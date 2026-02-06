'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ViewSelector } from '@/components/reporting/config/view-selector'
import { getMetricColumns, getColumnFormat } from '@/lib/bigquery/column-metadata'
import type { MetricWidgetConfig, AggregationType, DisplayFormat } from '@/types/modules'

interface MetricConfigProps {
  config: MetricWidgetConfig
  title: string
  onConfigChange: (config: MetricWidgetConfig) => void
  onTitleChange: (title: string) => void
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

export function MetricConfig({ config, title, onConfigChange, onTitleChange }: MetricConfigProps) {
  const metricColumns = getMetricColumns(config.view)

  function handleMetricChange(column: string) {
    const format = getColumnFormat(config.view, column)
    onConfigChange({ ...config, metric: column, format })
  }

  function handleViewChange(view: string) {
    // Reset metric when view changes since columns differ
    const newMetrics = getMetricColumns(view)
    const firstMetric = newMetrics[0]?.column ?? ''
    const format = firstMetric ? getColumnFormat(view, firstMetric) : config.format
    onConfigChange({ ...config, view, metric: firstMetric, format })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="metric-title">Title</Label>
        <Input
          id="metric-title"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="e.g., Total Sales"
          className="h-9"
        />
      </div>

      <ViewSelector
        value={config.view}
        onChange={handleViewChange}
      />

      <div className="space-y-2">
        <Label>Metric</Label>
        <Select value={config.metric} onValueChange={handleMetricChange}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Select a metric" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Available Metrics</SelectLabel>
              {metricColumns.map((col) => (
                <SelectItem key={col.column} value={col.column}>
                  {col.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        {metricColumns.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Select a data view first
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Aggregation</Label>
          <Select
            value={config.aggregation}
            onValueChange={(val) => onConfigChange({ ...config, aggregation: val as AggregationType })}
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
