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
 * HeatmapShimmer — Loading state for the health heatmap.
 * Features a pulsing heart icon with heartbeat animation - ties into the "health" theme.
 */
export function HeatmapShimmer({ className }: { className?: string }) {
  return (
    <div className={cn('', className)}>
      {/* Main container matching heatmap structure */}
      <div className="border rounded-lg bg-card overflow-hidden">
        <div className="flex flex-col items-center justify-center py-24 px-8">
          {/* Pulsing heart with ECG line */}
          <div className="relative mb-6">
            {/* Heart icon with pulse animation */}
            <div className="relative">
              <svg
                viewBox="0 0 24 24"
                className="w-16 h-16 text-rose-500/80 animate-[heartbeat_1.2s_ease-in-out_infinite]"
                fill="currentColor"
              >
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
              {/* Pulse ring effect */}
              <div className="absolute inset-0 animate-[ping_1.2s_ease-in-out_infinite]">
                <svg
                  viewBox="0 0 24 24"
                  className="w-16 h-16 text-rose-500/30"
                  fill="currentColor"
                >
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
              </div>
            </div>
          </div>

          {/* ECG heartbeat line */}
          <div className="w-48 h-8 mb-4 overflow-hidden">
            <svg viewBox="0 0 200 40" className="w-full h-full">
              <path
                d="M0,20 L40,20 L50,20 L55,5 L60,35 L65,10 L70,25 L75,20 L200,20"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-rose-500/60 animate-[ecg_1.5s_linear_infinite]"
                strokeDasharray="200"
                strokeDashoffset="200"
              />
            </svg>
          </div>

          {/* Loading text */}
          <p className="text-muted-foreground text-sm font-medium">
            Loading partner health data...
          </p>
          <p className="text-muted-foreground/60 text-xs mt-1">
            Analyzing weekly statuses
          </p>
        </div>
      </div>

      {/* Legend placeholder - subtle */}
      <div className="flex items-center justify-center gap-6 px-4 py-3 border border-t-0 rounded-b-lg bg-card">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex items-center gap-1.5 opacity-30">
            <div className="w-3 h-3 rounded-[2px] bg-muted" />
            <div className="w-12 h-2 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  )
}
