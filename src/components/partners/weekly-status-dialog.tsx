'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  getStatusBucket,
  BUCKET_COLORS,
  BUCKET_LABELS,
  type StatusColorBucket,
} from '@/lib/status-colors'

interface WeeklyStatusDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  partnerId: string
  partnerName: string
  sourceData: Record<string, Record<string, Record<string, unknown>>> | null | undefined
}

// Get the Monday of a given date's week
function getMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

// Format date as M/D/YY for lookup
function formatDateKey(date: Date): string {
  const m = date.getMonth() + 1
  const d = date.getDate()
  const y = date.getFullYear() % 100
  return `${m}/${d}/${y}`
}

// Format date for display
function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

// Get week number of the year
function getWeekNumber(date: Date): number {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1)
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7)
}

// Build a lookup map from source_data weekly columns
function buildWeeklyLookup(
  sourceData: Record<string, Record<string, Record<string, unknown>>> | null | undefined
): Map<string, { status: string; weekNumber: number }> {
  const lookup = new Map<string, { status: string; weekNumber: number }>()

  if (!sourceData) return lookup

  for (const connector of Object.values(sourceData)) {
    if (typeof connector !== 'object' || !connector) continue
    for (const tabData of Object.values(connector)) {
      if (typeof tabData !== 'object' || !tabData) continue

      for (const [columnName, value] of Object.entries(tabData)) {
        const weekMatch = columnName.match(/^(\d{1,2}\/\d{1,2}\/\d{2,4})[\s\n]+Week\s*(\d+)/i)
        if (!weekMatch) continue

        const [, dateStr, weekNumStr] = weekMatch
        const status = value && typeof value === 'string' && value.trim() ? value.trim() : ''

        if (status) {
          const parts = dateStr.split('/')
          if (parts.length === 3) {
            let year = parseInt(parts[2], 10)
            if (year < 100) year += year > 50 ? 1900 : 2000
            const normalizedKey = `${parseInt(parts[0], 10)}/${parseInt(parts[1], 10)}/${year % 100}`
            lookup.set(normalizedKey, { status, weekNumber: parseInt(weekNumStr, 10) })
          }
        }
      }
    }
  }

  return lookup
}

interface WeekData {
  date: Date
  dateStr: string
  weekNumber: number
  status: string | null
  bucket: StatusColorBucket
}

export function WeeklyStatusDialog({
  open,
  onOpenChange,
  partnerId,
  partnerName,
  sourceData,
}: WeeklyStatusDialogProps) {
  const [weeksToShow, setWeeksToShow] = useState(12)

  // Build display data for the last N weeks
  const displayWeeks = useMemo(() => {
    const lookup = buildWeeklyLookup(sourceData)
    const result: WeekData[] = []

    const thisMonday = getMonday(new Date())

    for (let i = weeksToShow - 1; i >= 0; i--) {
      const monday = new Date(thisMonday)
      monday.setDate(monday.getDate() - i * 7)

      const dateStr = formatDateKey(monday)
      const weekNumber = getWeekNumber(monday)
      const found = lookup.get(dateStr)
      const status = found?.status || null

      result.push({
        date: monday,
        dateStr,
        weekNumber: found?.weekNumber || weekNumber,
        status,
        bucket: getStatusBucket(status),
      })
    }

    return result
  }, [sourceData, weeksToShow])

  // Calculate bucket distribution
  const bucketStats = useMemo(() => {
    const stats = new Map<StatusColorBucket, number>()
    for (const week of displayWeeks) {
      stats.set(week.bucket, (stats.get(week.bucket) || 0) + 1)
    }
    return stats
  }, [displayWeeks])

  const weeksWithData = displayWeeks.filter(w => w.status !== null).length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between pr-6">
            <span className="truncate">{partnerName}</span>
          </DialogTitle>
        </DialogHeader>

        <TooltipProvider delayDuration={150}>
          <div className="space-y-4">
            {/* Week count selector */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Showing last {weeksToShow} weeks
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setWeeksToShow(w => Math.max(8, w - 4))}
                  disabled={weeksToShow <= 8}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm tabular-nums w-6 text-center">{weeksToShow}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setWeeksToShow(w => Math.min(24, w + 4))}
                  disabled={weeksToShow >= 24}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Weekly status list */}
            <div className="max-h-[300px] overflow-y-auto -mx-2 px-2">
              <div className="space-y-1">
                {displayWeeks.slice().reverse().map((week, i) => (
                  <Tooltip key={i}>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-3 py-1.5 px-2 rounded-md hover:bg-muted/50 transition-colors">
                        <div
                          className={`w-2 h-6 rounded-sm shrink-0 ${BUCKET_COLORS[week.bucket]}`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2">
                            <span className="text-sm font-medium">Week {week.weekNumber}</span>
                            <span className="text-xs text-muted-foreground">
                              {formatDisplayDate(week.date)}
                            </span>
                          </div>
                        </div>
                        <div className={`text-sm truncate max-w-[120px] ${
                          week.status ? '' : 'text-muted-foreground'
                        }`}>
                          {week.status || 'No data'}
                        </div>
                      </div>
                    </TooltipTrigger>
                    {week.status && (
                      <TooltipContent side="left" className="text-xs">
                        {week.status}
                      </TooltipContent>
                    )}
                  </Tooltip>
                ))}
              </div>
            </div>

            {/* Legend / Stats */}
            <div className="flex flex-wrap gap-3 pt-2 border-t border-border/60">
              {Array.from(bucketStats.entries())
                .filter(([, count]) => count > 0)
                .sort((a, b) => b[1] - a[1])
                .map(([bucket, count]) => (
                  <div key={bucket} className="flex items-center gap-1.5 text-xs">
                    <div className={`w-2.5 h-2.5 rounded-sm ${BUCKET_COLORS[bucket]}`} />
                    <span className="text-muted-foreground">
                      {BUCKET_LABELS[bucket]} ({count})
                    </span>
                  </div>
                ))}
            </div>

            {/* Footer with link to full page */}
            <div className="flex items-center justify-between pt-2 border-t border-border/60">
              <span className="text-xs text-muted-foreground">
                {weeksWithData} of {weeksToShow} weeks have data
              </span>
              <Link
                href={`/partners/${partnerId}?tab=weekly`}
                onClick={() => onOpenChange(false)}
              >
                <Button variant="outline" size="sm" className="gap-1.5">
                  View Full History
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          </div>
        </TooltipProvider>
      </DialogContent>
    </Dialog>
  )
}
