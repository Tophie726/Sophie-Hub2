/**
 * GET /api/slack/analytics/summary
 *
 * Dashboard-level KPIs for Slack response time analytics.
 * Returns: overall avg response, % under 1h, total unanswered,
 * active channels count, and pod leader leaderboard (top 5).
 * Default: last 30 days.
 */

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/auth/api-auth'
import { ROLES } from '@/lib/auth/roles'
import { apiSuccess, apiValidationError, ApiErrors } from '@/lib/api/response'
import { getAdminClient } from '@/lib/supabase/admin'

const QuerySchema = z.object({
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  days: z.coerce.number().int().min(1).max(365).optional(),
})

export async function GET(request: NextRequest) {
  const auth = await requireRole(ROLES.ADMIN)
  if (!auth.authenticated) return auth.response

  try {
    const { searchParams } = new URL(request.url)
    const validation = QuerySchema.safeParse({
      date_from: searchParams.get('date_from') || undefined,
      date_to: searchParams.get('date_to') || undefined,
      days: searchParams.get('days') || undefined,
    })

    if (!validation.success) {
      return apiValidationError(validation.error)
    }

    const params = validation.data

    // Determine date range: explicit range takes precedence, else last N days (default 30)
    let dateTo: string
    let dateFrom: string

    if (params.date_from && params.date_to) {
      dateFrom = params.date_from
      dateTo = params.date_to
    } else {
      const days = params.days || 30
      const now = new Date()
      dateTo = now.toISOString().split('T')[0]
      const from = new Date(now)
      from.setUTCDate(from.getUTCDate() - days)
      dateFrom = from.toISOString().split('T')[0]
    }

    const supabase = getAdminClient()

    // Fetch all metrics for the date range
    const { data: metrics, error } = await supabase
      .from('slack_response_metrics')
      .select('*')
      .gte('date', dateFrom)
      .lte('date', dateTo)

    if (error) {
      console.error('Error fetching analytics summary:', error)
      return ApiErrors.database()
    }

    const rows = metrics || []

    // Compute overall KPIs
    const totalResponses = rows.reduce(
      (sum, m) =>
        sum +
        m.responses_under_30m +
        m.responses_30m_to_1h +
        m.responses_1h_to_4h +
        m.responses_4h_to_24h +
        m.responses_over_24h,
      0
    )
    const responsesUnder1h = rows.reduce(
      (sum, m) => sum + m.responses_under_30m + m.responses_30m_to_1h,
      0
    )
    const totalUnanswered = rows.reduce((sum, m) => sum + m.unanswered_count, 0)
    const activeChannels = new Set(rows.map(m => m.channel_id)).size

    // Weighted average response time (weighted by number of responses per row)
    let weightedSum = 0
    let weightCount = 0
    for (const m of rows) {
      const rowResponses =
        m.responses_under_30m +
        m.responses_30m_to_1h +
        m.responses_1h_to_4h +
        m.responses_4h_to_24h +
        m.responses_over_24h
      if (m.avg_response_time_mins !== null && rowResponses > 0) {
        weightedSum += m.avg_response_time_mins * rowResponses
        weightCount += rowResponses
      }
    }
    const overallAvgResponseMins = weightCount > 0 ? Math.round((weightedSum / weightCount) * 100) / 100 : null
    const percentUnder1h = totalResponses > 0 ? Math.round((responsesUnder1h / totalResponses) * 10000) / 100 : null

    // Pod leader leaderboard (top 5 by best avg response time)
    const podLeaderMap = new Map<
      string,
      { weighted_sum: number; response_count: number; unanswered: number; channels: Set<string> }
    >()

    for (const m of rows) {
      if (!m.pod_leader_id) continue

      if (!podLeaderMap.has(m.pod_leader_id)) {
        podLeaderMap.set(m.pod_leader_id, {
          weighted_sum: 0,
          response_count: 0,
          unanswered: 0,
          channels: new Set(),
        })
      }

      const entry = podLeaderMap.get(m.pod_leader_id)!
      const rowResponses =
        m.responses_under_30m +
        m.responses_30m_to_1h +
        m.responses_1h_to_4h +
        m.responses_4h_to_24h +
        m.responses_over_24h

      if (m.avg_response_time_mins !== null && rowResponses > 0) {
        entry.weighted_sum += m.avg_response_time_mins * rowResponses
        entry.response_count += rowResponses
      }
      entry.unanswered += m.unanswered_count
      entry.channels.add(m.channel_id)
    }

    // Fetch pod leader names
    const podLeaderIds = Array.from(podLeaderMap.keys())
    let podLeaderNames: Record<string, string> = {}
    if (podLeaderIds.length > 0) {
      const { data: staff } = await supabase
        .from('staff')
        .select('id, full_name')
        .in('id', podLeaderIds)
      if (staff) {
        podLeaderNames = Object.fromEntries(staff.map(s => [s.id, s.full_name]))
      }
    }

    const leaderboard = Array.from(podLeaderMap.entries())
      .map(([id, entry]) => ({
        pod_leader_id: id,
        pod_leader_name: podLeaderNames[id] || null,
        avg_response_time_mins:
          entry.response_count > 0
            ? Math.round((entry.weighted_sum / entry.response_count) * 100) / 100
            : null,
        total_responses: entry.response_count,
        total_unanswered: entry.unanswered,
        channels: entry.channels.size,
      }))
      .filter(e => e.avg_response_time_mins !== null)
      .sort((a, b) => (a.avg_response_time_mins ?? Infinity) - (b.avg_response_time_mins ?? Infinity))
      .slice(0, 5)

    return apiSuccess({
      date_range: { from: dateFrom, to: dateTo },
      overall_avg_response_mins: overallAvgResponseMins,
      percent_under_1h: percentUnder1h,
      total_responses: totalResponses,
      total_unanswered: totalUnanswered,
      active_channels: activeChannels,
      pod_leader_leaderboard: leaderboard,
    })
  } catch (error) {
    console.error('GET analytics/summary error:', error)
    return ApiErrors.internal()
  }
}
