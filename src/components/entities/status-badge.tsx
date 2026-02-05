import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

const partnerStatusStyles: Record<string, string> = {
  active: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
  onboarding: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  paused: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  at_risk: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  offboarding: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
  churned: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
  pending: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
}

const staffStatusStyles: Record<string, string> = {
  active: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
  onboarding: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  on_leave: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  offboarding: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
  departed: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
}

const defaultStyle = 'bg-gray-500/10 text-gray-500 border-gray-500/20'

function formatStatus(status: string): string {
  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

interface StatusBadgeProps {
  status: string | null
  entity: 'partners' | 'staff'
  className?: string
}

export function StatusBadge({ status, entity, className }: StatusBadgeProps) {
  if (!status) return <span className="text-sm text-muted-foreground">--</span>

  const styles = entity === 'partners' ? partnerStatusStyles : staffStatusStyles
  const style = styles[status] || defaultStyle

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-md border',
        style,
        className
      )}
    >
      {formatStatus(status)}
    </span>
  )
}

/**
 * Computed Status Badge for Partners
 * Shows the computed status from latest weekly data with optional mismatch indicator
 */
interface ComputedStatusBadgeProps {
  computedStatus: string | null    // The computed status value
  displayLabel: string             // Human-readable label (e.g., "Active" or "Pending (last: Active)")
  sheetStatus: string | null       // The status from sheet for comparison
  statusMatches: boolean           // Does computed match sheet?
  latestWeeklyStatus?: string | null // Raw weekly status text
  className?: string
  onClick?: () => void             // Click handler for investigation dialog
}

export function ComputedStatusBadge({
  computedStatus,
  displayLabel,
  sheetStatus,
  statusMatches,
  latestWeeklyStatus,
  className,
  onClick,
}: ComputedStatusBadgeProps) {
  const status = computedStatus || 'pending'
  const style = partnerStatusStyles[status] || defaultStyle
  const showMismatch = !statusMatches && sheetStatus && computedStatus

  const badge = (
    <span
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-md border',
        style,
        showMismatch && 'ring-1 ring-amber-500 ring-offset-1',
        onClick && 'cursor-pointer hover:opacity-80 transition-opacity',
        className
      )}
    >
      {displayLabel}
      {showMismatch && (
        <span className="text-amber-500" title="Computed status differs from sheet">
          ⚠
        </span>
      )}
    </span>
  )

  // If there's additional info to show, wrap in tooltip
  if (latestWeeklyStatus || showMismatch) {
    return (
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>{badge}</TooltipTrigger>
          <TooltipContent side="top" className="text-xs max-w-xs">
            <div className="space-y-1">
              {latestWeeklyStatus && (
                <div>
                  <span className="text-muted-foreground">Latest weekly: </span>
                  <span className="font-medium">{latestWeeklyStatus}</span>
                </div>
              )}
              {showMismatch && (
                <div className="text-amber-500">
                  Sheet says: {formatStatus(sheetStatus!)}
                </div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return badge
}
