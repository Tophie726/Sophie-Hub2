'use client'

import { useState, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
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
import { ViewSelector } from '@/components/reporting/config/view-selector'
import { getMetricColumns, getColumnFormat, getColumnLabel } from '@/lib/bigquery/column-metadata'
import { cn } from '@/lib/utils'
import type { MetricWidgetConfig, AggregationType, DisplayFormat } from '@/types/modules'

const PPC_VIEWS = ['sp', 'sd', 'sb'] as const
const PPC_OPTIONS = [
  { value: 'sp' as const, label: 'Sponsored Products' },
  { value: 'sd' as const, label: 'Sponsored Display' },
  { value: 'sb' as const, label: 'Sponsored Brands' },
]

interface MetricConfigProps {
  config: MetricWidgetConfig
  title: string
  onConfigChange: (config: MetricWidgetConfig) => void
  onTitleChange: (title: string) => void
  titleTouched: boolean
  onTitleTouched: () => void
}

const AGGREGATIONS: { value: AggregationType; label: string }[] = [
  { value: 'sum', label: 'Sum' },
  { value: 'avg', label: 'Average' },
  { value: 'count', label: 'Count' },
  { value: 'min', label: 'Minimum' },
  { value: 'max', label: 'Maximum' },
]

const FORMATS: { value: DisplayFormat; label: string }[] = [
  { value: 'currency', label: 'Currency ($)' },
  { value: 'number', label: 'Number' },
  { value: 'percent', label: 'Percentage (%)' },
  { value: 'compact', label: 'Compact (1.2K)' },
]

const AGG_PREFIX: Record<AggregationType, string> = {
  sum: 'Total',
  avg: 'Average',
  count: 'Count of',
  min: 'Minimum',
  max: 'Maximum',
}

function generateMetricTitle(view: string, metric: string, aggregation: AggregationType): string {
  if (!metric) return ''
  const label = getColumnLabel(view, metric)
  return `${AGG_PREFIX[aggregation]} ${label}`
}

export function MetricConfig({ config, title, onConfigChange, onTitleChange, titleTouched, onTitleTouched }: MetricConfigProps) {
  const metricColumns = getMetricColumns(config.view)
  const [metricSearch, setMetricSearch] = useState('')
  const [metricOpen, setMetricOpen] = useState(false)

  const filteredMetrics = metricColumns.filter((col) => {
    if (!metricSearch) return true
    const q = metricSearch.toLowerCase()
    return col.label.toLowerCase().includes(q) || col.description.toLowerCase().includes(q)
  })

  const autoTitle = useCallback((view: string, metric: string, aggregation: AggregationType) => {
    if (!titleTouched) {
      onTitleChange(generateMetricTitle(view, metric, aggregation))
    }
  }, [titleTouched, onTitleChange])

  function handleMetricChange(column: string) {
    const format = getColumnFormat(config.view, column)
    onConfigChange({ ...config, metric: column, format })
    autoTitle(config.view, column, config.aggregation)
    setMetricOpen(false)
    setMetricSearch('')
  }

  const isPpcView = PPC_VIEWS.includes(config.view as typeof PPC_VIEWS[number])
  const activePpcViews = config.ppc_views ?? (isPpcView ? [config.view as typeof PPC_VIEWS[number]] : [])

  function handleViewChange(view: string) {
    const newMetrics = getMetricColumns(view)
    const firstMetric = newMetrics[0]?.column ?? ''
    const format = firstMetric ? getColumnFormat(view, firstMetric) : config.format
    const isPpc = PPC_VIEWS.includes(view as typeof PPC_VIEWS[number])
    onConfigChange({
      ...config,
      view,
      metric: firstMetric,
      format,
      ppc_views: isPpc ? [view as typeof PPC_VIEWS[number]] : undefined,
    })
    autoTitle(view, firstMetric, config.aggregation)
  }

  function togglePpcView(view: typeof PPC_VIEWS[number]) {
    const current = activePpcViews
    const next = current.includes(view)
      ? current.filter(v => v !== view)
      : [...current, view]
    // Must have at least one view selected
    if (next.length === 0) return
    onConfigChange({ ...config, ppc_views: next as ('sp' | 'sd' | 'sb')[] })
  }

  function handleAggregationChange(val: string) {
    const agg = val as AggregationType
    onConfigChange({ ...config, aggregation: agg })
    autoTitle(config.view, config.metric, agg)
  }

  function handleTitleChange(value: string) {
    onTitleTouched()
    onTitleChange(value)
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="metric-title">Title</Label>
        <Input
          id="metric-title"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="e.g., Total Sales"
          className="h-9"
        />
      </div>

      <ViewSelector
        value={config.view}
        onChange={handleViewChange}
      />

      {isPpcView && (
        <div className="space-y-1.5">
          <span className="text-xs text-muted-foreground">Campaign Types</span>
          <div className="flex flex-wrap gap-1.5">
            {PPC_OPTIONS.map(opt => {
              const isSelected = activePpcViews.includes(opt.value)
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => togglePpcView(opt.value)}
                  className={cn(
                    'px-2.5 py-1 text-xs rounded-md transition-colors active:scale-[0.97]',
                    isSelected
                      ? 'bg-foreground text-background'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                  style={!isSelected ? { boxShadow: '0 0 0 1px rgba(0,0,0,0.08)' } : undefined}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label>Metric</Label>
        <Popover open={metricOpen} onOpenChange={(open) => { setMetricOpen(open); if (!open) setMetricSearch('') }}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-start h-9 px-3 font-normal"
            >
              {config.metric ? (
                <span>{getColumnLabel(config.view, config.metric)}</span>
              ) : (
                <span className="text-muted-foreground">Select a metric</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2" align="start">
            <Input
              placeholder="Search metrics..."
              value={metricSearch}
              onChange={(e) => setMetricSearch(e.target.value)}
              className="h-8 mb-2 text-sm"
            />
            <div className="space-y-0.5 max-h-48 overflow-y-auto">
              {filteredMetrics.map((col) => (
                <button
                  key={col.column}
                  type="button"
                  onClick={() => handleMetricChange(col.column)}
                  className={`w-full text-left px-2 py-1.5 rounded-md cursor-pointer transition-colors text-sm ${
                    config.metric === col.column ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
                  }`}
                >
                  <div className="font-medium">{col.label}</div>
                  {col.description && (
                    <div className="text-xs text-muted-foreground">{col.description}</div>
                  )}
                </button>
              ))}
              {filteredMetrics.length === 0 && metricSearch && (
                <p className="text-xs text-muted-foreground px-2 py-1.5">No matching metrics</p>
              )}
              {metricColumns.length === 0 && (
                <p className="text-xs text-muted-foreground px-2 py-1.5">
                  Select a data view first
                </p>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Aggregation</Label>
          <Select
            value={config.aggregation}
            onValueChange={handleAggregationChange}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AGGREGATIONS.map((agg) => (
                <SelectItem key={agg.value} value={agg.value}>
                  {agg.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Format</Label>
          <Select
            value={config.format}
            onValueChange={(val) => onConfigChange({ ...config, format: val as DisplayFormat })}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FORMATS.map((fmt) => (
                <SelectItem key={fmt.value} value={fmt.value}>
                  {fmt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}
