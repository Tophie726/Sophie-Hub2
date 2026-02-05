'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { Building2, Plus, Database, ChevronRight, Loader2, Settings2, Activity, RefreshCw, FileSpreadsheet, MoreHorizontal, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ShimmerGrid } from '@/components/ui/shimmer-grid'
import { EntityListToolbar } from '@/components/entities/entity-list-toolbar'
import { StatusBadge, ComputedStatusBadge } from '@/components/entities/status-badge'
import { TierBadge } from '@/components/entities/tier-badge'
import { WeeklyStatusPreview } from '@/components/partners/weekly-status-preview'
import { WeeklyStatusDialog } from '@/components/partners/weekly-status-dialog'
import { HealthBarCompact } from '@/components/partners/health-bar-compact'
import { HealthHeatmap, clearHeatmapCache } from '@/components/partners/health-heatmap'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useDebounce } from '@/lib/hooks/use-debounce'

// Module-level cache for view state persistence
const viewCache = {
  showHeatmap: false,
}

// Extended partner type that includes source_data and computed status
interface Partner {
  id: string
  partner_code: string | null
  brand_name: string
  client_name: string | null
  client_email: string | null
  client_phone: string | null
  status: string | null  // Sheet-derived status
  tier: string | null
  parent_asin_count: number | null
  child_asin_count: number | null
  onboarding_date: string | null
  created_at: string
  updated_at: string | null
  pod_leader_name: string | null
  brand_manager_name: string | null
  sales_rep_name: string | null
  pod_leader?: { id: string; full_name: string } | null
  source_data?: Record<string, Record<string, Record<string, unknown>>> | null
  // Computed status fields from API
  computed_status?: string | null
  computed_status_label?: string
  computed_status_bucket?: string
  latest_weekly_status?: string | null
  status_matches?: boolean
  weeks_without_data?: number
  [key: string]: unknown // Allow dynamic field access
}

// Column definition for dynamic columns
interface ColumnDef {
  key: string
  label: string
  source: 'db' | 'source_data'
  sourceKey?: string // For source_data fields: "Seller Central Name"
  sourceType?: 'sheet' | 'computed' | 'both' // Where the data comes from
  sourceTab?: string // Tab name for source_data fields
  defaultVisible: boolean
  width?: string
  align?: 'left' | 'right'
  render?: (partner: Partner) => React.ReactNode
}

// Core database columns that always exist
const CORE_COLUMNS: ColumnDef[] = [
  {
    key: 'status',
    label: 'Status',
    source: 'db',
    sourceType: 'computed', // Computed from latest weekly status
    defaultVisible: true,
    width: 'w-28',
    render: (p) => (
      <ComputedStatusBadge
        computedStatus={p.computed_status ?? null}
        displayLabel={p.computed_status_label || (p.status ? p.status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'No Data')}
        sheetStatus={p.status}
        statusMatches={p.status_matches ?? true}
        latestWeeklyStatus={p.latest_weekly_status}
      />
    )
  },
  {
    key: 'weekly',
    label: 'Weekly',
    source: 'db',
    sourceType: 'sheet', // From source_data weekly columns
    defaultVisible: true,
    width: 'w-14',
    // Note: weekly column is handled specially in PartnerRow to support click handler
    render: (p) => <WeeklyStatusPreview sourceData={p.source_data} weeks={8} />
  },
  {
    key: 'tier',
    label: 'Tier',
    source: 'db',
    sourceType: 'sheet', // From sheet sync
    defaultVisible: true,
    width: 'w-20',
    render: (p) => <TierBadge tier={p.tier} />
  },
  { key: 'client_name', label: 'Client', source: 'db', sourceType: 'sheet', defaultVisible: true, width: 'w-32' },
  { key: 'client_email', label: 'Email', source: 'db', sourceType: 'sheet', defaultVisible: false, width: 'w-40' },
  { key: 'client_phone', label: 'Phone', source: 'db', sourceType: 'sheet', defaultVisible: false, width: 'w-28' },
  {
    key: 'pod_leader_name',
    label: 'Pod Leader',
    source: 'db',
    sourceType: 'sheet',
    defaultVisible: true,
    width: 'w-28',
    render: (p) => {
      if (p.pod_leader) {
        return <span className="text-foreground">{p.pod_leader.full_name}</span>
      }
      if (p.pod_leader_name) {
        return (
          <span className="text-muted-foreground flex items-center gap-1" title="Not linked to staff record">
            {p.pod_leader_name}
            <span className="text-[10px] text-amber-500">●</span>
          </span>
        )
      }
      return <span className="text-muted-foreground">--</span>
    }
  },
  { key: 'brand_manager_name', label: 'Brand Manager', source: 'db', sourceType: 'sheet', defaultVisible: false, width: 'w-28' },
  { key: 'sales_rep_name', label: 'Sales Rep', source: 'db', sourceType: 'sheet', defaultVisible: false, width: 'w-28' },
  {
    key: 'asin_count',
    label: 'ASINs',
    source: 'db',
    sourceType: 'sheet',
    defaultVisible: true,
    width: 'w-16',
    align: 'right',
    render: (p) => {
      const count = (p.parent_asin_count || 0) + (p.child_asin_count || 0)
      return <span className="tabular-nums">{count > 0 ? count : '--'}</span>
    }
  },
  {
    key: 'onboarding_date',
    label: 'Onboarded',
    source: 'db',
    sourceType: 'sheet',
    defaultVisible: false,
    width: 'w-28',
    align: 'right',
    render: (p) => p.onboarding_date ? format(parseISO(p.onboarding_date), 'MMM d, yyyy') : '--'
  },
  {
    key: 'updated_at',
    label: 'Last Synced',
    source: 'db',
    sourceType: 'computed',
    defaultVisible: false,
    width: 'w-28',
    align: 'right',
    render: (p) => p.updated_at ? format(parseISO(p.updated_at), 'MMM d, h:mm a') : '--'
  },
]

// Check if a column name is a weekly status column (e.g., "1/1/24\nWeek 1", "2/5/24\nWeek 6")
function isWeeklyColumn(columnName: string): boolean {
  // Pattern: date followed by "Week" and a number
  // Examples: "1/1/24\nWeek 1", "12/30/24\nWeek 53", "2/5/24 Week 6"
  const weeklyPattern = /\d{1,2}\/\d{1,2}\/\d{2,4}[\s\n]+Week\s*\d+/i
  return weeklyPattern.test(columnName)
}

// Extract unique source_data keys from partners (excluding weekly columns)
// Also captures the tab name for lineage display
function extractSourceDataColumns(partners: Partner[]): ColumnDef[] {
  // Map: sourceKey -> { label, tabName }
  const fieldSet = new Map<string, { label: string; tabName: string }>()

  for (const partner of partners) {
    if (!partner.source_data) continue

    // source_data structure: { gsheets: { "Tab Name": { "Column Name": value } } }
    for (const connector of Object.values(partner.source_data)) {
      if (typeof connector !== 'object' || !connector) continue
      for (const [tabName, tabData] of Object.entries(connector)) {
        if (typeof tabData !== 'object' || !tabData) continue
        for (const columnName of Object.keys(tabData as Record<string, unknown>)) {
          // Skip weekly status columns - they have their own display
          if (isWeeklyColumn(columnName)) continue

          // Skip if we already have a core column for this
          const normalizedKey = columnName.toLowerCase().replace(/[^a-z0-9]/g, '_')
          const existsAsCore = CORE_COLUMNS.some(c =>
            c.key === normalizedKey ||
            c.label.toLowerCase() === columnName.toLowerCase()
          )
          if (!existsAsCore && !fieldSet.has(columnName)) {
            fieldSet.set(columnName, { label: columnName, tabName })
          }
        }
      }
    }
  }

  // Convert to column definitions, sorted alphabetically
  return Array.from(fieldSet.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([sourceKey, { label, tabName }]) => ({
      key: `source_${sourceKey.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
      label,
      source: 'source_data' as const,
      sourceKey,
      sourceType: 'sheet' as const,
      sourceTab: tabName,
      defaultVisible: false,
      width: 'w-32',
    }))
}

// Get value from source_data
function getSourceDataValue(partner: Partner, sourceKey: string): string {
  if (!partner.source_data) return '--'

  for (const connector of Object.values(partner.source_data)) {
    if (typeof connector !== 'object' || !connector) continue
    for (const tabData of Object.values(connector)) {
      if (typeof tabData !== 'object' || !tabData) continue
      const value = (tabData as Record<string, unknown>)[sourceKey]
      if (value !== undefined && value !== null && value !== '') {
        return String(value)
      }
    }
  }
  return '--'
}

const statusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'paused', label: 'Paused' },
  { value: 'at_risk', label: 'At Risk' },
  { value: 'offboarding', label: 'Offboarding' },
  { value: 'churned', label: 'Churned' },
]

const sortOptions = [
  { value: 'brand_name', label: 'Brand Name' },
  { value: 'created_at', label: 'Date Added' },
  { value: 'onboarding_date', label: 'Onboarding Date' },
  { value: 'tier', label: 'Tier' },
]

// Column dropdown item with source indicator and lineage tooltip
function ColumnDropdownItem({
  col,
  isVisible,
  fieldLineage,
  onToggle,
}: {
  col: ColumnDef
  isVisible: boolean
  fieldLineage: Record<string, { sourceColumn: string; tabName: string; sheetName: string }>
  onToggle: () => void
}) {
  return (
    <DropdownMenuCheckboxItem
      checked={isVisible}
      onCheckedChange={onToggle}
      className="text-sm"
    >
      <span className="flex items-center justify-between w-full">
        <span className="truncate">{col.label}</span>
        {col.sourceType === 'computed' && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 ml-2 shrink-0 cursor-help">
                <Sparkles className="h-3 w-3" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="left" className="text-xs z-[100]">
              <div className="font-medium">Computed by App</div>
              <div className="text-muted-foreground">Calculated from source data</div>
            </TooltipContent>
          </Tooltip>
        )}
        {col.sourceType === 'sheet' && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-green-500/10 text-green-600 dark:text-green-400 ml-2 shrink-0 cursor-help">
                <FileSpreadsheet className="h-3 w-3" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="left" className="text-xs z-[100] max-w-xs">
              {col.key === 'weekly' ? (
                <div className="space-y-0.5">
                  <div className="font-medium">Weekly Status Columns</div>
                  <div className="text-muted-foreground">Pattern-matched from sheet</div>
                </div>
              ) : col.source === 'source_data' && col.sourceTab ? (
                // Source data columns have their lineage directly on the column def
                <div className="space-y-0.5">
                  <div className="font-medium">Google Sheet</div>
                  <div className="text-muted-foreground">
                    Tab: <span className="text-foreground">{col.sourceTab}</span>
                  </div>
                  <div className="text-muted-foreground">
                    Column: <span className="text-foreground">{col.sourceKey}</span>
                  </div>
                </div>
              ) : fieldLineage[col.key] ? (
                // Core columns lookup from field-lineage API
                <div className="space-y-0.5">
                  <div className="font-medium">{fieldLineage[col.key].sheetName}</div>
                  <div className="text-muted-foreground">
                    Tab: <span className="text-foreground">{fieldLineage[col.key].tabName}</span>
                  </div>
                  <div className="text-muted-foreground">
                    Column: <span className="text-foreground">{fieldLineage[col.key].sourceColumn}</span>
                  </div>
                </div>
              ) : (
                <div className="text-muted-foreground">Not mapped in Data Enrichment</div>
              )}
            </TooltipContent>
          </Tooltip>
        )}
      </span>
    </DropdownMenuCheckboxItem>
  )
}

function PartnerRow({ partner, columns, visibleColumns, onSync, onWeeklyClick }: {
  partner: Partner
  columns: ColumnDef[]
  visibleColumns: Set<string>
  onSync: (partnerId: string, brandName: string) => void
  onWeeklyClick: (partner: Partner) => void
}) {
  const [isSyncing, setIsSyncing] = useState(false)

  const handleSync = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsSyncing(true)
    await onSync(partner.id, partner.brand_name)
    setIsSyncing(false)
  }

  return (
    <div className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/30 transition-colors min-w-fit">
      {/* Brand name + code - clickable link */}
      <Link href={`/partners/${partner.id}`} className="flex-1 min-w-[180px] cursor-pointer">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate hover:underline">{partner.brand_name}</span>
          {partner.partner_code && (
            <span className="hidden sm:inline text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
              {partner.partner_code}
            </span>
          )}
        </div>
        {/* Mobile: show client name below brand */}
        <div className="md:hidden text-xs text-muted-foreground mt-0.5 truncate">
          {partner.client_name || 'No client contact'}
        </div>
      </Link>

      {/* Dynamic columns */}
      {columns.map(col => {
        if (!visibleColumns.has(col.key)) return null

        let content: React.ReactNode

        // Special handling for weekly column to add click handler
        if (col.key === 'weekly') {
          content = (
            <WeeklyStatusPreview
              sourceData={partner.source_data}
              weeks={8}
              onExpand={() => onWeeklyClick(partner)}
            />
          )
        } else if (col.render) {
          content = col.render(partner)
        } else if (col.source === 'source_data' && col.sourceKey) {
          content = getSourceDataValue(partner, col.sourceKey)
        } else {
          const value = partner[col.key]
          content = value !== null && value !== undefined && value !== '' ? String(value) : '--'
        }

        return (
          <div
            key={col.key}
            className={`${col.width || 'w-28'} hidden md:block text-sm ${col.align === 'right' ? 'text-right' : ''} text-muted-foreground shrink-0`}
          >
            {content}
          </div>
        )
      })}

      {/* Mobile status + chevron */}
      <Link href={`/partners/${partner.id}`} className="flex md:hidden items-center gap-2 shrink-0">
        <StatusBadge status={partner.status} entity="partners" />
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </Link>

      {/* Row actions dropdown */}
      <div className="hidden md:flex shrink-0 items-center">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:bg-muted">
              {isSyncing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <MoreHorizontal className="h-3.5 w-3.5" />
              )}
              <span className="sr-only">Row actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem asChild>
              <Link href={`/partners/${partner.id}`} className="cursor-pointer">
                <ChevronRight className="h-4 w-4 mr-2" />
                View Details
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSync} disabled={isSyncing}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Sync
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

export default function PartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)
  const [isFiltering, setIsFiltering] = useState(false) // Subtle indicator for filter changes
  const [isRefreshing, setIsRefreshing] = useState(false) // For manual refresh
  const [loadingMore, setLoadingMore] = useState(false)
  const initialLoadDone = useRef(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string[]>(['active']) // Default to Active partners
  const [showHeatmap, setShowHeatmapState] = useState(() => viewCache.showHeatmap)

  // Wrapper to persist heatmap toggle to cache
  const setShowHeatmap = useCallback((value: boolean | ((prev: boolean) => boolean)) => {
    setShowHeatmapState(prev => {
      const newValue = typeof value === 'function' ? value(prev) : value
      viewCache.showHeatmap = newValue
      return newValue
    })
  }, [])
  const [sort, setSort] = useState('brand_name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(
    () => new Set(CORE_COLUMNS.filter(c => c.defaultVisible).map(c => c.key))
  )

  // Weekly status dialog state
  const [weeklyDialogPartner, setWeeklyDialogPartner] = useState<Partner | null>(null)

  // Field lineage info for tooltips (which sheet/tab/column each field came from)
  const [fieldLineage, setFieldLineage] = useState<Record<string, {
    sourceColumn: string
    tabName: string
    sheetName: string
  }>>({})

  const debouncedSearch = useDebounce(search, 300)

  // Discover additional columns from source_data
  const sourceDataColumns = useMemo(() => extractSourceDataColumns(partners), [partners])

  // All available columns
  const allColumns = useMemo(() => [...CORE_COLUMNS, ...sourceDataColumns], [sourceDataColumns])

  // Column order state - preserves user's ordering preference
  const [columnOrder, setColumnOrder] = useState<string[]>(() => allColumns.map(c => c.key))

  // Update column order when new columns are discovered
  useEffect(() => {
    setColumnOrder(prev => {
      const newKeys = allColumns.map(c => c.key)
      const existingKeys = new Set(prev)
      // Add any new columns that weren't in the previous order
      const addedKeys = newKeys.filter(k => !existingKeys.has(k))
      // Remove any columns that no longer exist
      const filteredPrev = prev.filter(k => newKeys.includes(k))
      return [...filteredPrev, ...addedKeys]
    })
  }, [allColumns])

  // Ordered columns for rendering - follows columnOrder
  const orderedColumns = useMemo(() => {
    const colMap = new Map(allColumns.map(c => [c.key, c]))
    return columnOrder
      .map(key => colMap.get(key))
      .filter((c): c is ColumnDef => c !== undefined)
  }, [allColumns, columnOrder])

  // Columns ordered for the dropdown: visible first, then hidden
  const dropdownOrderedColumns = useMemo(() => {
    const visible = orderedColumns.filter(c => visibleColumns.has(c.key))
    const hidden = orderedColumns.filter(c => !visibleColumns.has(c.key))
    return { visible, hidden }
  }, [orderedColumns, visibleColumns])

  const toggleColumn = (key: string) => {
    setVisibleColumns(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  // Move column in the order (for drag-and-drop) - reserved for future use
  const _moveColumn = (fromIndex: number, toIndex: number) => {
    setColumnOrder(prev => {
      const next = [...prev]
      const [moved] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, moved)
      return next
    })
  }
  void _moveColumn // silence unused warning

  const fetchPartners = useCallback(async (append = false, currentOffset = 0) => {
    if (append) {
      setLoadingMore(true)
    } else if (!initialLoadDone.current) {
      // Only show full shimmer on initial load
      setLoading(true)
    } else {
      // On filter changes, show subtle indicator but keep current data visible
      setIsFiltering(true)
    }

    try {
      const params = new URLSearchParams()
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (statusFilter.length) params.set('status', statusFilter.join(','))
      params.set('sort', sort)
      params.set('order', sortOrder)
      params.set('limit', '50')
      params.set('offset', String(append ? currentOffset : 0))

      const res = await fetch(`/api/partners?${params}`)
      const json = await res.json()
      const data = json.data

      if (data) {
        if (append) {
          setPartners(prev => [...prev, ...data.partners])
        } else {
          setPartners(data.partners)
        }
        setTotal(data.total)
        setHasMore(data.has_more)
        initialLoadDone.current = true
      }
    } catch (error) {
      console.error('Failed to fetch partners:', error)
    } finally {
      setLoading(false)
      setLoadingMore(false)
      setIsFiltering(false)
    }
  }, [debouncedSearch, statusFilter, sort, sortOrder])

  // Fetch on filter/search/sort change
  useEffect(() => {
    fetchPartners(false)
  }, [fetchPartners])

  // Fetch field lineage info (which sheet/tab/column each field came from)
  useEffect(() => {
    async function fetchFieldLineage() {
      try {
        const res = await fetch('/api/partners/field-lineage')
        const json = await res.json()
        if (json.data?.lineage) {
          setFieldLineage(json.data.lineage)
        }
      } catch (error) {
        console.error('Failed to fetch field lineage:', error)
      }
    }
    fetchFieldLineage()
  }, [])

  const handleLoadMore = () => {
    fetchPartners(true, partners.length)
  }

  // Manual refresh - clears cache and re-fetches
  const handleRefresh = async () => {
    setIsRefreshing(true)
    // Clear the heatmap cache
    clearHeatmapCache()
    await fetchPartners(false)
    setIsRefreshing(false)
  }

  // Sync a single partner from Google Sheet
  const handleSyncPartner = async (partnerId: string, brandName: string) => {
    try {
      const res = await fetch(`/api/partners/${partnerId}/sync`, { method: 'POST' })
      const json = await res.json()

      if (!res.ok) {
        toast.error(json.error?.message || 'Sync failed')
        return
      }

      const data = json.data
      if (data?.synced) {
        toast.success(`${brandName} synced from sheet`)
        // Update the partner in our local state with fresh data
        await fetchPartners(false)
      } else {
        toast.warning(data?.message || 'Partner not found in source sheet')
      }
    } catch (err) {
      console.error('Sync failed:', err)
      toast.error('Failed to sync partner')
    }
  }

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Partners"
        description={total > 0 ? `${total} partner brands` : 'View and manage all partner brands'}
      >
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing || loading}
            className="h-8 w-8 p-0"
            title="Refresh partner data"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            variant={showHeatmap ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowHeatmap(!showHeatmap)}
            className="gap-1.5"
          >
            <Activity className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{showHeatmap ? 'Show List' : 'Health Overview'}</span>
          </Button>
          <HealthBarCompact />
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add Partner</span>
          </Button>
        </div>
      </PageHeader>

      <EntityListToolbar
        search={search}
        onSearchChange={setSearch}
        statusOptions={statusOptions}
        selectedStatuses={statusFilter}
        onStatusChange={setStatusFilter}
        sortOptions={sortOptions}
        currentSort={sort}
        sortOrder={sortOrder}
        onSortChange={(s, o) => { setSort(s); setSortOrder(o) }}
        resultCount={partners.length}
        totalCount={total}
        placeholder="Search brand, client, or code..."
      />

      <div className="p-6 md:p-8">
        {/* Heatmap View */}
        {showHeatmap ? (
          <HealthHeatmap
            statusFilter={statusFilter}
            search={debouncedSearch}
          />
        ) : loading ? (
          <div className="rounded-xl border bg-card p-1">
            <ShimmerGrid variant="table" rows={10} columns={6} />
          </div>
        ) : partners.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500/10 mb-6">
                <Building2 className="h-8 w-8 text-blue-500" />
              </div>
              <h2 className="text-xl font-semibold mb-2">
                {debouncedSearch || statusFilter.length > 0
                  ? 'No partners match your filters'
                  : 'No partners yet'}
              </h2>
              <p className="text-muted-foreground text-center max-w-md mb-6">
                {debouncedSearch || statusFilter.length > 0
                  ? 'Try adjusting your search or filters to find what you\'re looking for.'
                  : 'Partners will appear here as you map fields through Data Enrichment. Connect a Google Sheet, map your columns, and sync — data flows in automatically.'}
              </p>
              {!debouncedSearch && statusFilter.length === 0 && (
                <Link href="/admin/data-enrichment">
                  <Button className="gap-2">
                    <Database className="h-4 w-4" />
                    Set Up Data Enrichment
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            <div className={`rounded-xl border bg-card transition-opacity duration-150 ${isFiltering ? 'opacity-60' : ''}`}>
              {/* Horizontal scroll wrapper for table content */}
              <div className="overflow-x-auto">
                {/* Sticky header row — sticks below the toolbar */}
                <div className="sticky top-[113px] z-20 bg-card border-b border-border/60 rounded-t-xl min-w-fit">
                  <div className="hidden md:flex items-center gap-4 px-5 py-2.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    <div className="flex-1 min-w-[180px]">Brand</div>
                    {orderedColumns.map(col => {
                      if (!visibleColumns.has(col.key)) return null
                      return (
                        <div
                          key={col.key}
                          className={`${col.width || 'w-28'} shrink-0 ${col.align === 'right' ? 'text-right' : ''}`}
                        >
                          {col.label}
                        </div>
                      )
                    })}
                    {/* Column visibility toggle */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-muted shrink-0">
                          <Settings2 className="h-3.5 w-3.5" />
                          <span className="sr-only">Toggle columns</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-72 max-h-[400px] overflow-y-auto z-50">
                        <TooltipProvider delayDuration={400}>
                          {/* Visible columns section */}
                          {dropdownOrderedColumns.visible.length > 0 && (
                            <>
                              <DropdownMenuLabel className="text-xs flex items-center justify-between">
                                <span>Visible Columns ({dropdownOrderedColumns.visible.length})</span>
                              </DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              {dropdownOrderedColumns.visible.map(col => (
                                <ColumnDropdownItem
                                  key={col.key}
                                  col={col}
                                  isVisible={true}
                                  fieldLineage={fieldLineage}
                                  onToggle={() => toggleColumn(col.key)}
                                />
                              ))}
                            </>
                          )}

                          {/* Hidden columns section */}
                          {dropdownOrderedColumns.hidden.length > 0 && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuLabel className="text-xs">
                                Hidden Columns ({dropdownOrderedColumns.hidden.length})
                              </DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              {dropdownOrderedColumns.hidden.map(col => (
                                <ColumnDropdownItem
                                  key={col.key}
                                  col={col}
                                  isVisible={false}
                                  fieldLineage={fieldLineage}
                                  onToggle={() => toggleColumn(col.key)}
                                />
                              ))}
                            </>
                          )}
                        </TooltipProvider>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                <div className="divide-y divide-border/60 rounded-b-xl overflow-hidden min-w-fit">
                  {partners.map(partner => (
                    <PartnerRow
                      key={partner.id}
                      partner={partner}
                      columns={orderedColumns}
                      visibleColumns={visibleColumns}
                      onSync={handleSyncPartner}
                      onWeeklyClick={setWeeklyDialogPartner}
                    />
                  ))}
                </div>
              </div>
            </div>

            {hasMore && (
              <div className="flex justify-center mt-6">
                <Button
                  variant="outline"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="gap-2"
                >
                  {loadingMore ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  Load More
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Weekly Status Dialog */}
      <WeeklyStatusDialog
        open={weeklyDialogPartner !== null}
        onOpenChange={(open) => !open && setWeeklyDialogPartner(null)}
        partnerId={weeklyDialogPartner?.id ?? ''}
        partnerName={weeklyDialogPartner?.brand_name ?? ''}
        sourceData={weeklyDialogPartner?.source_data}
      />
    </div>
  )
}
