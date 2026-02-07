/**
 * Shared Slack Cache
 *
 * Module-level cache for Slack users and channels lists.
 * Shared between API routes so that mapping changes can invalidate cached data.
 *
 * Slack API calls are rate-limited, so we cache for 5 minutes.
 */

import { CACHE } from '@/lib/constants'
import type { SlackUser, SlackChannel } from '@/lib/slack/types'

const CACHE_TTL = CACHE.DEFAULT_TTL // 5 minutes

// =============================================================================
// Users Cache
// =============================================================================

let cachedUsers: SlackUser[] | null = null
let usersCacheTimestamp = 0

export function getCachedUsers(): SlackUser[] | null {
  if (!cachedUsers) return null
  if (Date.now() - usersCacheTimestamp > CACHE_TTL) {
    cachedUsers = null
    usersCacheTimestamp = 0
    return null
  }
  return cachedUsers
}

export function setCachedUsers(users: SlackUser[]): void {
  cachedUsers = users
  usersCacheTimestamp = Date.now()
}

export function invalidateUsersCache(): void {
  cachedUsers = null
  usersCacheTimestamp = 0
}

// =============================================================================
// Channels Cache
// =============================================================================

let cachedChannels: SlackChannel[] | null = null
let channelsCacheTimestamp = 0

export function getCachedChannels(): SlackChannel[] | null {
  if (!cachedChannels) return null
  if (Date.now() - channelsCacheTimestamp > CACHE_TTL) {
    cachedChannels = null
    channelsCacheTimestamp = 0
    return null
  }
  return cachedChannels
}

export function setCachedChannels(channels: SlackChannel[]): void {
  cachedChannels = channels
  channelsCacheTimestamp = Date.now()
}

export function invalidateChannelsCache(): void {
  cachedChannels = null
  channelsCacheTimestamp = 0
}

// =============================================================================
// Invalidate All
// =============================================================================

export function invalidateAllSlackCaches(): void {
  invalidateUsersCache()
  invalidateChannelsCache()
}
