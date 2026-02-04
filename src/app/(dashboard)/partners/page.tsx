'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { Building2, Plus, Database, ChevronRight, Loader2, Settings2 } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ShimmerGrid } from '@/components/ui/shimmer-grid'
import { EntityListToolbar } from '@/components/entities/entity-list-toolbar'
import { StatusBadge } from '@/components/entities/status-badge'
import { TierBadge } from '@/components/entities/tier-badge'
import { WeeklyStatusPreview } from '@/components/partners/weekly-status-preview'
import { HealthBarCompact } from '@/components/partners/health-bar-compact'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useDebounce } from '@/lib/hooks/use-debounce'

// Extended partner type that includes source_data
interface Partner {
  id: string
  partner_code: string | null
  brand_name: string
  client_name: string | null
  client_email: string | null
  client_phone: string | null
  status: string | null
  tier: string | null
  parent_asin_count: number | null
  child_asin_count: number | null
  onboarding_date: string | null
  created_at: string
  pod_leader_name: string | null
  brand_manager_name: string | null
  sales_rep_name: string | null
  pod_leader?: { id: string; full_name: string } | null
  source_data?: Record<string, Record<string, Record<string, unknown>>> | null
  [key: string]: unknown // Allow dynamic field access
}

// Column definition for dynamic columns
interface ColumnDef {
  key: string
  label: string
  source: 'db' | 'source_data'
  sourceKey?: string // For source_data fields: "Seller Central Name"
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
    defaultVisible: true,
    width: 'w-24',
    render: (p) => <StatusBadge status={p.status} entity="partners" />
  },
  {
    key: 'weekly',
    label: 'Weekly',
    source: 'db',
    defaultVisible: true,
    width: 'w-14',
    render: (p) => <WeeklyStatusPreview sourceData={p.source_data} weeks={8} />
  },
  {
    key: 'tier',
    label: 'Tier',
    source: 'db',
    defaultVisible: true,
    width: 'w-20',
    render: (p) => <TierBadge tier={p.tier} />
  },
  { key: 'client_name', label: 'Client', source: 'db', defaultVisible: true, width: 'w-32' },
  { key: 'client_email', label: 'Email', source: 'db', defaultVisible: false, width: 'w-40' },
  { key: 'client_phone', label: 'Phone', source: 'db', defaultVisible: false, width: 'w-28' },
  {
    key: 'pod_leader_name',
    label: 'Pod Leader',
    source: 'db',
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
  { key: 'brand_manager_name', label: 'Brand Manager', source: 'db', defaultVisible: false, width: 'w-28' },
  { key: 'sales_rep_name', label: 'Sales Rep', source: 'db', defaultVisible: false, width: 'w-28' },
  {
    key: 'asin_count',
    label: 'ASINs',
    source: 'db',
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
    defaultVisible: false,
    width: 'w-28',
    align: 'right',
    render: (p) => p.onboarding_date ? format(parseISO(p.onboarding_date), 'MMM d, yyyy') : '--'
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
function extractSourceDataColumns(partners: Partner[]): ColumnDef[] {
  const fieldSet = new Map<string, string>() // sourceKey -> label

  for (const partner of partners) {
    if (!partner.source_data) continue

    // source_data structure: { gsheets: { "Tab Name": { "Column Name": value } } }
    for (const connector of Object.values(partner.source_data)) {
      if (typeof connector !== 'object' || !connector) continue
      for (const tabData of Object.values(connector)) {
        if (typeof tabData !== 'object' || !tabData) continue
        for (const columnName of Object.keys(tabData)) {
          // Skip weekly status columns - they have their own display
          if (isWeeklyColumn(columnName)) continue

          // Skip if we already have a core column for this
          const normalizedKey = columnName.toLowerCase().replace(/[^a-z0-9]/g, '_')
          const existsAsCore = CORE_COLUMNS.some(c =>
            c.key === normalizedKey ||
            c.label.toLowerCase() === columnName.toLowerCase()
          )
          if (!existsAsCore && !fieldSet.has(columnName)) {
            fieldSet.set(columnName, columnName)
          }
        }
      }
    }
  }

  // Convert to column definitions, sorted alphabetically
  return Array.from(fieldSet.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([sourceKey, label]) => ({
      key: `source_${sourceKey.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
      label,
      source: 'source_data' as const,
      sourceKey,
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

function PartnerRow({ partner, columns, visibleColumns }: {
  partner: Partner
  columns: ColumnDef[]
  visibleColumns: Set<string>
}) {
  return (
    <Link href={`/partners/${partner.id}`}>
      <div className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/30 transition-colors cursor-pointer">
        {/* Brand name + code - always visible */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">{partner.brand_name}</span>
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
        </div>

        {/* Dynamic columns */}
        {columns.map(col => {
          if (!visibleColumns.has(col.key)) return null

          let content: React.ReactNode
          if (col.render) {
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
              className={`${col.width || 'w-28'} hidden md:block text-sm ${col.align === 'right' ? 'text-right' : ''} text-muted-foreground truncate`}
            >
              {content}
            </div>
          )
        })}

        {/* Mobile status + chevron */}
        <div className="flex md:hidden items-center gap-2 shrink-0">
          <StatusBadge status={partner.status} entity="partners" />
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>

        {/* Spacer for settings button alignment */}
        <div className="hidden md:block w-6 shrink-0" />
      </div>
    </Link>
  )
}

export default function PartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)
  const [isFiltering, setIsFiltering] = useState(false) // Subtle indicator for filter changes
  const [loadingMore, setLoadingMore] = useState(false)
  const initialLoadDone = useRef(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string[]>(['active']) // Default to Active partners
  const [sort, setSort] = useState('brand_name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(
    () => new Set(CORE_COLUMNS.filter(c => c.defaultVisible).map(c => c.key))
  )

  const debouncedSearch = useDebounce(search, 300)

  // Discover additional columns from source_data
  const sourceDataColumns = useMemo(() => extractSourceDataColumns(partners), [partners])

  // All available columns
  const allColumns = useMemo(() => [...CORE_COLUMNS, ...sourceDataColumns], [sourceDataColumns])

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

  const handleLoadMore = () => {
    fetchPartners(true, partners.length)
  }

  // Group columns for the dropdown menu
  const coreColumnKeys = new Set(CORE_COLUMNS.map(c => c.key))

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Partners"
        description={total > 0 ? `${total} partner brands` : 'View and manage all partner brands'}
      >
        <div className="flex items-center gap-4">
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
        {loading ? (
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
              {/* Sticky header row — sticks below the toolbar */}
              <div className="sticky top-[113px] z-10 bg-card border-b border-border/60 rounded-t-xl">
                <div className="hidden md:flex items-center gap-4 px-5 py-2.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  <div className="flex-1 min-w-0">Brand</div>
                  {allColumns.map(col => {
                    if (!visibleColumns.has(col.key)) return null
                    return (
                      <div
                        key={col.key}
                        className={`${col.width || 'w-28'} ${col.align === 'right' ? 'text-right' : ''}`}
                      >
                        {col.label}
                      </div>
                    )
                  })}
                  {/* Column visibility toggle */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-muted">
                        <Settings2 className="h-3.5 w-3.5" />
                        <span className="sr-only">Toggle columns</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-64 max-h-[400px] overflow-y-auto">
                      <DropdownMenuLabel className="text-xs">Database Columns</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {CORE_COLUMNS.map(col => (
                        <DropdownMenuCheckboxItem
                          key={col.key}
                          checked={visibleColumns.has(col.key)}
                          onCheckedChange={() => toggleColumn(col.key)}
                          className="text-sm"
                        >
                          {col.label}
                        </DropdownMenuCheckboxItem>
                      ))}
                      {sourceDataColumns.length > 0 && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuLabel className="text-xs">
                            Source Data ({sourceDataColumns.length} fields)
                          </DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {sourceDataColumns.map(col => (
                            <DropdownMenuCheckboxItem
                              key={col.key}
                              checked={visibleColumns.has(col.key)}
                              onCheckedChange={() => toggleColumn(col.key)}
                              className="text-sm"
                            >
                              {col.label}
                            </DropdownMenuCheckboxItem>
                          ))}
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              <div className="divide-y divide-border/60 rounded-b-xl overflow-hidden">
                {partners.map(partner => (
                  <PartnerRow
                    key={partner.id}
                    partner={partner}
                    columns={allColumns}
                    visibleColumns={visibleColumns}
                  />
                ))}
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
    </div>
  )
}
