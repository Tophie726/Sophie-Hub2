'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import {
  DollarSign, TrendingUp, Target, BarChart3,
  Filter,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ShimmerBar, ShimmerGrid } from '@/components/ui/shimmer-grid'
import { formatCurrency, formatNumber, formatCompact, formatDateShort } from '@/lib/reporting/formatters'

// =============================================================================
// Types
// =============================================================================

interface PortfolioDashboardProps {
  moduleSlug: string
}

type Period = '7d' | '30d' | '90d'

interface PortfolioMetrics {
  total_sales: number
  ppc_spend: number
  ppc_sales: number
  acos: number
  roas: number
}

interface DailyDataPoint {
  date: string
  value: number
}

interface BrandRow {
  brand: string
  sales: number
  units: number
}

interface PpcDailyPoint {
  date: string
  ppc_spend: number
  ppc_sales: number
}

interface FilterState {
  tiers: string[]
  statuses: string[]
}

interface MappedPartner {
  entity_id: string
  external_id: string
  brand_name: string
  tier: string | null
  status: string | null
}

// =============================================================================
// Constants
// =============================================================================

const PERIODS: { value: Period; label: string }[] = [
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
]

const TIER_OPTIONS = ['tier_0', 'tier_1', 'tier_2', 'tier_3', 'tier_4']
const STATUS_OPTIONS = ['active', 'onboarding', 'paused', 'at_risk', 'offboarding', 'churned']

const TIER_LABELS: Record<string, string> = {
  tier_0: 'Tier 0',
  tier_1: 'Tier 1',
  tier_2: 'Tier 2',
  tier_3: 'Tier 3',
  tier_4: 'Tier 4',
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  onboarding: 'Onboarding',
  paused: 'Paused',
  at_risk: 'At Risk',
  offboarding: 'Offboarding',
  churned: 'Churned',
}

// =============================================================================
// Tooltip
// =============================================================================

interface ChartTooltipPayloadEntry {
  value: number
  name: string
  color: string
  dataKey: string
  payload: Record<string, number | string>
}

function SalesChartTooltip({
  active, payload, label,
}: {
  active?: boolean; payload?: ChartTooltipPayloadEntry[]; label?: string
}) {
  if (!active || !payload || !payload.length) return null
  const dataPoint = payload[0]?.payload
  const value = typeof dataPoint?.value === 'number' ? dataPoint.value : 0

  return (
    <div
      className="bg-popover text-popover-foreground rounded-lg p-3"
      style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.1)' }}
    >
      <p className="text-xs text-muted-foreground mb-1">{label ? formatDateShort(label) : ''}</p>
      <p className="text-sm font-medium" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {formatCurrency(value)}
      </p>
    </div>
  )
}

function PpcChartTooltip({
  active, payload, label,
}: {
  active?: boolean; payload?: ChartTooltipPayloadEntry[]; label?: string
}) {
  if (!active || !payload || !payload.length) return null
  const dataPoint = payload[0]?.payload
  const spend = typeof dataPoint?.ppc_spend === 'number' ? dataPoint.ppc_spend : 0
  const sales = typeof dataPoint?.ppc_sales === 'number' ? dataPoint.ppc_sales : 0

  return (
    <div
      className="bg-popover text-popover-foreground rounded-lg p-3"
      style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.1)' }}
    >
      <p className="text-xs text-muted-foreground mb-1.5">{label ? formatDateShort(label) : ''}</p>
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-orange-500 flex-shrink-0" />
        <span className="text-xs">Spend:</span>
        <span className="text-xs font-medium" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(spend)}</span>
      </div>
      <div className="flex items-center gap-2 mt-0.5">
        <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: 'hsl(var(--primary))' }} />
        <span className="text-xs">Sales:</span>
        <span className="text-xs font-medium" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(sales)}</span>
      </div>
    </div>
  )
}

// =============================================================================
// Main Component
// =============================================================================

export function PortfolioDashboard({ moduleSlug }: PortfolioDashboardProps) {
  if (moduleSlug !== 'amazon-reporting') return null
  return <PortfolioDashboardInner />
}

function PortfolioDashboardInner() {
  const [period, setPeriod] = useState<Period>('30d')
  const [filters, setFilters] = useState<FilterState>({ tiers: [], statuses: [] })
  const [showFilters, setShowFilters] = useState(false)
  const [mappedPartners, setMappedPartners] = useState<MappedPartner[]>([])

  // Data states
  const [metrics, setMetrics] = useState<PortfolioMetrics | null>(null)
  const [salesTrend, setSalesTrend] = useState<DailyDataPoint[]>([])
  const [ppcTrend, setPpcTrend] = useState<PpcDailyPoint[]>([])
  const [topBrands, setTopBrands] = useState<BrandRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Resolve filtered partner IDs
  const filteredPartnerIds = useMemo(() => {
    if (filters.tiers.length === 0 && filters.statuses.length === 0) return undefined
    return mappedPartners
      .filter((p) => {
        if (filters.tiers.length > 0 && (!p.tier || !filters.tiers.includes(p.tier))) return false
        if (filters.statuses.length > 0 && (!p.status || !filters.statuses.includes(p.status))) return false
        return true
      })
      .map((p) => p.entity_id)
  }, [mappedPartners, filters])

  const brandCount = filteredPartnerIds ? filteredPartnerIds.length : mappedPartners.length

  // Fetch mapped partners (for filter options)
  useEffect(() => {
    async function fetchPartners() {
      try {
        const res = await fetch('/api/bigquery/partner-mappings')
        if (!res.ok) return
        const json = await res.json()
        const mappings = json.data?.mappings || []
        setMappedPartners(mappings.map((m: { entity_id: string; external_id: string; brand_name?: string; tier?: string; status?: string }) => ({
          entity_id: m.entity_id,
          external_id: m.external_id,
          brand_name: m.brand_name || m.external_id,
          tier: m.tier || null,
          status: m.status || null,
        })))
      } catch (err) { console.error('[portfolio] Failed to fetch partners:', err) }
    }
    fetchPartners()
  }, [])

  // Portfolio query helper
  const portfolioQuery = useCallback(async (body: Record<string, unknown>) => {
    const res = await fetch('/api/bigquery/portfolio-query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...body,
        date_range: { preset: period },
        ...(filteredPartnerIds ? { partner_ids: filteredPartnerIds } : {}),
      }),
    })
    if (!res.ok) throw new Error('Query failed')
    const json = await res.json()
    return json.data
  }, [period, filteredPartnerIds])

  // Fetch all data
  const fetchAll = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Run all queries in parallel
      const [salesResult, ppcResult, salesTrendResult, ppcTrendResult, brandsResult] = await Promise.allSettled([
        // Total sales
        portfolioQuery({
          view: 'sales',
          metrics: ['ordered_product_sales_amount'],
          aggregation: 'sum',
          mode: 'aggregate',
        }),
        // PPC metrics (spend + sales for ACOS/ROAS)
        portfolioQuery({
          view: 'sp',
          metrics: ['ppc_spend', 'ppc_sales'],
          aggregation: 'sum',
          mode: 'aggregate',
        }),
        // Sales trend
        portfolioQuery({
          view: 'sales',
          metrics: ['ordered_product_sales_amount'],
          aggregation: 'sum',
          group_by: 'date',
          sort_by: 'date',
          sort_direction: 'asc',
          limit: 500,
        }),
        // PPC trend
        portfolioQuery({
          view: 'sp',
          metrics: ['ppc_spend', 'ppc_sales'],
          aggregation: 'sum',
          group_by: 'date',
          sort_by: 'date',
          sort_direction: 'asc',
          limit: 500,
        }),
        // Top brands by sales
        portfolioQuery({
          view: 'sales',
          metrics: ['ordered_product_sales_amount', 'units_ordered'],
          aggregation: 'sum',
          group_by_brand: true,
          sort_by: 'ordered_product_sales_amount',
          sort_direction: 'desc',
          limit: 50,
        }),
      ])

      // Extract metrics
      let totalSales = 0
      let ppcSpend = 0
      let ppcSales = 0

      if (salesResult.status === 'fulfilled' && salesResult.value?.data) {
        totalSales = salesResult.value.data.value ?? salesResult.value.data.ordered_product_sales_amount ?? 0
      }
      if (ppcResult.status === 'fulfilled' && ppcResult.value?.data) {
        ppcSpend = ppcResult.value.data.ppc_spend ?? 0
        ppcSales = ppcResult.value.data.ppc_sales ?? 0
      }

      const acos = ppcSales > 0 ? (ppcSpend / ppcSales) * 100 : 0
      const roas = ppcSpend > 0 ? ppcSales / ppcSpend : 0

      setMetrics({ total_sales: totalSales, ppc_spend: ppcSpend, ppc_sales: ppcSales, acos, roas })

      // Extract sales trend
      if (salesTrendResult.status === 'fulfilled' && salesTrendResult.value?.data?.labels) {
        const { labels, datasets } = salesTrendResult.value.data
        const trend: DailyDataPoint[] = labels.map((date: string, i: number) => ({
          date,
          value: datasets[0]?.data[i] ?? 0,
        }))
        setSalesTrend(trend)
      }

      // Extract PPC trend
      if (ppcTrendResult.status === 'fulfilled' && ppcTrendResult.value?.data?.labels) {
        const { labels, datasets } = ppcTrendResult.value.data
        const spendData = datasets.find((d: { label: string }) => d.label === 'ppc_spend')?.data || []
        const salesData = datasets.find((d: { label: string }) => d.label === 'ppc_sales')?.data || []
        const trend: PpcDailyPoint[] = labels.map((date: string, i: number) => ({
          date,
          ppc_spend: spendData[i] ?? 0,
          ppc_sales: salesData[i] ?? 0,
        }))
        setPpcTrend(trend)
      }

      // Extract top brands
      if (brandsResult.status === 'fulfilled' && brandsResult.value?.data?.rows) {
        const { headers, rows } = brandsResult.value.data
        const brandIdx = headers.indexOf('client_id')
        const salesIdx = headers.indexOf('ordered_product_sales_amount')
        const unitsIdx = headers.indexOf('units_ordered')

        const brands: BrandRow[] = rows.map((row: string[]) => ({
          brand: row[brandIdx] || 'Unknown',
          sales: parseFloat(row[salesIdx] || '0'),
          units: parseInt(row[unitsIdx] || '0', 10),
        }))
        setTopBrands(brands)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load portfolio data')
    } finally {
      setIsLoading(false)
    }
  }, [portfolioQuery])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const hasActiveFilters = filters.tiers.length > 0 || filters.statuses.length > 0

  function toggleFilter(type: 'tiers' | 'statuses', value: string) {
    setFilters((prev) => ({
      ...prev,
      [type]: prev[type].includes(value)
        ? prev[type].filter((v) => v !== value)
        : [...prev[type], value],
    }))
  }

  function clearFilters() {
    setFilters({ tiers: [], statuses: [] })
  }

  const maxBrandSales = useMemo(() => {
    if (!topBrands.length) return 1
    return Math.max(...topBrands.map((b) => b.sales), 0.001)
  }, [topBrands])

  return (
    <div className="space-y-6">
      {/* Header: period selector + filter toggle */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs text-muted-foreground">
            {hasActiveFilters
              ? `Filtered: ${brandCount} brand${brandCount !== 1 ? 's' : ''}`
              : `All ${brandCount} mapped brand${brandCount !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
              hasActiveFilters
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
            style={!hasActiveFilters ? { boxShadow: '0 0 0 1px rgba(0,0,0,0.08)' } : undefined}
          >
            <Filter className="h-3 w-3" />
            Filters
            {hasActiveFilters && (
              <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-primary-foreground/20 rounded">
                {filters.tiers.length + filters.statuses.length}
              </span>
            )}
          </button>
          <div className="flex items-center rounded-lg p-0.5" style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.08)' }}>
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
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
      </div>

      {/* Filter bar (expandable) */}
      {showFilters && (
        <div
          className="rounded-xl p-4 space-y-3"
          style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.08)' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Filter by</span>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="text-xs text-primary hover:underline">
                Clear all
              </button>
            )}
          </div>

          {/* Tier filter */}
          <div>
            <span className="text-xs text-muted-foreground block mb-1.5">Tier</span>
            <div className="flex flex-wrap gap-1.5">
              {TIER_OPTIONS.map((tier) => (
                <button
                  key={tier}
                  onClick={() => toggleFilter('tiers', tier)}
                  className={cn(
                    'px-2.5 py-1 text-xs rounded-md transition-colors',
                    filters.tiers.includes(tier)
                      ? 'bg-foreground text-background'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                  style={!filters.tiers.includes(tier) ? { boxShadow: '0 0 0 1px rgba(0,0,0,0.08)' } : undefined}
                >
                  {TIER_LABELS[tier] || tier}
                </button>
              ))}
            </div>
          </div>

          {/* Status filter */}
          <div>
            <span className="text-xs text-muted-foreground block mb-1.5">Status</span>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_OPTIONS.map((status) => (
                <button
                  key={status}
                  onClick={() => toggleFilter('statuses', status)}
                  className={cn(
                    'px-2.5 py-1 text-xs rounded-md transition-colors',
                    filters.statuses.includes(status)
                      ? 'bg-foreground text-background'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                  style={!filters.statuses.includes(status) ? { boxShadow: '0 0 0 1px rgba(0,0,0,0.08)' } : undefined}
                >
                  {STATUS_LABELS[status] || status}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Loading state */}
      {isLoading && <PortfolioLoadingState />}

      {/* Error state */}
      {!isLoading && error && (
        <div className="rounded-xl p-6 text-center" style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.08)' }}>
          <p className="text-sm text-muted-foreground">{error}</p>
          <button onClick={fetchAll} className="mt-2 text-xs text-primary hover:underline">
            Retry
          </button>
        </div>
      )}

      {/* Data loaded */}
      {!isLoading && !error && metrics && (
        <>
          {/* Metric cards */}
          <div className="grid grid-cols-2 gap-3 md:gap-4 md:grid-cols-4">
            <MetricCard
              icon={<DollarSign className="h-4 w-4" />}
              label="Total Sales"
              value={formatCurrency(metrics.total_sales)}
              color="text-green-600 dark:text-green-400"
            />
            <MetricCard
              icon={<TrendingUp className="h-4 w-4" />}
              label="PPC Spend"
              value={formatCurrency(metrics.ppc_spend)}
              color="text-orange-600 dark:text-orange-400"
            />
            <MetricCard
              icon={<Target className="h-4 w-4" />}
              label="ACOS"
              value={metrics.acos > 0 ? `${metrics.acos.toFixed(1)}%` : '-'}
              subtitle="spend / ad sales"
              color="text-blue-600 dark:text-blue-400"
            />
            <MetricCard
              icon={<BarChart3 className="h-4 w-4" />}
              label="ROAS"
              value={metrics.roas > 0 ? `${metrics.roas.toFixed(2)}x` : '-'}
              subtitle="ad sales / spend"
              color="text-purple-600 dark:text-purple-400"
            />
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Sales trend */}
            {salesTrend.length > 0 && (
              <div className="rounded-xl p-4 md:p-6" style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.08)' }}>
                <p className="text-sm font-medium text-foreground mb-4">Sales Trend</p>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={salesTrend} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                      tickLine={false}
                      axisLine={{ stroke: 'hsl(var(--border))', strokeOpacity: 0.4 }}
                      tickFormatter={(d: string) => formatDateShort(d)}
                    />
                    <YAxis
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v: number) => `$${formatCompact(v)}`}
                      width={55}
                    />
                    <Tooltip content={<SalesChartTooltip />} cursor={{ stroke: 'hsl(var(--border))', strokeWidth: 1 }} />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      fill="url(#salesGradient)"
                      animationDuration={300}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* PPC performance */}
            {ppcTrend.length > 0 && (
              <div className="rounded-xl p-4 md:p-6" style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.08)' }}>
                <p className="text-sm font-medium text-foreground mb-4">PPC Performance</p>
                <ResponsiveContainer width="100%" height={220}>
                  <ComposedChart data={ppcTrend} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                      tickLine={false}
                      axisLine={{ stroke: 'hsl(var(--border))', strokeOpacity: 0.4 }}
                      tickFormatter={(d: string) => formatDateShort(d)}
                    />
                    <YAxis
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v: number) => `$${formatCompact(v)}`}
                      width={55}
                    />
                    <Tooltip content={<PpcChartTooltip />} cursor={{ stroke: 'hsl(var(--border))', strokeWidth: 1 }} />
                    <Bar
                      dataKey="ppc_spend"
                      fill="hsl(25, 95%, 53%)"
                      fillOpacity={0.3}
                      radius={[2, 2, 0, 0]}
                      animationDuration={300}
                    />
                    <Line
                      type="monotone"
                      dataKey="ppc_sales"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 2 }}
                      animationDuration={300}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Top brands table */}
          <div className="rounded-xl overflow-hidden" style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.08)' }}>
            <div className="p-4 md:p-6 pb-0 md:pb-0">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Top Brands by Sales</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Aggregated across {period === '7d' ? '7 days' : period === '30d' ? '30 days' : '90 days'}
                  </p>
                </div>
                {topBrands.length > 0 && (
                  <span className="text-xs text-muted-foreground" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {topBrands.length} brand{topBrands.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>

            {topBrands.length === 0 ? (
              <div className="px-4 md:px-6 pb-6 pt-2">
                <p className="text-sm text-muted-foreground text-center py-8">
                  No brand data available for this period.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left px-4 md:px-6 py-2 font-medium text-muted-foreground whitespace-nowrap">Brand</th>
                      <th className="text-right px-4 md:px-6 py-2 font-medium text-muted-foreground whitespace-nowrap">Sales</th>
                      <th className="text-right px-4 md:px-6 py-2 font-medium text-muted-foreground whitespace-nowrap hidden md:table-cell">Units</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topBrands.map((brand, idx) => (
                      <tr
                        key={brand.brand}
                        className={cn('transition-colors hover:bg-muted/40', idx % 2 === 0 && 'bg-muted/[0.15]')}
                      >
                        <td className="px-4 md:px-6 py-2.5">
                          <div className="flex flex-col gap-1">
                            <span className="font-medium text-foreground truncate max-w-[250px]">{brand.brand}</span>
                            <div className="h-1 rounded-full bg-muted w-full max-w-[160px]">
                              <div
                                className="h-full rounded-full bg-primary/60 transition-all"
                                style={{ width: `${Math.max((brand.sales / maxBrandSales) * 100, 2)}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 md:px-6 py-2.5 text-right whitespace-nowrap font-medium" style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {formatCurrency(brand.sales)}
                        </td>
                        <td className="px-4 md:px-6 py-2.5 text-right whitespace-nowrap text-muted-foreground hidden md:table-cell" style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {formatNumber(brand.units)}
                        </td>
                      </tr>
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

function PortfolioLoadingState() {
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
        {[0, 1].map((i) => (
          <div key={i} className="rounded-xl p-4 md:p-6" style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.08)' }}>
            <ShimmerBar width={140} height={14} className="mb-4" />
            <div
              className="w-full rounded-lg overflow-hidden bg-gradient-to-r from-muted/40 via-muted/15 to-muted/40 bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite]"
              style={{ height: 220 }}
            />
          </div>
        ))}
      </div>
      <div className="rounded-xl p-4 md:p-6 overflow-hidden" style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.08)' }}>
        <ShimmerBar width={160} height={14} className="mb-4" />
        <ShimmerGrid variant="table" rows={5} columns={3} />
      </div>
    </div>
  )
}
