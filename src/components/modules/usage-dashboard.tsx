'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import { DollarSign, Activity, Database, Users, ArrowUp, ArrowDown, ChevronRight, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ShimmerBar, ShimmerGrid } from '@/components/ui/shimmer-grid'
import { formatCurrency, formatNumber, formatCompact, formatDateShort, formatBytes } from '@/lib/reporting/formatters'
import type { UsageData, AccountUsage, SourceBreakdown, SourceDetailEntry } from '@/types/usage'

interface UsageDashboardProps {
  moduleSlug: string
}

type Period = '7d' | '30d' | '90d'
type SortKey = 'estimated_cost' | 'query_count' | 'total_bytes' | 'last_query'
type SortDir = 'asc' | 'desc'

const PERIODS: { value: Period; label: string }[] = [
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
]

/** Colors for source breakdown */
const SOURCE_COLORS: Record<string, string> = {
  'Sophie Hub': 'bg-blue-500',
  'Daton (Sync)': 'bg-amber-500',
  'BI Tools': 'bg-purple-500',
  'Scheduled Jobs': 'bg-cyan-500',
  'Team Queries': 'bg-emerald-500',
  'Other': 'bg-gray-400',
}

const SOURCE_STROKE_COLORS: Record<string, string> = {
  'Sophie Hub': 'hsl(217, 91%, 60%)',
  'Daton (Sync)': 'hsl(38, 92%, 50%)',
  'BI Tools': 'hsl(270, 67%, 55%)',
  'Scheduled Jobs': 'hsl(190, 80%, 50%)',
  'Team Queries': 'hsl(152, 69%, 45%)',
  'Other': 'hsl(0, 0%, 60%)',
}

/** Descriptions explaining what each source is */
const SOURCE_DESCRIPTIONS: Record<string, string> = {
  'Sophie Hub': 'Queries from partner dashboards in this app',
  'Daton (Sync)': 'Automated Amazon data sync (runs hourly, many small queries)',
  'BI Tools': 'Power BI, Looker, Tableau, or analytics@ connected to BigQuery',
  'Scheduled Jobs': 'ETL pipelines and service accounts running on a schedule',
  'Team Queries': 'Team members querying BigQuery directly in the console',
  'Other': 'External users or unidentified sources',
}

interface ChartTooltipPayloadEntry {
  value: number
  name: string
  color: string
  dataKey: string
  payload: Record<string, number | string>
}

function ChartTooltip({
  active,
  payload,
  label,
  sourceFilter,
}: {
  active?: boolean
  payload?: ChartTooltipPayloadEntry[]
  label?: string
  sourceFilter?: string | null
}) {
  if (!active || !payload || !payload.length) return null

  const dataPoint = payload[0]?.payload
  const cost = typeof dataPoint?.cost === 'number' ? dataPoint.cost : 0
  const queries = typeof dataPoint?.queries === 'number' ? dataPoint.queries : 0

  return (
    <div
      className="bg-popover text-popover-foreground rounded-lg p-3"
      style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.1)' }}
    >
      <p className="text-xs text-muted-foreground mb-1">
        {label ? formatDateShort(label) : ''}
        {sourceFilter && <span className="ml-1 text-muted-foreground/60">({sourceFilter})</span>}
      </p>
      <div className="flex items-center gap-2">
        <div
          className="h-2 w-2 rounded-full flex-shrink-0"
          style={{ background: sourceFilter ? (SOURCE_STROKE_COLORS[sourceFilter] || 'hsl(var(--primary))') : 'hsl(var(--primary))' }}
        />
        <span className="text-xs">Cost:</span>
        <span className="text-xs font-medium" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {formatCurrency(cost)}
        </span>
      </div>
      <div className="flex items-center gap-2 mt-0.5">
        <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: 'hsl(var(--muted-foreground))' }} />
        <span className="text-xs">Queries:</span>
        <span className="text-xs font-medium" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {formatNumber(queries)}
        </span>
      </div>
    </div>
  )
}

function timeAgo(dateStr: string): string {
  const now = new Date()
  const then = new Date(dateStr)
  const diffMs = now.getTime() - then.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

export function UsageDashboard({ moduleSlug }: UsageDashboardProps) {
  if (moduleSlug !== 'amazon-reporting') return null
  return <UsageDashboardInner />
}

function UsageDashboardInner() {
  const [data, setData] = useState<UsageData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState<Period>('30d')
  const [sortKey, setSortKey] = useState<SortKey>('estimated_cost')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [sourceFilter, setSourceFilter] = useState<string | null>(null)
  const [sourceDetail, setSourceDetail] = useState<SourceDetailEntry[] | null>(null)
  const [sourceDetailLoading, setSourceDetailLoading] = useState(false)

  const fetchUsage = useCallback(async (p: Period) => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/bigquery/usage?period=${p}`)
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error?.message || 'Failed to load usage data')
      }
      const json = await res.json()
      setData(json.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load usage data')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsage(period)
  }, [period, fetchUsage])

  // Fetch source detail when a source is selected
  const fetchSourceDetail = useCallback(async (source: string, p: Period) => {
    setSourceDetailLoading(true)
    setSourceDetail(null)
    try {
      const res = await fetch(`/api/bigquery/usage/source-detail?source=${encodeURIComponent(source)}&period=${p}`)
      if (!res.ok) return
      const json = await res.json()
      setSourceDetail(json.data?.entries || [])
    } catch {
      // Silent fail
    } finally {
      setSourceDetailLoading(false)
    }
  }, [])

  function handlePeriodChange(p: Period) {
    setPeriod(p)
    setSourceFilter(null)
    setSourceDetail(null)
  }

  function handleSourceClick(source: string) {
    if (sourceFilter === source) {
      setSourceFilter(null)
      setSourceDetail(null)
    } else {
      setSourceFilter(source)
      fetchSourceDetail(source, period)
    }
  }

  function handleShowAll() {
    setSourceFilter('All')
    fetchSourceDetail('All', period)
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const sortedAccounts = useMemo(() => {
    if (!data?.accountUsage) return []
    return [...data.accountUsage].sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'estimated_cost':
          cmp = a.estimated_cost - b.estimated_cost
          break
        case 'query_count':
          cmp = a.query_count - b.query_count
          break
        case 'total_bytes':
          cmp = a.total_bytes - b.total_bytes
          break
        case 'last_query':
          cmp = new Date(a.last_query).getTime() - new Date(b.last_query).getTime()
          break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [data?.accountUsage, sortKey, sortDir])

  const maxCost = useMemo(() => {
    if (!sortedAccounts.length) return 1
    return Math.max(...sortedAccounts.map((a) => a.estimated_cost), 0.001)
  }, [sortedAccounts])

  // Filtered overview when a source is selected (not 'All')
  const filteredOverview = useMemo(() => {
    if (!data || !sourceFilter || sourceFilter === 'All') return data?.overview ?? null
    const src = data.sourceBreakdown.find((s) => s.source === sourceFilter)
    if (!src) return data.overview
    return {
      ...data.overview,
      total_cost_usd: src.estimated_cost,
      total_queries: src.query_count,
      total_bytes_processed: src.total_bytes,
    }
  }, [data, sourceFilter])

  // Chart data: use filtered source data or total ('All' shows everything)
  const chartData = useMemo(() => {
    if (!data) return []
    if (sourceFilter && sourceFilter !== 'All' && data.dailyCostsBySource?.[sourceFilter]) {
      return data.dailyCostsBySource[sourceFilter]
    }
    return data.dailyCosts
  }, [data, sourceFilter])

  // Chart line color ('All' uses default)
  const activeSourceFilter = sourceFilter === 'All' ? null : sourceFilter
  const chartStroke = activeSourceFilter
    ? (SOURCE_STROKE_COLORS[activeSourceFilter] || 'hsl(var(--primary))')
    : 'hsl(var(--primary))'

  return (
    <div className="space-y-6">
      {/* Section header + period selector */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Data Usage & Cost</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {sourceFilter && sourceFilter !== 'All'
              ? `Showing: ${sourceFilter}`
              : 'BigQuery project costs across all sources'}
          </p>
        </div>
        <div className="flex items-center rounded-lg p-0.5" style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.08)' }}>
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => handlePeriodChange(p.value)}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-md transition-colors',
                period === p.value
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading && <UsageLoadingState />}

      {!isLoading && error && (
        <div
          className="rounded-xl p-6 text-center"
          style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.08)' }}
        >
          <p className="text-sm text-muted-foreground">{error}</p>
          <button
            onClick={() => fetchUsage(period)}
            className="mt-2 text-xs text-primary hover:underline"
          >
            Retry
          </button>
        </div>
      )}

      {!isLoading && !error && data && filteredOverview && (
        <>
          {/* Metric cards */}
          <div className="grid grid-cols-2 gap-3 md:gap-4 md:grid-cols-4">
            <MetricCard
              icon={<DollarSign className="h-4 w-4" />}
              label="Total Cost"
              value={formatCurrency(filteredOverview.total_cost_usd)}
              subtitle={sourceFilter && sourceFilter !== 'All' ? sourceFilter : `${filteredOverview.period_days}d billable`}
              color="text-green-600 dark:text-green-400"
            />
            <MetricCard
              icon={<Activity className="h-4 w-4" />}
              label="Queries"
              value={formatNumber(filteredOverview.total_queries)}
              subtitle="excl. cached"
              color="text-blue-600 dark:text-blue-400"
            />
            <MetricCard
              icon={<Database className="h-4 w-4" />}
              label="Data Scanned"
              value={formatBytes(filteredOverview.total_bytes_processed)}
              subtitle="billable bytes"
              color="text-purple-600 dark:text-purple-400"
            />
            <MetricCard
              icon={<Users className="h-4 w-4" />}
              label="Hub Brands"
              value={formatNumber(data.overview.unique_accounts)}
              subtitle={data.overview.unique_accounts === 0 ? 'logging just enabled' : 'queried via Hub'}
              color="text-orange-600 dark:text-orange-400"
            />
          </div>

          {/* Source breakdown + Daily cost trend */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SourceBreakdownCard
              sources={data.sourceBreakdown}
              activeSource={sourceFilter}
              onSourceClick={handleSourceClick}
              onShowAll={handleShowAll}
            />

            {chartData.length > 0 && (
              <div
                className="rounded-xl p-4 md:p-6"
                style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.08)' }}
              >
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-medium text-foreground">
                    Daily Cost & Queries
                  </p>
                  {activeSourceFilter && (
                    <span className="text-xs text-muted-foreground">{activeSourceFilter}</span>
                  )}
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <ComposedChart
                    data={chartData}
                    margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                      strokeOpacity={0.4}
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                      tickLine={false}
                      axisLine={{ stroke: 'hsl(var(--border))', strokeOpacity: 0.4 }}
                      tickFormatter={(d: string) => formatDateShort(d)}
                    />
                    <YAxis
                      yAxisId="cost"
                      orientation="left"
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v: number) => `$${formatCompact(v)}`}
                      width={50}
                      domain={[0, 'dataMax']}
                    />
                    <YAxis
                      yAxisId="queries"
                      orientation="right"
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v: number) => formatCompact(v)}
                      width={40}
                      domain={[0, 'dataMax']}
                    />
                    <Tooltip
                      content={<ChartTooltip sourceFilter={activeSourceFilter} />}
                      cursor={{ stroke: 'hsl(var(--border))', strokeWidth: 1 }}
                    />
                    <Bar
                      yAxisId="queries"
                      dataKey="queries"
                      fill="hsl(var(--muted-foreground))"
                      fillOpacity={0.15}
                      radius={[2, 2, 0, 0]}
                      animationDuration={300}
                      animationEasing="ease-out"
                    />
                    <Line
                      yAxisId="cost"
                      type="monotone"
                      dataKey="cost"
                      stroke={chartStroke}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 2 }}
                      animationDuration={300}
                      animationEasing="ease-out"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Source detail panel (when a source or "All" is clicked) */}
          {sourceFilter && (
            <SourceDetailPanel
              source={sourceFilter}
              entries={sourceDetail}
              isLoading={sourceDetailLoading}
              onClose={() => { setSourceFilter(null); setSourceDetail(null) }}
            />
          )}

          {/* Sophie Hub per-brand table */}
          <div
            className="rounded-xl overflow-hidden"
            style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.08)' }}
          >
            <div className="p-4 md:p-6 pb-0 md:pb-0">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-medium text-foreground text-wrap-balance">
                    Sophie Hub — Per Brand
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Queries made through partner dashboards
                  </p>
                </div>
                {sortedAccounts.length > 0 && (
                  <span
                    className="text-xs text-muted-foreground"
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {sortedAccounts.length} brand{sortedAccounts.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>

            {sortedAccounts.length === 0 ? (
              <div className="px-4 md:px-6 pb-6 pt-2">
                <p className="text-sm text-muted-foreground text-center py-8">
                  Per-brand breakdown will appear as partners use their dashboards.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left px-4 md:px-6 py-2 font-medium text-muted-foreground whitespace-nowrap">
                        Brand
                      </th>
                      <SortableHeader label="Queries" sortKey="query_count" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                      <SortableHeader label="Scanned" sortKey="total_bytes" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="hidden md:table-cell" />
                      <SortableHeader label="Est. Cost" sortKey="estimated_cost" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                      <SortableHeader label="Last Query" sortKey="last_query" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="hidden md:table-cell" />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedAccounts.map((account, idx) => (
                      <AccountRow key={account.partner_name + idx} account={account} maxCost={maxCost} isEven={idx % 2 === 0} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// =============================================================================
// Sub-components
// =============================================================================

function MetricCard({
  icon, label, value, subtitle, color,
}: {
  icon: React.ReactNode; label: string; value: string; subtitle?: string; color: string
}) {
  return (
    <div className="rounded-xl p-4" style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.08)' }}>
      <div className={cn('flex items-center gap-1.5 mb-2', color)}>
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl font-bold text-foreground" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </p>
      {subtitle && (
        <p className="text-[11px] text-muted-foreground/70 mt-0.5">{subtitle}</p>
      )}
    </div>
  )
}

function SourceBreakdownCard({
  sources,
  activeSource,
  onSourceClick,
  onShowAll,
}: {
  sources: SourceBreakdown[]
  activeSource: string | null
  onSourceClick: (source: string) => void
  onShowAll: () => void
}) {
  if (!sources.length) {
    return (
      <div className="rounded-xl p-4 md:p-6" style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.08)' }}>
        <p className="text-sm font-medium text-foreground mb-4">Cost by Source</p>
        <p className="text-sm text-muted-foreground text-center py-8">Source breakdown unavailable.</p>
      </div>
    )
  }

  const maxPct = Math.max(...sources.map((s) => s.pct), 1)
  const totalCost = sources.reduce((sum, s) => sum + s.estimated_cost, 0)
  const totalBytes = sources.reduce((sum, s) => sum + s.total_bytes, 0)
  const totalQueries = sources.reduce((sum, s) => sum + s.query_count, 0)

  return (
    <div className="rounded-xl p-4 md:p-6" style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.08)' }}>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-medium text-foreground">Cost by Source</p>
        {activeSource && activeSource !== 'All' && (
          <button
            onClick={() => onSourceClick(activeSource)}
            className="text-xs text-primary hover:underline"
          >
            Clear filter
          </button>
        )}
      </div>

      {/* Stacked bar */}
      <div className="flex rounded-full overflow-hidden h-3 mb-5">
        {sources.map((s) => (
          <div
            key={s.source}
            className={cn(
              'transition-all cursor-pointer hover:opacity-80',
              SOURCE_COLORS[s.source] || 'bg-gray-400',
              activeSource && activeSource !== 'All' && activeSource !== s.source && 'opacity-30',
            )}
            style={{ width: `${Math.max(s.pct, 1)}%` }}
            title={`${s.source}: ${s.pct.toFixed(1)}%`}
            onClick={() => onSourceClick(s.source)}
          />
        ))}
      </div>

      {/* "All Sources" row */}
      <div className="space-y-3">
        <button
          onClick={onShowAll}
          className={cn(
            'flex items-center gap-3 w-full text-left rounded-lg p-1.5 -m-1.5 transition-all',
            'hover:bg-muted/40 active:scale-[0.99]',
            activeSource === 'All' && 'bg-muted/60',
          )}
        >
          <div className="h-2.5 w-2.5 rounded-full flex-shrink-0 mt-0.5 bg-foreground/40" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex items-center gap-1.5">
                <span className="text-sm font-medium text-foreground">All Sources</span>
                {activeSource === 'All' && <ChevronRight className="h-3 w-3 text-primary flex-shrink-0" />}
              </div>
              <div className="text-right flex-shrink-0">
                <span className="text-sm font-medium text-foreground block" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {formatCurrency(totalCost)}
                </span>
                <span className="text-[11px] text-muted-foreground/60 block" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {formatBytes(totalBytes)}
                </span>
              </div>
            </div>
            <span className="text-xs text-muted-foreground flex-shrink-0" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {formatNumber(totalQueries)} queries · 100%
            </span>
          </div>
        </button>

        {/* Divider */}
        <div className="border-t border-border/40" />

        {/* Source rows */}
        {sources.map((s) => (
          <button
            key={s.source}
            onClick={() => onSourceClick(s.source)}
            className={cn(
              'flex items-center gap-3 w-full text-left rounded-lg p-1.5 -m-1.5 transition-all',
              'hover:bg-muted/40 active:scale-[0.99]',
              activeSource === s.source && 'bg-muted/60',
              activeSource && activeSource !== 'All' && activeSource !== s.source && 'opacity-40',
            )}
          >
            <div className={cn('h-2.5 w-2.5 rounded-full flex-shrink-0 mt-0.5', SOURCE_COLORS[s.source] || 'bg-gray-400')} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex items-center gap-1.5">
                  <span className="text-sm font-medium text-foreground truncate">{s.source}</span>
                  {activeSource === s.source && <ChevronRight className="h-3 w-3 text-primary flex-shrink-0" />}
                </div>
                <div className="text-right flex-shrink-0">
                  <span className="text-sm font-medium text-foreground block" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {formatCurrency(s.estimated_cost)}
                  </span>
                  <span className="text-[11px] text-muted-foreground/60 block" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {formatBytes(s.total_bytes)}
                  </span>
                </div>
              </div>
              {SOURCE_DESCRIPTIONS[s.source] && (
                <span className="text-[11px] text-muted-foreground/60 leading-tight block mt-0.5">
                  {SOURCE_DESCRIPTIONS[s.source]}
                </span>
              )}
              <div className="flex items-center justify-between gap-2 mt-1">
                <div className="flex-1 h-1.5 rounded-full bg-muted max-w-[160px]">
                  <div
                    className={cn('h-full rounded-full transition-all', SOURCE_COLORS[s.source] || 'bg-gray-400')}
                    style={{ width: `${(s.pct / maxPct) * 100}%`, opacity: 0.6 }}
                  />
                </div>
                <span className="text-xs text-muted-foreground flex-shrink-0" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {formatNumber(s.query_count)} queries · {s.pct.toFixed(0)}%
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

/** Capitalize first letter of each word */
function capitalize(str: string): string {
  return str.replace(/\b\w/g, (c) => c.toUpperCase())
}

function SourceDetailPanel({
  source,
  entries,
  isLoading,
  onClose,
}: {
  source: string
  entries: SourceDetailEntry[] | null
  isLoading: boolean
  onClose: () => void
}) {
  const isAll = source === 'All'

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.08)' }}
    >
      <div className="p-4 md:p-6 pb-0 md:pb-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {!isAll && <div className={cn('h-3 w-3 rounded-full', SOURCE_COLORS[source] || 'bg-gray-400')} />}
            <div>
              <p className="text-sm font-medium text-foreground">
                {isAll ? 'All Sources — Top Queriers' : `${source} — Breakdown`}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Top queriers by user account
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="px-4 md:px-6 pb-6 pt-2">
          <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading breakdown…</span>
          </div>
        </div>
      )}

      {!isLoading && entries && entries.length === 0 && (
        <div className="px-4 md:px-6 pb-6 pt-2">
          <p className="text-sm text-muted-foreground text-center py-8">
            No query data found for this source.
          </p>
        </div>
      )}

      {!isLoading && entries && entries.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left px-4 md:px-6 py-2 font-medium text-muted-foreground whitespace-nowrap">
                  User / Service Account
                </th>
                {isAll && (
                  <th className="text-left px-4 md:px-6 py-2 font-medium text-muted-foreground whitespace-nowrap hidden md:table-cell">
                    Source
                  </th>
                )}
                <th className="text-right px-4 md:px-6 py-2 font-medium text-muted-foreground whitespace-nowrap">
                  Queries
                </th>
                <th className="text-right px-4 md:px-6 py-2 font-medium text-muted-foreground whitespace-nowrap hidden md:table-cell">
                  Scanned
                </th>
                <th className="text-right px-4 md:px-6 py-2 font-medium text-muted-foreground whitespace-nowrap">
                  Est. Cost
                </th>
                <th className="text-right px-4 md:px-6 py-2 font-medium text-muted-foreground whitespace-nowrap hidden md:table-cell">
                  Last Query
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, idx) => {
                // Format display name: capitalize, strip dots/underscores
                const emailPrefix = entry.user_email.includes('@')
                  ? entry.user_email.split('@')[0]
                  : entry.user_email
                const displayName = capitalize(emailPrefix.replace(/[._]/g, ' '))

                return (
                  <tr
                    key={entry.user_email + (entry.source_category || '')}
                    className={cn('transition-colors hover:bg-muted/40', idx % 2 === 0 && 'bg-muted/[0.15]')}
                  >
                    <td className="px-4 md:px-6 py-2.5">
                      <span className="text-sm font-medium text-foreground truncate block max-w-[280px]" title={entry.user_email}>
                        {displayName}
                      </span>
                      {entry.user_email.includes('@') && (
                        <span className="text-xs text-muted-foreground/60 truncate block max-w-[280px]">
                          {entry.user_email}
                        </span>
                      )}
                    </td>
                    {isAll && (
                      <td className="px-4 md:px-6 py-2.5 hidden md:table-cell">
                        <span className="inline-flex items-center gap-1.5">
                          <div className={cn('h-2 w-2 rounded-full flex-shrink-0', SOURCE_COLORS[entry.source_category || ''] || 'bg-gray-400')} />
                          <span className="text-xs text-muted-foreground whitespace-nowrap">{entry.source_category || 'Unknown'}</span>
                        </span>
                      </td>
                    )}
                    <td className="px-4 md:px-6 py-2.5 text-right whitespace-nowrap" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {formatNumber(entry.query_count)}
                    </td>
                    <td className="px-4 md:px-6 py-2.5 text-right whitespace-nowrap hidden md:table-cell" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {formatBytes(entry.total_bytes)}
                    </td>
                    <td className="px-4 md:px-6 py-2.5 text-right whitespace-nowrap font-medium" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {formatCurrency(entry.estimated_cost)}
                    </td>
                    <td className="px-4 md:px-6 py-2.5 text-right whitespace-nowrap text-muted-foreground hidden md:table-cell">
                      {timeAgo(entry.last_query)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function SortableHeader({
  label, sortKey: key, currentKey, currentDir, onSort, className,
}: {
  label: string; sortKey: SortKey; currentKey: SortKey; currentDir: SortDir; onSort: (key: SortKey) => void; className?: string
}) {
  const isActive = currentKey === key
  return (
    <th
      onClick={() => onSort(key)}
      className={cn(
        'text-right px-4 md:px-6 py-2 font-medium text-muted-foreground whitespace-nowrap cursor-pointer select-none transition-colors hover:text-foreground',
        className,
      )}
    >
      <span className="inline-flex items-center gap-1 justify-end">
        {label}
        {isActive && (currentDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
      </span>
    </th>
  )
}

function AccountRow({ account, maxCost, isEven }: { account: AccountUsage; maxCost: number; isEven: boolean }) {
  const costRatio = account.estimated_cost / maxCost
  return (
    <tr className={cn('transition-colors hover:bg-muted/40', isEven && 'bg-muted/[0.15]')}>
      <td className="px-4 md:px-6 py-2.5">
        <div className="flex flex-col gap-1">
          <span className="font-medium text-foreground truncate max-w-[200px]">{account.partner_name}</span>
          <div className="h-1 rounded-full bg-muted w-full max-w-[140px]">
            <div className="h-full rounded-full bg-primary/60 transition-all" style={{ width: `${Math.max(costRatio * 100, 2)}%` }} />
          </div>
        </div>
      </td>
      <td className="px-4 md:px-6 py-2.5 text-right whitespace-nowrap" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {formatNumber(account.query_count)}
      </td>
      <td className="px-4 md:px-6 py-2.5 text-right whitespace-nowrap hidden md:table-cell" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {formatBytes(account.total_bytes)}
      </td>
      <td className="px-4 md:px-6 py-2.5 text-right whitespace-nowrap font-medium" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {formatCurrency(account.estimated_cost)}
      </td>
      <td className="px-4 md:px-6 py-2.5 text-right whitespace-nowrap text-muted-foreground hidden md:table-cell">
        {timeAgo(account.last_query)}
      </td>
    </tr>
  )
}

function UsageLoadingState() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:gap-4 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl p-4" style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.08)' }}>
            <ShimmerBar width={80} height={12} className="mb-3" />
            <ShimmerBar width={120} height={28} />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl p-4 md:p-6" style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.08)' }}>
          <ShimmerBar width={120} height={14} className="mb-4" />
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-2.5 w-2.5 rounded-full bg-muted" />
                <div className="flex-1">
                  <ShimmerBar width={180} height={14} />
                  <ShimmerBar width={120} height={10} className="mt-1.5" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl p-4 md:p-6" style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.08)' }}>
          <ShimmerBar width={140} height={14} className="mb-4" />
          <div
            className="w-full rounded-lg overflow-hidden bg-gradient-to-r from-muted/40 via-muted/15 to-muted/40 bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite]"
            style={{ height: 220 }}
          />
        </div>
      </div>
      <div className="rounded-xl p-4 md:p-6 overflow-hidden" style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.08)' }}>
        <ShimmerBar width={160} height={14} className="mb-4" />
        <ShimmerGrid variant="table" rows={5} columns={4} />
      </div>
    </div>
  )
}
