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
        onChange={(view) => onConfigChange({ ...config, view })}
      />

      <div className="space-y-2">
        <Label htmlFor="table-columns">Columns</Label>
        <Input
          id="table-columns"
          value={config.columns.join(', ')}
          onChange={(e) =>
            onConfigChange({
              ...config,
              columns: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
            })
          }
          placeholder="e.g., asin, title, ordered_product_sales"
          className="h-9"
        />
        <p className="text-xs text-muted-foreground">
          Comma-separated column names to display
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="table-sort">Sort By</Label>
          <Input
            id="table-sort"
            value={config.sort_by}
            onChange={(e) => onConfigChange({ ...config, sort_by: e.target.value })}
            placeholder="e.g., ordered_product_sales"
            className="h-9"
          />
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
