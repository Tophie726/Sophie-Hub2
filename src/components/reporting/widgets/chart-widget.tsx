'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  BarChart,
  AreaChart,
  Line,
  Bar,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import { formatCompact, formatDateShort, resolveColumnLabel, formatByType } from '@/lib/reporting/formatters'
import { fetchBigQuery } from '@/lib/bigquery/query-cache'
import type { ChartWidgetProps } from '@/lib/reporting/types'
import { CHART_COLORS } from '@/lib/reporting/types'
import type { ChartQueryResult } from '@/types/modules'

// Default chart height for 1 row_span
const DEFAULT_HEIGHT = 200
// Additional height per extra row (including 16px gap)
const ROW_HEIGHT_INCREMENT = 216

interface TooltipPayloadEntry {
  name: string
  value: number
  color: string
}

function CustomTooltip({
  active,
  payload,
  label,
  format,
  viewAlias,
}: {
  active?: boolean
  payload?: TooltipPayloadEntry[]
  label?: string
  format: string
  viewAlias: string
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
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2">
          <div
            className="h-2 w-2 rounded-full flex-shrink-0"
            style={{ background: entry.color }}
          />
          <span className="text-xs">{resolveColumnLabel(viewAlias, entry.name)}:</span>
          <span
            className="text-xs font-medium"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {formatByType(entry.value, format as 'number' | 'currency' | 'percent' | 'compact')}
          </span>
        </div>
      ))}
    </div>
  )
}

export function ChartWidget({ config, dateRange, partnerId, title, height }: ChartWidgetProps) {
  const [data, setData] = useState<ChartQueryResult | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const chartHeight = height || DEFAULT_HEIGHT

  const fetchChart = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Multi-view: fetch from each PPC view in parallel and merge by date
      if (config.ppc_views && config.ppc_views.length > 1) {
        const results = await Promise.all(
          config.ppc_views.map(async (view) => {
            const result = await fetchBigQuery({
              partner_id: partnerId,
              view,
              metrics: config.y_axis,
              aggregation: config.aggregation,
              group_by: config.x_axis,
              date_range: dateRange,
              sort_by: config.x_axis,
              sort_direction: 'asc',
              limit: 365,
            })
            const r = result as Record<string, unknown>
            return (r?.data || result) as ChartQueryResult
          })
        )

        // Merge datasets by date label: sum values for same dates
        const mergedMap = new Map<string, Record<string, number>>()

        for (const result of results) {
          if (!result?.labels) continue
          result.labels.forEach((label, i) => {
            const existing = mergedMap.get(label) || {}
            for (const ds of result.datasets) {
              existing[ds.label] = (existing[ds.label] || 0) + (ds.data[i] ?? 0)
            }
            mergedMap.set(label, existing)
          })
        }

        // Build merged ChartQueryResult
        const sortedLabels = Array.from(mergedMap.keys()).sort()
        const datasetLabels = results[0]?.datasets.map(ds => ds.label) ?? config.y_axis
        const mergedDatasets = datasetLabels.map(label => ({
          label,
          data: sortedLabels.map(date => mergedMap.get(date)?.[label] ?? 0),
        }))

        setData({ labels: sortedLabels, datasets: mergedDatasets })
        return
      }

      // Single view: default behavior
      const result = await fetchBigQuery({
        partner_id: partnerId,
        view: config.view,
        metrics: config.y_axis,
        aggregation: config.aggregation,
        group_by: config.x_axis,
        date_range: dateRange,
        sort_by: config.x_axis,
        sort_direction: 'asc',
        limit: 365,
      })
      const r = result as Record<string, unknown>
      setData((r?.data || result) as ChartQueryResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load chart')
    } finally {
      setIsLoading(false)
    }
  }, [partnerId, config, dateRange])

  useEffect(() => {
    fetchChart()
  }, [fetchChart])

  // Transform API response to recharts format
  const chartData = useMemo(() => {
    if (!data) return []
    return data.labels.map((label, i) => {
      const point: Record<string, string | number> = { date: label }
      data.datasets.forEach(ds => {
        point[ds.label] = ds.data[i] ?? 0
      })
      return point
    })
  }, [data])

  const seriesKeys = useMemo(() => {
    return data?.datasets.map(ds => ds.label) ?? []
  }, [data])

  // Loading state - shimmer rectangle matching chart area
  if (isLoading) {
    return (
      <div className="p-4 md:p-6 antialiased">
        {title && (
          <div className="h-4 w-32 rounded bg-gradient-to-r from-muted/40 via-muted/15 to-muted/40 bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite] mb-4" />
        )}
        <div
          className="w-full rounded-lg overflow-hidden bg-gradient-to-r from-muted/40 via-muted/15 to-muted/40 bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite]"
          style={{ height: chartHeight }}
        />
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-4 md:p-6 h-full">
        <p className="text-sm text-muted-foreground">{error}</p>
        <button
          onClick={fetchChart}
          className="mt-2 text-xs text-primary hover:underline"
        >
          Retry
        </button>
      </div>
    )
  }

  // Empty state
  if (!data || chartData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-4 md:p-6 h-full">
        <p className="text-sm text-muted-foreground">No data for this date range.</p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          Try expanding the range.
        </p>
      </div>
    )
  }

  const commonAxisProps = {
    xAxis: {
      dataKey: 'date' as const,
      tick: { fill: 'hsl(var(--muted-foreground))', fontSize: 11 },
      tickLine: false,
      axisLine: { stroke: 'hsl(var(--border))', strokeOpacity: 0.4 },
      tickFormatter: (date: string) => formatDateShort(date),
    },
    yAxis: {
      tick: { fill: 'hsl(var(--muted-foreground))', fontSize: 11 },
      tickLine: false,
      axisLine: false,
      tickFormatter: (value: number) => formatCompact(value),
      width: 60,
    },
    grid: {
      strokeDasharray: '3 3',
      stroke: 'hsl(var(--border))',
      strokeOpacity: 0.4,
      vertical: false,
    },
  }

  const tooltipContent = (
    <Tooltip
      content={<CustomTooltip format={config.format} viewAlias={config.view} />}
      cursor={{ stroke: 'hsl(var(--border))', strokeWidth: 1 }}
    />
  )

  const gridElement = <CartesianGrid {...commonAxisProps.grid} />
  const xAxisElement = <XAxis {...commonAxisProps.xAxis} />
  const yAxisElement = <YAxis {...commonAxisProps.yAxis} />

  return (
    <div className="p-4 md:p-6 antialiased">
      {title && (
        <p className="text-sm font-medium text-foreground mb-4 text-wrap-balance">
          {title}
        </p>
      )}
      <ResponsiveContainer width="100%" height={chartHeight}>
        {config.chart_type === 'bar' ? (
          <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            {gridElement}
            {xAxisElement}
            {yAxisElement}
            {tooltipContent}
            {seriesKeys.map((key, i) => (
              <Bar
                key={key}
                dataKey={key}
                fill={CHART_COLORS[i % CHART_COLORS.length]}
                radius={[4, 4, 0, 0]}
                barSize={32}
                animationDuration={300}
                animationEasing="ease-out"
              />
            ))}
          </BarChart>
        ) : config.chart_type === 'area' ? (
          <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              {seriesKeys.map((key, i) => (
                <linearGradient key={key} id={`gradient-${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_COLORS[i % CHART_COLORS.length]} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={CHART_COLORS[i % CHART_COLORS.length]} stopOpacity={0.02} />
                </linearGradient>
              ))}
            </defs>
            {gridElement}
            {xAxisElement}
            {yAxisElement}
            {tooltipContent}
            {seriesKeys.map((key, i) => (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                stroke={CHART_COLORS[i % CHART_COLORS.length]}
                strokeWidth={2}
                fill={`url(#gradient-${i})`}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2 }}
                animationDuration={300}
                animationEasing="ease-out"
              />
            ))}
          </AreaChart>
        ) : (
          /* Default: line chart */
          <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            {gridElement}
            {xAxisElement}
            {yAxisElement}
            {tooltipContent}
            {seriesKeys.map((key, i) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={CHART_COLORS[i % CHART_COLORS.length]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2 }}
                animationDuration={300}
                animationEasing="ease-out"
              />
            ))}
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  )
}

/**
 * Calculate chart height from widget row_span.
 * 1 row = 200px, each additional row adds 216px (200 + 16px gap).
 */
export function chartHeightFromRowSpan(rowSpan: number): number {
  if (rowSpan <= 1) return DEFAULT_HEIGHT
  return DEFAULT_HEIGHT + (rowSpan - 1) * ROW_HEIGHT_INCREMENT
}
