'use client'

import { useState, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { getMetricColumns, getColumnLabel } from '@/lib/bigquery/column-metadata'
import { cn } from '@/lib/utils'
import type { AiTextWidgetConfig } from '@/types/modules'

interface AiTextConfigProps {
  config: AiTextWidgetConfig
  title: string
  onConfigChange: (config: AiTextWidgetConfig) => void
  onTitleChange: (title: string) => void
  titleTouched: boolean
  onTitleTouched: () => void
}

const FORMAT_OPTIONS = [
  { value: 'summary' as const, label: 'Summary paragraph' },
  { value: 'bullets' as const, label: 'Bullet points' },
  { value: 'comparison' as const, label: 'Comparison analysis' },
]

export function AiTextConfig({ config, title, onConfigChange, onTitleChange, titleTouched, onTitleTouched }: AiTextConfigProps) {
  const metricColumns = getMetricColumns(config.view)
  const [metricSearch, setMetricSearch] = useState('')
  const [metricOpen, setMetricOpen] = useState(false)

  const filteredMetrics = metricColumns.filter((col) => {
    if (!metricSearch) return true
    const q = metricSearch.toLowerCase()
    return col.label.toLowerCase().includes(q) || col.description.toLowerCase().includes(q)
  })

  const autoTitle = useCallback((prompt: string) => {
    if (!titleTouched && prompt) {
      onTitleChange(prompt.length > 50 ? prompt.slice(0, 50) + '...' : prompt)
    }
  }, [titleTouched, onTitleChange])

  function handlePromptChange(prompt: string) {
    onConfigChange({ ...config, prompt })
    autoTitle(prompt)
  }

  function handleViewChange(view: string) {
    onConfigChange({ ...config, view, metrics: [] })
  }

  function toggleMetric(column: string) {
    const current = config.metrics || []
    const next = current.includes(column)
      ? current.filter(m => m !== column)
      : [...current, column]
    onConfigChange({ ...config, metrics: next })
  }

  function handleTitleChange(value: string) {
    onTitleTouched()
    onTitleChange(value)
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="ai-text-title">Title</Label>
        <Input
          id="ai-text-title"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="e.g., Sales Summary"
          className="h-9"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="ai-prompt">Prompt</Label>
        <Textarea
          id="ai-prompt"
          value={config.prompt}
          onChange={(e) => handlePromptChange(e.target.value)}
          placeholder="e.g., Summarize the key trends in this data and highlight any notable changes..."
          className="min-h-[80px] resize-y"
        />
        <p className="text-xs text-muted-foreground">
          Describe what you want the AI to analyze from the selected metrics.
        </p>
      </div>

      <ViewSelector
        value={config.view}
        onChange={handleViewChange}
      />

      <div className="space-y-2">
        <Label>Metrics to Include</Label>
        <Popover open={metricOpen} onOpenChange={(open) => { setMetricOpen(open); if (!open) setMetricSearch('') }}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-start h-9 px-3 font-normal"
            >
              {config.metrics.length > 0 ? (
                <span className="truncate">
                  {config.metrics.length} metric{config.metrics.length !== 1 ? 's' : ''} selected
                </span>
              ) : (
                <span className="text-muted-foreground">Select metrics</span>
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
              {filteredMetrics.map((col) => {
                const isSelected = config.metrics.includes(col.column)
                return (
                  <button
                    key={col.column}
                    type="button"
                    onClick={() => toggleMetric(col.column)}
                    className={cn(
                      'w-full text-left px-2 py-1.5 rounded-md cursor-pointer transition-colors text-sm',
                      isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        'h-3.5 w-3.5 rounded border flex items-center justify-center flex-shrink-0',
                        isSelected ? 'bg-primary border-primary' : 'border-muted-foreground/30'
                      )}>
                        {isSelected && (
                          <svg className="h-2.5 w-2.5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <div>
                        <div className="font-medium">{col.label}</div>
                        {col.description && (
                          <div className="text-xs text-muted-foreground">{col.description}</div>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
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
        {config.metrics.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {config.metrics.map((m) => (
              <span
                key={m}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-md bg-muted text-muted-foreground"
              >
                {getColumnLabel(config.view, m)}
                <button
                  type="button"
                  onClick={() => toggleMetric(m)}
                  className="hover:text-foreground transition-colors"
                >
                  x
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label>Output Format</Label>
        <Select
          value={config.format}
          onValueChange={(val) => onConfigChange({ ...config, format: val as AiTextWidgetConfig['format'] })}
        >
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FORMAT_OPTIONS.map((fmt) => (
              <SelectItem key={fmt.value} value={fmt.value}>
                {fmt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
