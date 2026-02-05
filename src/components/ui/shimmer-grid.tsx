'use client'

import { cn } from '@/lib/utils'

/**
 * ShimmerGrid — Staggered wave shimmer loader.
 *
 * A grid of cells with a diagonal wave animation that sweeps across,
 * creating a "lightning bolt" effect. Used as a loading placeholder
 * anywhere tabular or grid data is expected.
 *
 * Usage:
 *   <ShimmerGrid />                        — default 8x4 table
 *   <ShimmerGrid rows={5} columns={3} />   — custom size
 *   <ShimmerGrid variant="header" />        — with highlighted header row
 *   <ShimmerGrid variant="list" />          — single-column list
 */

interface ShimmerGridProps {
  /** Number of data rows (default: 8) */
  rows?: number
  /** Number of columns (default: 4) */
  columns?: number
  /** Cell height in pixels (default: 32) */
  cellHeight?: number
  /** Gap between cells in pixels (default: 12) */
  gap?: number
  /** Delay between each cell in ms — lower = faster wave (default: 40) */
  stagger?: number
  /** Animation duration in seconds (default: 1.5) */
  duration?: number
  /** Show row numbers on the left (default: false) */
  showRowNumbers?: boolean
  /** Variant: 'table' has header row, 'grid' is uniform, 'list' is single column */
  variant?: 'table' | 'grid' | 'list'
  /** Additional className on the container */
  className?: string
}

function ShimmerCell({
  height,
  delay,
  duration,
  isHeader = false,
}: {
  height: number
  delay: number
  duration: number
  isHeader?: boolean
}) {
  return (
    <div
      className={cn(
        'flex-1 rounded',
        'bg-[length:200%_100%] animate-[shimmer_var(--shimmer-dur)_ease-in-out_infinite]',
        isHeader
          ? 'bg-gradient-to-r from-primary/15 via-primary/5 to-primary/15'
          : 'bg-gradient-to-r from-muted/40 via-muted/15 to-muted/40'
      )}
      style={{
        height,
        animationDelay: `${delay}ms`,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ['--shimmer-dur' as any]: `${duration}s`,
      }}
    />
  )
}

export function ShimmerGrid({
  rows = 8,
  columns = 4,
  cellHeight = 32,
  gap = 12,
  stagger = 40,
  duration = 1.5,
  showRowNumbers = false,
  variant = 'grid',
  className,
}: ShimmerGridProps) {
  const effectiveColumns = variant === 'list' ? 1 : columns
  const hasHeader = variant === 'table'

  return (
    <div className={cn('space-y-0', className)}>
      {/* Header row */}
      {hasHeader && (
        <div className="flex border-b pb-2 mb-2" style={{ gap }}>
          {showRowNumbers && (
            <div
              className="flex-shrink-0 w-8 bg-muted/30 rounded flex items-center justify-center"
              style={{ height: cellHeight }}
            >
              <span className="text-[10px] text-muted-foreground/50">#</span>
            </div>
          )}
          {Array.from({ length: effectiveColumns }, (_, j) => (
            <ShimmerCell
              key={j}
              height={cellHeight}
              delay={j * stagger}
              duration={duration}
              isHeader
            />
          ))}
        </div>
      )}

      {/* Data rows */}
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="flex"
          style={{ gap, paddingTop: i === 0 && !hasHeader ? 0 : 3, paddingBottom: 3 }}
        >
          {showRowNumbers && (
            <div
              className="flex-shrink-0 w-8 bg-muted/15 rounded flex items-center justify-center text-xs text-muted-foreground/40"
              style={{ height: cellHeight }}
            >
              {i + 1}
            </div>
          )}
          {Array.from({ length: effectiveColumns }, (_, j) => {
            // Diagonal wave: delay increases by row + column
            const headerOffset = hasHeader ? effectiveColumns : 0
            const cellIndex = headerOffset + i * effectiveColumns + j
            return (
              <ShimmerCell
                key={j}
                height={cellHeight}
                delay={cellIndex * stagger}
                duration={duration}
              />
            )
          })}
        </div>
      ))}
    </div>
  )
}

/**
 * ShimmerBar — Single animated bar for inline loading states.
 */
export function ShimmerBar({
  width,
  height = 16,
  className,
}: {
  width?: number | string
  height?: number
  className?: string
}) {
  return (
    <div
      className={cn(
        'rounded bg-gradient-to-r from-muted/40 via-muted/15 to-muted/40',
        'bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite]',
        className
      )}
      style={{ width, height }}
    />
  )
}

/**
 * HeatmapShimmer — Loading state for the health heatmap grid.
 * Individual cells shimmer with a diagonal wave effect.
 */
export function HeatmapShimmer({
  rows = 20,
  columns = 80,
  cellSize = 12,
  cellGap = 2,
  nameColWidth = 180,
  className,
}: {
  rows?: number
  columns?: number
  cellSize?: number
  cellGap?: number
  nameColWidth?: number
  className?: string
}) {
  // Limit columns for performance - render fewer cells but they animate
  const visibleCols = Math.min(columns, 50)

  return (
    <div className={cn('', className)}>
      {/* Header controls */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <ShimmerBar width={140} height={16} />
          <div className="flex items-center gap-1">
            <div className="h-7 w-7 rounded bg-muted/20" />
            <div className="h-7 w-7 rounded bg-muted/20" />
          </div>
        </div>
        <ShimmerBar width={100} height={28} className="rounded-md" />
      </div>

      {/* Main grid container */}
      <div className="border rounded-lg bg-card overflow-hidden">
        <div className="overflow-hidden" style={{ maxHeight: 'calc(100vh - 280px)' }}>
          {/* Header section */}
          <div className="bg-card border-b py-2">
            <div className="flex">
              <div style={{ width: nameColWidth }} className="shrink-0 px-3" />
              <div className="flex-1 space-y-1.5 pr-3">
                <ShimmerBar width="70%" height={12} />
                <ShimmerBar width="85%" height={10} />
                <ShimmerBar width="95%" height={8} />
              </div>
            </div>
            {/* Week numbers row */}
            <div className="flex mt-1 pb-1">
              <div style={{ width: nameColWidth }} className="shrink-0 px-3">
                <ShimmerBar width={50} height={10} />
              </div>
              <div className="flex" style={{ gap: cellGap }}>
                {Array.from({ length: visibleCols }, (_, i) => (
                  <div
                    key={i}
                    className="rounded-[2px] bg-gradient-to-r from-muted/15 via-muted/5 to-muted/15 bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite]"
                    style={{
                      width: cellSize,
                      height: 8,
                      animationDelay: `${i * 15}ms`,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Summary row - cells slightly taller to match actual heatmap */}
          <div className="flex items-center py-1 bg-muted/40 border-b">
            <div style={{ width: nameColWidth }} className="shrink-0 px-3">
              <ShimmerBar width={55} height={12} />
            </div>
            <div className="flex" style={{ gap: cellGap }}>
              {Array.from({ length: visibleCols }, (_, i) => (
                <div
                  key={i}
                  className="rounded-[2px] bg-gradient-to-r from-muted/30 via-muted/10 to-muted/30 bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite]"
                  style={{
                    width: cellSize,
                    height: cellSize + 2,
                    animationDelay: `${i * 15}ms`,
                  }}
                />
              ))}
            </div>
          </div>

          {/* Data rows with animated cells */}
          <div>
            {Array.from({ length: rows }, (_, rowIdx) => (
              <div
                key={rowIdx}
                className="flex items-center"
                style={{ paddingTop: cellGap, paddingBottom: cellGap }}
              >
                {/* Name column */}
                <div style={{ width: nameColWidth }} className="shrink-0 px-3">
                  <div
                    className="rounded bg-gradient-to-r from-muted/25 via-muted/8 to-muted/25 bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite]"
                    style={{
                      width: 70 + (rowIdx % 5) * 20,
                      height: cellSize,
                      animationDelay: `${rowIdx * 40}ms`,
                    }}
                  />
                </div>
                {/* Cell grid - diagonal wave animation */}
                <div className="flex" style={{ gap: cellGap }}>
                  {Array.from({ length: visibleCols }, (_, colIdx) => (
                    <div
                      key={colIdx}
                      className="rounded-[2px] bg-gradient-to-r from-muted/25 via-muted/8 to-muted/25 bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite]"
                      style={{
                        width: cellSize,
                        height: cellSize,
                        // Diagonal wave: delay based on row + column position
                        animationDelay: `${(rowIdx + colIdx) * 8}ms`,
                      }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 px-4 py-3 border border-t-0 rounded-b-lg bg-card">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded-[2px] bg-gradient-to-r from-muted/25 via-muted/8 to-muted/25 bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite]"
              style={{ animationDelay: `${i * 100}ms` }}
            />
            <ShimmerBar width={40 + i * 5} height={10} />
          </div>
        ))}
      </div>
    </div>
  )
}
