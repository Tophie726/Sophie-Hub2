/**
 * Slack-specific TypeScript types
 *
 * Types for Slack API responses and internal data structures.
 * We only store message metadata (timestamps, sender IDs, type) — NOT content.
 */

// =============================================================================
// Slack API Response Types
// =============================================================================

/** Slack user profile from users.list */
export interface SlackUser {
  id: string
  name: string
  real_name: string
  deleted: boolean
  is_bot: boolean
  is_app_user: boolean
  is_restricted: boolean        // Multi-channel guest
  is_ultra_restricted: boolean  // Single-channel guest
  is_stranger?: boolean         // Slack Connect (external org)
  profile: {
    email?: string
    display_name: string
    real_name: string
    title?: string
    phone?: string
    first_name?: string
    last_name?: string
    image_24?: string
    image_32?: string
    image_48?: string
    image_72?: string
    image_192?: string
    image_512?: string
    image_1024?: string
    image_original?: string
  }
  tz?: string
  tz_label?: string
  tz_offset?: number
}

/** Classification of a Slack user's account type */
export type SlackUserType = 'member' | 'multi_channel_guest' | 'single_channel_guest' | 'bot' | 'deactivated' | 'connect'

/** Classify a Slack user into their account type */
export function classifySlackUser(user: SlackUser): SlackUserType {
  if (user.deleted) return 'deactivated'
  if (user.is_bot || user.is_app_user) return 'bot'
  if (user.is_stranger) return 'connect'
  if (user.is_ultra_restricted) return 'single_channel_guest'
  if (user.is_restricted) return 'multi_channel_guest'
  return 'member'
}

/** Human-readable label for user type */
export function userTypeLabel(type: SlackUserType): string {
  switch (type) {
    case 'member': return 'Member'
    case 'multi_channel_guest': return 'Multi-Channel Guest'
    case 'single_channel_guest': return 'Single-Channel Guest'
    case 'bot': return 'Bot'
    case 'deactivated': return 'Deactivated'
    case 'connect': return 'Slack Connect'
  }
}

/** Slack channel from conversations.list */
export interface SlackChannel {
  id: string
  name: string
  is_channel: boolean
  is_group: boolean
  is_private: boolean
  is_archived: boolean
  is_shared: boolean
  is_ext_shared: boolean
  num_members: number
  purpose?: {
    value: string
  }
  topic?: {
    value: string
  }
}

/** Slack message metadata (no content stored) */
export interface SlackMessageMeta {
  ts: string
  thread_ts?: string
  user?: string
  bot_id?: string
  type: string
  subtype?: string
}

// =============================================================================
// Internal Types
// =============================================================================

/** Staff ↔ Slack user mapping result */
export interface StaffSlackMapping {
  staff_id: string
  staff_name: string
  staff_email: string
  slack_user_id: string | null
  slack_user_name: string | null
  slack_email: string | null
  match_type: 'auto' | 'manual' | null
}

/** Channel ↔ Partner mapping result */
export interface ChannelPartnerMapping {
  channel_id: string
  channel_name: string
  partner_id: string | null
  partner_name: string | null
  match_type: 'auto' | 'manual' | null
  match_confidence: number | null
}

/** Auto-match result for a single item */
export interface AutoMatchResult {
  matched: boolean
  source_id: string
  source_name: string
  target_id: string | null
  target_name: string | null
  confidence: number
}

/** Sync state for a channel */
export interface ChannelSyncState {
  id: string
  channel_id: string
  channel_name: string
  partner_id: string | null
  latest_ts: string | null
  is_backfill_complete: boolean
  message_count: number
  last_synced_at: string | null
  error: string | null
}

/** Extended sync state with Phase 2 fields (two-watermark model) */
export interface ChannelSyncStateV2 extends ChannelSyncState {
  oldest_ts: string | null
  bot_is_member: boolean
}

/** Sync run record from slack_sync_runs table */
export interface SlackSyncRun {
  id: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  triggered_by: string | null
  total_channels: number
  synced_channels: number
  failed_channels: number
  total_messages_synced: number
  next_channel_offset: number
  worker_lease_expires_at: string | null
  last_heartbeat_at: string | null
  started_at: string | null
  completed_at: string | null
  error: string | null
  created_at: string
}

/** Result of syncing a single channel */
export interface SyncChannelResult {
  channel_id: string
  channel_name: string
  success: boolean
  messages_synced: number
  error?: string
}

/** Summary of a sync run chunk (batch of channels processed by one cron invocation) */
export interface SyncRunSummary {
  run_id: string
  channels_synced: number
  channels_failed: number
  channels_skipped: number
  total_messages: number
  duration_ms: number
}

// =============================================================================
// API Request/Response Types
// =============================================================================

/** Test connection response */
export interface SlackConnectionStatus {
  connected: boolean
  workspace_name?: string
  bot_user_id?: string
  error?: string
}

/** Channel auto-match request */
export interface ChannelAutoMatchRequest {
  /** Channel naming convention pattern, e.g. "client-{brand_name}" */
  pattern: string
  /** Prefixes to skip (internal channels) */
  skip_prefixes?: string[]
}

/** Staff auto-match summary */
export interface StaffAutoMatchSummary {
  total_staff: number
  total_slack_users: number
  matched: number
  unmatched_staff: string[]
  unmatched_slack_users: string[]
}

/** Channel auto-match summary */
export interface ChannelAutoMatchSummary {
  total_channels: number
  total_partners: number
  matched: number
  skipped_internal: number
  ambiguous: Array<{
    channel_name: string
    possible_matches: Array<{ partner_id: string; partner_name: string; confidence: number }>
  }>
  unmatched_channels: string[]
}

// =============================================================================
// Analytics Types (Phase 3)
// =============================================================================

/** Response time bucket classifications */
export type ResponseTimeBucket =
  | 'under_30m'
  | '30m_to_1h'
  | '1h_to_4h'
  | '4h_to_24h'
  | 'over_24h'

/** A single computed response time data point */
export interface ResponseTimeDataPoint {
  partnerMessageAt: Date
  staffReplyAt: Date
  responseTimeMinutes: number
  scope: 'top_level' | 'thread'
  threadTs?: string
}

/** Row in slack_response_metrics table */
export interface ResponseMetric {
  id: string
  channel_id: string
  partner_id: string
  pod_leader_id: string | null
  date: string

  total_messages: number
  staff_messages: number
  partner_messages: number

  avg_response_time_mins: number | null
  median_response_time_mins: number | null
  p95_response_time_mins: number | null
  max_response_time_mins: number | null
  min_response_time_mins: number | null

  responses_under_30m: number
  responses_30m_to_1h: number
  responses_1h_to_4h: number
  responses_4h_to_24h: number
  responses_over_24h: number
  unanswered_count: number

  computed_at: string
  algorithm_version: number
}

/** Summary of analytics across channels/dates for dashboard display */
export interface AnalyticsSummary {
  avg_response_time_mins: number | null
  median_response_time_mins: number | null
  total_partner_messages: number
  total_staff_messages: number
  total_unanswered: number
  channels_computed: number
  percent_under_1h: number | null
  bucket_totals: Record<ResponseTimeBucket, number>
}

/** Result of computing metrics for a single channel + date */
export interface ComputeResult {
  channel_id: string
  partner_id: string
  pod_leader_id: string | null
  date: string

  total_messages: number
  staff_messages: number
  partner_messages: number

  response_times: number[]
  unanswered_count: number
}

/** Message row as read from slack_messages for analytics processing */
export interface AnalyticsMessage {
  message_ts: string
  thread_ts: string | null
  sender_is_staff: boolean
  is_bot: boolean
  posted_at: Date
}
