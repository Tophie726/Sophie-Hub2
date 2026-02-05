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
 * Mimics the tiny cell grid structure with a wave animation.
 */
export function HeatmapShimmer({
  rows = 12,
  columns = 52,
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
  return (
    <div className={cn('border rounded-lg bg-card overflow-hidden', className)}>
      {/* Header shimmer */}
      <div className="border-b p-2">
        <div className="flex items-center gap-4">
          <ShimmerBar width={100} height={14} />
          <ShimmerBar width={60} height={14} />
        </div>
      </div>

      {/* Grid shimmer */}
      <div className="p-3 overflow-hidden">
        <div className="space-y-0">
          {Array.from({ length: rows }, (_, rowIdx) => (
            <div key={rowIdx} className="flex items-center" style={{ gap: cellGap, marginBottom: cellGap }}>
              {/* Name column */}
              <div
                className="shrink-0 rounded bg-gradient-to-r from-muted/30 via-muted/10 to-muted/30 bg-[length:200%_100%] animate-[shimmer_1.8s_ease-in-out_infinite]"
                style={{
                  width: nameColWidth,
                  height: cellSize,
                  animationDelay: `${rowIdx * 60}ms`,
                }}
              />
              {/* Cell columns */}
              <div className="flex" style={{ gap: cellGap }}>
                {Array.from({ length: Math.min(columns, 40) }, (_, colIdx) => (
                  <div
                    key={colIdx}
                    className="rounded-[2px] bg-gradient-to-r from-muted/25 via-muted/8 to-muted/25 bg-[length:200%_100%] animate-[shimmer_1.8s_ease-in-out_infinite]"
                    style={{
                      width: cellSize,
                      height: cellSize,
                      animationDelay: `${(rowIdx * 3 + colIdx) * 15}ms`,
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
