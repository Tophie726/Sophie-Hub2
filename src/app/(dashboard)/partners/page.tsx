'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { Building2, Plus, Database, ChevronRight, ChevronUp, ChevronDown, Loader2, Settings2, Activity, RefreshCw, FileSpreadsheet, MoreHorizontal, Sparkles } from 'lucide-react'
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
import { StatusInvestigationDialog } from '@/components/partners/status-investigation-dialog'
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


// Column definition extended with sortable flag
interface ColumnDef {
  key: string
  label: string
  source: 'db' | 'source_data'
  sourceKey?: string // For source_data fields: "Seller Central Name"
  sourceType?: 'sheet' | 'computed' | 'both' // Where the data comes from
  sourceTab?: string // Tab name for source_data fields
  defaultVisible: boolean
  minWidth?: number // Minimum width in pixels
  flex?: number // Flex grow factor (default 1)
  align?: 'left' | 'right'
  sortable?: boolean // Can click header to sort
  sortKey?: string // API sort key if different from column key
  render?: (partner: Partner) => React.ReactNode
}

// Core database columns that always exist
const CORE_COLUMNS: ColumnDef[] = [
  {
    key: 'partner_code',
    label: 'Code',
    source: 'db',
    sourceType: 'sheet',
    defaultVisible: false,
    minWidth: 90,
    flex: 0,
    sortable: true,
    render: (p) => p.partner_code ? (
      <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono">
        {p.partner_code}
      </span>
    ) : <span className="text-muted-foreground">--</span>
  },
  {
    key: 'status',
    label: 'Status',
    source: 'db',
    sourceType: 'computed', // Computed from latest weekly status
    defaultVisible: true,
    minWidth: 120,
    flex: 0,
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
    minWidth: 70,
    flex: 0,
    // Note: weekly column is handled specially in PartnerRow to support click handler
    render: (p) => <WeeklyStatusPreview sourceData={p.source_data} weeks={8} />
  },
  {
    key: 'tier',
    label: 'Tier',
    source: 'db',
    sourceType: 'sheet', // From sheet sync
    defaultVisible: true,
    minWidth: 70,
    flex: 0,
    sortable: true,
    render: (p) => <TierBadge tier={p.tier} />
  },
  { key: 'client_name', label: 'Client', source: 'db', sourceType: 'sheet', defaultVisible: true, minWidth: 120, flex: 1, sortable: true },
  { key: 'client_email', label: 'Email', source: 'db', sourceType: 'sheet', defaultVisible: false, minWidth: 160, flex: 1 },
  { key: 'client_phone', label: 'Phone', source: 'db', sourceType: 'sheet', defaultVisible: false, minWidth: 110, flex: 0 },
  {
    key: 'pod_leader_name',
    label: 'Pod Leader',
    source: 'db',
    sourceType: 'sheet',
    defaultVisible: true,
    minWidth: 110,
    flex: 1,
    sortable: true,
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
  { key: 'brand_manager_name', label: 'Brand Manager', source: 'db', sourceType: 'sheet', defaultVisible: false, minWidth: 110, flex: 1 },
  { key: 'sales_rep_name', label: 'Sales Rep', source: 'db', sourceType: 'sheet', defaultVisible: false, minWidth: 110, flex: 1 },
  {
    key: 'asin_count',
    label: 'ASINs',
    source: 'db',
    sourceType: 'sheet',
    defaultVisible: false,
    minWidth: 70,
    flex: 0,
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
    minWidth: 100,
    flex: 0,
    align: 'right',
    sortable: true,
    sortKey: 'onboarding_date',
    render: (p) => p.onboarding_date ? format(parseISO(p.onboarding_date), 'MMM d, yyyy') : '--'
  },
  {
    key: 'updated_at',
    label: 'Last Synced',
    source: 'db',
    sourceType: 'computed',
    defaultVisible: false,
    minWidth: 120,
    flex: 0,
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
      minWidth: 120,
      flex: 1,
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

// Column dropdown item - clean, minimal design with hover-reveal reorder
function ColumnDropdownItem({
  col,
  isVisible,
  onToggle,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: {
  col: ColumnDef
  isVisible: boolean
  fieldLineage: Record<string, { sourceColumn: string; tabName: string; sheetName: string }>
  onToggle: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  canMoveUp?: boolean
  canMoveDown?: boolean
}) {
  return (
    <div className="group flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-muted/50 rounded-md transition-colors">
      {/* Reorder buttons - visible on hover */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); onMoveUp?.() }}
          disabled={!canMoveUp}
          className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed rounded hover:bg-muted"
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onMoveDown?.() }}
          disabled={!canMoveDown}
          className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed rounded hover:bg-muted"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Checkbox + Label */}
      <label className="flex items-center gap-2.5 flex-1 cursor-pointer select-none">
        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
          isVisible
            ? 'bg-primary border-primary text-primary-foreground'
            : 'border-muted-foreground/30 hover:border-muted-foreground/50'
        }`}>
          {isVisible && (
            <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
              <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </div>
        <input type="checkbox" checked={isVisible} onChange={onToggle} className="sr-only" />
        <span className={`truncate ${isVisible ? 'text-foreground' : 'text-muted-foreground'}`}>
          {col.label}
        </span>
      </label>

      {/* Source indicator - subtle */}
      {col.sourceType === 'computed' && (
        <span className="text-purple-500/60 shrink-0" title="Computed">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
      )}
      {col.sourceType === 'sheet' && (
        <span className="text-green-500/60 shrink-0" title="From Sheet">
          <FileSpreadsheet className="h-3.5 w-3.5" />
        </span>
      )}
    </div>
  )
}

function PartnerRow({ partner, columns, visibleColumns, onSync, onWeeklyClick, onStatusClick }: {
  partner: Partner
  columns: ColumnDef[]
  visibleColumns: Set<string>
  onSync: (partnerId: string, brandName: string) => void
  onWeeklyClick: (partner: Partner) => void
  onStatusClick: (partner: Partner) => void
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
    <div className="flex items-center py-3.5 hover:bg-orange-500/5 dark:hover:bg-orange-500/10 transition-colors group">
      {/* Brand name - sticky left, clickable link */}
      <Link
        href={`/partners/${partner.id}`}
        className="sticky left-0 z-10 bg-card group-hover:bg-orange-500/5 dark:group-hover:bg-orange-500/10 pl-5 pr-4 shrink-0 cursor-pointer transition-colors shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]"
        style={{ width: 180, minWidth: 180 }}
      >
        <span className="font-medium text-sm truncate block hover:underline hover:text-orange-600 dark:hover:text-orange-400 transition-colors">
          {partner.brand_name}
        </span>
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
        } else if (col.key === 'status') {
          // Special handling for status column to add investigation click handler
          content = (
            <ComputedStatusBadge
              computedStatus={partner.computed_status ?? null}
              displayLabel={partner.computed_status_label || (partner.status ? partner.status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'No Data')}
              sheetStatus={partner.status}
              statusMatches={partner.status_matches ?? true}
              latestWeeklyStatus={partner.latest_weekly_status}
              onClick={() => onStatusClick(partner)}
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

        const colStyle: React.CSSProperties = {
          minWidth: col.minWidth || 100,
          flex: col.flex ?? 1,
        }

        return (
          <div
            key={col.key}
            className={`hidden md:block text-sm ${col.align === 'right' ? 'text-right' : ''} text-muted-foreground truncate px-2`}
            style={colStyle}
          >
            {content}
          </div>
        )
      })}

      {/* Mobile status + chevron */}
      <Link href={`/partners/${partner.id}`} className="flex md:hidden items-center gap-2 shrink-0 pr-4">
        <StatusBadge status={partner.status} entity="partners" />
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </Link>

      {/* Row actions dropdown */}
      <div className="hidden md:flex shrink-0 items-center px-3">
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

// localStorage keys for persisting column preferences
const VISIBLE_COLUMNS_STORAGE_KEY = 'partners-visible-columns'
const COLUMN_ORDER_STORAGE_KEY = 'partners-column-order'

export default function PartnersPage() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)
  const [isFiltering, setIsFiltering] = useState(false) // Subtle indicator for filter changes
  const [isRefreshing, setIsRefreshing] = useState(false) // For manual refresh
  const [loadingMore, setLoadingMore] = useState(false)
  const initialLoadDone = useRef(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string[]>(['active']) // Default to Active partners

  // Read heatmap view from URL params - clicking Partners nav resets to list view
  const showHeatmap = searchParams.get('view') === 'heatmap'

  // Toggle heatmap via URL params
  const setShowHeatmap = useCallback((value: boolean | ((prev: boolean) => boolean)) => {
    const newValue = typeof value === 'function' ? value(showHeatmap) : value
    if (newValue) {
      router.push('/partners?view=heatmap', { scroll: false })
    } else {
      router.push('/partners', { scroll: false })
    }
  }, [router, showHeatmap])
  const [sort, setSort] = useState('brand_name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => {
    // Try to restore from localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(VISIBLE_COLUMNS_STORAGE_KEY)
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as string[]
          if (Array.isArray(parsed) && parsed.length > 0) {
            return new Set(parsed)
          }
        } catch {
          // Invalid JSON, use defaults
        }
      }
    }
    // Fall back to defaults
    return new Set(CORE_COLUMNS.filter(c => c.defaultVisible).map(c => c.key))
  })

  // Weekly status dialog state
  const [weeklyDialogPartner, setWeeklyDialogPartner] = useState<Partner | null>(null)

  // Status investigation dialog state
  const [investigationDialogPartner, setInvestigationDialogPartner] = useState<Partner | null>(null)

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
  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    // Try to restore from localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(COLUMN_ORDER_STORAGE_KEY)
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as string[]
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed
          }
        } catch {
          // Invalid JSON, use defaults
        }
      }
    }
    return allColumns.map(c => c.key)
  })

  // Persist visible columns to localStorage
  useEffect(() => {
    localStorage.setItem(VISIBLE_COLUMNS_STORAGE_KEY, JSON.stringify(Array.from(visibleColumns)))
  }, [visibleColumns])

  // Persist column order to localStorage
  useEffect(() => {
    localStorage.setItem(COLUMN_ORDER_STORAGE_KEY, JSON.stringify(columnOrder))
  }, [columnOrder])

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

  // Move column in the order
  const moveColumn = (fromIndex: number, toIndex: number) => {
    setColumnOrder(prev => {
      const next = [...prev]
      const [moved] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, moved)
      return next
    })
  }

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
  const fetchFieldLineage = useCallback(async () => {
    try {
      // Add cache buster to force fresh data
      const res = await fetch(`/api/partners/field-lineage?_=${Date.now()}`)
      const json = await res.json()
      if (json.data?.lineage) {
        // Debug: log first lineage entry
        const firstKey = Object.keys(json.data.lineage)[0]
        if (firstKey) {
          console.log('Frontend received lineage for', firstKey, ':', json.data.lineage[firstKey])
        }
        setFieldLineage(json.data.lineage)
      }
    } catch (error) {
      console.error('Failed to fetch field lineage:', error)
    }
  }, [])

  useEffect(() => {
    fetchFieldLineage()
  }, [fetchFieldLineage])

  const handleLoadMore = () => {
    fetchPartners(true, partners.length)
  }

  // Manual refresh - clears cache and re-fetches
  const handleRefresh = async () => {
    setIsRefreshing(true)
    // Clear the heatmap cache
    clearHeatmapCache()
    await Promise.all([
      fetchPartners(false),
      fetchFieldLineage(),
    ])
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
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="p-3">
              <ShimmerGrid variant="table" rows={8} columns={6} />
            </div>
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
              {/* Sticky header - outside scroll container for proper vertical sticky */}
              <div className="sticky top-[113px] z-20 bg-card border-b border-border/60 rounded-t-xl overflow-hidden">
                <div
                  className="overflow-x-auto scrollbar-hide"
                  onScroll={(e) => {
                    // Sync scroll with content
                    const content = e.currentTarget.parentElement?.nextElementSibling?.querySelector('.overflow-x-auto')
                    if (content) content.scrollLeft = e.currentTarget.scrollLeft
                  }}
                >
                  <div className="hidden md:flex items-center py-2.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    {/* Brand header - sticky left, sortable */}
                    <button
                      onClick={() => {
                        if (sort === 'brand_name') {
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
                        } else {
                          setSort('brand_name')
                          setSortOrder('asc')
                        }
                      }}
                      className="sticky left-0 z-10 bg-card pl-5 pr-4 shrink-0 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)] flex items-center gap-1 hover:text-foreground transition-colors"
                      style={{ width: 180, minWidth: 180 }}
                    >
                      Brand
                      {sort === 'brand_name' && (
                        sortOrder === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                      )}
                    </button>
                    {orderedColumns.map(col => {
                      if (!visibleColumns.has(col.key)) return null

                      const isSorted = sort === (col.sortKey || col.key)
                      const colStyle: React.CSSProperties = {
                        minWidth: col.minWidth || 100,
                        flex: col.flex ?? 1,
                      }

                      if (col.sortable) {
                        return (
                          <button
                            key={col.key}
                            onClick={() => {
                              const sortKey = col.sortKey || col.key
                              if (sort === sortKey) {
                                setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
                              } else {
                                setSort(sortKey)
                                setSortOrder('asc')
                              }
                            }}
                            className={`flex items-center gap-1 hover:text-foreground transition-colors px-2 ${col.align === 'right' ? 'justify-end' : ''}`}
                            style={colStyle}
                          >
                            {col.label}
                            {isSorted && (
                              sortOrder === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                            )}
                          </button>
                        )
                      }

                      return (
                        <div
                          key={col.key}
                          className={`px-2 ${col.align === 'right' ? 'text-right' : ''}`}
                          style={colStyle}
                        >
                          {col.label}
                        </div>
                      )
                    })}
                    {/* Column visibility toggle */}
                    <div className="shrink-0 px-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-muted">
                            <Settings2 className="h-3.5 w-3.5" />
                            <span className="sr-only">Toggle columns</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-64 max-h-[420px] overflow-y-auto z-50 p-1.5">
                          {/* Column list */}
                          <div className="space-y-0.5">
                            {orderedColumns.map((col) => {
                              const orderIndex = columnOrder.indexOf(col.key)
                              return (
                                <ColumnDropdownItem
                                  key={col.key}
                                  col={col}
                                  isVisible={visibleColumns.has(col.key)}
                                  fieldLineage={fieldLineage}
                                  onToggle={() => toggleColumn(col.key)}
                                  onMoveUp={() => moveColumn(orderIndex, orderIndex - 1)}
                                  onMoveDown={() => moveColumn(orderIndex, orderIndex + 1)}
                                  canMoveUp={orderIndex > 0}
                                  canMoveDown={orderIndex < columnOrder.length - 1}
                                />
                              )
                            })}
                          </div>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              </div>
              {/* Table content - separate scroll container synced with header */}
              <div
                className="overflow-x-auto"
                onScroll={(e) => {
                  // Sync scroll with header
                  const header = e.currentTarget.parentElement?.querySelector('.sticky .overflow-x-auto')
                  if (header) header.scrollLeft = e.currentTarget.scrollLeft
                }}
              >
                <div className="divide-y divide-border/60 rounded-b-xl min-w-fit">
                  {partners.map(partner => (
                    <PartnerRow
                      key={partner.id}
                      partner={partner}
                      columns={orderedColumns}
                      visibleColumns={visibleColumns}
                      onSync={handleSyncPartner}
                      onWeeklyClick={setWeeklyDialogPartner}
                      onStatusClick={setInvestigationDialogPartner}
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

      {/* Status Investigation Dialog */}
      <StatusInvestigationDialog
        open={investigationDialogPartner !== null}
        onOpenChange={(open) => !open && setInvestigationDialogPartner(null)}
        partner={investigationDialogPartner}
      />
    </div>
  )
}
