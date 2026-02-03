'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CalendarDays, LayoutGrid, List } from 'lucide-react'
import {
  getStatusColor,
  getStatusBucket,
  BUCKET_COLORS,
  BUCKET_LABELS,
  type StatusColorBucket,
} from '@/lib/status-colors'

interface WeeklyStatus {
  id: string
  week_start_date: string
  status: string | null
  notes: string | null
}

interface WeeklyStatusTabProps {
  /** Partner's weekly statuses from API (already sorted by date DESC) */
  statuses: WeeklyStatus[]
  /** Partner's source_data for extracting additional weekly columns */
  sourceData?: Record<string, Record<string, Record<string, unknown>>> | null
}

type TimeRange = 'ytd' | '3mo' | '6mo' | '1yr' | 'all'
type ViewMode = 'grid' | 'list'

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: 'ytd', label: 'YTD' },
  { value: '3mo', label: '3 Months' },
  { value: '6mo', label: '6 Months' },
  { value: '1yr', label: '1 Year' },
  { value: 'all', label: 'All' },
]

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

// Format date nicely for display
function formatDateDisplay(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// Get week number of the year
function getWeekNumber(date: Date): number {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1)
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7)
}

// Get month name
function getMonthName(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short' })
}

// Build lookup from source_data weekly columns
function buildSourceDataLookup(
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

// Build lookup from weekly_statuses table
function buildStatusesLookup(
  statuses: WeeklyStatus[]
): Map<string, WeeklyStatus> {
  const lookup = new Map<string, WeeklyStatus>()

  for (const ws of statuses) {
    // week_start_date is ISO format like "2026-01-05"
    const date = new Date(ws.week_start_date)
    const key = formatDateKey(date)
    lookup.set(key, ws)
  }

  return lookup
}

interface WeekData {
  date: Date
  dateKey: string
  weekNumber: number
  monthName: string
  status: string | null
  notes: string | null
  isNewMonth: boolean
}

export function WeeklyStatusTab({ statuses, sourceData }: WeeklyStatusTabProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('ytd')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')

  // Build the display data
  const { weeks, legendBuckets } = useMemo(() => {
    const sourceDataLookup = buildSourceDataLookup(sourceData)
    const statusesLookup = buildStatusesLookup(statuses)

    // Determine date range
    const today = new Date()
    const thisMonday = getMonday(today)
    let startDate: Date

    switch (timeRange) {
      case 'ytd':
        startDate = new Date(today.getFullYear(), 0, 1)
        startDate = getMonday(startDate)
        break
      case '3mo':
        startDate = new Date(thisMonday)
        startDate.setMonth(startDate.getMonth() - 3)
        break
      case '6mo':
        startDate = new Date(thisMonday)
        startDate.setMonth(startDate.getMonth() - 6)
        break
      case '1yr':
        startDate = new Date(thisMonday)
        startDate.setFullYear(startDate.getFullYear() - 1)
        break
      case 'all':
        // Find earliest data point
        let earliest = thisMonday
        for (const ws of statuses) {
          const d = new Date(ws.week_start_date)
          if (d < earliest) earliest = d
        }
        // Also check source_data dates
        for (const key of Array.from(sourceDataLookup.keys())) {
          const parts = key.split('/')
          if (parts.length === 3) {
            let year = parseInt(parts[2], 10)
            if (year < 100) year += 2000
            const d = new Date(year, parseInt(parts[0], 10) - 1, parseInt(parts[1], 10))
            if (d < earliest) earliest = d
          }
        }
        startDate = getMonday(earliest)
        break
    }

    // Generate weeks from startDate to thisMonday
    const result: WeekData[] = []
    const bucketCounts = new Map<StatusColorBucket, number>()
    let lastMonth = ''

    const current = new Date(startDate)
    while (current <= thisMonday) {
      const dateKey = formatDateKey(current)
      const weekNum = getWeekNumber(current)
      const monthName = getMonthName(current)
      const isNewMonth = monthName !== lastMonth
      lastMonth = monthName

      // Prefer weekly_statuses table, fallback to source_data
      const fromTable = statusesLookup.get(dateKey)
      const fromSource = sourceDataLookup.get(dateKey)

      const status = fromTable?.status || fromSource?.status || null
      const notes = fromTable?.notes || null

      result.push({
        date: new Date(current),
        dateKey,
        weekNumber: fromSource?.weekNumber || weekNum,
        monthName,
        status,
        notes,
        isNewMonth,
      })

      // Count for legend
      const bucket = getStatusBucket(status)
      bucketCounts.set(bucket, (bucketCounts.get(bucket) || 0) + 1)

      current.setDate(current.getDate() + 7)
    }

    // Build legend (only show buckets that have data)
    const legendBuckets: { bucket: StatusColorBucket; count: number }[] = []
    const orderedBuckets: StatusColorBucket[] = [
      'healthy',
      'onboarding',
      'warning',
      'paused',
      'offboarding',
      'churned',
      'unknown',
      'no-data',
    ]

    for (const bucket of orderedBuckets) {
      const count = bucketCounts.get(bucket) || 0
      if (count > 0) {
        legendBuckets.push({ bucket, count })
      }
    }

    return { weeks: result, legendBuckets }
  }, [statuses, sourceData, timeRange])

  // Group weeks by month for grid view
  const monthGroups = useMemo(() => {
    const groups: { month: string; year: number; weeks: WeekData[] }[] = []
    let currentGroup: { month: string; year: number; weeks: WeekData[] } | null = null

    for (const week of weeks) {
      const monthYear = `${week.monthName} ${week.date.getFullYear()}`

      if (!currentGroup || currentGroup.month !== week.monthName || currentGroup.year !== week.date.getFullYear()) {
        currentGroup = {
          month: week.monthName,
          year: week.date.getFullYear(),
          weeks: [],
        }
        groups.push(currentGroup)
      }

      currentGroup.weeks.push(week)
    }

    return groups
  }, [weeks])

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Time Range Selector */}
        <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
          {TIME_RANGES.map(range => (
            <button
              key={range.value}
              onClick={() => setTimeRange(range.value)}
              className={`
                relative px-3 py-1.5 text-sm font-medium rounded-md transition-colors
                ${timeRange === range.value
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
                }
              `}
            >
              {timeRange === range.value && (
                <motion.div
                  layoutId="timeRangeIndicator"
                  className="absolute inset-0 bg-background shadow-sm rounded-md"
                  transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
                />
              )}
              <span className="relative z-10">{range.label}</span>
            </button>
          ))}
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
          <button
            onClick={() => setViewMode('grid')}
            className={`
              relative p-2 rounded-md transition-colors
              ${viewMode === 'grid'
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground'
              }
            `}
            title="Grid view"
          >
            {viewMode === 'grid' && (
              <motion.div
                layoutId="viewModeIndicator"
                className="absolute inset-0 bg-background shadow-sm rounded-md"
                transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
              />
            )}
            <LayoutGrid className="relative z-10 h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`
              relative p-2 rounded-md transition-colors
              ${viewMode === 'list'
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground'
              }
            `}
            title="List view"
          >
            {viewMode === 'list' && (
              <motion.div
                layoutId="viewModeIndicator"
                className="absolute inset-0 bg-background shadow-sm rounded-md"
                transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
              />
            )}
            <List className="relative z-10 h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs">
        {legendBuckets.map(({ bucket, count }) => (
          <div key={bucket} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded-sm ${BUCKET_COLORS[bucket]}`} />
            <span className="text-muted-foreground">
              {BUCKET_LABELS[bucket]} ({count})
            </span>
          </div>
        ))}
      </div>

      {/* Content */}
      {viewMode === 'grid' ? (
        <Card>
          <CardContent className="pt-6">
            <TooltipProvider delayDuration={150}>
              <div className="space-y-4">
                {monthGroups.map((group, gi) => (
                  <div key={`${group.month}-${group.year}`} className="space-y-2">
                    {/* Month label */}
                    <div className="text-xs font-medium text-muted-foreground">
                      {group.month} {group.year}
                    </div>
                    {/* Week blocks */}
                    <div className="flex flex-wrap gap-1">
                      {group.weeks.map((week, wi) => (
                        <Tooltip key={week.dateKey}>
                          <TooltipTrigger asChild>
                            <motion.div
                              initial={false}
                              whileHover={{ scale: 1.2 }}
                              className={`
                                w-4 h-4 rounded-sm cursor-default
                                ${getStatusColor(week.status)}
                              `}
                            />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs max-w-[200px]">
                            <div className="font-medium">Week {week.weekNumber}</div>
                            <div className="text-muted-foreground">
                              {formatDateDisplay(week.date)}
                            </div>
                            <div className={week.status ? 'font-medium mt-1' : 'text-muted-foreground mt-1'}>
                              {week.status || 'No data'}
                            </div>
                            {week.notes && (
                              <div className="text-muted-foreground mt-1 border-t border-border/50 pt-1">
                                {week.notes}
                              </div>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </TooltipProvider>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-0">
            <div className="divide-y divide-border/60">
              {/* Reverse to show most recent first in list view */}
              {[...weeks].reverse().map(week => (
                <div
                  key={week.dateKey}
                  className="flex items-center gap-3 py-3 first:pt-6"
                >
                  {/* Color indicator */}
                  <div className={`w-2 h-8 rounded-sm shrink-0 ${getStatusColor(week.status)}`} />

                  {/* Date */}
                  <div className="w-32 shrink-0">
                    <div className="text-sm font-medium">Week {week.weekNumber}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDateDisplay(week.date)}
                    </div>
                  </div>

                  {/* Status */}
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm ${week.status ? '' : 'text-muted-foreground'}`}>
                      {week.status || 'No data'}
                    </div>
                    {week.notes && (
                      <div className="text-xs text-muted-foreground truncate">
                        {week.notes}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      <div className="text-xs text-muted-foreground text-center">
        Showing {weeks.length} weeks
        {timeRange === 'ytd' && ` (${new Date().getFullYear()} year to date)`}
      </div>
    </div>
  )
}
