'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Clock,
  CheckCircle2,
  MessageSquareWarning,
  Radio,
  TrendingDown,
  TrendingUp,
  Trophy,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ShimmerGrid, ShimmerBar } from '@/components/ui/shimmer-grid'
import {
  LineChart,
  Line,
  ResponsiveContainer,
} from 'recharts'

interface AnalyticsSummary {
  date_range: { from: string; to: string }
  overall_avg_response_mins: number | null
  percent_under_1h: number | null
  total_responses: number
  total_unanswered: number
  active_channels: number
  pod_leader_leaderboard: Array<{
    pod_leader_id: string
    pod_leader_name: string | null
    avg_response_time_mins: number | null
    total_responses: number
    total_unanswered: number
    channels: number
  }>
}

interface ResponseMetric {
  date: string
  avg_response_time_mins: number | null
}

function formatResponseTime(mins: number | null): string {
  if (mins === null) return '--'
  if (mins < 60) return `${Math.round(mins)}m`
  const hours = Math.floor(mins / 60)
  const remaining = Math.round(mins % 60)
  if (remaining === 0) return `${hours}h`
  return `${hours}h ${remaining}m`
}

const PERIOD_OPTIONS = [
  { value: 30, label: '30d' },
  { value: 60, label: '60d' },
  { value: 90, label: '90d' },
]

export function SlackAnalyticsSummary() {
  const [days, setDays] = useState(30)

  const { data: summary, isLoading: summaryLoading } = useQuery<AnalyticsSummary>({
    queryKey: ['slack-analytics-summary', days],
    queryFn: async () => {
      const res = await fetch(`/api/slack/analytics/summary?days=${days}`)
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message || 'Failed')
      return json.data
    },
  })

  // Fetch last 7 days for sparklines (compare to previous period for trend)
  const { data: recentMetrics } = useQuery<ResponseMetric[]>({
    queryKey: ['slack-analytics-sparkline'],
    queryFn: async () => {
      const now = new Date()
      const to = now.toISOString().split('T')[0]
      const from = new Date(now)
      from.setUTCDate(from.getUTCDate() - 7)
      const fromStr = from.toISOString().split('T')[0]
      const res = await fetch(`/api/slack/analytics/response-times?date_from=${fromStr}&date_to=${to}`)
      const json = await res.json()
      if (!json.success) return []
      return json.data.metrics || []
    },
  })

  // Aggregate recent metrics per day for sparkline
  const sparklineData = (() => {
    if (!recentMetrics || recentMetrics.length === 0) return []
    const byDate = new Map<string, number[]>()
    for (const m of recentMetrics) {
      if (m.avg_response_time_mins === null) continue
      if (!byDate.has(m.date)) byDate.set(m.date, [])
      byDate.get(m.date)!.push(m.avg_response_time_mins)
    }
    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, values]) => ({
        date,
        avg: values.reduce((a, b) => a + b, 0) / values.length,
      }))
  })()

  // Calculate trend (compare last 3 days avg to first 3 days avg)
  const trend = (() => {
    if (sparklineData.length < 4) return null
    const firstHalf = sparklineData.slice(0, Math.floor(sparklineData.length / 2))
    const secondHalf = sparklineData.slice(Math.floor(sparklineData.length / 2))
    const avgFirst = firstHalf.reduce((s, d) => s + d.avg, 0) / firstHalf.length
    const avgSecond = secondHalf.reduce((s, d) => s + d.avg, 0) / secondHalf.length
    if (avgFirst === 0) return null
    const pctChange = ((avgSecond - avgFirst) / avgFirst) * 100
    return pctChange
  })()

  if (summaryLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Card key={i}>
              <CardContent className="pt-4 pb-4">
                <ShimmerBar width="60%" height={14} className="mb-2" />
                <ShimmerBar width="40%" height={24} />
              </CardContent>
            </Card>
          ))}
        </div>
        <ShimmerGrid variant="table" rows={5} columns={4} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg w-fit">
        {PERIOD_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setDays(opt.value)}
            className={`relative px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              days === opt.value ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {days === opt.value && (
              <div className="absolute inset-0 bg-background shadow-sm rounded-md ring-1 ring-border/50" />
            )}
            <span className="relative z-10">{opt.label}</span>
          </button>
        ))}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {/* Avg Response Time */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-blue-500/10">
                  <Clock className="h-4 w-4 text-blue-600" />
                </div>
                <span className="text-xs text-muted-foreground font-medium">Avg Response</span>
              </div>
              {trend !== null && (
                <div className={`flex items-center gap-0.5 text-xs ${
                  trend < 0 ? 'text-green-600' : trend > 0 ? 'text-red-600' : 'text-muted-foreground'
                }`}>
                  {trend < 0 ? (
                    <TrendingDown className="h-3 w-3" />
                  ) : (
                    <TrendingUp className="h-3 w-3" />
                  )}
                  <span className="tabular-nums">{Math.abs(Math.round(trend))}%</span>
                </div>
              )}
            </div>
            <p className="text-2xl font-semibold tabular-nums mt-1">
              {formatResponseTime(summary?.overall_avg_response_mins ?? null)}
            </p>
            {sparklineData.length > 1 && (
              <div className="h-8 mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sparklineData}>
                    <Line
                      type="monotone"
                      dataKey="avg"
                      stroke="hsl(var(--primary))"
                      strokeWidth={1.5}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* % Under 1h */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 rounded-md bg-green-500/10">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              </div>
              <span className="text-xs text-muted-foreground font-medium">Under 1 hour</span>
            </div>
            <p className="text-2xl font-semibold tabular-nums mt-1">
              {summary?.percent_under_1h !== null && summary?.percent_under_1h !== undefined
                ? `${summary.percent_under_1h.toFixed(1)}%`
                : '--'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {summary?.total_responses.toLocaleString() || 0} total responses
            </p>
          </CardContent>
        </Card>

        {/* Unanswered */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 rounded-md bg-red-500/10">
                <MessageSquareWarning className="h-4 w-4 text-red-600" />
              </div>
              <span className="text-xs text-muted-foreground font-medium">Unanswered</span>
            </div>
            <p className="text-2xl font-semibold tabular-nums mt-1">
              {summary?.total_unanswered?.toLocaleString() ?? '--'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              No staff reply within 7 days
            </p>
          </CardContent>
        </Card>

        {/* Active Channels */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 rounded-md bg-purple-500/10">
                <Radio className="h-4 w-4 text-purple-600" />
              </div>
              <span className="text-xs text-muted-foreground font-medium">Active Channels</span>
            </div>
            <p className="text-2xl font-semibold tabular-nums mt-1">
              {summary?.active_channels ?? '--'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              With response data
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Pod Leader Leaderboard */}
      {summary?.pod_leader_leaderboard && summary.pod_leader_leaderboard.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-500" />
              Pod Leader Leaderboard
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead>Pod Leader</TableHead>
                  <TableHead className="text-right">Avg Response</TableHead>
                  <TableHead className="text-right">Channels</TableHead>
                  <TableHead className="text-right">Responses</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.pod_leader_leaderboard.map((leader, index) => (
                  <TableRow key={leader.pod_leader_id}>
                    <TableCell className="tabular-nums font-medium text-muted-foreground">
                      {index + 1}
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {leader.pod_leader_name || 'Unknown'}
                        {index === 0 && (
                          <Badge variant="secondary" className="text-amber-600 bg-amber-500/10 text-xs">
                            Fastest
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatResponseTime(leader.avg_response_time_mins)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {leader.channels}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {leader.total_responses.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Empty state for no data */}
      {summary && summary.total_responses === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Clock className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No response time data yet</p>
          <p className="text-xs mt-1">Sync messages first, then run analytics computation</p>
        </div>
      )}
    </div>
  )
}
