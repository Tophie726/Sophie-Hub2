'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { getStatusBucket, BUCKET_LABELS, type StatusColorBucket } from '@/lib/status-colors'
import Link from 'next/link'

interface Partner {
  id: string
  brand_name: string
  source_data?: Record<string, Record<string, Record<string, unknown>>> | null
}

interface WeekData {
  weekStart: Date
  weekNumber: number
  statuses: Map<string, string | null> // partnerId -> status
}

const BUCKET_COLORS: Record<StatusColorBucket, string> = {
  healthy: 'bg-green-500',
  onboarding: 'bg-blue-500',
  warning: 'bg-amber-500',
  paused: 'bg-gray-400',
  offboarding: 'bg-orange-500',
  churned: 'bg-red-500',
  unknown: 'bg-purple-500',
  'no-data': 'bg-gray-200 dark:bg-gray-700',
}

const WEEKS_TO_SHOW = 12

/**
 * Extract weekly status data from partner source_data
 */
function extractWeeklyData(
  sourceData: Record<string, Record<string, Record<string, unknown>>> | null
): Map<string, string> {
  const weekData = new Map<string, string>()

  if (!sourceData) return weekData

  for (const connector of Object.values(sourceData)) {
    if (typeof connector !== 'object' || !connector) continue
    for (const tabData of Object.values(connector)) {
      if (typeof tabData !== 'object' || !tabData) continue

      for (const [columnName, value] of Object.entries(tabData)) {
        const weekMatch = columnName.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})[\s\n]+Week\s*(\d+)/i)
        if (!weekMatch) continue

        const [, month, day, yearStr] = weekMatch
        let year = parseInt(yearStr, 10)
        if (year < 100) year += year > 50 ? 1900 : 2000

        const dateKey = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`

        if (typeof value === 'string' && value.trim()) {
          weekData.set(dateKey, value.trim())
        }
      }
    }
  }

  return weekData
}

/**
 * Get Monday of the week for a given date
 */
function getWeekMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Generate array of week start dates
 */
function generateWeeks(weeksCount: number, offsetWeeks: number = 0): Date[] {
  const weeks: Date[] = []
  const today = new Date()
  const currentMonday = getWeekMonday(today)

  for (let i = weeksCount - 1 + offsetWeeks; i >= offsetWeeks; i--) {
    const weekStart = new Date(currentMonday)
    weekStart.setDate(weekStart.getDate() - i * 7)
    weeks.push(weekStart)
  }

  return weeks
}

function formatWeekLabel(date: Date): string {
  const month = date.toLocaleDateString('en-US', { month: 'short' })
  const day = date.getDate()
  return `${month} ${day}`
}

interface HealthHeatmapProps {
  maxPartners?: number
}

export function HealthHeatmap({ maxPartners = 50 }: HealthHeatmapProps) {
  const [partners, setPartners] = useState<Partner[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [weekOffset, setWeekOffset] = useState(0)

  const fetchPartners = useCallback(async () => {
    try {
      const res = await fetch(`/api/partners?limit=${maxPartners}&sort=brand_name&order=asc`)
      const json = await res.json()
      if (json.data?.partners) {
        setPartners(json.data.partners)
      }
    } catch (error) {
      console.error('Failed to fetch partners:', error)
    } finally {
      setIsLoading(false)
    }
  }, [maxPartners])

  useEffect(() => {
    fetchPartners()
  }, [fetchPartners])

  const weeks = useMemo(() => generateWeeks(WEEKS_TO_SHOW, weekOffset), [weekOffset])

  // Build the heatmap data
  const heatmapData = useMemo(() => {
    const data: { partner: Partner; weekStatuses: (string | null)[] }[] = []

    for (const partner of partners) {
      const weeklyData = extractWeeklyData(partner.source_data || null)
      const weekStatuses: (string | null)[] = []

      for (const weekStart of weeks) {
        // Try to find status for this week
        const year = weekStart.getFullYear()
        const month = (weekStart.getMonth() + 1).toString()
        const day = weekStart.getDate().toString()
        const dateKey = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`

        // Also try M/D/YY format
        const shortYear = year % 100
        const altKey = `${year}-${month}-${day}`

        let status = weeklyData.get(dateKey) || null

        // Try other date formats in the map
        if (!status) {
          weeklyData.forEach((value, key) => {
            if (status) return // Already found
            const keyDate = new Date(key)
            if (!isNaN(keyDate.getTime())) {
              const keyMonday = getWeekMonday(keyDate)
              if (keyMonday.getTime() === weekStart.getTime()) {
                status = value
              }
            }
          })
        }

        weekStatuses.push(status)
      }

      data.push({ partner, weekStatuses })
    }

    return data
  }, [partners, weeks])

  // Calculate bucket counts per week for summary row
  const weekSummaries = useMemo(() => {
    return weeks.map((_, weekIndex) => {
      const counts: Record<StatusColorBucket, number> = {
        healthy: 0, onboarding: 0, warning: 0, paused: 0,
        offboarding: 0, churned: 0, unknown: 0, 'no-data': 0,
      }

      for (const { weekStatuses } of heatmapData) {
        const status = weekStatuses[weekIndex]
        const bucket = getStatusBucket(status)
        counts[bucket]++
      }

      return counts
    })
  }, [heatmapData, weeks])

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Partner Health Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Partner Health Over Time</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Weekly status for {partners.length} partners
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setWeekOffset(prev => prev + WEEKS_TO_SHOW)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setWeekOffset(prev => Math.max(0, prev - WEEKS_TO_SHOW))}
              disabled={weekOffset === 0}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <TooltipProvider delayDuration={100}>
          <div className="overflow-x-auto">
            <div className="min-w-fit">
              {/* Week header row */}
              <div className="flex items-center gap-px mb-1">
                <div className="w-32 shrink-0" />
                {weeks.map((week, i) => (
                  <div
                    key={i}
                    className="w-6 text-[9px] text-muted-foreground text-center truncate"
                    title={formatWeekLabel(week)}
                  >
                    {week.getDate()}
                  </div>
                ))}
              </div>

              {/* Summary row */}
              <div className="flex items-center gap-px mb-2 pb-2 border-b border-border">
                <div className="w-32 shrink-0 text-xs font-medium text-muted-foreground">
                  Summary
                </div>
                {weekSummaries.map((counts, weekIndex) => {
                  const total = partners.length
                  const healthyPct = total > 0 ? (counts.healthy / total) * 100 : 0
                  const warningPct = total > 0 ? ((counts.warning + counts.offboarding) / total) * 100 : 0
                  const churnedPct = total > 0 ? (counts.churned / total) * 100 : 0

                  // Determine dominant color
                  let bgColor = 'bg-gray-200 dark:bg-gray-700'
                  if (healthyPct > 50) bgColor = 'bg-green-500'
                  else if (churnedPct > 20) bgColor = 'bg-red-500'
                  else if (warningPct > 20) bgColor = 'bg-amber-500'
                  else if (healthyPct > 20) bgColor = 'bg-green-400'

                  return (
                    <Tooltip key={weekIndex}>
                      <TooltipTrigger asChild>
                        <div
                          className={cn(
                            'w-6 h-4 rounded-sm cursor-default',
                            bgColor
                          )}
                        />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">
                        <div className="font-medium mb-1">{formatWeekLabel(weeks[weekIndex])}</div>
                        <div className="space-y-0.5">
                          <div>Healthy: {counts.healthy}</div>
                          <div>Warning: {counts.warning}</div>
                          <div>Churned: {counts.churned}</div>
                          <div>No Data: {counts['no-data']}</div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  )
                })}
              </div>

              {/* Partner rows */}
              <div className="space-y-px max-h-[400px] overflow-y-auto">
                {heatmapData.map(({ partner, weekStatuses }) => (
                  <div key={partner.id} className="flex items-center gap-px group">
                    <Link
                      href={`/partners/${partner.id}`}
                      className="w-32 shrink-0 text-xs truncate hover:text-primary transition-colors pr-2"
                      title={partner.brand_name}
                    >
                      {partner.brand_name}
                    </Link>
                    {weekStatuses.map((status, weekIndex) => {
                      const bucket = getStatusBucket(status)
                      const isFuture = weeks[weekIndex] > new Date()

                      return (
                        <Tooltip key={weekIndex}>
                          <TooltipTrigger asChild>
                            <div
                              className={cn(
                                'w-6 h-3 rounded-sm transition-all',
                                isFuture
                                  ? 'bg-transparent'
                                  : BUCKET_COLORS[bucket],
                                'group-hover:ring-1 group-hover:ring-primary/30'
                              )}
                            />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            <div className="font-medium">{partner.brand_name}</div>
                            <div className="text-muted-foreground">
                              {formatWeekLabel(weeks[weekIndex])}
                            </div>
                            <div className={status ? '' : 'text-muted-foreground'}>
                              {status || 'No data'}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      )
                    })}
                  </div>
                ))}
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t border-border">
                {(['healthy', 'onboarding', 'warning', 'paused', 'offboarding', 'churned', 'no-data'] as StatusColorBucket[]).map(bucket => (
                  <div key={bucket} className="flex items-center gap-1.5 text-xs">
                    <div className={cn('w-3 h-3 rounded-sm', BUCKET_COLORS[bucket])} />
                    <span className="text-muted-foreground">{BUCKET_LABELS[bucket]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  )
}
