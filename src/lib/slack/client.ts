/**
 * Slack API Client
 *
 * Rate-limited wrapper around the Slack Web API.
 * Uses bot token authentication (SLACK_BOT_TOKEN env var).
 *
 * Rate limits (internal app = Tier 3):
 * - conversations.history: ~50 req/min
 * - conversations.list: Tier 2, higher allowance
 * - users.list: Tier 2
 *
 * We enforce a minimum delay between calls to stay under limits.
 */

import type { SlackUser, SlackChannel, SlackMessageMeta } from './types'

// =============================================================================
// Configuration
// =============================================================================

const SLACK_API_BASE = 'https://slack.com/api'

/** Minimum delay between API calls (ms) to respect rate limits */
const MIN_DELAY_MS = 1200

/** Maximum items per page for paginated endpoints */
const PAGE_SIZE = 200

// =============================================================================
// Rate Limiting
// =============================================================================

let lastCallTime = 0

/**
 * Wait if needed to respect rate limits
 */
async function rateLimit(): Promise<void> {
  const now = Date.now()
  const elapsed = now - lastCallTime
  if (elapsed < MIN_DELAY_MS) {
    await new Promise(resolve => setTimeout(resolve, MIN_DELAY_MS - elapsed))
  }
  lastCallTime = Date.now()
}

// =============================================================================
// Core API Call
// =============================================================================

/**
 * Get the bot token from environment
 */
function getBotToken(): string {
  const token = process.env.SLACK_BOT_TOKEN
  if (!token) {
    throw new Error('SLACK_BOT_TOKEN environment variable is not set')
  }
  return token
}

interface SlackApiResponse {
  ok: boolean
  error?: string
  response_metadata?: {
    next_cursor?: string
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

/**
 * Make a rate-limited call to the Slack API
 */
async function slackApi(
  method: string,
  params: Record<string, string | number | boolean> = {}
): Promise<SlackApiResponse> {
  await rateLimit()

  const token = getBotToken()
  const url = new URL(`${SLACK_API_BASE}/${method}`)

  // Add params as query string for GET-style methods
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value))
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  })

  if (!response.ok) {
    throw new Error(`Slack API HTTP error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json() as SlackApiResponse

  if (!data.ok) {
    throw new Error(`Slack API error: ${data.error || 'Unknown error'}`)
  }

  return data
}

/**
 * Make a POST call to the Slack API (for methods that require POST)
 */
async function slackApiPost(
  method: string,
  body: Record<string, unknown> = {}
): Promise<SlackApiResponse> {
  await rateLimit()

  const token = getBotToken()

  const response = await fetch(`${SLACK_API_BASE}/${method}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new Error(`Slack API HTTP error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json() as SlackApiResponse

  if (!data.ok) {
    throw new Error(`Slack API error: ${data.error || 'Unknown error'}`)
  }

  return data
}

// =============================================================================
// Public API Methods
// =============================================================================

/**
 * Test the bot connection and return workspace info
 */
export async function testConnection(): Promise<{
  workspace_name: string
  bot_user_id: string
}> {
  const data = await slackApi('auth.test')
  return {
    workspace_name: data.team as string,
    bot_user_id: data.user_id as string,
  }
}

/**
 * List all users in the workspace (paginated)
 * Excludes bots and deleted users by default
 */
export async function listUsers(options?: {
  include_bots?: boolean
  include_deleted?: boolean
}): Promise<SlackUser[]> {
  const allUsers: SlackUser[] = []
  let cursor: string | undefined

  do {
    const params: Record<string, string | number> = { limit: PAGE_SIZE }
    if (cursor) params.cursor = cursor

    const data = await slackApi('users.list', params)
    const members = (data.members || []) as SlackUser[]

    for (const user of members) {
      // Filter out bots and deleted users unless explicitly requested
      if (!options?.include_bots && (user.is_bot || user.is_app_user)) continue
      if (!options?.include_deleted && user.deleted) continue
      allUsers.push(user)
    }

    cursor = data.response_metadata?.next_cursor || undefined
  } while (cursor)

  return allUsers
}

/**
 * List all channels in the workspace (paginated)
 * Includes both public and private channels the bot has access to
 */
export async function listChannels(options?: {
  include_archived?: boolean
  types?: string
}): Promise<SlackChannel[]> {
  const allChannels: SlackChannel[] = []
  let cursor: string | undefined

  do {
    const params: Record<string, string | number> = {
      limit: PAGE_SIZE,
      types: options?.types || 'public_channel,private_channel',
      exclude_archived: options?.include_archived ? 'false' : 'true',
    }
    if (cursor) params.cursor = cursor

    const data = await slackApi('conversations.list', params)
    const channels = (data.channels || []) as SlackChannel[]
    allChannels.push(...channels)

    cursor = data.response_metadata?.next_cursor || undefined
  } while (cursor)

  return allChannels
}

/**
 * Get message history for a channel (paginated)
 * Returns message metadata only — NOT content
 *
 * @param channelId - Slack channel ID
 * @param oldest - Only messages after this timestamp
 * @param limit - Max messages to fetch (default: all)
 */
export async function getChannelHistory(
  channelId: string,
  oldest?: string,
  limit?: number
): Promise<SlackMessageMeta[]> {
  const allMessages: SlackMessageMeta[] = []
  let cursor: string | undefined
  const maxMessages = limit || Infinity

  do {
    const params: Record<string, string | number> = {
      channel: channelId,
      limit: Math.min(PAGE_SIZE, maxMessages - allMessages.length),
    }
    if (oldest) params.oldest = oldest
    if (cursor) params.cursor = cursor

    const data = await slackApi('conversations.history', params)
    const messages = (data.messages || []) as SlackMessageMeta[]

    // Extract metadata only (no content)
    for (const msg of messages) {
      allMessages.push({
        ts: msg.ts,
        thread_ts: msg.thread_ts,
        user: msg.user,
        bot_id: msg.bot_id,
        type: msg.type,
        subtype: msg.subtype,
      })
    }

    cursor = data.response_metadata?.next_cursor || undefined
  } while (cursor && allMessages.length < maxMessages)

  return allMessages
}

/**
 * Get members of a channel
 */
export async function getChannelMembers(channelId: string): Promise<string[]> {
  const allMembers: string[] = []
  let cursor: string | undefined

  do {
    const params: Record<string, string | number> = {
      channel: channelId,
      limit: PAGE_SIZE,
    }
    if (cursor) params.cursor = cursor

    const data = await slackApi('conversations.members', params)
    const members = (data.members || []) as string[]
    allMembers.push(...members)

    cursor = data.response_metadata?.next_cursor || undefined
  } while (cursor)

  return allMembers
}

/**
 * Join a public channel (bot must have channels:join scope)
 */
export async function joinChannel(channelId: string): Promise<void> {
  await slackApiPost('conversations.join', { channel: channelId })
}
