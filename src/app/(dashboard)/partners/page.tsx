'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { Building2, Plus, Database, ChevronRight, ChevronLeft, ChevronUp, ChevronDown, Loader2, Settings2, Activity, RefreshCw, FileSpreadsheet, MoreHorizontal, Sparkles, GripVertical, Filter, X } from 'lucide-react'
import { Reorder, useDragControls } from 'framer-motion'
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
import { AddPartnerDialog } from '@/components/partners/add-partner-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useDebounce } from '@/lib/hooks/use-debounce'
import { usePartnerSearch } from '@/lib/hooks/use-partner-search'


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
  sales_rep?: { id: string; full_name: string } | null
  source_data?: Record<string, Record<string, Record<string, unknown>>> | null
  // Computed status fields from API
  computed_status?: string | null
  computed_status_label?: string
  computed_status_bucket?: string
  latest_weekly_status?: string | null
  status_matches?: boolean
  weeks_without_data?: number
  // BigQuery mapping
  has_bigquery?: boolean
  bigquery_client_name?: string | null
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
  filterable?: boolean // Can filter by column values
  filterType?: 'boolean' | 'enum' | 'text' // How to render filter UI
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
    minWidth: 160,
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
    filterable: true,
    filterType: 'enum',
    render: (p) => <TierBadge tier={p.tier} />
  },
  {
    key: 'has_bigquery',
    label: 'BigQuery',
    source: 'db',
    sourceType: 'computed',
    defaultVisible: true,
    minWidth: 90,
    flex: 0,
    filterable: true,
    filterType: 'boolean',
    render: (p) => p.has_bigquery ? (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 bg-green-500/10 px-2 py-0.5 rounded-full">
        <Database className="h-3 w-3" />
        Connected
      </span>
    ) : (
      <span className="text-muted-foreground/40 text-xs">--</span>
    )
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
    filterable: true,
    filterType: 'text',
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
  {
    key: 'sales_rep_name',
    label: 'Sales Rep',
    source: 'db',
    sourceType: 'sheet',
    defaultVisible: false,
    minWidth: 110,
    flex: 1,
    sortable: true,
    filterable: true,
    filterType: 'text',
    render: (p) => {
      if (p.sales_rep) {
        return <span className="text-foreground">{p.sales_rep.full_name}</span>
      }
      if (p.sales_rep_name) {
        return (
          <span className="text-muted-foreground flex items-center gap-1" title="Not linked to staff record">
            {p.sales_rep_name}
            <span className="text-[10px] text-amber-500">●</span>
          </span>
        )
      }
      return <span className="text-muted-foreground">--</span>
    }
  },
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
  { value: 'onboarding_date', label: 'Newest First', defaultOrder: 'desc' as const },
  { value: 'brand_name', label: 'Brand Name (A-Z)', defaultOrder: 'asc' as const },
  { value: 'tier', label: 'Tier', defaultOrder: 'asc' as const },
  { value: 'created_at', label: 'Date Added', defaultOrder: 'desc' as const },
]

// Draggable column item with grip handle
function DraggableColumnItem({
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
  const dragControls = useDragControls()
  const lineage = fieldLineage[col.key]

  return (
    <Reorder.Item
      value={col.key}
      dragListener={false}
      dragControls={dragControls}
      className="flex items-center gap-1.5 px-1 py-1.5 text-sm bg-card rounded-md select-none"
      whileDrag={{
        scale: 1.02,
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        zIndex: 50,
      }}
      transition={{ duration: 0.15 }}
    >
      {/* Drag handle */}
      <div
        onPointerDown={(e) => dragControls.start(e)}
        className="cursor-grab active:cursor-grabbing p-0.5 text-muted-foreground/40 hover:text-muted-foreground touch-none"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </div>

      {/* Checkbox + Label */}
      <label className="flex items-center gap-2 flex-1 cursor-pointer">
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

      {/* Source indicator with tooltip */}
      {col.sourceType === 'computed' && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-purple-500/70 shrink-0 cursor-help">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
          </TooltipTrigger>
          <TooltipContent side="left" className="text-xs max-w-[200px]">
            <div className="font-medium">Computed by App</div>
            <div className="text-muted-foreground">Calculated from source data</div>
          </TooltipContent>
        </Tooltip>
      )}
      {col.sourceType === 'sheet' && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-green-500/70 shrink-0 cursor-help">
              <FileSpreadsheet className="h-3.5 w-3.5" />
            </span>
          </TooltipTrigger>
          <TooltipContent side="left" className="text-xs max-w-[220px]">
            {col.key === 'weekly' ? (
              <div className="space-y-0.5">
                <div className="font-medium">Weekly Status Columns</div>
                <div className="text-muted-foreground">Pattern-matched from sheet</div>
              </div>
            ) : col.source === 'source_data' && col.sourceTab ? (
              <div className="space-y-0.5">
                <div className="font-medium">From Google Sheet</div>
                <div className="text-muted-foreground">
                  Tab: <span className="text-foreground">{col.sourceTab}</span>
                </div>
                <div className="text-muted-foreground">
                  Column: <span className="text-foreground">{col.sourceKey}</span>
                </div>
              </div>
            ) : lineage ? (
              <div className="space-y-0.5">
                <div className="font-medium">{lineage.sheetName || 'Google Sheet'}</div>
                {lineage.tabName ? (
                  <div className="text-muted-foreground">
                    Tab: <span className="text-foreground">{lineage.tabName}</span>
                  </div>
                ) : (
                  <div className="text-amber-500 text-[10px]">Tab info missing</div>
                )}
                {lineage.sourceColumn ? (
                  <div className="text-muted-foreground">
                    Column: <span className="text-foreground">{lineage.sourceColumn}</span>
                  </div>
                ) : (
                  <div className="text-amber-500 text-[10px]">Column info missing</div>
                )}
              </div>
            ) : (
              <div className="text-muted-foreground">From connected sheet</div>
            )}
          </TooltipContent>
        </Tooltip>
      )}
    </Reorder.Item>
  )
}

// Column filter popover - Google Sheets-style filter for column headers
function ColumnFilterPopover({
  col,
  partners,
  activeFilters,
  onFilterChange,
}: {
  col: ColumnDef
  partners: Partner[]
  activeFilters: string[]
  onFilterChange: (values: string[]) => void
}) {
  const [filterSearch, setFilterSearch] = useState('')

  // Compute unique values for this column
  const uniqueValues = useMemo(() => {
    if (col.key === 'has_bigquery') {
      return ['Connected', 'Not Connected']
    }

    const valSet = new Set<string>()
    for (const p of partners) {
      const raw = p[col.key]
      const val = raw !== null && raw !== undefined && raw !== '' ? String(raw) : '--'
      valSet.add(val)
    }

    // Sort: real values first (alphabetically), then '--' at the end
    return Array.from(valSet).sort((a, b) => {
      if (a === '--') return 1
      if (b === '--') return 0
      return a.localeCompare(b)
    })
  }, [col.key, partners])

  const filteredValues = useMemo(() => {
    if (!filterSearch) return uniqueValues
    const q = filterSearch.toLowerCase()
    return uniqueValues.filter(v => v.toLowerCase().includes(q))
  }, [uniqueValues, filterSearch])

  const isActive = activeFilters.length > 0
  const allSelected = activeFilters.length === 0

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={`ml-1 p-0.5 rounded hover:bg-muted transition-colors ${isActive ? 'text-primary' : 'text-muted-foreground/40 hover:text-muted-foreground'}`}
          onClick={(e) => e.stopPropagation()}
        >
          <Filter className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-52 p-2"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search for columns with many values */}
        {uniqueValues.length > 6 && (
          <input
            type="text"
            placeholder="Search..."
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
            className="w-full h-7 px-2 text-xs border rounded mb-2 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
          />
        )}

        {/* Quick actions */}
        <div className="flex items-center gap-2 mb-1.5">
          <button
            className="text-[11px] text-muted-foreground hover:text-foreground"
            onClick={() => onFilterChange([])}
          >
            Show All
          </button>
          {!allSelected && (
            <button
              className="text-[11px] text-primary hover:text-primary/80"
              onClick={() => onFilterChange([])}
            >
              Clear Filter
            </button>
          )}
        </div>

        {/* Value list */}
        <div className="max-h-[200px] overflow-y-auto space-y-0.5">
          {filteredValues.map(val => {
            const isChecked = allSelected || activeFilters.includes(val)
            return (
              <label
                key={val}
                className="flex items-center gap-2 py-1 px-1 rounded hover:bg-muted cursor-pointer text-xs"
                onClick={(e) => {
                  e.preventDefault()
                  if (allSelected) {
                    // Transition from "show all" to "show only this one"
                    onFilterChange([val])
                  } else if (activeFilters.includes(val)) {
                    // Uncheck this value
                    const next = activeFilters.filter(v => v !== val)
                    onFilterChange(next) // Empty array = show all
                  } else {
                    // Check this value
                    onFilterChange([...activeFilters, val])
                  }
                }}
              >
                <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${
                  isChecked
                    ? 'bg-primary border-primary text-primary-foreground'
                    : 'border-muted-foreground/30'
                }`}>
                  {isChecked && (
                    <svg className="w-2.5 h-2.5" viewBox="0 0 12 12" fill="none">
                      <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <span className="truncate">{val}</span>
              </label>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
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
    <div className="flex items-center py-3.5 hover:bg-muted/30 transition-colors group min-w-max">
      {/* Brand name - sticky left, clickable link */}
      <Link
        href={`/partners/${partner.id}`}
        className="sticky left-0 z-10 bg-card group-hover:bg-accent pl-5 pr-4 shrink-0 cursor-pointer transition-colors"
        style={{ width: 180, minWidth: 180, boxShadow: '2px 0 4px -2px rgba(0,0,0,0.08)' }}
      >
        <span className="font-medium text-sm truncate block hover:text-primary transition-colors">
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

        // Don't truncate status column - badges need to display fully
        const shouldTruncate = col.key !== 'status'

        return (
          <div
            key={col.key}
            className={`hidden md:block text-sm ${col.align === 'right' ? 'text-right' : ''} text-muted-foreground ${shouldTruncate ? 'truncate' : ''} px-2`}
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
const KNOWN_COLUMNS_STORAGE_KEY = 'partners-known-columns'

export default function PartnersPage() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)
  const [isFiltering, setIsFiltering] = useState(false) // Subtle indicator for filter changes
  const [isRefreshing, setIsRefreshing] = useState(false) // For manual refresh
  // const [loadingMore, setLoadingMore] = useState(false) // Reserved for future infinite scroll
  const initialLoadDone = useRef(false)
  // Refs for scroll sync between header and content
  const headerScrollRef = useRef<HTMLDivElement>(null)
  const contentScrollRef = useRef<HTMLDivElement>(null)
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
  const [sort, setSort] = useState('onboarding_date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [total, setTotal] = useState(0)
  // const [hasMore, setHasMore] = useState(false) // Reserved for future infinite scroll
  // Pagination state
  const [pageSize, setPageSize] = useState(50)
  const [currentPage, setCurrentPage] = useState(1)
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => {
    const defaults = new Set(CORE_COLUMNS.filter(c => c.defaultVisible).map(c => c.key))

    // Try to restore from localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(VISIBLE_COLUMNS_STORAGE_KEY)
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as string[]
          if (Array.isArray(parsed) && parsed.length > 0) {
            const savedSet = new Set(parsed)

            // Auto-show new defaultVisible columns that weren't in previously known columns
            const knownRaw = localStorage.getItem(KNOWN_COLUMNS_STORAGE_KEY)
            const knownCols = knownRaw ? new Set(JSON.parse(knownRaw) as string[]) : new Set<string>()

            Array.from(defaults).forEach(key => {
              if (!knownCols.has(key)) {
                // New column that wasn't previously known — show it
                savedSet.add(key)
              }
            })

            // Update known columns
            localStorage.setItem(KNOWN_COLUMNS_STORAGE_KEY, JSON.stringify(CORE_COLUMNS.map(c => c.key)))

            return savedSet
          }
        } catch {
          // Invalid JSON, use defaults
        }
      }
    }

    // Fall back to defaults and save known columns
    if (typeof window !== 'undefined') {
      localStorage.setItem(KNOWN_COLUMNS_STORAGE_KEY, JSON.stringify(CORE_COLUMNS.map(c => c.key)))
    }
    return defaults
  })

  // Weekly status dialog state
  const [weeklyDialogPartner, setWeeklyDialogPartner] = useState<Partner | null>(null)

  // Status investigation dialog state
  const [investigationDialogPartner, setInvestigationDialogPartner] = useState<Partner | null>(null)

  // Add partner dialog state
  const [addPartnerOpen, setAddPartnerOpen] = useState(false)

  // Column filter state - maps column key to selected filter values
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({})

  // Field lineage info for tooltips (which sheet/tab/column each field came from)
  const [fieldLineage, setFieldLineage] = useState<Record<string, {
    sourceColumn: string
    tabName: string
    sheetName: string
  }>>({})

  const debouncedSearch = useDebounce(search, 300)

  // Client-side fuzzy search for instant filtering of loaded partners
  const { results: filteredPartners } = usePartnerSearch({
    partners,
    searchQuery: search,
    minChars: 2,
    fuzzy: 0.2,
  })

  // Use filtered results when searching locally, otherwise use all partners
  const searchFiltered = search.length >= 2 ? filteredPartners : partners

  // Apply column-level filters
  const displayedPartners = useMemo(() => {
    const activeFilters = Object.entries(columnFilters).filter(([, vals]) => vals.length > 0)
    if (activeFilters.length === 0) return searchFiltered

    return searchFiltered.filter(partner => {
      return activeFilters.every(([key, allowedValues]) => {
        // Special handling for boolean columns (BigQuery)
        if (key === 'has_bigquery') {
          const val = partner.has_bigquery ? 'Connected' : 'Not Connected'
          return allowedValues.includes(val)
        }
        // Get the display value for this partner+column
        const rawVal = partner[key]
        const displayVal = rawVal !== null && rawVal !== undefined && rawVal !== '' ? String(rawVal) : '--'
        return allowedValues.includes(displayVal)
      })
    })
  }, [searchFiltered, columnFilters])

  // Scroll sync handler - syncs header and content horizontal scroll
  const handleContentScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (headerScrollRef.current) {
      headerScrollRef.current.scrollLeft = e.currentTarget.scrollLeft
    }
  }, [])

  // handleHeaderScroll removed - header is overflow-hidden, synced one-way from content

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

  const fetchPartners = useCallback(async (page = currentPage, size = pageSize) => {
    if (!initialLoadDone.current) {
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
      params.set('limit', String(size))
      params.set('offset', String((page - 1) * size))

      const res = await fetch(`/api/partners?${params}`)
      const json = await res.json()
      const data = json.data

      if (data) {
        setPartners(data.partners)
        setTotal(data.total)
        // setHasMore(data.has_more) // Reserved for future infinite scroll
        initialLoadDone.current = true
      }
    } catch (error) {
      console.error('Failed to fetch partners:', error)
    } finally {
      setLoading(false)
      // setLoadingMore(false) // Reserved for future infinite scroll
      setIsFiltering(false)
    }
  }, [debouncedSearch, statusFilter, sort, sortOrder, currentPage, pageSize])

  // Fetch on filter/search/sort change
  useEffect(() => {
    fetchPartners()
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

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearch, statusFilter, sort, sortOrder, pageSize])

  // Pagination helpers
  const totalPages = Math.ceil(total / pageSize)
  const startItem = (currentPage - 1) * pageSize + 1
  const endItem = Math.min(currentPage * pageSize, total)

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    fetchPartners(page, pageSize)
    // Scroll to top of table
    window.scrollTo({ top: 200, behavior: 'smooth' })
  }

  const handlePageSizeChange = (size: number) => {
    setPageSize(size)
    setCurrentPage(1)
    fetchPartners(1, size)
  }

  // Manual refresh - clears cache and re-fetches
  const handleRefresh = async () => {
    setIsRefreshing(true)
    // Clear the heatmap cache
    clearHeatmapCache()
    await Promise.all([
      fetchPartners(),
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
        await fetchPartners()
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
            className="h-10 w-10 md:h-9 md:w-9 p-0"
            title="Refresh partner data"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            variant={showHeatmap ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowHeatmap(!showHeatmap)}
            className="h-10 md:h-9 gap-1.5 px-3"
          >
            <Activity className="h-4 w-4" />
            <span className="hidden sm:inline">{showHeatmap ? 'List' : 'Heatmap'}</span>
          </Button>
          <div className="hidden sm:block">
            <HealthBarCompact />
          </div>
          <Button
            className="h-10 md:h-9 gap-2 px-3"
            onClick={() => setAddPartnerOpen(true)}
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add</span>
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
        onSortChange={(s, o) => {
          // Use the option's default order if switching to a new sort
          const option = sortOptions.find(opt => opt.value === s)
          setSort(s)
          setSortOrder(o ?? option?.defaultOrder ?? 'asc')
        }}
        resultCount={displayedPartners.length}
        totalCount={total}
        placeholder="Search brand, client, or code..."
      />

      {/* Active column filter chips */}
      {Object.keys(columnFilters).length > 0 && (
        <div className="px-6 md:px-8 pt-2 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Column filters:</span>
          {Object.entries(columnFilters).map(([key, values]) => {
            const col = CORE_COLUMNS.find(c => c.key === key)
            return (
              <button
                key={key}
                onClick={() => {
                  setColumnFilters(prev => {
                    const next = { ...prev }
                    delete next[key]
                    return next
                  })
                }}
                className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full hover:bg-primary/20 transition-colors"
              >
                {col?.label || key}: {values.join(', ')}
                <X className="h-3 w-3" />
              </button>
            )
          })}
          <button
            onClick={() => setColumnFilters({})}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Clear all
          </button>
        </div>
      )}

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
        ) : displayedPartners.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500/10 mb-6">
                <Building2 className="h-8 w-8 text-blue-500" />
              </div>
              <h2 className="text-xl font-semibold mb-2">
                {search || statusFilter.length > 0
                  ? 'No partners match your filters'
                  : 'No partners yet'}
              </h2>
              <p className="text-muted-foreground text-center max-w-md mb-6">
                {search && partners.length > 0
                  ? `No matches found in ${partners.length} loaded partners. Try a different search term.`
                  : search || statusFilter.length > 0
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
                  ref={headerScrollRef}
                  className="overflow-hidden"
                >
                  <div className="hidden md:flex items-center py-2.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider min-w-max">
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
                      className="sticky left-0 z-10 bg-card pl-5 pr-4 shrink-0 flex items-center gap-1 hover:text-foreground transition-colors"
                      style={{ width: 180, minWidth: 180, boxShadow: '2px 0 4px -2px rgba(0,0,0,0.08)' }}
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

                      const filterEl = col.filterable ? (
                        <ColumnFilterPopover
                          col={col}
                          partners={partners}
                          activeFilters={columnFilters[col.key] || []}
                          onFilterChange={(values) => {
                            setColumnFilters(prev => {
                              const next = { ...prev }
                              if (values.length === 0) {
                                delete next[col.key]
                              } else {
                                next[col.key] = values
                              }
                              return next
                            })
                          }}
                        />
                      ) : null

                      if (col.sortable) {
                        return (
                          <div
                            key={col.key}
                            className={`flex items-center px-2 ${col.align === 'right' ? 'justify-end' : ''}`}
                            style={colStyle}
                          >
                            <button
                              onClick={() => {
                                const sortKey = col.sortKey || col.key
                                if (sort === sortKey) {
                                  setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
                                } else {
                                  setSort(sortKey)
                                  const isDateCol = sortKey === 'onboarding_date' || sortKey === 'created_at' || sortKey === 'updated_at'
                                  setSortOrder(isDateCol ? 'desc' : 'asc')
                                }
                              }}
                              className="flex items-center gap-1 hover:text-foreground transition-colors"
                            >
                              {col.label}
                              {isSorted && (
                                sortOrder === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                              )}
                            </button>
                            {filterEl}
                          </div>
                        )
                      }

                      return (
                        <div
                          key={col.key}
                          className={`flex items-center px-2 ${col.align === 'right' ? 'justify-end' : ''}`}
                          style={colStyle}
                        >
                          <span>{col.label}</span>
                          {filterEl}
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
                          <TooltipProvider delayDuration={300}>
                            {/* Draggable column list */}
                            <Reorder.Group
                              axis="y"
                              values={columnOrder}
                              onReorder={setColumnOrder}
                              className="space-y-0.5"
                            >
                              {orderedColumns.map((col) => (
                                <DraggableColumnItem
                                  key={col.key}
                                  col={col}
                                  isVisible={visibleColumns.has(col.key)}
                                  fieldLineage={fieldLineage}
                                  onToggle={() => toggleColumn(col.key)}
                                />
                              ))}
                            </Reorder.Group>
                          </TooltipProvider>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              </div>
              {/* Table content - separate scroll container synced with header */}
              <div
                ref={contentScrollRef}
                className="overflow-x-auto"
                onScroll={handleContentScroll}
              >
                <div className="divide-y divide-border/60 rounded-b-xl min-w-max">
                  {displayedPartners.map(partner => (
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

            {/* Pagination Controls */}
            {total > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 px-2">
                {/* Page size selector */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Show</span>
                  <Select value={String(pageSize)} onValueChange={(v) => handlePageSizeChange(Number(v))}>
                    <SelectTrigger className="w-[70px] h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                      <SelectItem value="200">200</SelectItem>
                    </SelectContent>
                  </Select>
                  <span>per page</span>
                </div>

                {/* Page info and navigation */}
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground">
                    {startItem}-{endItem} of {total}
                  </span>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage <= 1 || isFiltering}
                      className="h-8 px-2"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>

                    {/* Page numbers */}
                    {(() => {
                      const pages: (number | 'ellipsis')[] = []
                      const showPages = 5

                      if (totalPages <= showPages + 2) {
                        // Show all pages
                        for (let i = 1; i <= totalPages; i++) pages.push(i)
                      } else {
                        // Always show first page
                        pages.push(1)

                        // Calculate range around current page
                        let start = Math.max(2, currentPage - 1)
                        let end = Math.min(totalPages - 1, currentPage + 1)

                        // Adjust if at edges
                        if (currentPage <= 3) {
                          end = Math.min(totalPages - 1, 4)
                        } else if (currentPage >= totalPages - 2) {
                          start = Math.max(2, totalPages - 3)
                        }

                        if (start > 2) pages.push('ellipsis')
                        for (let i = start; i <= end; i++) pages.push(i)
                        if (end < totalPages - 1) pages.push('ellipsis')

                        // Always show last page
                        if (totalPages > 1) pages.push(totalPages)
                      }

                      return pages.map((page, i) =>
                        page === 'ellipsis' ? (
                          <span key={`ellipsis-${i}`} className="px-2 text-muted-foreground">…</span>
                        ) : (
                          <Button
                            key={page}
                            variant={page === currentPage ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => handlePageChange(page)}
                            disabled={isFiltering}
                            className="h-8 w-8 p-0"
                          >
                            {page}
                          </Button>
                        )
                      )
                    })()}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage >= totalPages || isFiltering}
                      className="h-8 px-2"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
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

      {/* Add Partner Dialog */}
      <AddPartnerDialog
        open={addPartnerOpen}
        onOpenChange={setAddPartnerOpen}
        onSuccess={handleRefresh}
      />
    </div>
  )
}
