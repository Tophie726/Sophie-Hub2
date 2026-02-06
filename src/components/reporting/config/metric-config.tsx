'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ViewSelector } from '@/components/reporting/config/view-selector'
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
        onChange={(view) => onConfigChange({ ...config, view })}
      />

      <div className="space-y-2">
        <Label htmlFor="metric-column">Metric Column</Label>
        <Input
          id="metric-column"
          value={config.metric}
          onChange={(e) => onConfigChange({ ...config, metric: e.target.value })}
          placeholder="e.g., ordered_product_sales"
          className="h-9"
        />
        <p className="text-xs text-muted-foreground">
          The BigQuery column name to aggregate
        </p>
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
