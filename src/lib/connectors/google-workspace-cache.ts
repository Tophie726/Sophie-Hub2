/**
 * Google Workspace Directory Cache
 *
 * Module-level cache for directory user snapshots.
 * Uses stale-while-revalidate pattern matching slack-cache.ts.
 *
 * Since directory data changes infrequently (~120-200 users), we use a
 * longer TTL than Slack. Fresh: 10 min, Stale: 20 min.
 */

import { CACHE } from '@/lib/constants'
import type { DirectorySnapshotRow } from '@/lib/google-workspace/types'

/** Snapshot row without raw_profile — used for browser-facing cache */
type DirectoryUserRow = Omit<DirectorySnapshotRow, 'raw_profile'>

const CACHE_TTL = CACHE.GOOGLE_WORKSPACE_TTL // 10 minutes — data considered fresh
const STALE_TTL = 20 * 60 * 1000              // 20 minutes — stale data still serveable

// =============================================================================
// Directory Users Cache
// =============================================================================

let cachedUsers: DirectoryUserRow[] | null = null
let usersCacheTimestamp = 0
let usersRefreshInProgress = false

export function getCachedDirectoryUsers(): DirectoryUserRow[] | null {
  if (!cachedUsers) return null
  if (Date.now() - usersCacheTimestamp > STALE_TTL) {
    cachedUsers = null
    usersCacheTimestamp = 0
    return null
  }
  return cachedUsers
}

export function isDirectoryUsersCacheStale(): boolean {
  if (!cachedUsers) return false
  return Date.now() - usersCacheTimestamp > CACHE_TTL
}

export function getDirectoryUsersRefreshInProgress(): boolean {
  return usersRefreshInProgress
}

export function setDirectoryUsersRefreshInProgress(v: boolean): void {
  usersRefreshInProgress = v
}

export function setCachedDirectoryUsers(users: DirectoryUserRow[]): void {
  cachedUsers = users
  usersCacheTimestamp = Date.now()
}

export function invalidateDirectoryUsersCache(): void {
  cachedUsers = null
  usersCacheTimestamp = 0
}
