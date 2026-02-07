/**
 * Slack Response Time Analytics Engine
 *
 * Computes how quickly staff respond to partner messages in mapped Slack channels.
 * Pre-aggregates results into slack_response_metrics for fast dashboard queries.
 *
 * Algorithm overview (per channel, per anchor day):
 * 1. Fetch messages for [date, date + LOOKAHEAD_DAYS]
 * 2. Split into top-level and threaded
 * 3. Walk chronologically: partner msgs open "pending" windows, staff reply closes all pending
 * 4. Compute response time = staff_reply.posted_at - FIRST_pending_partner.posted_at
 * 5. Aggregate stats (avg, median, p95, buckets) and upsert into DB
 */

import { getAdminClient } from '@/lib/supabase/admin'
import type {
  AnalyticsMessage,
  ComputeResult,
  ResponseMetric,
} from './types'
import {
  median,
  p95,
  average,
  bucketCounts,
  diffMinutes,
  addDays,
  dateRange,
  round2,
} from './analytics-utils'

// =============================================================================
// Constants
// =============================================================================

/** Number of days to look ahead for staff replies to anchor-day partner messages */
export const LOOKAHEAD_DAYS = 7

/** Algorithm version — bump when the core logic changes */
export const ALGORITHM_VERSION = 1

// =============================================================================
// Core Algorithm
// =============================================================================

/**
 * Process a chronological list of messages using the pending-partner / staff-reply model.
 *
 * Only partner messages posted on the anchor day open pending windows.
 * Staff replies from within the lookahead window close all pending partner messages.
 *
 * Returns response times (in minutes) and count of unanswered partner messages.
 */
export function processMessageSequence(
  messages: AnalyticsMessage[],
  anchorDayStart: Date,
  anchorDayEnd: Date
): { responseTimes: number[]; unanswered: number; staffCount: number; partnerCount: number } {
  const pendingPartnerMsgs: AnalyticsMessage[] = []
  const responseTimes: number[] = []
  let staffCount = 0
  let partnerCount = 0

  for (const msg of messages) {
    // Skip bots entirely
    if (msg.is_bot) continue

    if (msg.sender_is_staff) {
      staffCount++
      if (pendingPartnerMsgs.length > 0) {
        // Staff replied — compute response time to FIRST pending partner message
        const earliest = pendingPartnerMsgs[0]
        const rt = diffMinutes(msg.posted_at, earliest.posted_at)
        responseTimes.push(rt)
        // All pending messages are "answered" by this reply
        pendingPartnerMsgs.length = 0
      }
      // If no pending partner messages, this staff message is ignored (no rt to compute)
    } else {
      // Partner/external message
      // Only messages from the anchor day open pending windows
      if (msg.posted_at >= anchorDayStart && msg.posted_at < anchorDayEnd) {
        partnerCount++
        pendingPartnerMsgs.push(msg)
      }
    }
  }

  return {
    responseTimes,
    unanswered: pendingPartnerMsgs.length,
    staffCount,
    partnerCount,
  }
}

/**
 * Compute response times for a single channel on a single anchor date.
 *
 * Fetches messages from [date, date + LOOKAHEAD_DAYS], splits into top-level
 * and threaded scopes, runs the pending/reply algorithm on each, and aggregates.
 */
export async function computeResponseTimes(
  channelId: string,
  partnerId: string,
  anchorDate: string
): Promise<ComputeResult> {
  const supabase = getAdminClient()

  const anchorDayStart = new Date(anchorDate + 'T00:00:00Z')
  const anchorDayEnd = new Date(anchorDate + 'T00:00:00Z')
  anchorDayEnd.setUTCDate(anchorDayEnd.getUTCDate() + 1)

  const windowEnd = new Date(anchorDate + 'T00:00:00Z')
  windowEnd.setUTCDate(windowEnd.getUTCDate() + LOOKAHEAD_DAYS + 1)

  // Fetch messages for the lookahead window
  const { data: rawMessages, error } = await supabase
    .from('slack_messages')
    .select('message_ts, thread_ts, sender_is_staff, is_bot, posted_at')
    .eq('channel_id', channelId)
    .gte('posted_at', anchorDayStart.toISOString())
    .lt('posted_at', windowEnd.toISOString())
    .order('posted_at', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch messages for ${channelId} on ${anchorDate}: ${error.message}`)
  }

  const messages: AnalyticsMessage[] = (rawMessages || []).map(m => ({
    message_ts: m.message_ts,
    thread_ts: m.thread_ts,
    sender_is_staff: m.sender_is_staff,
    is_bot: m.is_bot,
    posted_at: new Date(m.posted_at),
  }))

  // Split into top-level and threaded
  const topLevel: AnalyticsMessage[] = []
  const threadMap = new Map<string, AnalyticsMessage[]>()

  for (const msg of messages) {
    if (msg.thread_ts === null || msg.thread_ts === undefined) {
      topLevel.push(msg)
    } else {
      const key = msg.thread_ts
      if (!threadMap.has(key)) {
        threadMap.set(key, [])
      }
      threadMap.get(key)!.push(msg)
    }
  }

  // Process top-level messages
  const topResult = processMessageSequence(topLevel, anchorDayStart, anchorDayEnd)

  // Process each thread independently
  let threadResponseTimes: number[] = []
  let threadUnanswered = 0
  let threadStaffCount = 0
  let threadPartnerCount = 0

  for (const threadMsgs of Array.from(threadMap.values())) {
    const threadResult = processMessageSequence(threadMsgs, anchorDayStart, anchorDayEnd)
    threadResponseTimes = threadResponseTimes.concat(threadResult.responseTimes)
    threadUnanswered += threadResult.unanswered
    threadStaffCount += threadResult.staffCount
    threadPartnerCount += threadResult.partnerCount
  }

  // Merge results
  const allResponseTimes = topResult.responseTimes.concat(threadResponseTimes)

  // Get pod_leader_id for this partner
  const { data: assignment } = await supabase
    .from('partner_assignments')
    .select('staff_id')
    .eq('partner_id', partnerId)
    .eq('assignment_role', 'pod_leader')
    .is('unassigned_at', null)
    .limit(1)
    .maybeSingle()

  // Count total messages on anchor day (both staff and partner, excluding bots)
  const anchorDayMessages = messages.filter(
    m => !m.is_bot && m.posted_at >= anchorDayStart && m.posted_at < anchorDayEnd
  )
  const totalMessages = anchorDayMessages.length
  const staffMessages = anchorDayMessages.filter(m => m.sender_is_staff).length
  const partnerMessages = anchorDayMessages.filter(m => !m.sender_is_staff).length

  return {
    channel_id: channelId,
    partner_id: partnerId,
    pod_leader_id: assignment?.staff_id || null,
    date: anchorDate,
    total_messages: totalMessages,
    staff_messages: staffMessages,
    partner_messages: partnerMessages,
    response_times: allResponseTimes,
    unanswered_count: topResult.unanswered + threadUnanswered,
  }
}

/**
 * Compute metrics for a single channel on a single date and upsert into the DB.
 */
export async function computeChannelMetrics(
  channelId: string,
  partnerId: string,
  anchorDate: string
): Promise<ResponseMetric> {
  const supabase = getAdminClient()

  const result = await computeResponseTimes(channelId, partnerId, anchorDate)
  const sorted = [...result.response_times].sort((a, b) => a - b)
  const buckets = bucketCounts(result.response_times)

  const metric: Omit<ResponseMetric, 'id' | 'computed_at'> = {
    channel_id: result.channel_id,
    partner_id: result.partner_id,
    pod_leader_id: result.pod_leader_id,
    date: result.date,

    total_messages: result.total_messages,
    staff_messages: result.staff_messages,
    partner_messages: result.partner_messages,

    avg_response_time_mins: round2(average(sorted)),
    median_response_time_mins: round2(median(sorted)),
    p95_response_time_mins: round2(p95(sorted)),
    max_response_time_mins: sorted.length > 0 ? round2(sorted[sorted.length - 1]) : null,
    min_response_time_mins: sorted.length > 0 ? round2(sorted[0]) : null,

    responses_under_30m: buckets.under_30m,
    responses_30m_to_1h: buckets['30m_to_1h'],
    responses_1h_to_4h: buckets['1h_to_4h'],
    responses_4h_to_24h: buckets['4h_to_24h'],
    responses_over_24h: buckets.over_24h,
    unanswered_count: result.unanswered_count,

    algorithm_version: ALGORITHM_VERSION,
  }

  // Upsert: ON CONFLICT (channel_id, date) DO UPDATE
  const { data, error } = await supabase
    .from('slack_response_metrics')
    .upsert(
      {
        ...metric,
        computed_at: new Date().toISOString(),
      },
      { onConflict: 'channel_id,date' }
    )
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to upsert metric for ${channelId} on ${anchorDate}: ${error.message}`)
  }

  return data as ResponseMetric
}

/**
 * Compute metrics for all mapped channels over a date range.
 *
 * Used for:
 * - Daily cron: rolling window of [today - LOOKAHEAD_DAYS, yesterday]
 * - Backfill: arbitrary date range
 * - Recomputation: specific channel + date range
 */
export async function computeAllChannels(options: {
  dateFrom: string
  dateTo: string
  channelId?: string
}): Promise<{
  computed: number
  failed: number
  errors: Array<{ channel_id: string; date: string; error: string }>
}> {
  const supabase = getAdminClient()

  // Fetch mapped channels from slack_sync_state
  let query = supabase
    .from('slack_sync_state')
    .select('channel_id, partner_id')
    .not('partner_id', 'is', null)

  if (options.channelId) {
    query = query.eq('channel_id', options.channelId)
  }

  const { data: channels, error } = await query

  if (error) {
    throw new Error(`Failed to fetch mapped channels: ${error.message}`)
  }

  if (!channels || channels.length === 0) {
    return { computed: 0, failed: 0, errors: [] }
  }

  const dates = dateRange(options.dateFrom, options.dateTo)
  let computed = 0
  let failed = 0
  const errors: Array<{ channel_id: string; date: string; error: string }> = []

  for (const channel of channels) {
    for (const date of dates) {
      try {
        await computeChannelMetrics(channel.channel_id, channel.partner_id!, date)
        computed++
      } catch (err) {
        failed++
        const errorMessage = err instanceof Error ? err.message : String(err)
        errors.push({
          channel_id: channel.channel_id,
          date,
          error: errorMessage,
        })
        // Continue processing other channels/dates
        console.error(`Analytics error for ${channel.channel_id} on ${date}: ${errorMessage}`)
      }
    }
  }

  console.log(
    `Analytics computation complete: ${computed} computed, ${failed} failed, ` +
    `${channels.length} channels, ${dates.length} dates`
  )

  return { computed, failed, errors }
}

/**
 * Compute the daily rolling window for the cron job.
 * Recomputes [today - LOOKAHEAD_DAYS, yesterday] for all mapped channels.
 */
export async function computeDailyRollingWindow(): Promise<{
  computed: number
  failed: number
  errors: Array<{ channel_id: string; date: string; error: string }>
}> {
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const dateFrom = addDays(todayStr, -LOOKAHEAD_DAYS)
  const dateTo = addDays(todayStr, -1)

  console.log(`Daily analytics: computing ${dateFrom} to ${dateTo} (rolling ${LOOKAHEAD_DAYS}-day window)`)

  return computeAllChannels({ dateFrom, dateTo })
}
