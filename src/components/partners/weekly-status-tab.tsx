'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Card, CardContent } from '@/components/ui/card'
import { ChevronLeft, ChevronRight, LayoutGrid, List } from 'lucide-react'
import {
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
  statuses: WeeklyStatus[]
  sourceData?: Record<string, Record<string, Record<string, unknown>>> | null
}

type ViewMode = 'calendar' | 'list'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April',
  'May', 'June', 'July', 'August',
  'September', 'October', 'November', 'December',
]

const DAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

// =============================================================================
// Centralized bucket-based color variants
// Uses getStatusBucket() for consistent mapping, then applies visual variants
// =============================================================================

type ColorVariant = 'full' | 'light' | 'faded' | 'fadedLight' | 'outside'

// Color classes for each bucket at different intensity levels
const BUCKET_COLOR_VARIANTS: Record<StatusColorBucket, Record<ColorVariant, string>> = {
  healthy: {
    full: 'bg-green-500',
    light: 'bg-green-400',
    faded: 'bg-green-400/60',
    fadedLight: 'bg-green-300/50',
    outside: 'bg-green-200/40',
  },
  onboarding: {
    full: 'bg-blue-500',
    light: 'bg-blue-400',
    faded: 'bg-blue-400/60',
    fadedLight: 'bg-blue-300/50',
    outside: 'bg-blue-200/40',
  },
  warning: {
    full: 'bg-amber-500',
    light: 'bg-amber-400',
    faded: 'bg-amber-400/60',
    fadedLight: 'bg-amber-300/50',
    outside: 'bg-amber-200/40',
  },
  paused: {
    full: 'bg-gray-400',
    light: 'bg-gray-300',
    faded: 'bg-gray-300/60',
    fadedLight: 'bg-gray-200/50',
    outside: 'bg-gray-100/40',
  },
  offboarding: {
    full: 'bg-orange-500',
    light: 'bg-orange-400',
    faded: 'bg-orange-400/60',
    fadedLight: 'bg-orange-300/50',
    outside: 'bg-orange-200/40',
  },
  churned: {
    full: 'bg-red-500',
    light: 'bg-red-400',
    faded: 'bg-red-400/60',
    fadedLight: 'bg-red-300/50',
    outside: 'bg-red-200/40',
  },
  unknown: {
    full: 'bg-purple-500',
    light: 'bg-purple-400',
    faded: 'bg-purple-400/60',
    fadedLight: 'bg-purple-300/50',
    outside: 'bg-purple-200/40',
  },
  'no-data': {
    full: 'bg-muted',
    light: '',
    faded: 'bg-muted/30',
    fadedLight: '',
    outside: '',
  },
}

/**
 * Get color class for a status using bucket-based lookup
 */
function getStatusColor(status: string | null, variant: ColorVariant): string {
  const bucket = getStatusBucket(status)
  return BUCKET_COLOR_VARIANTS[bucket][variant]
}

// Convenience wrappers for different visual contexts
function getStatusColorFull(status: string | null): string {
  return getStatusColor(status, 'full')
}

function getStatusColorLight(status: string | null): string {
  return getStatusColor(status, 'light')
}

function getStatusColorFaded(status: string | null): string {
  return getStatusColor(status, 'faded')
}

function getStatusColorFadedLight(status: string | null): string {
  return getStatusColor(status, 'fadedLight')
}

function getStatusColorOutside(status: string | null): string {
  return getStatusColor(status, 'outside')
}

// Format date as M/D/YY for lookup
function formatDateKey(date: Date): string {
  const m = date.getMonth() + 1
  const d = date.getDate()
  const y = date.getFullYear() % 100
  return `${m}/${d}/${y}`
}

// Get ISO week number
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
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
function buildStatusesLookup(statuses: WeeklyStatus[]): Map<string, WeeklyStatus> {
  const lookup = new Map<string, WeeklyStatus>()
  for (const ws of statuses) {
    const date = new Date(ws.week_start_date)
    const key = formatDateKey(date)
    lookup.set(key, ws)
  }
  return lookup
}

interface DayData {
  date: Date
  day: number
  isCurrentMonth: boolean
  isToday: boolean
}

interface WeekRowData {
  weekNumber: number
  days: DayData[]
  status: string | null
  inheritedStatus: string | null // Previous status when no data (only for past weeks)
  notes: string | null
  mondayDate: Date | null
  hasData: boolean
  isFuture: boolean // Week starts after today
}

function buildMonthCalendar(
  year: number,
  month: number,
  statusLookup: Map<string, WeeklyStatus>,
  sourceDataLookup: Map<string, { status: string; weekNumber: number }>,
  lastKnownStatus: string | null
): { weeks: WeekRowData[]; lastStatus: string | null } {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)

  // Start from the Sunday before or on the first day
  const startDate = new Date(firstDay)
  startDate.setDate(startDate.getDate() - startDate.getDay())

  const weeks: WeekRowData[] = []
  const current = new Date(startDate)
  let runningStatus = lastKnownStatus

  while (current <= lastDay || current.getDay() !== 0) {
    const weekDays: DayData[] = []
    let weekMonday: Date | null = null
    let weekStatus: string | null = null
    let weekNotes: string | null = null
    let hasData = false

    for (let i = 0; i < 7; i++) {
      const isCurrentMonth = current.getMonth() === month
      const isMonday = current.getDay() === 1
      const isToday = current.getTime() === today.getTime()

      if (isMonday) {
        weekMonday = new Date(current)
        const key = formatDateKey(current)
        const fromTable = statusLookup.get(key)
        const fromSource = sourceDataLookup.get(key)
        weekStatus = fromTable?.status || fromSource?.status || null
        weekNotes = fromTable?.notes || null
        hasData = weekStatus !== null

        if (hasData) {
          runningStatus = weekStatus
        }
      }

      weekDays.push({
        date: new Date(current),
        day: current.getDate(),
        isCurrentMonth,
        isToday,
      })

      current.setDate(current.getDate() + 1)
    }

    // Only add weeks that have at least one day in the current month
    if (weekDays.some(d => d.isCurrentMonth)) {
      // Check if this week is in the future (Monday is after today)
      const isFuture = weekMonday ? weekMonday > today : false

      weeks.push({
        weekNumber: weekDays[1] ? getWeekNumber(weekDays[1].date) : getWeekNumber(weekDays[0].date),
        days: weekDays,
        status: weekStatus,
        // Only inherit status for past/current weeks, not future
        inheritedStatus: (hasData || isFuture) ? null : runningStatus,
        notes: weekNotes,
        mondayDate: weekMonday,
        hasData,
        isFuture,
      })
    }

    // Break if we've moved past the month
    if (current.getMonth() > month && current.getFullYear() >= year) break
    if (current.getFullYear() > year) break
  }

  return { weeks, lastStatus: runningStatus }
}

export function WeeklyStatusTab({ statuses, sourceData }: WeeklyStatusTabProps) {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [viewMode, setViewMode] = useState<ViewMode>('calendar')

  const statusLookup = useMemo(() => buildStatusesLookup(statuses), [statuses])
  const sourceDataLookup = useMemo(() => buildSourceDataLookup(sourceData), [sourceData])

  // Build calendar data for all 12 months, tracking last known status
  const monthsData = useMemo(() => {
    const result: { name: string; weeks: WeekRowData[] }[] = []
    let lastStatus: string | null = null

    for (let i = 0; i < 12; i++) {
      const { weeks, lastStatus: newLastStatus } = buildMonthCalendar(
        year, i, statusLookup, sourceDataLookup, lastStatus
      )
      result.push({ name: MONTH_NAMES[i], weeks })
      lastStatus = newLastStatus
    }

    return result
  }, [year, statusLookup, sourceDataLookup])

  // Calculate legend stats for the year
  const legendBuckets = useMemo(() => {
    const bucketCounts = new Map<StatusColorBucket, number>()

    for (const month of monthsData) {
      for (const week of month.weeks) {
        if (week.mondayDate && week.mondayDate.getFullYear() === year) {
          const bucket = getStatusBucket(week.status)
          bucketCounts.set(bucket, (bucketCounts.get(bucket) || 0) + 1)
        }
      }
    }

    const orderedBuckets: StatusColorBucket[] = [
      'healthy', 'onboarding', 'warning', 'paused', 'offboarding', 'churned', 'unknown', 'no-data',
    ]

    return orderedBuckets
      .filter(bucket => (bucketCounts.get(bucket) || 0) > 0)
      .map(bucket => ({ bucket, count: bucketCounts.get(bucket) || 0 }))
  }, [monthsData, year])

  // Build list data
  const listData = useMemo(() => {
    const weeks: { date: Date; weekNumber: number; status: string | null; notes: string | null; hasData: boolean; inheritedStatus: string | null; isFuture: boolean }[] = []

    for (const month of monthsData) {
      for (const week of month.weeks) {
        if (week.mondayDate && week.mondayDate.getFullYear() === year) {
          const exists = weeks.some(w => w.date.getTime() === week.mondayDate!.getTime())
          if (!exists) {
            weeks.push({
              date: week.mondayDate,
              weekNumber: week.weekNumber,
              status: week.status,
              notes: week.notes,
              hasData: week.hasData,
              inheritedStatus: week.inheritedStatus,
              isFuture: week.isFuture,
            })
          }
        }
      }
    }

    return weeks.sort((a, b) => b.date.getTime() - a.date.getTime())
  }, [monthsData, year])

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-4">
        {/* Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Year Selector */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setYear(y => y - 1)}
              className="p-1.5 rounded-md hover:bg-muted transition-colors"
              title="Previous year"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="text-lg font-semibold tabular-nums min-w-[4rem] text-center">
              {year}
            </span>
            <button
              onClick={() => setYear(y => y + 1)}
              disabled={year >= currentYear}
              className="p-1.5 rounded-md hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="Next year"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
            <button
              onClick={() => setViewMode('calendar')}
              className={`
                relative p-2 rounded-md transition-colors
                ${viewMode === 'calendar' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}
              `}
              title="Calendar view"
            >
              {viewMode === 'calendar' && (
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
                ${viewMode === 'list' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}
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

        {/* Calendar View */}
        {viewMode === 'calendar' && (
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {monthsData.map((month) => (
                  <div key={month.name} className="space-y-2">
                    {/* Month Header */}
                    <div className="text-sm font-semibold text-center text-primary">
                      {month.name}
                    </div>

                    {/* Calendar Grid */}
                    <div className="text-[10px]">
                      {/* Day headers */}
                      <div className="grid grid-cols-8 gap-px mb-1">
                        <div className="text-muted-foreground text-center font-medium">Wk</div>
                        {DAY_NAMES.map(day => (
                          <div key={day} className="text-muted-foreground text-center font-medium">
                            {day}
                          </div>
                        ))}
                      </div>

                      {/* Week rows */}
                      {month.weeks.map((week, weekIndex) => {
                        // Future weeks should show no color (even if they have inherited status)
                        const effectiveStatus = week.isFuture ? null : (week.status || week.inheritedStatus)
                        const isInherited = !week.hasData && !week.isFuture && week.inheritedStatus

                        return (
                          <Tooltip key={weekIndex}>
                            <TooltipTrigger asChild>
                              <div className="grid grid-cols-8 gap-px rounded-sm cursor-default">
                                {/* Week number - darkest */}
                                <div className={`
                                  text-center py-0.5 rounded-l-sm font-medium
                                  ${isInherited
                                    ? `${getStatusColorFaded(effectiveStatus)} text-foreground/60`
                                    : effectiveStatus
                                      ? `${getStatusColorFull(effectiveStatus)} text-white`
                                      : 'text-muted-foreground'
                                  }
                                `}>
                                  {week.weekNumber}
                                </div>

                                {/* Days - lighter */}
                                {week.days.map((day, dayIndex) => {
                                  // Determine day styling based on month membership and status
                                  let dayClass = ''
                                  if (!day.isCurrentMonth) {
                                    // Days outside current month - show faint status color if week has status
                                    if (effectiveStatus) {
                                      dayClass = `${getStatusColorOutside(effectiveStatus)} text-foreground/30`
                                    } else {
                                      dayClass = 'text-muted-foreground/30'
                                    }
                                  } else if (isInherited) {
                                    // Current month, inherited status
                                    dayClass = `${getStatusColorFadedLight(effectiveStatus)} text-foreground/70`
                                  } else if (effectiveStatus) {
                                    // Current month, actual status
                                    dayClass = `${getStatusColorLight(effectiveStatus)} text-white`
                                  }

                                  return (
                                    <div
                                      key={dayIndex}
                                      className={`
                                        text-center py-0.5
                                        ${dayIndex === 6 ? 'rounded-r-sm' : ''}
                                        ${day.isToday ? 'font-bold ring-1 ring-primary ring-inset rounded-sm' : ''}
                                        ${dayClass}
                                      `}
                                    >
                                      {day.day}
                                    </div>
                                  )
                                })}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs max-w-[200px]">
                              <div className="font-medium">Week {week.weekNumber}</div>
                              {week.mondayDate && (
                                <div className="text-muted-foreground">
                                  {week.mondayDate.toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                  })}
                                </div>
                              )}
                              <div className={week.status ? 'font-medium mt-1' : 'text-muted-foreground mt-1'}>
                                {week.isFuture
                                  ? 'Future'
                                  : week.status || (isInherited ? `No data (was: ${week.inheritedStatus})` : 'No data')
                                }
                              </div>
                              {week.notes && (
                                <div className="text-muted-foreground mt-1 border-t border-border/50 pt-1">
                                  {week.notes}
                                </div>
                              )}
                            </TooltipContent>
                          </Tooltip>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* List View */}
        {viewMode === 'list' && (
          <Card>
            <CardContent className="pt-0">
              <div className="divide-y divide-border/60">
                {listData.map(week => {
                  // Future weeks show no color
                  const effectiveStatus = week.isFuture ? null : (week.status || week.inheritedStatus)
                  const isInherited = !week.hasData && !week.isFuture && week.inheritedStatus

                  return (
                    <div
                      key={week.date.toISOString()}
                      className="flex items-center gap-3 py-3 first:pt-6"
                    >
                      <div className={`w-2 h-8 rounded-sm shrink-0 ${
                        isInherited
                          ? getStatusColorFaded(effectiveStatus)
                          : getStatusColorFull(effectiveStatus)
                      }`} />
                      <div className="w-32 shrink-0">
                        <div className="text-sm font-medium">Week {week.weekNumber}</div>
                        <div className="text-xs text-muted-foreground">
                          {week.date.toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm ${week.status ? '' : 'text-muted-foreground'}`}>
                          {week.isFuture
                            ? 'Future'
                            : week.status || (isInherited ? `(was: ${week.inheritedStatus})` : 'No data')
                          }
                        </div>
                        {week.notes && (
                          <div className="text-xs text-muted-foreground truncate">
                            {week.notes}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary */}
        <div className="text-xs text-muted-foreground text-center">
          {year} Calendar • {listData.filter(w => w.hasData).length} weeks with data
        </div>
      </div>
    </TooltipProvider>
  )
}
