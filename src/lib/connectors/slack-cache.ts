/**
 * Shared Slack Cache
 *
 * Module-level cache for Slack users and channels lists.
 * Shared between API routes so that mapping changes can invalidate cached data.
 *
 * Uses stale-while-revalidate pattern:
 * - Fresh data (< CACHE_TTL): returned immediately
 * - Stale data (CACHE_TTL..STALE_TTL): returned immediately, background refresh triggered
 * - Expired data (> STALE_TTL): cache miss, must wait for fresh fetch
 */

import { CACHE } from '@/lib/constants'
import type { SlackUser, SlackChannel } from '@/lib/slack/types'

const CACHE_TTL = CACHE.DEFAULT_TTL // 5 minutes — data considered fresh
const STALE_TTL = 10 * 60 * 1000   // 10 minutes — stale data still serveable

// =============================================================================
// Users Cache
// =============================================================================

let cachedUsers: SlackUser[] | null = null
let usersCacheTimestamp = 0
let usersRefreshInProgress = false

export function getCachedUsers(): SlackUser[] | null {
  if (!cachedUsers) return null
  if (Date.now() - usersCacheTimestamp > STALE_TTL) {
    cachedUsers = null
    usersCacheTimestamp = 0
    return null
  }
  return cachedUsers
}

export function isUsersCacheStale(): boolean {
  if (!cachedUsers) return false
  return Date.now() - usersCacheTimestamp > CACHE_TTL
}

export function getUsersRefreshInProgress(): boolean {
  return usersRefreshInProgress
}

export function setUsersRefreshInProgress(v: boolean): void {
  usersRefreshInProgress = v
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
let channelsRefreshInProgress = false

export function getCachedChannels(): SlackChannel[] | null {
  if (!cachedChannels) return null
  if (Date.now() - channelsCacheTimestamp > STALE_TTL) {
    cachedChannels = null
    channelsCacheTimestamp = 0
    return null
  }
  return cachedChannels
}

export function isChannelsCacheStale(): boolean {
  if (!cachedChannels) return false
  return Date.now() - channelsCacheTimestamp > CACHE_TTL
}

export function getChannelsRefreshInProgress(): boolean {
  return channelsRefreshInProgress
}

export function setChannelsRefreshInProgress(v: boolean): void {
  channelsRefreshInProgress = v
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
