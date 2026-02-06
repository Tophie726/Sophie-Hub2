'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import { DollarSign, Activity, Database, Users, ArrowUp, ArrowDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ShimmerBar, ShimmerGrid } from '@/components/ui/shimmer-grid'
import { formatCurrency, formatNumber, formatCompact, formatDateShort, formatBytes } from '@/lib/reporting/formatters'
import type { UsageData, AccountUsage } from '@/types/usage'

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

interface TooltipPayloadEntry {
  value: number
  name: string
  color: string
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: TooltipPayloadEntry[]
  label?: string
}) {
  if (!active || !payload || !payload.length) return null

  return (
    <div
      className="bg-popover text-popover-foreground rounded-lg p-3"
      style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.1)' }}
    >
      <p className="text-xs text-muted-foreground mb-1">
        {label ? formatDateShort(label) : ''}
      </p>
      <div className="flex items-center gap-2">
        <span className="text-xs">Cost:</span>
        <span className="text-xs font-medium" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {formatCurrency(payload[0].value)}
        </span>
      </div>
      {payload[0] && (
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-muted-foreground">Queries:</span>
          <span className="text-xs" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {/* cost payload's sibling is queries — access from chart data */}
            {formatNumber(payload[1]?.value ?? 0)}
          </span>
        </div>
      )}
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
  // Only show for amazon-reporting module
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

  function handlePeriodChange(p: Period) {
    setPeriod(p)
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

  return (
    <div className="space-y-6">
      {/* Section header + period selector */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Data Usage & Cost</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            BigQuery query costs and per-account breakdown
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

      {/* Loading state */}
      {isLoading && <UsageLoadingState />}

      {/* Error state */}
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

      {/* Data loaded */}
      {!isLoading && !error && data && (
        <>
          {/* Metric cards */}
          <div className="grid grid-cols-2 gap-3 md:gap-4 md:grid-cols-4">
            <MetricCard
              icon={<DollarSign className="h-4 w-4" />}
              label="Est. Cost"
              value={formatCurrency(data.overview.total_cost_usd)}
              color="text-green-600 dark:text-green-400"
            />
            <MetricCard
              icon={<Activity className="h-4 w-4" />}
              label="Queries"
              value={formatNumber(data.overview.total_queries)}
              color="text-blue-600 dark:text-blue-400"
            />
            <MetricCard
              icon={<Database className="h-4 w-4" />}
              label="Data Scanned"
              value={formatBytes(data.overview.total_bytes_processed)}
              color="text-purple-600 dark:text-purple-400"
            />
            <MetricCard
              icon={<Users className="h-4 w-4" />}
              label="Active Accounts"
              value={formatNumber(data.overview.unique_accounts)}
              color="text-orange-600 dark:text-orange-400"
            />
          </div>

          {/* Cost trend chart */}
          {data.dailyCosts.length > 0 && (
            <div
              className="rounded-xl p-4 md:p-6"
              style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.08)' }}
            >
              <p className="text-sm font-medium text-foreground mb-4 text-wrap-balance">
                Daily Cost Trend
              </p>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart
                  data={data.dailyCosts}
                  margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
                >
                  <defs>
                    <linearGradient id="usage-gradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
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
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => `$${formatCompact(v)}`}
                    width={60}
                  />
                  <Tooltip
                    content={<ChartTooltip />}
                    cursor={{ stroke: 'hsl(var(--border))', strokeWidth: 1 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="cost"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#usage-gradient)"
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 2 }}
                    animationDuration={300}
                    animationEasing="ease-out"
                  />
                  {/* Hidden series so tooltip can access queries */}
                  <Area
                    type="monotone"
                    dataKey="queries"
                    stroke="transparent"
                    fill="transparent"
                    dot={false}
                    activeDot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Account usage table */}
          <div
            className="rounded-xl overflow-hidden"
            style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.08)' }}
          >
            <div className="p-4 md:p-6 pb-0 md:pb-0">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-foreground text-wrap-balance">
                  Top Accounts by Cost
                </p>
                {sortedAccounts.length > 0 && (
                  <span
                    className="text-xs text-muted-foreground"
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {sortedAccounts.length} account{sortedAccounts.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>

            {sortedAccounts.length === 0 ? (
              <div className="px-4 md:px-6 pb-6 pt-2">
                <p className="text-sm text-muted-foreground text-center py-8">
                  Account-level breakdown will appear as partners use their dashboards.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left px-4 md:px-6 py-2 font-medium text-muted-foreground whitespace-nowrap">
                        Account
                      </th>
                      <SortableHeader
                        label="Queries"
                        sortKey="query_count"
                        currentKey={sortKey}
                        currentDir={sortDir}
                        onSort={handleSort}
                      />
                      <SortableHeader
                        label="Scanned"
                        sortKey="total_bytes"
                        currentKey={sortKey}
                        currentDir={sortDir}
                        onSort={handleSort}
                        className="hidden md:table-cell"
                      />
                      <SortableHeader
                        label="Est. Cost"
                        sortKey="estimated_cost"
                        currentKey={sortKey}
                        currentDir={sortDir}
                        onSort={handleSort}
                      />
                      <SortableHeader
                        label="Last Query"
                        sortKey="last_query"
                        currentKey={sortKey}
                        currentDir={sortDir}
                        onSort={handleSort}
                        className="hidden md:table-cell"
                      />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedAccounts.map((account, idx) => (
                      <AccountRow
                        key={account.partner_name + idx}
                        account={account}
                        maxCost={maxCost}
                        isEven={idx % 2 === 0}
                      />
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
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode
  label: string
  value: string
  color: string
}) {
  return (
    <div
      className="rounded-xl p-4"
      style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.08)' }}
    >
      <div className={cn('flex items-center gap-1.5 mb-2', color)}>
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
      </div>
      <p
        className="text-2xl font-bold text-foreground"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {value}
      </p>
    </div>
  )
}

function SortableHeader({
  label,
  sortKey: key,
  currentKey,
  currentDir,
  onSort,
  className,
}: {
  label: string
  sortKey: SortKey
  currentKey: SortKey
  currentDir: SortDir
  onSort: (key: SortKey) => void
  className?: string
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
        {isActive && (
          currentDir === 'asc'
            ? <ArrowUp className="h-3 w-3" />
            : <ArrowDown className="h-3 w-3" />
        )}
      </span>
    </th>
  )
}

function AccountRow({
  account,
  maxCost,
  isEven,
}: {
  account: AccountUsage
  maxCost: number
  isEven: boolean
}) {
  const costRatio = account.estimated_cost / maxCost

  return (
    <tr
      className={cn(
        'transition-colors hover:bg-muted/40',
        isEven && 'bg-muted/[0.15]',
      )}
    >
      <td className="px-4 md:px-6 py-2.5">
        <div className="flex flex-col gap-1">
          <span className="font-medium text-foreground truncate max-w-[200px]">
            {account.partner_name}
          </span>
          {/* Cost bar — relative width */}
          <div className="h-1 rounded-full bg-muted w-full max-w-[140px]">
            <div
              className="h-full rounded-full bg-primary/60 transition-all"
              style={{ width: `${Math.max(costRatio * 100, 2)}%` }}
            />
          </div>
        </div>
      </td>
      <td
        className="px-4 md:px-6 py-2.5 text-right whitespace-nowrap"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {formatNumber(account.query_count)}
      </td>
      <td
        className="px-4 md:px-6 py-2.5 text-right whitespace-nowrap hidden md:table-cell"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {formatBytes(account.total_bytes)}
      </td>
      <td
        className="px-4 md:px-6 py-2.5 text-right whitespace-nowrap font-medium"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
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
      {/* Metric card shimmers */}
      <div className="grid grid-cols-2 gap-3 md:gap-4 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-xl p-4"
            style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.08)' }}
          >
            <ShimmerBar width={80} height={12} className="mb-3" />
            <ShimmerBar width={120} height={28} />
          </div>
        ))}
      </div>

      {/* Chart shimmer */}
      <div
        className="rounded-xl p-4 md:p-6"
        style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.08)' }}
      >
        <ShimmerBar width={140} height={14} className="mb-4" />
        <div
          className="w-full rounded-lg overflow-hidden bg-gradient-to-r from-muted/40 via-muted/15 to-muted/40 bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite]"
          style={{ height: 200 }}
        />
      </div>

      {/* Table shimmer */}
      <div
        className="rounded-xl p-4 md:p-6 overflow-hidden"
        style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.08)' }}
      >
        <ShimmerBar width={160} height={14} className="mb-4" />
        <ShimmerGrid variant="table" rows={5} columns={4} />
      </div>
    </div>
  )
}
