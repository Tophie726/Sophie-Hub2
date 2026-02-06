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
import type { ChartWidgetConfig, ChartType, AggregationType, DisplayFormat } from '@/types/modules'

interface ChartConfigProps {
  config: ChartWidgetConfig
  title: string
  onConfigChange: (config: ChartWidgetConfig) => void
  onTitleChange: (title: string) => void
}

const CHART_TYPES: { value: ChartType; label: string }[] = [
  { value: 'line', label: 'Line' },
  { value: 'bar', label: 'Bar' },
  { value: 'area', label: 'Area' },
]

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

export function ChartConfig({ config, title, onConfigChange, onTitleChange }: ChartConfigProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="chart-title">Title</Label>
        <Input
          id="chart-title"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="e.g., Sales Over Time"
          className="h-9"
        />
      </div>

      <ViewSelector
        value={config.view}
        onChange={(view) => onConfigChange({ ...config, view })}
      />

      <div className="space-y-2">
        <Label>Chart Type</Label>
        <Select
          value={config.chart_type}
          onValueChange={(val) => onConfigChange({ ...config, chart_type: val as ChartType })}
        >
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CHART_TYPES.map((ct) => (
              <SelectItem key={ct.value} value={ct.value}>
                {ct.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="chart-xaxis">X-Axis Column</Label>
        <Input
          id="chart-xaxis"
          value={config.x_axis}
          onChange={(e) => onConfigChange({ ...config, x_axis: e.target.value })}
          placeholder="e.g., date"
          className="h-9"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="chart-yaxis">Y-Axis Columns</Label>
        <Input
          id="chart-yaxis"
          value={config.y_axis.join(', ')}
          onChange={(e) =>
            onConfigChange({
              ...config,
              y_axis: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
            })
          }
          placeholder="e.g., ordered_product_sales, units_ordered"
          className="h-9"
        />
        <p className="text-xs text-muted-foreground">
          Comma-separated column names for the Y-axis
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
          <Label>Y-Axis Format</Label>
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
