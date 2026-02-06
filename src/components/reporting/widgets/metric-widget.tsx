'use client'

import { useState, useEffect, useCallback } from 'react'
import { ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ShimmerBar } from '@/components/ui/shimmer-grid'
import { formatByType } from '@/lib/reporting/formatters'
import type { MetricWidgetProps, TrendDirection } from '@/lib/reporting/types'
import type { MetricQueryResult } from '@/types/modules'

export function MetricWidget({ config, dateRange, partnerId, title }: MetricWidgetProps) {
  const [data, setData] = useState<MetricQueryResult | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchMetric = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Computed metric: fetch numerator + denominator and calculate client-side
      if (config.computed) {
        const { formula, numerator, denominator } = config.computed
        const views = config.ppc_views && config.ppc_views.length > 1
          ? config.ppc_views
          : [config.view]

        // Fetch both metrics across all views in parallel
        const results = await Promise.all(
          views.map(async (view) => {
            const res = await fetch('/api/bigquery/query', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                partner_id: partnerId,
                view,
                metrics: [numerator, denominator],
                aggregation: config.aggregation,
                date_range: dateRange,
              }),
            })
            if (!res.ok) {
              const json = await res.json()
              throw new Error(json.error?.message || 'Failed to load metric')
            }
            const json = await res.json()
            return json.data?.data || json.data
          })
        )

        // Sum numerator and denominator across views
        let numTotal = 0
        let denTotal = 0
        for (const result of results) {
          numTotal += Number(result?.[numerator] ?? result?.value ?? 0)
          denTotal += Number(result?.[denominator] ?? 0)
        }

        // Apply formula
        let computedValue: number
        if (denTotal === 0) {
          setData({ value: 0, formatted: '\u2014' }) // em dash for division by zero
          return
        }
        const ratio = numTotal / denTotal
        if (['acos', 'ctr', 'cvr', 'tacos'].includes(formula)) {
          computedValue = ratio * 100
        } else {
          computedValue = ratio
        }

        setData({
          value: computedValue,
          formatted: formatByType(computedValue, config.format),
        })
        return
      }

      // Multi-view: fetch from each PPC view in parallel and sum
      if (config.ppc_views && config.ppc_views.length > 1) {
        const results = await Promise.all(
          config.ppc_views.map(async (view) => {
            const res = await fetch('/api/bigquery/query', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                partner_id: partnerId,
                view,
                metrics: [config.metric],
                aggregation: config.aggregation,
                date_range: dateRange,
              }),
            })
            if (!res.ok) {
              const json = await res.json()
              throw new Error(json.error?.message || 'Failed to load metric')
            }
            const json = await res.json()
            return json.data?.data || json.data
          })
        )

        // Sum the values across all views
        let total = 0
        for (const result of results) {
          total += Number(result?.value ?? 0)
        }

        setData({
          value: total,
          formatted: formatByType(total, config.format),
        })
        return
      }

      // Single view: default behavior
      const res = await fetch('/api/bigquery/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partner_id: partnerId,
          view: config.view,
          metrics: [config.metric],
          aggregation: config.aggregation,
          date_range: dateRange,
        }),
      })

      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error?.message || 'Failed to load metric')
      }

      const json = await res.json()
      // API returns { data: { mapped, type, data: { value } } }
      setData(json.data?.data || json.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load metric')
    } finally {
      setIsLoading(false)
    }
  }, [partnerId, config, dateRange])

  useEffect(() => {
    fetchMetric()
  }, [fetchMetric])

  // Determine trend direction
  const trend: TrendDirection = data?.comparison
    ? data.comparison.change_percent > 0
      ? 'up'
      : data.comparison.change_percent < 0
        ? 'down'
        : 'flat'
    : 'flat'

  const trendPercent = data?.comparison
    ? Math.abs(data.comparison.change_percent).toFixed(1)
    : null

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-4 md:p-6 h-full">
        {title && (
          <div className="mb-3">
            <ShimmerBar width={80} height={12} />
          </div>
        )}
        <ShimmerBar width={120} height={36} />
        <div className="mt-2">
          <ShimmerBar width={60} height={14} />
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-4 md:p-6 h-full">
        <p className="text-sm text-muted-foreground">{error}</p>
        <button
          onClick={fetchMetric}
          className="mt-2 text-xs text-primary hover:underline"
        >
          Retry
        </button>
      </div>
    )
  }

  // Empty state
  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center p-4 md:p-6 h-full">
        <p className="text-sm text-muted-foreground">No data available</p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          Try expanding the date range.
        </p>
      </div>
    )
  }

  const formattedValue = data.formatted || formatByType(data.value, config.format)

  return (
    <div className="flex flex-col items-center justify-center p-4 md:p-6 h-full antialiased">
      {/* Label */}
      {title && (
        <p className="text-sm text-muted-foreground uppercase tracking-wide mb-2 text-wrap-balance text-center">
          {title}
        </p>
      )}

      {/* Large value */}
      <p
        className="text-3xl md:text-4xl font-bold text-foreground"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {formattedValue}
      </p>

      {/* Trend indicator */}
      {trendPercent && trend !== 'flat' && (
        <div
          className={cn(
            'flex items-center gap-1 mt-2 text-sm font-medium',
            trend === 'up' && 'text-emerald-600 dark:text-emerald-400',
            trend === 'down' && 'text-red-600 dark:text-red-400',
          )}
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {trend === 'up' ? (
            <ArrowUpRight className="h-4 w-4" />
          ) : (
            <ArrowDownRight className="h-4 w-4" />
          )}
          <span>{trendPercent}%</span>
        </div>
      )}
    </div>
  )
}
