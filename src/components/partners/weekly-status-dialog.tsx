'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
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

const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAY_NAMES = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

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
  mondayDate: Date | null
  hasData: boolean
  isFuture: boolean
}

function buildMonthCalendar(
  year: number,
  month: number,
  statusLookup: Map<string, { status: string; weekNumber: number }>,
  lastKnownStatus: string | null
): { weeks: WeekRowData[]; lastStatus: string | null } {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)

  const startDate = new Date(firstDay)
  startDate.setDate(startDate.getDate() - startDate.getDay())

  const weeks: WeekRowData[] = []
  const current = new Date(startDate)
  let runningStatus = lastKnownStatus

  while (current <= lastDay || current.getDay() !== 0) {
    const weekDays: DayData[] = []
    let weekMonday: Date | null = null
    let weekStatus: string | null = null
    let hasData = false

    for (let i = 0; i < 7; i++) {
      const isCurrentMonth = current.getMonth() === month
      const isMonday = current.getDay() === 1
      const isToday = current.getTime() === today.getTime()

      if (isMonday) {
        weekMonday = new Date(current)
        const key = formatDateKey(current)
        const fromSource = statusLookup.get(key)
        weekStatus = fromSource?.status || null
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

    if (weekDays.some(d => d.isCurrentMonth)) {
      const isFuture = weekMonday ? weekMonday > today : false

      weeks.push({
        weekNumber: weekDays[1] ? getWeekNumber(weekDays[1].date) : getWeekNumber(weekDays[0].date),
        days: weekDays,
        status: weekStatus,
        mondayDate: weekMonday,
        hasData,
        isFuture,
      })
    }

    if (current.getMonth() > month && current.getFullYear() >= year) break
    if (current.getFullYear() > year) break
  }

  return { weeks, lastStatus: runningStatus }
}

export function WeeklyStatusDialog({
  open,
  onOpenChange,
  partnerId,
  partnerName,
  sourceData,
}: WeeklyStatusDialogProps) {
  const statusLookup = useMemo(() => buildWeeklyLookup(sourceData), [sourceData])

  // Build calendar data for the last 4 months
  const monthsData = useMemo(() => {
    const today = new Date()
    const result: { name: string; year: number; month: number; weeks: WeekRowData[] }[] = []
    let lastStatus: string | null = null

    // Go back 3 months from current month (show 4 months total)
    for (let i = 3; i >= 0; i--) {
      const targetDate = new Date(today.getFullYear(), today.getMonth() - i, 1)
      const { weeks, lastStatus: newLastStatus } = buildMonthCalendar(
        targetDate.getFullYear(),
        targetDate.getMonth(),
        statusLookup,
        lastStatus
      )
      result.push({
        name: MONTH_NAMES_SHORT[targetDate.getMonth()],
        year: targetDate.getFullYear(),
        month: targetDate.getMonth(),
        weeks,
      })
      lastStatus = newLastStatus
    }

    return result
  }, [statusLookup])

  // Calculate bucket stats
  const bucketStats = useMemo(() => {
    const stats = new Map<StatusColorBucket, number>()

    for (const month of monthsData) {
      for (const week of month.weeks) {
        if (week.hasData) {
          const bucket = getStatusBucket(week.status)
          stats.set(bucket, (stats.get(bucket) || 0) + 1)
        }
      }
    }

    return stats
  }, [monthsData])

  const weeksWithData = monthsData.reduce(
    (sum, m) => sum + m.weeks.filter(w => w.hasData).length,
    0
  )
  const totalWeeks = monthsData.reduce((sum, m) => sum + m.weeks.length, 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between pr-6">
            <span className="truncate">{partnerName}</span>
          </DialogTitle>
        </DialogHeader>

        <TooltipProvider delayDuration={100}>
          <div className="space-y-4">
            {/* Mini Calendar Grid - 4 months in 2x2 */}
            <div className="grid grid-cols-2 gap-4">
              {monthsData.map((month) => (
                <div key={`${month.year}-${month.month}`} className="space-y-1">
                  {/* Month Header */}
                  <div className="text-xs font-medium text-muted-foreground text-center">
                    {month.name} {month.year !== new Date().getFullYear() ? month.year : ''}
                  </div>

                  {/* Calendar Grid */}
                  <div className="text-[9px]">
                    {/* Day headers */}
                    <div className="grid grid-cols-8 gap-px mb-0.5">
                      <div className="text-muted-foreground/60 text-center">W</div>
                      {DAY_NAMES.map((day, i) => (
                        <div key={i} className="text-muted-foreground/60 text-center">
                          {day}
                        </div>
                      ))}
                    </div>

                    {/* Week rows */}
                    {month.weeks.map((week, weekIndex) => {
                      const effectiveStatus = week.isFuture ? null : week.status
                      const bucket = getStatusBucket(effectiveStatus)
                      const bgColor = effectiveStatus ? BUCKET_COLORS[bucket] : ''

                      return (
                        <Tooltip key={weekIndex}>
                          <TooltipTrigger asChild>
                            <div className="grid grid-cols-8 gap-[2px] cursor-default">
                              {/* Week number */}
                              <div className={`
                                text-center py-0.5 rounded-[1px] font-medium text-[8px]
                                ${effectiveStatus ? `${bgColor} text-white` : 'text-muted-foreground/50'}
                              `}>
                                {week.weekNumber}
                              </div>

                              {/* Days */}
                              {week.days.map((day, dayIndex) => {
                                let dayClass = ''
                                if (!day.isCurrentMonth) {
                                  dayClass = 'text-muted-foreground/20'
                                } else if (effectiveStatus) {
                                  dayClass = `${bgColor} text-white/90`
                                } else {
                                  dayClass = 'text-muted-foreground/40'
                                }

                                return (
                                  <div
                                    key={dayIndex}
                                    className={`
                                      text-center py-0.5 rounded-[1px]
                                      ${day.isToday ? 'ring-1 ring-primary ring-inset font-bold' : ''}
                                      ${dayClass}
                                    `}
                                  >
                                    {day.day}
                                  </div>
                                )
                              })}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs max-w-[180px]">
                            <div className="font-medium">Week {week.weekNumber}</div>
                            {week.mondayDate && (
                              <div className="text-muted-foreground">
                                {week.mondayDate.toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </div>
                            )}
                            <div className={week.status ? 'font-medium mt-0.5' : 'text-muted-foreground mt-0.5'}>
                              {week.isFuture ? 'Future' : week.status || 'No data'}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Legend / Stats */}
            <div className="flex flex-wrap gap-3 pt-3 border-t border-border/60">
              {Array.from(bucketStats.entries())
                .filter(([, count]) => count > 0)
                .sort((a, b) => b[1] - a[1])
                .map(([bucket, count]) => (
                  <div key={bucket} className="flex items-center gap-1.5 text-xs">
                    <div className={`w-2 h-3 rounded-[1px] ${BUCKET_COLORS[bucket]}`} />
                    <span className="text-muted-foreground">
                      {BUCKET_LABELS[bucket]} ({count})
                    </span>
                  </div>
                ))}
            </div>

            {/* Footer with link to full page */}
            <div className="flex items-center justify-between pt-2 border-t border-border/60">
              <span className="text-xs text-muted-foreground">
                {weeksWithData} of {totalWeeks} weeks have data
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
