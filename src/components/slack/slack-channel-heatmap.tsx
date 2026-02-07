'use client'

import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ShimmerBar } from '@/components/ui/shimmer-grid'
import { cn } from '@/lib/utils'

interface ResponseMetric {
  date: string
  channel_id: string
  partner_id: string
  partner_name: string | null
  avg_response_time_mins: number | null
  total_messages: number
}

interface ChannelInfo {
  channel_id: string
  channel_name: string | null
}

type ResponseBucket = 'fast' | 'good' | 'slow' | 'critical' | 'no-data'

const BUCKET_CONFIG: Record<ResponseBucket, { color: string; label: string; description: string }> = {
  fast: { color: 'bg-green-500', label: '< 1h', description: 'Under 1 hour' },
  good: { color: 'bg-yellow-400', label: '1-4h', description: '1 to 4 hours' },
  slow: { color: 'bg-orange-500', label: '4-24h', description: '4 to 24 hours' },
  critical: { color: 'bg-red-500', label: '> 24h', description: 'Over 24 hours' },
  'no-data': { color: 'bg-muted/40', label: 'No data', description: 'No messages' },
}

function getResponseBucket(avgMins: number | null): ResponseBucket {
  if (avgMins === null) return 'no-data'
  if (avgMins < 60) return 'fast'
  if (avgMins < 240) return 'good'
  if (avgMins < 1440) return 'slow'
  return 'critical'
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatResponseTime(mins: number | null): string {
  if (mins === null) return 'N/A'
  if (mins < 60) return `${Math.round(mins)}m`
  const hours = Math.floor(mins / 60)
  const remaining = Math.round(mins % 60)
  if (remaining === 0) return `${hours}h`
  return `${hours}h ${remaining}m`
}

// Generate date strings for last N days
function generateDays(count: number): string[] {
  const days: string[] = []
  const today = new Date()
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setUTCDate(d.getUTCDate() - i)
    days.push(d.toISOString().split('T')[0])
  }
  return days
}

const CELL_SIZE = 14
const CELL_GAP = 2
const NAME_COL_WIDTH = 160
const ROW_HEIGHT = 20
const DAYS_COUNT = 30

interface HoveredCell {
  channelName: string
  date: string
  avgMins: number | null
  messageCount: number
  bucket: ResponseBucket
  x: number
  y: number
}

export function SlackChannelHeatmap() {
  const [hoveredCell, setHoveredCell] = useState<HoveredCell | null>(null)
  const hoveredCellRef = useRef<HoveredCell | null>(null)
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isScrollingRef = useRef(false)
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const days = useMemo(() => generateDays(DAYS_COUNT), [])

  const dateRange = useMemo(() => ({
    from: days[0],
    to: days[days.length - 1],
  }), [days])

  // Fetch response metrics
  const { data: metrics, isLoading, error } = useQuery<ResponseMetric[]>({
    queryKey: ['slack-heatmap-data', dateRange.from, dateRange.to],
    queryFn: async () => {
      const params = new URLSearchParams({
        date_from: dateRange.from,
        date_to: dateRange.to,
      })
      const res = await fetch(`/api/slack/analytics/response-times?${params}`)
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message || 'Failed')
      return json.data.metrics || []
    },
  })

  // Fetch channel names
  const { data: channelInfoList } = useQuery<ChannelInfo[]>({
    queryKey: ['slack-channel-names'],
    queryFn: async () => {
      const res = await fetch('/api/slack/sync/status')
      const json = await res.json()
      if (!json.success) return []
      return (json.data.channels || []).map((c: { channel_id: string; channel_name: string }) => ({
        channel_id: c.channel_id,
        channel_name: c.channel_name,
      }))
    },
    staleTime: 5 * 60 * 1000,
  })

  const channelNames = useMemo(() => {
    const map = new Map<string, string>()
    if (channelInfoList) {
      for (const c of channelInfoList) {
        map.set(c.channel_id, c.channel_name || c.channel_id)
      }
    }
    return map
  }, [channelInfoList])

  // Build grid data: rows = channels, columns = days
  const gridData = useMemo(() => {
    if (!metrics || metrics.length === 0) return []

    // Create lookup: Map<channelId|date, metric>
    const lookup = new Map<string, ResponseMetric>()
    const channelWorst = new Map<string, number>() // worst avg across period

    for (const m of metrics) {
      lookup.set(`${m.channel_id}|${m.date}`, m)
      if (m.avg_response_time_mins !== null) {
        const current = channelWorst.get(m.channel_id) ?? 0
        channelWorst.set(m.channel_id, Math.max(current, m.avg_response_time_mins))
      }
    }

    // Get unique channels
    const channelIds = Array.from(new Set(metrics.map(m => m.channel_id)))

    // Sort by worst response time descending
    channelIds.sort((a, b) => {
      const worstA = channelWorst.get(a) ?? -1
      const worstB = channelWorst.get(b) ?? -1
      return worstB - worstA
    })

    return channelIds.map(channelId => ({
      channelId,
      channelName: channelNames.get(channelId) || channelId.slice(0, 10),
      cells: days.map(date => {
        const m = lookup.get(`${channelId}|${date}`)
        return {
          date,
          avgMins: m?.avg_response_time_mins ?? null,
          messageCount: m?.total_messages ?? 0,
          bucket: getResponseBucket(m?.avg_response_time_mins ?? null),
        }
      }),
    }))
  }, [metrics, days, channelNames])

  const updateHoveredCell = useCallback((cell: HoveredCell | null) => {
    hoveredCellRef.current = cell
    setHoveredCell(cell)
  }, [])

  // Track scrolling to hide tooltips
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const handleScroll = () => {
      isScrollingRef.current = true
      if (hoveredCellRef.current) {
        hoveredCellRef.current = null
        setHoveredCell(null)
      }
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current)
        hoverTimeoutRef.current = null
      }
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current)
      scrollTimeoutRef.current = setTimeout(() => {
        isScrollingRef.current = false
      }, 150)
    }

    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => el.removeEventListener('scroll', handleScroll)
  }, [])

  // Cleanup timeouts
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current)
    }
  }, [])

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Channel Response Heatmap</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center py-12">
            <ShimmerBar width="80%" height={200} />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Channel Response Heatmap</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center py-8 text-center">
            <AlertTriangle className="h-6 w-6 text-destructive mb-2" />
            <p className="text-sm text-muted-foreground">
              {error instanceof Error ? error.message : 'Failed to load heatmap data'}
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (gridData.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Channel Response Heatmap</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">No response time data available</p>
            <p className="text-xs mt-1">Sync messages and run analytics first</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const totalHeight = gridData.length * ROW_HEIGHT
  const gridWidth = days.length * (CELL_SIZE + CELL_GAP)

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Channel Response Heatmap</CardTitle>
          <span className="text-xs text-muted-foreground">
            {gridData.length} channels, last {DAYS_COUNT} days
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="border rounded-lg bg-card overflow-hidden">
          <div
            ref={scrollRef}
            className="overflow-auto overscroll-contain"
            style={{
              scrollbarWidth: 'thin',
              maxHeight: 'min(500px, calc(100vh - 400px))',
            }}
          >
            <div style={{ minWidth: NAME_COL_WIDTH + gridWidth + 20 }}>
              {/* Header row - day labels */}
              <div className="sticky top-0 z-20 bg-card border-b select-none">
                <div className="flex items-center">
                  <div
                    style={{ width: NAME_COL_WIDTH }}
                    className="shrink-0 px-3 py-1 text-[10px] font-medium text-muted-foreground bg-card sticky left-0 z-30 border-r border-border/20"
                  >
                    Channel
                  </div>
                  <div className="flex">
                    {days.map((date, i) => (
                      <div
                        key={date}
                        className="text-[8px] text-center text-muted-foreground/60"
                        style={{ width: CELL_SIZE + CELL_GAP }}
                        title={formatDate(date)}
                      >
                        {/* Show day number every 5 days */}
                        {i % 5 === 0 ? new Date(date + 'T00:00:00Z').getUTCDate() : ''}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Data rows - event delegation */}
              <div
                className="relative"
                onMouseMove={(e) => {
                  if (isScrollingRef.current) return

                  const target = e.target as HTMLElement
                  const cell = target.closest('[data-hcell]') as HTMLElement | null

                  if (!cell) {
                    if (hoverTimeoutRef.current) {
                      clearTimeout(hoverTimeoutRef.current)
                      hoverTimeoutRef.current = null
                    }
                    if (hoveredCellRef.current) updateHoveredCell(null)
                    return
                  }

                  const rowIdx = parseInt(cell.dataset.row || '', 10)
                  const colIdx = parseInt(cell.dataset.col || '', 10)
                  if (isNaN(rowIdx) || isNaN(colIdx)) return

                  // Skip if same cell
                  const row = gridData[rowIdx]
                  if (!row) return
                  if (
                    hoveredCellRef.current?.channelName === row.channelName &&
                    hoveredCellRef.current?.date === days[colIdx]
                  ) {
                    return
                  }

                  if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)

                  hoverTimeoutRef.current = setTimeout(() => {
                    if (isScrollingRef.current) return
                    const cellData = row.cells[colIdx]
                    if (!cellData) return
                    const rect = cell.getBoundingClientRect()
                    updateHoveredCell({
                      channelName: row.channelName,
                      date: cellData.date,
                      avgMins: cellData.avgMins,
                      messageCount: cellData.messageCount,
                      bucket: cellData.bucket,
                      x: rect.left + rect.width / 2,
                      y: rect.top,
                    })
                  }, 120)
                }}
                onMouseLeave={() => {
                  if (hoverTimeoutRef.current) {
                    clearTimeout(hoverTimeoutRef.current)
                    hoverTimeoutRef.current = null
                  }
                  if (hoveredCellRef.current) updateHoveredCell(null)
                }}
              >
                <div style={{ height: totalHeight, position: 'relative' }}>
                  {gridData.map((row, rowIdx) => (
                    <div
                      key={row.channelId}
                      className="flex items-center hover:bg-muted/30"
                      style={{
                        position: 'absolute',
                        top: rowIdx * ROW_HEIGHT,
                        left: 0,
                        right: 0,
                        height: ROW_HEIGHT,
                      }}
                    >
                      <div
                        style={{ width: NAME_COL_WIDTH }}
                        className="shrink-0 px-3 text-xs truncate text-muted-foreground bg-card sticky left-0 z-10 border-r border-border/20"
                        title={row.channelName}
                      >
                        #{row.channelName}
                      </div>
                      <div className="flex items-center">
                        {row.cells.map((cell, colIdx) => (
                          <div
                            key={colIdx}
                            data-hcell
                            data-row={rowIdx}
                            data-col={colIdx}
                            className={cn(
                              'rounded-[2px] mx-px',
                              BUCKET_CONFIG[cell.bucket].color
                            )}
                            style={{ width: CELL_SIZE, height: CELL_SIZE }}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Floating tooltip */}
          {hoveredCell && (
            <div
              className="fixed z-[100] pointer-events-none bg-popover text-popover-foreground border rounded-md shadow-lg px-3 py-2 text-xs"
              style={{
                left: hoveredCell.x,
                top: hoveredCell.y - 8,
                transform: 'translate(-50%, -100%)',
              }}
            >
              <div className="font-medium">#{hoveredCell.channelName}</div>
              <div className="text-muted-foreground">{formatDate(hoveredCell.date)}</div>
              <div className="flex items-center gap-1.5 mt-1">
                <div className={cn('w-2 h-2 rounded-full shrink-0', BUCKET_CONFIG[hoveredCell.bucket].color)} />
                <span className="font-medium">
                  {hoveredCell.bucket === 'no-data'
                    ? 'No data'
                    : `Avg: ${formatResponseTime(hoveredCell.avgMins)}`}
                </span>
              </div>
              {hoveredCell.messageCount > 0 && (
                <div className="text-muted-foreground mt-0.5">
                  {hoveredCell.messageCount} messages
                </div>
              )}
            </div>
          )}

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-3 md:gap-4 px-3 md:px-4 py-2 md:py-3 border-t border-border bg-card">
            {(['fast', 'good', 'slow', 'critical', 'no-data'] as ResponseBucket[]).map(bucket => (
              <div key={bucket} className="flex items-center gap-1.5 text-[10px] md:text-xs">
                <div className={cn('w-2.5 h-2.5 md:w-3 md:h-3 rounded-[2px]', BUCKET_CONFIG[bucket].color)} />
                <span className="text-muted-foreground">
                  {BUCKET_CONFIG[bucket].label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
