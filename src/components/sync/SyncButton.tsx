'use client'

import { forwardRef } from 'react'
import { RefreshCw, Clock, Calendar } from 'lucide-react'
import { Button, ButtonProps } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export interface SyncButtonProps extends Omit<ButtonProps, 'children'> {
  /** Whether a sync is currently running */
  syncing?: boolean
  /** Last sync timestamp (ISO string or Date) */
  lastSyncedAt?: string | Date | null
  /** Scheduled auto-sync time (e.g., "2:00 AM UTC") - placeholder for future */
  scheduledTime?: string | null
  /** Button label (default: "Sync") */
  label?: string
  /** Show label text or just icon */
  showLabel?: boolean
}

/**
 * Format a date for display in the tooltip
 */
function formatLastSync(date: string | Date | null | undefined): string {
  if (!date) return 'Never'

  const d = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  // Less than 1 minute ago
  if (diffMins < 1) return 'Just now'

  // Less than 1 hour ago
  if (diffMins < 60) return `${diffMins}m ago`

  // Less than 24 hours ago
  if (diffHours < 24) return `${diffHours}h ago`

  // Less than 7 days ago
  if (diffDays < 7) return `${diffDays}d ago`

  // Format as date
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/**
 * SyncButton - A reusable sync button with tooltip showing sync status
 *
 * Shows on hover:
 * - Last sync time
 * - Scheduled auto-sync time (when implemented)
 */
export const SyncButton = forwardRef<HTMLButtonElement, SyncButtonProps>(
  (
    {
      syncing = false,
      lastSyncedAt,
      scheduledTime,
      label = 'Sync',
      showLabel = true,
      className,
      disabled,
      variant = 'outline',
      size = 'sm',
      ...props
    },
    ref
  ) => {
    const lastSyncFormatted = formatLastSync(lastSyncedAt)
    const hasSchedule = !!scheduledTime

    return (
      <TooltipProvider>
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <Button
              ref={ref}
              variant={variant}
              size={size}
              disabled={disabled || syncing}
              className={cn('gap-2', className)}
              {...props}
            >
              <RefreshCw
                className={cn(
                  'h-4 w-4',
                  syncing && 'animate-spin'
                )}
              />
              {showLabel && (syncing ? 'Syncing...' : label)}
            </Button>
          </TooltipTrigger>
          <TooltipContent
            side="bottom"
            className="max-w-[200px] space-y-1.5 py-2"
          >
            {/* Last sync */}
            <div className="flex items-center gap-2 text-xs">
              <Clock className="h-3 w-3 opacity-70" />
              <span>
                Last sync: <span className="font-medium">{lastSyncFormatted}</span>
              </span>
            </div>

            {/* Scheduled sync (future feature) */}
            {hasSchedule ? (
              <div className="flex items-center gap-2 text-xs">
                <Calendar className="h-3 w-3 opacity-70" />
                <span>
                  Auto-syncs: <span className="font-medium">{scheduledTime}</span>
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs opacity-70">
                <Calendar className="h-3 w-3" />
                <span>Manual sync only</span>
              </div>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }
)

SyncButton.displayName = 'SyncButton'

export default SyncButton
