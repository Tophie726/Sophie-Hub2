'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Search,
  Clock,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ShimmerBar } from '@/components/ui/shimmer-grid'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

interface ResponseMetric {
  date: string
  channel_id: string
  partner_id: string
  partner_name: string | null
  pod_leader_id: string | null
  pod_leader_name: string | null
  avg_response_time_mins: number | null
  responses_under_30m: number
  responses_30m_to_1h: number
  responses_1h_to_4h: number
  responses_4h_to_24h: number
  responses_over_24h: number
  total_messages: number
}

interface Partner {
  id: string
  brand_name: string
}

const PERIOD_OPTIONS = [
  { value: 30, label: '30 days' },
  { value: 60, label: '60 days' },
  { value: 90, label: '90 days' },
]

const BUCKET_COLORS = {
  under_30m: '#22c55e',
  '30m_to_1h': '#84cc16',
  '1h_to_4h': '#eab308',
  '4h_to_24h': '#f97316',
  over_24h: '#ef4444',
}

const BUCKET_LABELS: Record<string, string> = {
  under_30m: '< 30min',
  '30m_to_1h': '30min - 1h',
  '1h_to_4h': '1h - 4h',
  '4h_to_24h': '4h - 24h',
  over_24h: '> 24h',
}

function formatResponseTime(mins: number | null): string {
  if (mins === null) return '--'
  if (mins < 60) return `${Math.round(mins)}m`
  const hours = Math.floor(mins / 60)
  const remaining = Math.round(mins % 60)
  if (remaining === 0) return `${hours}h`
  return `${hours}h ${remaining}m`
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function SlackResponseChart() {
  const [days, setDays] = useState(30)
  const [partnerId, setPartnerId] = useState<string>('')
  const [podLeaderId, setPodLeaderId] = useState<string>('')
  const [partnerSearch, setPartnerSearch] = useState('')

  // Compute date range
  const dateRange = useMemo(() => {
    const now = new Date()
    const to = now.toISOString().split('T')[0]
    const from = new Date(now)
    from.setUTCDate(from.getUTCDate() - days)
    return { from: from.toISOString().split('T')[0], to }
  }, [days])

  // Fetch metrics
  const { data: metrics, isLoading } = useQuery<ResponseMetric[]>({
    queryKey: ['slack-response-times', days, partnerId, podLeaderId],
    queryFn: async () => {
      const params = new URLSearchParams({
        date_from: dateRange.from,
        date_to: dateRange.to,
      })
      if (partnerId) params.set('partner_id', partnerId)
      if (podLeaderId) params.set('pod_leader_id', podLeaderId)

      const res = await fetch(`/api/slack/analytics/response-times?${params}`)
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message || 'Failed')
      return json.data.metrics || []
    },
  })

  // Fetch partners for filter dropdown
  const { data: partners } = useQuery<Partner[]>({
    queryKey: ['partners-for-filter'],
    queryFn: async () => {
      const res = await fetch('/api/partners?limit=1000')
      const json = await res.json()
      const list = json.data?.partners || json.partners || []
      return list.map((p: Partner) => ({ id: p.id, brand_name: p.brand_name }))
    },
    staleTime: 5 * 60 * 1000,
  })

  // Extract unique pod leaders from metrics data
  const podLeaders = useMemo(() => {
    if (!metrics) return []
    const map = new Map<string, string>()
    for (const m of metrics) {
      if (m.pod_leader_id && m.pod_leader_name) {
        map.set(m.pod_leader_id, m.pod_leader_name)
      }
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, full_name: name }))
      .sort((a, b) => a.full_name.localeCompare(b.full_name))
  }, [metrics])

  // Aggregate metrics by date for line chart
  const lineChartData = useMemo(() => {
    if (!metrics || metrics.length === 0) return []

    const byDate = new Map<string, { sum: number; count: number }>()
    for (const m of metrics) {
      if (m.avg_response_time_mins === null) continue
      const totalResponses =
        m.responses_under_30m + m.responses_30m_to_1h +
        m.responses_1h_to_4h + m.responses_4h_to_24h +
        m.responses_over_24h
      if (totalResponses === 0) continue

      if (!byDate.has(m.date)) byDate.set(m.date, { sum: 0, count: 0 })
      const entry = byDate.get(m.date)!
      entry.sum += m.avg_response_time_mins * totalResponses
      entry.count += totalResponses
    }

    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, { sum, count }]) => ({
        date,
        dateLabel: formatDate(date),
        avg_mins: Math.round((sum / count) * 100) / 100,
      }))
  }, [metrics])

  // Aggregate bucket data by date for stacked bar chart
  const barChartData = useMemo(() => {
    if (!metrics || metrics.length === 0) return []

    const byDate = new Map<string, {
      under_30m: number
      '30m_to_1h': number
      '1h_to_4h': number
      '4h_to_24h': number
      over_24h: number
    }>()

    for (const m of metrics) {
      if (!byDate.has(m.date)) {
        byDate.set(m.date, {
          under_30m: 0,
          '30m_to_1h': 0,
          '1h_to_4h': 0,
          '4h_to_24h': 0,
          over_24h: 0,
        })
      }
      const entry = byDate.get(m.date)!
      entry.under_30m += m.responses_under_30m
      entry['30m_to_1h'] += m.responses_30m_to_1h
      entry['1h_to_4h'] += m.responses_1h_to_4h
      entry['4h_to_24h'] += m.responses_4h_to_24h
      entry.over_24h += m.responses_over_24h
    }

    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, buckets]) => ({
        date,
        dateLabel: formatDate(date),
        ...buckets,
      }))
  }, [metrics])

  // Filter partners by search
  const filteredPartners = useMemo(() => {
    if (!partners) return []
    if (!partnerSearch) return partners.slice(0, 50)
    const q = partnerSearch.toLowerCase()
    return partners.filter(p => p.brand_name.toLowerCase().includes(q)).slice(0, 50)
  }, [partners, partnerSearch])

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Period selector */}
        <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg">
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

        {/* Partner filter */}
        <Select value={partnerId} onValueChange={(v) => setPartnerId(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-[200px] h-9">
            <SelectValue placeholder="All partners" />
          </SelectTrigger>
          <SelectContent>
            <div className="px-2 pb-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search partners..."
                  value={partnerSearch}
                  onChange={(e) => setPartnerSearch(e.target.value)}
                  className="pl-7 h-8 text-sm"
                />
              </div>
            </div>
            <SelectItem value="all">All partners</SelectItem>
            {filteredPartners.map(p => (
              <SelectItem key={p.id} value={p.id}>
                {p.brand_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Pod leader filter */}
        <Select value={podLeaderId} onValueChange={(v) => setPodLeaderId(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue placeholder="All pod leaders" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All pod leaders</SelectItem>
            {podLeaders.map(pl => (
              <SelectItem key={pl.id} value={pl.id}>
                {pl.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Line Chart - Avg Response Time */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Average Response Time
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-[300px] flex items-center justify-center">
              <ShimmerBar width="80%" height={200} />
            </div>
          ) : lineChartData.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">
              No response data for this period
            </div>
          ) : (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lineChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                  <XAxis
                    dataKey="dateLabel"
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                    tickFormatter={(v) => formatResponseTime(v)}
                    width={55}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    formatter={(value) => [formatResponseTime(value as number), 'Avg Response']}
                    labelFormatter={(label) => label}
                  />
                  <Line
                    type="monotone"
                    dataKey="avg_mins"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={lineChartData.length <= 30}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stacked Bar - Response Time Buckets */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Response Time Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-[250px] flex items-center justify-center">
              <ShimmerBar width="80%" height={180} />
            </div>
          ) : barChartData.length === 0 ? (
            <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">
              No response data for this period
            </div>
          ) : (
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                  <XAxis
                    dataKey="dateLabel"
                    tick={{ fontSize: 11 }}
                    className="text-muted-foreground"
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                    width={40}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    formatter={(value, name) => [
                      value as number,
                      BUCKET_LABELS[name as string] || name,
                    ]}
                  />
                  <Legend
                    formatter={(value: string) => (
                      <span className="text-xs">{BUCKET_LABELS[value] || value}</span>
                    )}
                  />
                  <Bar dataKey="under_30m" stackId="buckets" fill={BUCKET_COLORS.under_30m} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="30m_to_1h" stackId="buckets" fill={BUCKET_COLORS['30m_to_1h']} />
                  <Bar dataKey="1h_to_4h" stackId="buckets" fill={BUCKET_COLORS['1h_to_4h']} />
                  <Bar dataKey="4h_to_24h" stackId="buckets" fill={BUCKET_COLORS['4h_to_24h']} />
                  <Bar dataKey="over_24h" stackId="buckets" fill={BUCKET_COLORS.over_24h} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
