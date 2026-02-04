'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Loader2, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
  status: string | null
  source_data?: Record<string, Record<string, Record<string, unknown>>> | null
}

// Module-level cache for persistence between tab switches
const heatmapCache: {
  partners: Partner[] | null
  filterKey: string
  scrollLeft: number
  scrollTop: number
  sortBy: string
} = {
  partners: null,
  filterKey: '',
  scrollLeft: 0,
  scrollTop: 0,
  sortBy: 'name',
}

// Export function to clear cache (for refresh functionality)
export function clearHeatmapCache() {
  heatmapCache.partners = null
  heatmapCache.filterKey = ''
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

const BUCKET_RISK_SCORE: Record<StatusColorBucket, number> = {
  churned: 100,
  offboarding: 80,
  warning: 60,
  paused: 40,
  unknown: 30,
  'no-data': 20,
  onboarding: 10,
  healthy: 0,
}

// Show 3 years of history on desktop, 1 year on mobile
const WEEKS_DESKTOP = 156  // ~3 years
const WEEKS_MOBILE = 52    // 1 year

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

type SortOption = 'name' | 'current-risk' | 'turbulent' | 'healthiest' | 'recent-activity'

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'name', label: 'Name (A-Z)' },
  { value: 'current-risk', label: 'Currently At Risk' },
  { value: 'turbulent', label: 'Most Turbulent' },
  { value: 'healthiest', label: 'Healthiest' },
  { value: 'recent-activity', label: 'Most Data' },
]

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

function getWeekMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

function getQuarter(month: number): number {
  return Math.floor(month / 3) + 1
}

function generateWeeks(weeksCount: number): Date[] {
  const weeks: Date[] = []
  const today = new Date()
  const currentMonday = getWeekMonday(today)

  for (let i = weeksCount - 1; i >= 0; i--) {
    const weekStart = new Date(currentMonday)
    weekStart.setDate(weekStart.getDate() - i * 7)
    weeks.push(weekStart)
  }

  return weeks
}

function formatWeekDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// Get current risk score (most recent non-null status)
function getCurrentRiskScore(weekStatuses: (string | null)[]): number {
  // Find most recent status (search from end)
  for (let i = weekStatuses.length - 1; i >= 0; i--) {
    if (weekStatuses[i] !== null) {
      const bucket = getStatusBucket(weekStatuses[i])
      return BUCKET_RISK_SCORE[bucket]
    }
  }
  return BUCKET_RISK_SCORE['no-data']
}

// Calculate turbulence (how many risk/warning statuses vs healthy)
function calculateTurbulence(weekStatuses: (string | null)[]): number {
  let riskCount = 0
  let totalData = 0

  for (const status of weekStatuses) {
    if (status === null) continue
    totalData++
    const bucket = getStatusBucket(status)
    if (bucket === 'warning' || bucket === 'churned' || bucket === 'offboarding') {
      riskCount++
    }
  }

  // Return ratio of risky weeks (0-100)
  return totalData > 0 ? (riskCount / totalData) * 100 : 0
}

function countDataWeeks(weekStatuses: (string | null)[]): number {
  return weekStatuses.filter(s => s !== null).length
}

interface HealthHeatmapProps {
  statusFilter?: string[]
  search?: string
}

interface HoveredCell {
  partnerName: string
  weekIndex: number
  status: string | null
  bucket: StatusColorBucket
  x: number
  y: number
}

export function HealthHeatmap({ statusFilter = [], search = '' }: HealthHeatmapProps) {
  const filterKey = useMemo(() => `${statusFilter.join(',')}-${search}`, [statusFilter, search])

  // Use cached data if available and filter matches
  const [partners, setPartners] = useState<Partner[]>(() =>
    heatmapCache.filterKey === filterKey && heatmapCache.partners ? heatmapCache.partners : []
  )
  const [isLoading, setIsLoading] = useState(() =>
    !(heatmapCache.filterKey === filterKey && heatmapCache.partners)
  )
  const [error, setError] = useState<string | null>(null)
  const [_total, _setTotal] = useState(0)
  void _total; void _setTotal // reserved for pagination
  const [sortBy, setSortByState] = useState<SortOption>(() =>
    (heatmapCache.sortBy as SortOption) || 'name'
  )
  const [weeksToShow, setWeeksToShow] = useState(WEEKS_DESKTOP)
  const [hoveredCell, setHoveredCell] = useState<HoveredCell | null>(null)
  const hoveredCellRef = useRef<HoveredCell | null>(null) // Mirror of state for scroll handler
  const scrollRef = useRef<HTMLDivElement>(null)
  const hasScrolledRef = useRef(false)
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isScrollingRef = useRef(false)
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Keep ref in sync with state
  const updateHoveredCell = useCallback((cell: HoveredCell | null) => {
    hoveredCellRef.current = cell
    setHoveredCell(cell)
  }, [])

  // Wrapper to update cache when sort changes
  const setSortBy = useCallback((value: SortOption) => {
    setSortByState(value)
    heatmapCache.sortBy = value
  }, [])

  useEffect(() => {
    const updateWeeks = () => {
      setWeeksToShow(window.innerWidth < 768 ? WEEKS_MOBILE : WEEKS_DESKTOP)
    }
    updateWeeks()
    window.addEventListener('resize', updateWeeks)
    return () => window.removeEventListener('resize', updateWeeks)
  }, [])

  const fetchPartners = useCallback(async () => {
    // Skip fetch if we have cached data for this filter
    if (heatmapCache.filterKey === filterKey && heatmapCache.partners) {
      setPartners(heatmapCache.partners)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('limit', '1000')
      params.set('sort', 'brand_name')
      params.set('order', 'asc')
      if (statusFilter.length > 0) {
        params.set('status', statusFilter.join(','))
      }
      if (search) {
        params.set('search', search)
      }

      const res = await fetch(`/api/partners?${params}`, {
        credentials: 'include',
      })

      if (!res.ok) {
        setError(`Failed to load partners (${res.status})`)
        console.error('Failed to fetch partners:', res.status, res.statusText)
        return
      }

      const json = await res.json()
      if (json.data?.partners) {
        setPartners(json.data.partners)
        setTotal(json.data.total || json.data.partners.length)
        // Save to cache
        heatmapCache.partners = json.data.partners
        heatmapCache.filterKey = filterKey
      }
    } catch (err) {
      setError('Network error - please try again')
      console.error('Failed to fetch partners:', err)
    } finally {
      setIsLoading(false)
    }
  }, [filterKey])

  useEffect(() => {
    fetchPartners()
  }, [fetchPartners])

  // Restore scroll position or auto-scroll to right on initial load
  useEffect(() => {
    if (!isLoading && partners.length > 0 && !hasScrolledRef.current) {
      const restoreOrScrollRight = () => {
        const el = scrollRef.current
        if (el && el.scrollWidth > el.clientWidth) {
          // Restore cached scroll position if same filter, or scroll to right if first load
          if (heatmapCache.filterKey === filterKey && (heatmapCache.scrollLeft > 0 || heatmapCache.scrollTop > 0)) {
            el.scrollLeft = heatmapCache.scrollLeft
            el.scrollTop = heatmapCache.scrollTop
          } else {
            el.scrollLeft = el.scrollWidth - el.clientWidth
          }
          hasScrolledRef.current = true
        }
      }
      // Multiple attempts to ensure content is rendered
      const timeouts = [50, 150, 300].map(delay =>
        setTimeout(restoreOrScrollRight, delay)
      )
      return () => timeouts.forEach(clearTimeout)
    }
  }, [isLoading, partners.length, filterKey])

  useEffect(() => {
    hasScrolledRef.current = false
  }, [filterKey])

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current)
    }
  }, [])

  // Track scrolling state to disable tooltips during scroll + save position to cache
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    let ticking = false
    let lastSaveTime = 0

    const handleScroll = () => {
      isScrollingRef.current = true

      // Only clear tooltip if one is showing (check ref, not state)
      if (hoveredCellRef.current) {
        hoveredCellRef.current = null
        setHoveredCell(null)
      }

      // Clear any pending hover timeout
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current)
        hoverTimeoutRef.current = null
      }

      // Throttle position saves - max once per 100ms
      const now = Date.now()
      if (!ticking && now - lastSaveTime > 100) {
        ticking = true
        lastSaveTime = now
        requestAnimationFrame(() => {
          heatmapCache.scrollLeft = el.scrollLeft
          heatmapCache.scrollTop = el.scrollTop
          ticking = false
        })
      }

      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current)
      scrollTimeoutRef.current = setTimeout(() => {
        isScrollingRef.current = false
        // Final position save
        heatmapCache.scrollLeft = el.scrollLeft
        heatmapCache.scrollTop = el.scrollTop
      }, 150)
    }

    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => el.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollLeft = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -400, behavior: 'smooth' })
    }
  }

  const scrollRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 400, behavior: 'smooth' })
    }
  }

  const weeks = useMemo(() => generateWeeks(weeksToShow), [weeksToShow])

  // Group weeks by year, quarter, and month for headers
  const timeHeaders = useMemo(() => {
    const years: { year: number; startIdx: number; count: number }[] = []
    const quarters: { quarter: number; year: number; startIdx: number; count: number }[] = []
    const months: { month: number; year: number; startIdx: number; count: number }[] = []

    let currentYear = -1
    let currentQuarter = -1
    let currentMonth = -1
    let currentYearObj: typeof years[0] | null = null
    let currentQuarterObj: typeof quarters[0] | null = null
    let currentMonthObj: typeof months[0] | null = null

    weeks.forEach((week, idx) => {
      const year = week.getFullYear()
      const quarter = getQuarter(week.getMonth())
      const month = week.getMonth()

      // Group by calendar year
      if (year !== currentYear) {
        currentYear = year
        currentYearObj = { year, startIdx: idx, count: 0 }
        years.push(currentYearObj)
      }
      if (currentYearObj) currentYearObj.count++

      // Quarters grouped by calendar year + quarter
      if (quarter !== currentQuarter || year !== (currentQuarterObj?.year ?? -1)) {
        currentQuarter = quarter
        currentQuarterObj = { quarter, year, startIdx: idx, count: 0 }
        quarters.push(currentQuarterObj)
      }
      if (currentQuarterObj) currentQuarterObj.count++

      // Months grouped by calendar year + month
      if (month !== currentMonth || year !== (currentMonthObj?.year ?? -1)) {
        currentMonth = month
        currentMonthObj = { month, year, startIdx: idx, count: 0 }
        months.push(currentMonthObj)
      }
      if (currentMonthObj) currentMonthObj.count++
    })

    return { years, quarters, months }
  }, [weeks])

  const heatmapData = useMemo(() => {
    const data: { partner: Partner; weekStatuses: (string | null)[]; currentRisk: number; turbulence: number; dataWeeks: number }[] = []

    for (const partner of partners) {
      const weeklyData = extractWeeklyData(partner.source_data || null)
      const weekStatuses: (string | null)[] = []

      for (const weekStart of weeks) {
        let status: string | null = null

        weeklyData.forEach((value, key) => {
          if (status) return
          const keyDate = new Date(key)
          if (!isNaN(keyDate.getTime())) {
            const keyMonday = getWeekMonday(keyDate)
            if (keyMonday.getTime() === weekStart.getTime()) {
              status = value
            }
          }
        })

        weekStatuses.push(status)
      }

      data.push({
        partner,
        weekStatuses,
        currentRisk: getCurrentRiskScore(weekStatuses),
        turbulence: calculateTurbulence(weekStatuses),
        dataWeeks: countDataWeeks(weekStatuses),
      })
    }

    return data
  }, [partners, weeks])

  const sortedHeatmapData = useMemo(() => {
    const sorted = [...heatmapData]

    switch (sortBy) {
      case 'current-risk':
        // Sort by current risk status (highest risk first), then by turbulence
        sorted.sort((a, b) => {
          if (b.currentRisk !== a.currentRisk) return b.currentRisk - a.currentRisk
          return b.turbulence - a.turbulence
        })
        break
      case 'turbulent':
        // Sort by turbulence ratio (most turbulent first)
        sorted.sort((a, b) => b.turbulence - a.turbulence)
        break
      case 'healthiest':
        // Sort by lowest current risk, then lowest turbulence
        sorted.sort((a, b) => {
          if (a.currentRisk !== b.currentRisk) return a.currentRisk - b.currentRisk
          return a.turbulence - b.turbulence
        })
        break
      case 'recent-activity':
        sorted.sort((a, b) => b.dataWeeks - a.dataWeeks)
        break
      case 'name':
      default:
        sorted.sort((a, b) => a.partner.brand_name.localeCompare(b.partner.brand_name))
        break
    }

    return sorted
  }, [heatmapData, sortBy])

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

  const cellSize = 12 // pixels
  const cellGap = 2
  const nameColWidth = 180

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-sm text-destructive mb-3">{error}</p>
        <Button variant="outline" size="sm" onClick={fetchPartners}>
          Try Again
        </Button>
      </div>
    )
  }

  return (
    <TooltipProvider delayDuration={0}>
      {/* Header with controls */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {partners.length} partners • {weeksToShow} weeks
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={scrollLeft}
              title="Scroll to earlier weeks"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={scrollRight}
              title="Scroll to recent weeks"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 h-8">
              <ArrowUpDown className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{SORT_OPTIONS.find(o => o.value === sortBy)?.label}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuRadioGroup value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              {SORT_OPTIONS.map(option => (
                <DropdownMenuRadioItem key={option.value} value={option.value}>
                  {option.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Heatmap container with sticky headers */}
      <div className="border rounded-lg bg-card overflow-hidden">
        <div
          ref={scrollRef}
          className="overflow-auto overscroll-contain"
          style={{
            scrollbarWidth: 'thin',
            maxHeight: 'calc(100vh - 280px)',
            willChange: 'scroll-position',
          }}
        >
          <div style={{ minWidth: nameColWidth + (weeks.length * (cellSize + cellGap)) + 40 }}>
            {/* Sticky header section */}
            <div className="sticky top-0 z-20 bg-card border-b select-none">
              {/* Year row */}
              <div className="flex items-center">
                <div style={{ width: nameColWidth }} className="shrink-0 px-3 py-1 bg-card sticky left-0 z-30 border-r border-border/20" />
                <div className="flex">
                  {timeHeaders.years.map(({ year, count }, idx) => (
                    <div
                      key={`year-${idx}`}
                      className="text-xs font-semibold text-foreground border-l border-border px-1"
                      style={{ width: count * (cellSize + cellGap) }}
                    >
                      {year}
                    </div>
                  ))}
                </div>
              </div>

              {/* Quarter row */}
              <div className="flex items-center">
                <div style={{ width: nameColWidth }} className="shrink-0 px-3 bg-card sticky left-0 z-30 border-r border-border/20" />
                <div className="flex">
                  {timeHeaders.quarters.map(({ quarter, count }, idx) => (
                    <div
                      key={`quarter-${idx}`}
                      className="text-[10px] font-medium text-muted-foreground border-l border-border/50 px-1"
                      style={{ width: count * (cellSize + cellGap) }}
                    >
                      Q{quarter}
                    </div>
                  ))}
                </div>
              </div>

              {/* Month row */}
              <div className="flex items-center">
                <div style={{ width: nameColWidth }} className="shrink-0 px-3 bg-card sticky left-0 z-30 border-r border-border/20" />
                <div className="flex">
                  {timeHeaders.months.map(({ month, count }, idx) => (
                    <div
                      key={`month-${idx}`}
                      className="text-[9px] text-muted-foreground/70 border-l border-border/30 px-0.5"
                      style={{ width: count * (cellSize + cellGap) }}
                    >
                      {MONTH_NAMES[month]}
                    </div>
                  ))}
                </div>
              </div>

              {/* Week number row */}
              <div className="flex items-center pb-1">
                <div
                  style={{ width: nameColWidth }}
                  className="shrink-0 px-3 text-[10px] font-medium text-muted-foreground bg-card sticky left-0 z-30 border-r border-border/20"
                >
                  Partner
                </div>
                <div className="flex">
                  {weeks.map((week, i) => (
                    <div
                      key={i}
                      className="text-[8px] text-muted-foreground/50 text-center"
                      style={{ width: cellSize + cellGap }}
                    >
                      {getISOWeekNumber(week)}
                    </div>
                  ))}
                </div>
              </div>

              {/* Summary row */}
              <div className="flex items-center py-1 border-t bg-muted/50">
                <div
                  style={{ width: nameColWidth }}
                  className="shrink-0 px-3 text-xs font-medium text-muted-foreground bg-muted/50 sticky left-0 z-30 border-r border-border/20"
                >
                  Summary
                </div>
                <div className="flex items-center">
                  {weekSummaries.map((counts, weekIndex) => {
                    const totalPartners = partners.length
                    const healthyPct = totalPartners > 0 ? (counts.healthy / totalPartners) * 100 : 0
                    const warningPct = totalPartners > 0 ? ((counts.warning + counts.offboarding) / totalPartners) * 100 : 0
                    const churnedPct = totalPartners > 0 ? (counts.churned / totalPartners) * 100 : 0
                    const isFuture = weeks[weekIndex] > new Date()

                    let bgColor = 'bg-gray-200 dark:bg-gray-700'
                    if (!isFuture) {
                      if (healthyPct > 60) bgColor = 'bg-green-500'
                      else if (healthyPct > 40) bgColor = 'bg-green-400'
                      else if (churnedPct > 30) bgColor = 'bg-red-500'
                      else if (warningPct > 30) bgColor = 'bg-amber-500'
                      else if (healthyPct > 20) bgColor = 'bg-green-300'
                    }

                    return (
                      <Tooltip key={weekIndex}>
                        <TooltipTrigger asChild>
                          <div
                            className={cn(
                              'rounded-sm cursor-default mx-px',
                              isFuture ? 'bg-transparent border border-dashed border-border/30' : bgColor
                            )}
                            style={{ width: cellSize, height: cellSize + 2 }}
                          />
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs">
                          <div className="font-medium mb-1">
                            Week {getISOWeekNumber(weeks[weekIndex])} • {formatWeekDate(weeks[weekIndex])}
                          </div>
                          <div className="space-y-0.5 text-muted-foreground">
                            <div className="flex items-center gap-1.5">
                              <div className="w-2 h-2 rounded-full bg-green-500" /> Healthy: {counts.healthy}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <div className="w-2 h-2 rounded-full bg-blue-500" /> Onboarding: {counts.onboarding}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <div className="w-2 h-2 rounded-full bg-amber-500" /> Warning: {counts.warning}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <div className="w-2 h-2 rounded-full bg-red-500" /> Churned: {counts.churned}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <div className="w-2 h-2 rounded-full bg-gray-300" /> No Data: {counts['no-data']}
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Partner rows - using data attributes for event delegation */}
            <div
              className="relative"
              onMouseMove={(e) => {
                if (isScrollingRef.current) return

                const target = e.target as HTMLElement
                const cell = target.closest('[data-cell]') as HTMLElement | null

                if (!cell) {
                  // Mouse left cells area
                  if (hoverTimeoutRef.current) {
                    clearTimeout(hoverTimeoutRef.current)
                    hoverTimeoutRef.current = null
                  }
                  if (hoveredCellRef.current) updateHoveredCell(null)
                  return
                }

                const partnerIdx = cell.dataset.partner
                const weekIdx = cell.dataset.week
                if (!partnerIdx || !weekIdx) return

                const pIdx = parseInt(partnerIdx, 10)
                const wIdx = parseInt(weekIdx, 10)

                // Skip if same cell
                if (hoveredCellRef.current?.partnerName === sortedHeatmapData[pIdx]?.partner.brand_name &&
                    hoveredCellRef.current?.weekIndex === wIdx) {
                  return
                }

                if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)

                hoverTimeoutRef.current = setTimeout(() => {
                  if (isScrollingRef.current) return
                  const data = sortedHeatmapData[pIdx]
                  if (!data) return
                  const status = data.weekStatuses[wIdx]
                  const bucket = getStatusBucket(status)
                  const rect = cell.getBoundingClientRect()
                  updateHoveredCell({
                    partnerName: data.partner.brand_name,
                    weekIndex: wIdx,
                    status,
                    bucket,
                    x: rect.left + rect.width / 2,
                    y: rect.top
                  })
                }, 150)
              }}
              onMouseLeave={() => {
                if (hoverTimeoutRef.current) {
                  clearTimeout(hoverTimeoutRef.current)
                  hoverTimeoutRef.current = null
                }
                if (hoveredCellRef.current) updateHoveredCell(null)
              }}
            >
              {sortedHeatmapData.map(({ partner, weekStatuses }, partnerIndex) => (
                <div key={partner.id} className="flex items-center hover:bg-muted/40">
                  <Link
                    href={`/partners/${partner.id}`}
                    style={{ width: nameColWidth }}
                    className="shrink-0 px-3 py-0.5 text-xs truncate hover:text-primary hover:underline transition-colors bg-card hover:bg-muted/40 sticky left-0 z-10 border-r border-border/20"
                    title={partner.brand_name}
                  >
                    {partner.brand_name}
                  </Link>
                  <div className="flex items-center">
                    {weekStatuses.map((status, weekIndex) => {
                      const bucket = getStatusBucket(status)
                      const isFuture = weeks[weekIndex] > new Date()

                      return (
                        <div
                          key={weekIndex}
                          data-cell
                          data-partner={partnerIndex}
                          data-week={weekIndex}
                          className={cn(
                            'rounded-[2px] mx-px',
                            isFuture ? 'bg-transparent' : BUCKET_COLORS[bucket]
                          )}
                          style={{ width: cellSize, height: cellSize }}
                        />
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

          </div>
        </div>

        {/* Floating tooltip for hovered cells - uses fixed positioning */}
        {hoveredCell && (
          <div
            className="fixed z-[100] pointer-events-none bg-popover text-popover-foreground border rounded-md shadow-lg px-3 py-2 text-xs"
            style={{
              left: hoveredCell.x,
              top: hoveredCell.y - 8,
              transform: 'translate(-50%, -100%)',
            }}
          >
            <div className="font-medium">{hoveredCell.partnerName}</div>
            <div className="text-muted-foreground">
              Week {getISOWeekNumber(weeks[hoveredCell.weekIndex])} • {formatWeekDate(weeks[hoveredCell.weekIndex])}
            </div>
            <div className={cn(
              'flex items-center gap-1.5 mt-1',
              hoveredCell.status ? '' : 'text-muted-foreground'
            )}>
              <div className={cn('w-2 h-2 rounded-full shrink-0', BUCKET_COLORS[hoveredCell.bucket])} />
              <span className="font-medium">{BUCKET_LABELS[hoveredCell.bucket]}</span>
              {hoveredCell.status && hoveredCell.status !== BUCKET_LABELS[hoveredCell.bucket] && (
                <span className="text-muted-foreground">({hoveredCell.status})</span>
              )}
            </div>
          </div>
        )}

        {/* Legend - outside scrollable area */}
        <div className="flex flex-wrap items-center gap-4 px-4 py-3 border-t border-border bg-card">
          {(['healthy', 'onboarding', 'warning', 'paused', 'offboarding', 'churned', 'no-data'] as StatusColorBucket[]).map(bucket => (
            <div key={bucket} className="flex items-center gap-1.5 text-xs">
              <div className={cn('w-3 h-3 rounded-[2px]', BUCKET_COLORS[bucket])} />
              <span className="text-muted-foreground">{BUCKET_LABELS[bucket]}</span>
            </div>
          ))}
        </div>
      </div>
    </TooltipProvider>
  )
}
