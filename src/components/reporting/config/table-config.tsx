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
import { getTableColumns, getColumnLabel } from '@/lib/bigquery/column-metadata'
import type { TableWidgetConfig, SortDirection } from '@/types/modules'

interface TableConfigProps {
  config: TableWidgetConfig
  title: string
  onConfigChange: (config: TableWidgetConfig) => void
  onTitleChange: (title: string) => void
}

const ROW_LIMITS = [
  { value: '10', label: '10 rows' },
  { value: '20', label: '20 rows' },
  { value: '50', label: '50 rows' },
]

export function TableConfig({ config, title, onConfigChange, onTitleChange }: TableConfigProps) {
  const tableColumns = getTableColumns(config.view)

  function handleViewChange(view: string) {
    const newCols = getTableColumns(view)
    const firstFew = newCols.slice(0, 4).map(c => c.column)
    const sortBy = firstFew[0] ?? ''
    onConfigChange({ ...config, view, columns: firstFew, sort_by: sortBy })
  }

  function toggleColumn(column: string) {
    const current = config.columns
    const next = current.includes(column)
      ? current.filter(c => c !== column)
      : [...current, column]
    // If sort_by column was removed, reset to first remaining
    const sortBy = next.includes(config.sort_by) ? config.sort_by : (next[0] ?? '')
    onConfigChange({ ...config, columns: next, sort_by: sortBy })
  }

  function removeColumn(column: string) {
    const next = config.columns.filter(c => c !== column)
    const sortBy = next.includes(config.sort_by) ? config.sort_by : (next[0] ?? '')
    onConfigChange({ ...config, columns: next, sort_by: sortBy })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="table-title">Title</Label>
        <Input
          id="table-title"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="e.g., Top Products"
          className="h-9"
        />
      </div>

      <ViewSelector
        value={config.view}
        onChange={handleViewChange}
      />

      <div className="space-y-2">
        <Label>Columns</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-start h-auto min-h-9 py-1.5 px-3 font-normal"
            >
              {config.columns.length === 0 ? (
                <span className="text-muted-foreground">Select columns</span>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {config.columns.map(col => (
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
                          removeColumn(col)
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
            <div className="space-y-1 max-h-56 overflow-y-auto">
              {tableColumns.map((col) => (
                <label
                  key={col.column}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-muted transition-colors"
                >
                  <Checkbox
                    checked={config.columns.includes(col.column)}
                    onCheckedChange={() => toggleColumn(col.column)}
                  />
                  <div className="flex flex-col">
                    <span className="text-sm">{col.label}</span>
                    {col.description && (
                      <span className="text-xs text-muted-foreground">{col.description}</span>
                    )}
                  </div>
                </label>
              ))}
              {tableColumns.length === 0 && (
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
          <Label>Sort By</Label>
          <Select
            value={config.sort_by}
            onValueChange={(val) => onConfigChange({ ...config, sort_by: val })}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Select column" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Selected Columns</SelectLabel>
                {config.columns.map((col) => (
                  <SelectItem key={col} value={col}>
                    {getColumnLabel(config.view, col)}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Direction</Label>
          <Select
            value={config.sort_direction}
            onValueChange={(val) => onConfigChange({ ...config, sort_direction: val as SortDirection })}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="desc">Descending</SelectItem>
              <SelectItem value="asc">Ascending</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Row Limit</Label>
        <Select
          value={String(config.limit)}
          onValueChange={(val) => onConfigChange({ ...config, limit: parseInt(val, 10) })}
        >
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROW_LIMITS.map((rl) => (
              <SelectItem key={rl.value} value={rl.value}>
                {rl.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
