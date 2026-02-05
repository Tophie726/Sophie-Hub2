'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { ExternalLink, AlertTriangle, FileSpreadsheet, ChevronRight } from 'lucide-react'
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
import { cn } from '@/lib/utils'

interface Partner {
  id: string
  brand_name: string
  status: string | null
  computed_status?: string | null
  computed_status_label?: string
  latest_weekly_status?: string | null
  status_matches?: boolean
  source_data?: Record<string, Record<string, Record<string, unknown>>> | null
}

interface StatusInvestigationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  partner: Partner | null
}

// Format date as M/D/YY for lookup
function formatDateKey(date: Date): string {
  const m = date.getMonth() + 1
  const d = date.getDate()
  const y = date.getFullYear() % 100
  return `${m}/${d}/${y}`
}

// Build a lookup map from source_data weekly columns
function buildWeeklyLookup(
  sourceData: Record<string, Record<string, Record<string, unknown>>> | null | undefined
): Map<string, { status: string; weekNumber: number; dateStr: string }> {
  const lookup = new Map<string, { status: string; weekNumber: number; dateStr: string }>()

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
            lookup.set(normalizedKey, {
              status,
              weekNumber: parseInt(weekNumStr, 10),
              dateStr,
            })
          }
        }
      }
    }
  }

  return lookup
}

// Get last N weeks of data
function getRecentWeeks(
  lookup: Map<string, { status: string; weekNumber: number; dateStr: string }>,
  count: number
): Array<{ date: Date; status: string | null; weekNumber: number }> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const weeks: Array<{ date: Date; status: string | null; weekNumber: number }> = []

  // Find the most recent Monday
  const currentMonday = new Date(today)
  const dayOfWeek = currentMonday.getDay()
  const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  currentMonday.setDate(currentMonday.getDate() - daysToSubtract)

  // Go back N weeks
  for (let i = 0; i < count; i++) {
    const weekMonday = new Date(currentMonday)
    weekMonday.setDate(weekMonday.getDate() - (i * 7))

    const key = formatDateKey(weekMonday)
    const data = lookup.get(key)

    // Calculate week number
    const weekNum = data?.weekNumber ?? getISOWeekNumber(weekMonday)

    weeks.push({
      date: weekMonday,
      status: data?.status || null,
      weekNumber: weekNum,
    })
  }

  return weeks.reverse() // Oldest first
}

function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

// Status display box component
function StatusBox({
  label,
  status,
  bucket,
  sublabel,
}: {
  label: string
  status: string | null
  bucket: StatusColorBucket
  sublabel?: string
}) {
  const bgColor = BUCKET_COLORS[bucket]

  return (
    <div className="flex-1 text-center">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
        {label}
      </div>
      <div className={cn(
        'rounded-lg py-3 px-4',
        bgColor,
        'text-white font-medium'
      )}>
        {status ? status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Unknown'}
      </div>
      {sublabel && (
        <div className="text-[10px] text-muted-foreground mt-1">
          {sublabel}
        </div>
      )}
    </div>
  )
}

export function StatusInvestigationDialog({
  open,
  onOpenChange,
  partner,
}: StatusInvestigationDialogProps) {
  const [sourceUrl, setSourceUrl] = useState<string | null>(null)
  const [sourceName, setSourceName] = useState<string>('')
  const [cellReference, setCellReference] = useState<string | null>(null)
  const [isLoadingUrl, setIsLoadingUrl] = useState(false)

  // Fetch source URL when dialog opens
  useEffect(() => {
    if (open && partner?.id) {
      setIsLoadingUrl(true)
      setCellReference(null)
      fetch(`/api/partners/${partner.id}/source-url`)
        .then(res => res.json())
        .then(json => {
          if (json.data) {
            setSourceUrl(json.data.spreadsheet_url)
            setSourceName(json.data.source_name)
            setCellReference(json.data.cell_reference)
          }
        })
        .catch(err => {
          console.error('Failed to fetch source URL:', err)
        })
        .finally(() => {
          setIsLoadingUrl(false)
        })
    }
  }, [open, partner?.id])

  // Build weekly lookup
  const weeklyLookup = useMemo(
    () => buildWeeklyLookup(partner?.source_data),
    [partner?.source_data]
  )

  // Get recent 8 weeks
  const recentWeeks = useMemo(
    () => getRecentWeeks(weeklyLookup, 8),
    [weeklyLookup]
  )

  if (!partner) return null

  const showMismatch = !partner.status_matches && partner.status && partner.computed_status
  const computedBucket = getStatusBucket(partner.computed_status || null)
  const sheetBucket = getStatusBucket(partner.status || null)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-6">
            <span className="truncate">{partner.brand_name}</span>
          </DialogTitle>
        </DialogHeader>

        <TooltipProvider delayDuration={100}>
          <div className="space-y-4">
            {/* Mismatch Warning */}
            {showMismatch && (
              <div className="flex items-center gap-2 text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 rounded-lg">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span className="text-sm font-medium">Status Mismatch Detected</span>
              </div>
            )}

            {/* Status Comparison */}
            <div className="flex items-center gap-4">
              <StatusBox
                label="Computed (from weekly)"
                status={partner.computed_status || null}
                bucket={computedBucket}
                sublabel={BUCKET_LABELS[computedBucket]}
              />

              <div className="text-muted-foreground text-xl font-light">vs</div>

              <StatusBox
                label="Sheet (database)"
                status={partner.status}
                bucket={sheetBucket}
                sublabel={BUCKET_LABELS[sheetBucket]}
              />
            </div>

            {/* Latest Weekly Status */}
            {partner.latest_weekly_status && (
              <div className="text-sm text-center py-2 bg-muted/30 rounded-lg">
                <span className="text-muted-foreground">Latest weekly: </span>
                <span className="font-medium">{partner.latest_weekly_status}</span>
              </div>
            )}

            {/* Recent 8 Weeks Mini Bar */}
            <div className="border-t border-border/60 pt-4">
              <div className="text-xs font-medium text-muted-foreground mb-2">
                Recent 8 Weeks
              </div>

              {/* Mini bar chart */}
              <div className="flex gap-1 mb-3">
                {recentWeeks.map((week, i) => {
                  const bucket = getStatusBucket(week.status)
                  const bgColor = week.status ? BUCKET_COLORS[bucket] : 'bg-muted/30'

                  return (
                    <Tooltip key={i}>
                      <TooltipTrigger asChild>
                        <div
                          className={cn(
                            'flex-1 h-6 rounded-sm cursor-default transition-opacity hover:opacity-80',
                            bgColor
                          )}
                        />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">
                        <div className="font-medium">Week {week.weekNumber}</div>
                        <div className="text-muted-foreground">
                          {week.date.toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </div>
                        <div className={week.status ? 'font-medium mt-0.5' : 'text-muted-foreground mt-0.5'}>
                          {week.status || 'No data'}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  )
                })}
              </div>

              {/* Week list */}
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {recentWeeks.slice().reverse().slice(0, 4).map((week, i) => {
                  const bucket = getStatusBucket(week.status)
                  const bgColor = week.status ? BUCKET_COLORS[bucket] : ''

                  return (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <div className={cn(
                        'w-2 h-2 rounded-[2px]',
                        week.status ? bgColor : 'bg-muted'
                      )} />
                      <span className="text-muted-foreground">
                        Week {week.weekNumber} ({week.date.toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}):
                      </span>
                      <span className={week.status ? 'font-medium' : 'text-muted-foreground'}>
                        {week.status || 'No data'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-border/60">
              {sourceUrl ? (
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex"
                >
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                    {cellReference
                      ? `Go to Cell ${cellReference}`
                      : `View in ${sourceName || 'Google Sheet'}`
                    }
                    <ExternalLink className="h-3 w-3 opacity-60" />
                  </Button>
                </a>
              ) : (
                <Button variant="outline" size="sm" disabled className="gap-1.5">
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  {isLoadingUrl ? 'Finding cell...' : 'No source configured'}
                </Button>
              )}

              <Link
                href={`/partners/${partner.id}?tab=weekly`}
                onClick={() => onOpenChange(false)}
              >
                <Button variant="default" size="sm" className="gap-1.5">
                  View Full History
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          </div>
        </TooltipProvider>
      </DialogContent>
    </Dialog>
  )
}
