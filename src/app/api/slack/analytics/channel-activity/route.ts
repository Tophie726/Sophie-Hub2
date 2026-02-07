/**
 * GET /api/slack/analytics/channel-activity
 *
 * Message volume by channel over time.
 * Aggregates slack_response_metrics by day/week/month granularity.
 */

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/auth/api-auth'
import { ROLES } from '@/lib/auth/roles'
import { apiSuccess, apiValidationError, ApiErrors } from '@/lib/api/response'
import { getAdminClient } from '@/lib/supabase/admin'

const QuerySchema = z.object({
  channel_id: z.string().optional(),
  partner_id: z.string().uuid().optional(),
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date_from must be YYYY-MM-DD'),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date_to must be YYYY-MM-DD'),
  granularity: z.enum(['day', 'week', 'month']).default('day'),
})

interface AggregatedPeriod {
  period: string
  channel_id: string
  channel_name: string | null
  total_messages: number
  staff_messages: number
  partner_messages: number
}

export async function GET(request: NextRequest) {
  const auth = await requireRole(ROLES.ADMIN)
  if (!auth.authenticated) return auth.response

  try {
    const { searchParams } = new URL(request.url)
    const validation = QuerySchema.safeParse({
      channel_id: searchParams.get('channel_id') || undefined,
      partner_id: searchParams.get('partner_id') || undefined,
      date_from: searchParams.get('date_from'),
      date_to: searchParams.get('date_to'),
      granularity: searchParams.get('granularity') || 'day',
    })

    if (!validation.success) {
      return apiValidationError(validation.error)
    }

    const { channel_id, partner_id, date_from, date_to, granularity } = validation.data
    const supabase = getAdminClient()

    // Fetch raw metrics for the range
    let query = supabase
      .from('slack_response_metrics')
      .select('channel_id, date, total_messages, staff_messages, partner_messages')
      .gte('date', date_from)
      .lte('date', date_to)
      .order('date', { ascending: true })

    if (channel_id) {
      query = query.eq('channel_id', channel_id)
    }
    if (partner_id) {
      query = query.eq('partner_id', partner_id)
    }

    const { data: metrics, error } = await query

    if (error) {
      console.error('Error fetching channel activity:', error)
      return ApiErrors.database()
    }

    // Get channel names from slack_sync_state
    const channelIds = Array.from(new Set((metrics || []).map(m => m.channel_id)))
    let channelNames: Record<string, string> = {}
    if (channelIds.length > 0) {
      const { data: channels } = await supabase
        .from('slack_sync_state')
        .select('channel_id, channel_name')
        .in('channel_id', channelIds)
      if (channels) {
        channelNames = Object.fromEntries(channels.map(c => [c.channel_id, c.channel_name]))
      }
    }

    // Aggregate by granularity
    const aggregated = aggregateByPeriod(metrics || [], granularity, channelNames)

    return apiSuccess({
      activity: aggregated,
      count: aggregated.length,
      granularity,
      date_range: { from: date_from, to: date_to },
    })
  } catch (error) {
    console.error('GET analytics/channel-activity error:', error)
    return ApiErrors.internal()
  }
}

function getPeriodKey(dateStr: string, granularity: 'day' | 'week' | 'month'): string {
  if (granularity === 'day') return dateStr

  const d = new Date(dateStr + 'T00:00:00Z')

  if (granularity === 'week') {
    // ISO week: find the Monday of this date's week
    const day = d.getUTCDay()
    const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1)
    const monday = new Date(d)
    monday.setUTCDate(diff)
    return monday.toISOString().split('T')[0]
  }

  // month
  return dateStr.substring(0, 7) // YYYY-MM
}

function aggregateByPeriod(
  metrics: Array<{
    channel_id: string
    date: string
    total_messages: number
    staff_messages: number
    partner_messages: number
  }>,
  granularity: 'day' | 'week' | 'month',
  channelNames: Record<string, string>
): AggregatedPeriod[] {
  const map = new Map<string, AggregatedPeriod>()

  for (const m of metrics) {
    const period = getPeriodKey(m.date, granularity)
    const key = `${m.channel_id}|${period}`

    if (!map.has(key)) {
      map.set(key, {
        period,
        channel_id: m.channel_id,
        channel_name: channelNames[m.channel_id] || null,
        total_messages: 0,
        staff_messages: 0,
        partner_messages: 0,
      })
    }

    const agg = map.get(key)!
    agg.total_messages += m.total_messages
    agg.staff_messages += m.staff_messages
    agg.partner_messages += m.partner_messages
  }

  return Array.from(map.values()).sort((a, b) => a.period.localeCompare(b.period))
}
