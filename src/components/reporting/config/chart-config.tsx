'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { ViewSelector } from '@/components/reporting/config/view-selector'
import { getMetricColumns, getDimensionColumns, getColumnLabel, getColumnFormat } from '@/lib/bigquery/column-metadata'
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
  const dimensionColumns = getDimensionColumns(config.view)
  const metricColumns = getMetricColumns(config.view)

  function handleViewChange(view: string) {
    const newDims = getDimensionColumns(view)
    const newMetrics = getMetricColumns(view)
    const xAxis = newDims.find(d => d.category === 'temporal')?.column ?? newDims[0]?.column ?? ''
    const yAxis = newMetrics.length > 0 ? [newMetrics[0].column] : []
    const format = yAxis.length > 0 ? getColumnFormat(view, yAxis[0]) : config.format
    onConfigChange({ ...config, view, x_axis: xAxis, y_axis: yAxis, format })
  }

  function toggleYAxis(column: string) {
    const current = config.y_axis
    const next = current.includes(column)
      ? current.filter(c => c !== column)
      : [...current, column]
    const format = next.length > 0 ? getColumnFormat(config.view, next[0]) : config.format
    onConfigChange({ ...config, y_axis: next, format })
  }

  function removeYAxis(column: string) {
    const next = config.y_axis.filter(c => c !== column)
    const format = next.length > 0 ? getColumnFormat(config.view, next[0]) : config.format
    onConfigChange({ ...config, y_axis: next, format })
  }

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
        onChange={handleViewChange}
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
        <Label>X-Axis</Label>
        <Select
          value={config.x_axis}
          onValueChange={(val) => onConfigChange({ ...config, x_axis: val })}
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Select x-axis" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Dimensions</SelectLabel>
              {dimensionColumns.map((col) => (
                <SelectItem key={col.column} value={col.column}>
                  {col.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Y-Axis Metrics</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-start h-auto min-h-9 py-1.5 px-3 font-normal"
            >
              {config.y_axis.length === 0 ? (
                <span className="text-muted-foreground">Select metrics</span>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {config.y_axis.map(col => (
                    <span
                      key={col}
                      className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-medium"
                    >
                      {getColumnLabel(config.view, col)}
                      <button
                        type="button"
                        className="ml-0.5 rounded-sm hover:bg-muted-foreground/20"
                        onClick={(e) => {
                          e.stopPropagation()
                          removeYAxis(col)
                        }}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2" align="start">
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {metricColumns.map((col) => (
                <label
                  key={col.column}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-muted transition-colors"
                >
                  <Checkbox
                    checked={config.y_axis.includes(col.column)}
                    onCheckedChange={() => toggleYAxis(col.column)}
                  />
                  <span className="text-sm">{col.label}</span>
                </label>
              ))}
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
