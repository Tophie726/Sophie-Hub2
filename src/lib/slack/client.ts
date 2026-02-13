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

import type {
  SlackUser,
  SlackChannel,
  SlackMessageMeta,
  SlackMessageWithText,
} from './types'

// =============================================================================
// Configuration
// =============================================================================

const SLACK_API_BASE = 'https://slack.com/api'

/** Minimum delay between API calls (ms) to respect rate limits */
const MIN_DELAY_MS = 1200

/** Maximum items per page for paginated endpoints */
const PAGE_SIZE = 200

// =============================================================================
// Rate Limiting (concurrency-safe sequential queue)
// =============================================================================

/** Max retries on 429 or transient errors */
const MAX_RETRIES = 3

/**
 * Promise-chain queue ensures only one API call is in-flight at a time.
 * Concurrent callers wait in line rather than racing on a shared timestamp.
 */
let queue: Promise<void> = Promise.resolve()

function rateLimit(): Promise<void> {
  const waiter = queue.then(
    () => new Promise<void>(resolve => setTimeout(resolve, MIN_DELAY_MS))
  )
  queue = waiter
  return waiter
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
 * Execute a fetch with 429 retry and exponential backoff.
 * Waits in the rate-limit queue before each attempt.
 */
async function fetchWithRetry(
  buildRequest: () => { url: string; init: RequestInit }
): Promise<SlackApiResponse> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    await rateLimit()

    const { url, init } = buildRequest()
    const response = await fetch(url, init)

    // Handle 429 rate limit with Retry-After
    if (response.status === 429 && attempt < MAX_RETRIES) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '', 10)
      const backoffMs = retryAfter && !isNaN(retryAfter)
        ? retryAfter * 1000
        : MIN_DELAY_MS * Math.pow(2, attempt + 1) // exponential backoff
      console.warn(`Slack 429: retrying in ${backoffMs}ms (attempt ${attempt + 1}/${MAX_RETRIES})`)
      await new Promise(resolve => setTimeout(resolve, backoffMs))
      continue
    }

    if (!response.ok) {
      throw new Error(`Slack API HTTP error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json() as SlackApiResponse

    if (!data.ok) {
      throw new Error(`Slack API error: ${data.error || 'Unknown error'}`)
    }

    return data
  }

  throw new Error('Slack API: max retries exceeded on 429')
}

/**
 * Make a rate-limited GET call to the Slack API (with 429 retry)
 */
async function slackApi(
  method: string,
  params: Record<string, string | number | boolean> = {}
): Promise<SlackApiResponse> {
  const token = getBotToken()
  return fetchWithRetry(() => {
    const url = new URL(`${SLACK_API_BASE}/${method}`)
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, String(value))
    }
    return {
      url: url.toString(),
      init: {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    }
  })
}

/**
 * Make a rate-limited POST call to the Slack API (with 429 retry)
 */
async function slackApiPost(
  method: string,
  body: Record<string, unknown> = {}
): Promise<SlackApiResponse> {
  const token = getBotToken()
  return fetchWithRetry(() => ({
    url: `${SLACK_API_BASE}/${method}`,
    init: {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  }))
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

/** Result from a single page of channel history */
export interface ChannelHistoryPage {
  messages: SlackMessageMeta[]
  has_more: boolean
  next_cursor?: string
}

/** Result from a single page of channel history (includes text) */
export interface ChannelHistoryPageWithText {
  messages: SlackMessageWithText[]
  has_more: boolean
  next_cursor?: string
}

/**
 * Get a single page of message history for a channel.
 * Returns message metadata only — NOT content.
 *
 * @param channelId - Slack channel ID
 * @param options.oldest - Only messages after this timestamp (exclusive)
 * @param options.latest - Only messages before this timestamp (exclusive, for backfill)
 * @param options.cursor - Pagination cursor from previous page
 * @param options.limit - Messages per page (default: PAGE_SIZE = 200)
 */
export async function getChannelHistoryPage(
  channelId: string,
  options?: {
    oldest?: string
    latest?: string
    cursor?: string
    limit?: number
  }
): Promise<ChannelHistoryPage> {
  const params: Record<string, string | number> = {
    channel: channelId,
    limit: options?.limit || PAGE_SIZE,
  }
  if (options?.oldest) params.oldest = options.oldest
  if (options?.latest) params.latest = options.latest
  if (options?.cursor) params.cursor = options.cursor

  const data = await slackApi('conversations.history', params)
  const rawMessages = (data.messages || []) as SlackMessageMeta[]

  const messages: SlackMessageMeta[] = rawMessages.map(msg => ({
    ts: msg.ts,
    thread_ts: msg.thread_ts,
    user: msg.user,
    bot_id: msg.bot_id,
    type: msg.type,
    subtype: msg.subtype,
  }))

  return {
    messages,
    has_more: !!data.has_more,
    next_cursor: data.response_metadata?.next_cursor || undefined,
  }
}

/**
 * Get message history for a channel (paginated, fetches all pages)
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
    const page = await getChannelHistoryPage(channelId, {
      oldest,
      cursor,
      limit: Math.min(PAGE_SIZE, maxMessages - allMessages.length),
    })
    allMessages.push(...page.messages)
    cursor = page.next_cursor
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

/**
 * Get a single page of message history including message text.
 * Used by automation workflows that need to interpret channel updates.
 */
export async function getChannelHistoryPageWithText(
  channelId: string,
  options?: {
    oldest?: string
    latest?: string
    cursor?: string
    limit?: number
  }
): Promise<ChannelHistoryPageWithText> {
  const params: Record<string, string | number> = {
    channel: channelId,
    limit: options?.limit || PAGE_SIZE,
  }
  if (options?.oldest) params.oldest = options.oldest
  if (options?.latest) params.latest = options.latest
  if (options?.cursor) params.cursor = options.cursor

  const data = await slackApi('conversations.history', params)
  const rawMessages = (data.messages || []) as SlackMessageWithText[]

  const messages: SlackMessageWithText[] = rawMessages.map(msg => ({
    ts: msg.ts,
    thread_ts: msg.thread_ts,
    user: msg.user,
    bot_id: msg.bot_id,
    type: msg.type,
    subtype: msg.subtype,
    text: msg.text,
  }))

  return {
    messages,
    has_more: !!data.has_more,
    next_cursor: data.response_metadata?.next_cursor || undefined,
  }
}

/**
 * Get message history since a timestamp (exclusive), including message text.
 * Returns newest-first data sorted into chronological order for processing.
 */
export async function getChannelHistorySinceWithText(
  channelId: string,
  oldest: string,
  limit = 1000
): Promise<SlackMessageWithText[]> {
  const allMessages: SlackMessageWithText[] = []
  let cursor: string | undefined

  do {
    const page = await getChannelHistoryPageWithText(channelId, {
      oldest,
      cursor,
      limit: Math.min(PAGE_SIZE, limit - allMessages.length),
    })

    allMessages.push(...page.messages)
    cursor = page.next_cursor
  } while (cursor && allMessages.length < limit)

  return allMessages.sort((a, b) => parseFloat(a.ts) - parseFloat(b.ts))
}

/**
 * Resolve a permalink to a Slack message.
 */
export async function getMessagePermalink(
  channelId: string,
  messageTs: string
): Promise<string | null> {
  const data = await slackApi('chat.getPermalink', {
    channel: channelId,
    message_ts: messageTs,
  })

  const permalink = data.permalink
  return typeof permalink === 'string' ? permalink : null
}

/**
 * Post a plain text message to a Slack channel.
 */
export async function postChannelMessage(
  channelId: string,
  text: string
): Promise<{ ts: string }> {
  const data = await slackApiPost('chat.postMessage', {
    channel: channelId,
    text,
    mrkdwn: true,
  })

  if (typeof data.ts !== 'string') {
    throw new Error('Slack API returned no message timestamp')
  }

  return { ts: data.ts }
}
