'use client'

import { useRef, useState, useEffect } from 'react'
import { Search, ArrowUpDown, X, ChevronRight } from 'lucide-react'
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
  const chipScrollRef = useRef<HTMLDivElement>(null)
  const [canScrollRight, setCanScrollRight] = useState(false)

  // Check if chips overflow and need scroll indicator
  useEffect(() => {
    const el = chipScrollRef.current
    if (!el) return
    const check = () => {
      setCanScrollRight(el.scrollWidth > el.clientWidth + el.scrollLeft + 2)
    }
    check()
    el.addEventListener('scroll', check, { passive: true })
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => { el.removeEventListener('scroll', check); ro.disconnect() }
  }, [statusOptions.length, selectedStatuses.length])

  const scrollChipsRight = () => {
    chipScrollRef.current?.scrollBy({ left: 120, behavior: 'smooth' })
  }

  return (
    <div className="sticky top-[7rem] md:top-16 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border/40">
      <div className="flex flex-col gap-3 px-4 py-3 md:px-8 md:flex-row md:items-center">
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

        {/* Status filter chips with scroll fade */}
        <div className="relative flex-1 min-w-0 md:flex-none">
          <div
            ref={chipScrollRef}
            className={cn(
              'flex items-center gap-1.5 overflow-x-auto scrollbar-hide',
              canScrollRight && 'pr-8'
            )}
          >
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
          {/* Scroll arrow indicator */}
          {canScrollRight && (
            <button
              onClick={scrollChipsRight}
              className="absolute right-0 top-0 bottom-0 flex items-center pl-4 pr-0.5 bg-gradient-to-l from-background via-background/90 to-transparent md:from-background/60 md:via-background/40"
              aria-label="Scroll filters"
            >
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
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
