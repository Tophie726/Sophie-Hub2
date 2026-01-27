'use client'

import { Search, ArrowUpDown, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface FilterOption {
  value: string
  label: string
}

interface EntityListToolbarProps {
  search: string
  onSearchChange: (value: string) => void
  statusOptions: FilterOption[]
  selectedStatuses: string[]
  onStatusChange: (statuses: string[]) => void
  sortOptions: FilterOption[]
  currentSort: string
  sortOrder: 'asc' | 'desc'
  onSortChange: (sort: string, order: 'asc' | 'desc') => void
  resultCount?: number
  totalCount?: number
  placeholder?: string
}

export function EntityListToolbar({
  search,
  onSearchChange,
  statusOptions,
  selectedStatuses,
  onStatusChange,
  sortOptions,
  currentSort,
  sortOrder,
  onSortChange,
  resultCount,
  totalCount,
  placeholder = 'Search...',
}: EntityListToolbarProps) {
  const hasActiveFilters = selectedStatuses.length > 0

  return (
    <div className="sticky top-16 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border/40">
      <div className="flex flex-col gap-3 px-6 py-3 md:px-8 md:flex-row md:items-center">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder={placeholder}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        {/* Status filter chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => onStatusChange([])}
            className={cn(
              'shrink-0 px-2.5 py-1 text-xs font-medium rounded-md border transition-colors',
              selectedStatuses.length === 0
                ? 'bg-foreground text-background border-foreground'
                : 'text-muted-foreground border-border/60 hover:border-border hover:text-foreground'
            )}
          >
            All
          </button>
          {statusOptions.map(opt => {
            const active = selectedStatuses.includes(opt.value)
            return (
              <button
                key={opt.value}
                onClick={() => {
                  if (active) {
                    onStatusChange(selectedStatuses.filter(s => s !== opt.value))
                  } else {
                    onStatusChange([...selectedStatuses, opt.value])
                  }
                }}
                className={cn(
                  'shrink-0 px-2.5 py-1 text-xs font-medium rounded-md border transition-colors',
                  active
                    ? 'bg-foreground text-background border-foreground'
                    : 'text-muted-foreground border-border/60 hover:border-border hover:text-foreground'
                )}
              >
                {opt.label}
              </button>
            )
          })}
          {hasActiveFilters && (
            <button
              onClick={() => onStatusChange([])}
              className="shrink-0 p-1 text-muted-foreground hover:text-foreground rounded transition-colors"
              aria-label="Clear filters"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Sort + count */}
        <div className="flex items-center gap-3 ml-auto">
          {resultCount !== undefined && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {resultCount === totalCount
                ? `${totalCount} total`
                : `${resultCount} of ${totalCount}`}
            </span>
          )}
          <div className="relative">
            <select
              value={`${currentSort}:${sortOrder}`}
              onChange={(e) => {
                const [sort, order] = e.target.value.split(':')
                onSortChange(sort, order as 'asc' | 'desc')
              }}
              className="appearance-none h-8 pl-7 pr-3 text-xs font-medium rounded-md border border-border/60 bg-transparent text-muted-foreground hover:text-foreground hover:border-border transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {sortOptions.map(opt => (
                <optgroup key={opt.value} label={opt.label}>
                  <option value={`${opt.value}:asc`}>{opt.label} (A-Z)</option>
                  <option value={`${opt.value}:desc`}>{opt.label} (Z-A)</option>
                </optgroup>
              ))}
            </select>
            <ArrowUpDown className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          </div>
        </div>
      </div>
    </div>
  )
}
