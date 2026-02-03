'use client'

import { useMemo } from 'react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { getStatusColor } from '@/lib/status-colors'

interface WeeklyStatusPreviewProps {
  /** Raw source_data from partner record */
  sourceData: Record<string, Record<string, Record<string, unknown>>> | null | undefined
  /** Number of weeks to show (default 8) */
  weeks?: number
  /** Callback when clicking to expand */
  onExpand?: () => void
}

// Get the Monday of a given date's week
function getMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Adjust for Sunday
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

// Format date as M/D/YY
function formatDate(date: Date): string {
  const m = date.getMonth() + 1
  const d = date.getDate()
  const y = date.getFullYear() % 100
  return `${m}/${d}/${y}`
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
        // Match pattern: "M/D/YY\nWeek N" or "M/D/YY Week N"
        const weekMatch = columnName.match(/^(\d{1,2}\/\d{1,2}\/\d{2,4})[\s\n]+Week\s*(\d+)/i)
        if (!weekMatch) continue

        const [, dateStr, weekNumStr] = weekMatch
        const status = value && typeof value === 'string' && value.trim() ? value.trim() : ''

        if (status) {
          // Normalize the date key (handle 2-digit vs 4-digit years)
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

export function WeeklyStatusPreview({
  sourceData,
  weeks = 8,
  onExpand,
}: WeeklyStatusPreviewProps) {
  // Build the display data: last N Mondays ending with this week
  const displayWeeks = useMemo(() => {
    const lookup = buildWeeklyLookup(sourceData)
    const result: { date: Date; dateStr: string; weekNumber: number; status: string | null }[] = []

    // Start from this Monday
    const thisMonday = getMonday(new Date())

    // Go back N weeks (including this week)
    for (let i = weeks - 1; i >= 0; i--) {
      const monday = new Date(thisMonday)
      monday.setDate(monday.getDate() - i * 7)

      const dateStr = formatDate(monday)
      const weekNumber = getWeekNumber(monday)

      // Look up status for this date
      const found = lookup.get(dateStr)

      result.push({
        date: monday,
        dateStr,
        weekNumber: found?.weekNumber || weekNumber,
        status: found?.status || null,
      })
    }

    return result
  }, [sourceData, weeks])

  return (
    <TooltipProvider delayDuration={200}>
      <div
        className={`flex items-center gap-0.5 ${onExpand ? 'cursor-pointer hover:opacity-80' : ''}`}
        onClick={onExpand}
      >
        {displayWeeks.map((week, i) => (
          <Tooltip key={i}>
            <TooltipTrigger asChild>
              <div
                className={`w-1 h-3 rounded-[1px] transition-colors ${getStatusColor(week.status)}`}
              />
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              <div className="font-medium">Week {week.weekNumber}</div>
              <div className="text-muted-foreground">{week.dateStr}</div>
              <div className={week.status ? '' : 'text-muted-foreground'}>
                {week.status || 'No data'}
              </div>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  )
}
