/**
 * Slack Message Sync Engine
 *
 * Incrementally syncs message metadata from mapped Slack channels into `slack_messages`.
 * No message content stored — only timestamps, sender IDs, and thread references.
 *
 * Architecture:
 * - Two-watermark model: latest_ts (forward incremental) + oldest_ts (historical backfill)
 * - Lease-based overlap protection for cron workers
 * - Chunked processing: each cron invocation processes a batch of channels
 * - Idempotent: ON CONFLICT DO NOTHING for message upserts
 *
 * @see src/docs/SLACK-ROLLOUT-PLAN.md §2.3 for full algorithm spec
 */

import { getAdminClient } from '@/lib/supabase/admin'
import { getChannelHistoryPage, joinChannel } from './client'
import type {
  SlackMessageMeta,
  ChannelSyncStateV2,
  SyncChannelResult,
  SyncRunSummary,
} from './types'

// =============================================================================
// Configuration
// =============================================================================

/** Default number of days for initial backfill lookback */
const SLACK_BACKFILL_DAYS = 30

/** Maximum pages to fetch per channel per sync run (bounds backfill work) */
const MAX_PAGES_PER_CHANNEL = 10

/** Number of channels to process per cron invocation */
const CHANNELS_PER_CHUNK = 15

/** Lease duration for anti-overlap protection (4 minutes for 5-min cron) */
const LEASE_DURATION_MINUTES = 4

/** Message subtypes to skip (non-conversation events) */
const SKIP_SUBTYPES = new Set([
  'channel_join',
  'channel_leave',
  'channel_topic',
  'channel_purpose',
  'channel_name',
  'channel_archive',
  'channel_unarchive',
  'pinned_item',
  'unpinned_item',
])

/** Batch size for message upserts */
const UPSERT_BATCH_SIZE = 100

// =============================================================================
// Staff Lookup
// =============================================================================

/**
 * Build a lookup map from Slack user IDs to staff IDs.
 * Uses entity_external_ids WHERE source = 'slack_user'.
 */
async function buildStaffLookup(): Promise<Map<string, string>> {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('entity_external_ids')
    .select('entity_id, external_id')
    .eq('entity_type', 'staff')
    .eq('source', 'slack_user')

  if (error) {
    console.error('Failed to build staff lookup:', error)
    return new Map()
  }

  const lookup = new Map<string, string>()
  for (const row of data || []) {
    lookup.set(row.external_id, row.entity_id)
  }
  return lookup
}

// =============================================================================
// Message Processing
// =============================================================================

/** Parsed message ready for DB insertion */
interface ParsedMessage {
  channel_id: string
  message_ts: string
  thread_ts: string | null
  sender_slack_id: string | null
  sender_bot_id: string | null
  sender_type: 'user' | 'bot' | 'system'
  sender_staff_id: string | null
  sender_is_staff: boolean
  is_bot: boolean
  posted_at: string // ISO timestamp
}

/**
 * Parse a raw Slack message into a DB-ready row.
 * Classifies sender as user/bot/system and resolves staff membership.
 */
function parseMessage(
  msg: SlackMessageMeta,
  channelId: string,
  staffLookup: Map<string, string>
): ParsedMessage | null {
  // Skip non-conversation subtypes
  if (msg.subtype && SKIP_SUBTYPES.has(msg.subtype)) {
    return null
  }

  // Parse posted_at from message_ts (epoch.micro format)
  const epochSeconds = parseFloat(msg.ts)
  if (isNaN(epochSeconds)) {
    return null
  }
  const postedAt = new Date(epochSeconds * 1000).toISOString()

  // Classify sender
  let senderType: 'user' | 'bot' | 'system'
  let senderSlackId: string | null = null
  let senderBotId: string | null = null
  let senderStaffId: string | null = null
  let senderIsStaff = false
  let isBot = false

  if (msg.user) {
    senderType = 'user'
    senderSlackId = msg.user
    senderStaffId = staffLookup.get(msg.user) || null
    senderIsStaff = senderStaffId !== null
  } else if (msg.bot_id) {
    senderType = 'bot'
    senderBotId = msg.bot_id
    isBot = true
  } else {
    senderType = 'system'
  }

  return {
    channel_id: channelId,
    message_ts: msg.ts,
    thread_ts: msg.thread_ts || null,
    sender_slack_id: senderSlackId,
    sender_bot_id: senderBotId,
    sender_type: senderType,
    sender_staff_id: senderStaffId,
    sender_is_staff: senderIsStaff,
    is_bot: isBot,
    posted_at: postedAt,
  }
}

/**
 * Batch upsert parsed messages into slack_messages.
 * Uses ON CONFLICT DO NOTHING for idempotent inserts.
 * Returns the count of newly inserted messages.
 */
async function upsertMessages(messages: ParsedMessage[]): Promise<number> {
  if (messages.length === 0) return 0

  const supabase = getAdminClient()
  let inserted = 0

  for (let i = 0; i < messages.length; i += UPSERT_BATCH_SIZE) {
    const batch = messages.slice(i, i + UPSERT_BATCH_SIZE)

    const { data, error } = await supabase
      .from('slack_messages')
      .upsert(batch, {
        onConflict: 'channel_id,message_ts',
        ignoreDuplicates: true,
      })
      .select('id')

    if (error) {
      console.error(`Message upsert batch ${i / UPSERT_BATCH_SIZE + 1} failed:`, error)
      // Continue with remaining batches
    } else {
      inserted += data?.length || 0
    }
  }

  return inserted
}

// =============================================================================
// Channel Sync
// =============================================================================

/**
 * Ensure the bot is a member of a channel before reading history.
 * Public channels: auto-join. Private channels: log warning.
 */
async function ensureBotMembership(
  channelId: string,
  isPrivate: boolean
): Promise<{ isMember: boolean; error?: string }> {
  try {
    // Try to join if public
    if (!isPrivate) {
      await joinChannel(channelId)
    }
    return { isMember: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes('already_in_channel')) {
      return { isMember: true }
    }
    if (isPrivate) {
      return {
        isMember: false,
        error: `Bot not in private channel — admin must invite the bot`,
      }
    }
    return { isMember: false, error: `Failed to join channel: ${message}` }
  }
}

/**
 * Sync a single channel: forward incremental + optional historical backfill.
 * Returns the result (success/failure + message count).
 */
export async function syncChannel(
  channel: ChannelSyncStateV2,
  staffLookup: Map<string, string>
): Promise<SyncChannelResult> {
  const supabase = getAdminClient()
  const result: SyncChannelResult = {
    channel_id: channel.channel_id,
    channel_name: channel.channel_name,
    success: false,
    messages_synced: 0,
  }

  try {
    // 1. Ensure bot membership
    if (!channel.bot_is_member) {
      // We don't have is_private in sync_state directly; try joining and handle errors
      const membership = await ensureBotMembership(channel.channel_id, false)
      if (!membership.isMember) {
        // Try as private channel
        const privateMembership = await ensureBotMembership(channel.channel_id, true)
        if (!privateMembership.isMember) {
          result.error = privateMembership.error || 'Bot cannot access channel'
          await updateSyncState(channel.channel_id, { error: result.error })
          return result
        }
      }
      // Update bot_is_member
      await supabase
        .from('slack_sync_state')
        .update({ bot_is_member: true })
        .eq('channel_id', channel.channel_id)
    }

    let totalInserted = 0

    // 2. Forward incremental pass
    const forwardInserted = await syncForward(channel, staffLookup)
    totalInserted += forwardInserted

    // 3. Historical backfill pass (bounded pages)
    if (!channel.is_backfill_complete) {
      const backfillInserted = await syncBackfill(channel, staffLookup)
      totalInserted += backfillInserted
    }

    // 4. Update sync state on success
    await updateSyncState(channel.channel_id, {
      message_count: (channel.message_count || 0) + totalInserted,
      last_synced_at: new Date().toISOString(),
      error: null,
    })

    result.success = true
    result.messages_synced = totalInserted
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    result.error = errorMsg
    console.error(`syncChannel ${channel.channel_id} (${channel.channel_name}) error:`, errorMsg)
    await updateSyncState(channel.channel_id, { error: errorMsg })
  }

  return result
}

/**
 * Forward incremental sync: fetch messages newer than latest_ts.
 * If latest_ts is null, seed with a 30-day lookback.
 */
async function syncForward(
  channel: ChannelSyncStateV2,
  staffLookup: Map<string, string>
): Promise<number> {
  const supabase = getAdminClient()
  let oldest: string | undefined

  if (channel.latest_ts) {
    oldest = channel.latest_ts
  } else {
    // Seed: 30-day lookback
    const seedTime = Math.floor(Date.now() / 1000) - SLACK_BACKFILL_DAYS * 86400
    oldest = `${seedTime}.000000`
  }

  let totalInserted = 0
  let cursor: string | undefined
  let maxTs: string | null = null
  let pagesProcessed = 0

  do {
    const page = await getChannelHistoryPage(channel.channel_id, {
      oldest,
      cursor,
    })

    const parsed: ParsedMessage[] = []
    for (const msg of page.messages) {
      const p = parseMessage(msg, channel.channel_id, staffLookup)
      if (p) {
        parsed.push(p)
        // Track max ts for updating latest_ts
        if (!maxTs || msg.ts > maxTs) maxTs = msg.ts
      }
    }

    const inserted = await upsertMessages(parsed)
    totalInserted += inserted

    cursor = page.next_cursor
    pagesProcessed++
  } while (cursor && pagesProcessed < MAX_PAGES_PER_CHANNEL)

  // Update latest_ts if we found newer messages
  if (maxTs) {
    await supabase
      .from('slack_sync_state')
      .update({ latest_ts: maxTs })
      .eq('channel_id', channel.channel_id)
  }

  // If this was the first sync (no previous latest_ts), also set oldest_ts
  if (!channel.latest_ts && !channel.oldest_ts) {
    // Set oldest_ts to the seed boundary for future backfill
    const seedTime = Math.floor(Date.now() / 1000) - SLACK_BACKFILL_DAYS * 86400
    const seedTs = `${seedTime}.000000`
    await supabase
      .from('slack_sync_state')
      .update({ oldest_ts: seedTs })
      .eq('channel_id', channel.channel_id)
  }

  return totalInserted
}

/**
 * Historical backfill: fetch messages older than oldest_ts.
 * Bounded by MAX_PAGES_PER_CHANNEL per run.
 */
async function syncBackfill(
  channel: ChannelSyncStateV2,
  staffLookup: Map<string, string>
): Promise<number> {
  const supabase = getAdminClient()

  // If no oldest_ts set yet, nothing to backfill from
  if (!channel.oldest_ts) return 0

  let totalInserted = 0
  let cursor: string | undefined
  let minTs: string | null = null
  let pagesProcessed = 0
  let hasMore = true

  do {
    const page = await getChannelHistoryPage(channel.channel_id, {
      latest: channel.oldest_ts,
      cursor,
    })

    const parsed: ParsedMessage[] = []
    for (const msg of page.messages) {
      const p = parseMessage(msg, channel.channel_id, staffLookup)
      if (p) {
        parsed.push(p)
        if (!minTs || msg.ts < minTs) minTs = msg.ts
      }
    }

    const inserted = await upsertMessages(parsed)
    totalInserted += inserted

    hasMore = page.has_more
    cursor = page.next_cursor
    pagesProcessed++
  } while (cursor && hasMore && pagesProcessed < MAX_PAGES_PER_CHANNEL)

  // Update oldest_ts if we fetched older messages
  if (minTs) {
    await supabase
      .from('slack_sync_state')
      .update({ oldest_ts: minTs })
      .eq('channel_id', channel.channel_id)
  }

  // Mark backfill complete if no more pages
  if (!hasMore || !cursor) {
    await supabase
      .from('slack_sync_state')
      .update({ is_backfill_complete: true })
      .eq('channel_id', channel.channel_id)
  }

  return totalInserted
}

/**
 * Update sync state fields for a channel.
 */
async function updateSyncState(
  channelId: string,
  updates: Record<string, unknown>
): Promise<void> {
  const supabase = getAdminClient()
  const { error } = await supabase
    .from('slack_sync_state')
    .update(updates)
    .eq('channel_id', channelId)

  if (error) {
    console.error(`Failed to update sync state for ${channelId}:`, error)
  }
}

// =============================================================================
// Sync Run Management (Lease-based)
// =============================================================================

/**
 * Create a new sync run record. Returns the run ID.
 */
export async function createSyncRun(triggeredBy: string): Promise<string> {
  const supabase = getAdminClient()

  // Check for existing active runs
  const { data: existing } = await supabase
    .from('slack_sync_runs')
    .select('id, status')
    .in('status', ['pending', 'running'])
    .order('created_at', { ascending: false })
    .limit(1)

  if (existing && existing.length > 0) {
    throw new Error(`A sync run is already ${existing[0].status} (${existing[0].id})`)
  }

  // Count mapped channels
  const { count } = await supabase
    .from('slack_sync_state')
    .select('*', { count: 'exact', head: true })
    .not('partner_id', 'is', null)

  const { data: run, error } = await supabase
    .from('slack_sync_runs')
    .insert({
      status: 'pending',
      triggered_by: triggeredBy,
      total_channels: count || 0,
    })
    .select('id')
    .single()

  if (error || !run) {
    throw new Error(`Failed to create sync run: ${error?.message || 'unknown error'}`)
  }

  return run.id
}

/**
 * Attempt to acquire the lease for a sync run.
 * Returns the run if lease acquired, null if another worker holds it.
 */
export async function acquireLease(runId: string): Promise<Record<string, unknown> | null> {
  const supabase = getAdminClient()

  const { data, error } = await supabase
    .from('slack_sync_runs')
    .update({
      status: 'running',
      worker_lease_expires_at: new Date(
        Date.now() + LEASE_DURATION_MINUTES * 60 * 1000
      ).toISOString(),
      last_heartbeat_at: new Date().toISOString(),
      started_at: new Date().toISOString(),
    })
    .eq('id', runId)
    .in('status', ['pending', 'running'])
    .or(`worker_lease_expires_at.is.null,worker_lease_expires_at.lt.${new Date().toISOString()}`)
    .select()
    .single()

  if (error || !data) {
    return null // Another worker owns the lease
  }

  return data as Record<string, unknown>
}

/**
 * Process a chunk of channels for a sync run.
 * Called by the cron handler each invocation.
 */
export async function processChunk(runId: string): Promise<SyncRunSummary> {
  const startTime = Date.now()
  const supabase = getAdminClient()

  // 1. Acquire lease
  const run = await acquireLease(runId)
  if (!run) {
    return {
      run_id: runId,
      channels_synced: 0,
      channels_failed: 0,
      channels_skipped: 0,
      total_messages: 0,
      duration_ms: Date.now() - startTime,
    }
  }

  const offset = (run.next_channel_offset as number) || 0

  // 2. Fetch mapped channels ordered by last_synced_at (oldest first)
  const { data: channels, error: channelsError } = await supabase
    .from('slack_sync_state')
    .select('*')
    .not('partner_id', 'is', null)
    .order('last_synced_at', { ascending: true, nullsFirst: true })
    .range(offset, offset + CHANNELS_PER_CHUNK - 1)

  if (channelsError || !channels) {
    console.error('Failed to fetch channels for sync:', channelsError)
    await supabase
      .from('slack_sync_runs')
      .update({ error: channelsError?.message || 'Failed to fetch channels', status: 'failed' })
      .eq('id', runId)

    return {
      run_id: runId,
      channels_synced: 0,
      channels_failed: 0,
      channels_skipped: 0,
      total_messages: 0,
      duration_ms: Date.now() - startTime,
    }
  }

  // 3. Build staff lookup once for the chunk
  const staffLookup = await buildStaffLookup()

  // 4. Process channels sequentially (rate-limited)
  let syncedCount = 0
  let failedCount = 0
  let totalMessages = 0

  for (const ch of channels) {
    const channel = ch as unknown as ChannelSyncStateV2
    const result = await syncChannel(channel, staffLookup)

    if (result.success) {
      syncedCount++
      totalMessages += result.messages_synced
    } else {
      failedCount++
    }

    console.log(
      `syncChannel: ${channel.channel_name} — ${result.success ? 'OK' : 'FAIL'}` +
      ` (${result.messages_synced} msgs${result.error ? `, error: ${result.error}` : ''})`
    )
  }

  // 5. Update run progress
  const newOffset = offset + channels.length
  const totalChannels = (run.total_channels as number) || 0
  const isComplete = newOffset >= totalChannels || channels.length < CHANNELS_PER_CHUNK

  await supabase
    .from('slack_sync_runs')
    .update({
      synced_channels: ((run.synced_channels as number) || 0) + syncedCount,
      failed_channels: ((run.failed_channels as number) || 0) + failedCount,
      total_messages_synced: ((run.total_messages_synced as number) || 0) + totalMessages,
      next_channel_offset: newOffset,
      last_heartbeat_at: new Date().toISOString(),
      ...(isComplete
        ? { status: 'completed', completed_at: new Date().toISOString() }
        : {}),
    })
    .eq('id', runId)

  const summary: SyncRunSummary = {
    run_id: runId,
    channels_synced: syncedCount,
    channels_failed: failedCount,
    channels_skipped: 0,
    total_messages: totalMessages,
    duration_ms: Date.now() - startTime,
  }

  console.log(
    `Sync chunk complete: ${syncedCount} synced, ${failedCount} failed, ` +
    `${totalMessages} msgs, ${summary.duration_ms}ms, ` +
    `offset ${offset}→${newOffset}/${totalChannels}` +
    (isComplete ? ' [RUN COMPLETE]' : '')
  )

  return summary
}

// =============================================================================
// Single Channel Sync (for debugging/testing)
// =============================================================================

/**
 * Sync a single channel by channel ID.
 * Used for testing and debugging from the admin UI.
 */
export async function syncSingleChannel(channelId: string): Promise<SyncChannelResult> {
  const supabase = getAdminClient()

  const { data: channel, error } = await supabase
    .from('slack_sync_state')
    .select('*')
    .eq('channel_id', channelId)
    .single()

  if (error || !channel) {
    return {
      channel_id: channelId,
      channel_name: 'unknown',
      success: false,
      messages_synced: 0,
      error: `Channel not found in sync state: ${error?.message || 'not found'}`,
    }
  }

  const staffLookup = await buildStaffLookup()
  return syncChannel(channel as unknown as ChannelSyncStateV2, staffLookup)
}

// =============================================================================
// Staff Reclassification
// =============================================================================

/**
 * Reclassify existing messages when a staff mapping is created.
 * Updates sender_staff_id and sender_is_staff for all messages
 * from the given Slack user ID.
 *
 * @returns Number of messages updated
 */
export async function reclassifyStaffMessages(
  slackUserId: string,
  staffId: string
): Promise<number> {
  const supabase = getAdminClient()

  const { data, error } = await supabase
    .from('slack_messages')
    .update({
      sender_staff_id: staffId,
      sender_is_staff: true,
    })
    .eq('sender_slack_id', slackUserId)
    .is('sender_staff_id', null)
    .select('id')

  if (error) {
    console.error(`Reclassification failed for ${slackUserId}:`, error)
    return 0
  }

  const count = data?.length || 0
  if (count > 0) {
    console.log(`Reclassified ${count} messages: ${slackUserId} → staff ${staffId}`)
  }
  return count
}

/**
 * Un-reclassify messages when a staff mapping is removed.
 * Clears sender_staff_id and sender_is_staff for messages
 * from the given Slack user ID that were attributed to the given staff ID.
 *
 * @returns Number of messages updated
 */
export async function unclassifyStaffMessages(
  slackUserId: string,
  staffId: string
): Promise<number> {
  const supabase = getAdminClient()

  const { data, error } = await supabase
    .from('slack_messages')
    .update({
      sender_staff_id: null,
      sender_is_staff: false,
    })
    .eq('sender_slack_id', slackUserId)
    .eq('sender_staff_id', staffId)
    .select('id')

  if (error) {
    console.error(`Un-classification failed for ${slackUserId}:`, error)
    return 0
  }

  const count = data?.length || 0
  if (count > 0) {
    console.log(`Un-classified ${count} messages: ${slackUserId} (staff ${staffId} removed)`)
  }
  return count
}

/**
 * Bulk reclassify messages for multiple staff mappings (after auto-match).
 * Takes a list of { slackUserId, staffId } pairs.
 *
 * @returns Total messages reclassified
 */
export async function bulkReclassifyStaffMessages(
  mappings: Array<{ slackUserId: string; staffId: string }>
): Promise<number> {
  let total = 0
  for (const { slackUserId, staffId } of mappings) {
    total += await reclassifyStaffMessages(slackUserId, staffId)
  }
  if (total > 0) {
    console.log(`Bulk reclassification complete: ${total} messages across ${mappings.length} staff mappings`)
  }
  return total
}

// =============================================================================
// Exports (for sync constants)
// =============================================================================

export { CHANNELS_PER_CHUNK, LEASE_DURATION_MINUTES, SLACK_BACKFILL_DAYS }
