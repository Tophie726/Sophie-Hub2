'use client'

import { cn } from '@/lib/utils'
import { Calendar, Eye } from 'lucide-react'
import type { ViewerContext } from '@/lib/auth/viewer-context'

// ---------------------------------------------------------------------------
// Types — module contract
// ---------------------------------------------------------------------------

interface WorkCalendarOverviewProps {
  /** Partner to scope the calendar to (optional) */
  partnerId?: string
  /** Current viewer context for view-aware rendering */
  viewContext?: ViewerContext
  /** Additional class names */
  className?: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Work Calendar Overview — module shell
 *
 * This establishes the module component contract for the view_profile_modules
 * system. A view profile can attach this module via the junction table, and
 * the dashboard will render it with the resolved viewer context.
 *
 * Props contract:
 * - partnerId: optional partner scope
 * - viewContext: optional resolved ViewerContext (from dashboard hook)
 *
 * Future: replace placeholder with real calendar data from work_calendar table.
 */
export function WorkCalendarOverview({
  partnerId,
  viewContext,
  className,
}: WorkCalendarOverviewProps) {
  const isImpersonating = viewContext?.isImpersonating ?? false
  const subjectLabel = viewContext?.subject.targetLabel

  return (
    <div
      className={cn(
        'rounded-xl border border-border/40 bg-card p-5',
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10">
          <Calendar className="h-5 w-5 text-blue-500" />
        </div>
        <div>
          <h3 className="text-sm font-semibold" style={{ WebkitFontSmoothing: 'antialiased' }}>
            Work Calendar Overview
          </h3>
          <p className="text-xs text-muted-foreground">
            Upcoming tasks and deadlines
          </p>
        </div>
      </div>

      {/* Viewer context debug info (visible when impersonating) */}
      {viewContext && isImpersonating && (
        <div className="mb-4 rounded-md bg-amber-500/10 dark:bg-amber-500/15 px-3 py-2 text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2">
          <Eye className="h-3.5 w-3.5 shrink-0" />
          <span>
            Viewing as: <span className="font-medium">{subjectLabel}</span>
            {partnerId && <span className="text-muted-foreground ml-1">(partner: {partnerId})</span>}
          </span>
        </div>
      )}

      {/* Empty state placeholder */}
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Calendar className="h-8 w-8 text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground mb-1">
          No calendar data available
        </p>
        <p className="text-xs text-muted-foreground/70 max-w-xs">
          This module will show work calendar events and deadlines once the calendar
          data source is connected.
        </p>
      </div>
    </div>
  )
}
