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
  profile: {
    email?: string
    display_name: string
    real_name: string
    image_48?: string
    image_72?: string
  }
  tz?: string
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
