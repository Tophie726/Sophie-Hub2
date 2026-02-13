/**
 * Shared BigQuery Identifier Cache
 *
 * Module-level cache for BigQuery client identifiers.
 * Shared between the client-names and partner-mappings API routes
 * so that mapping changes can invalidate the cached data.
 *
 * BigQuery queries are expensive (~15s), so we cache for 10 minutes.
 */

import { CACHE } from '@/lib/constants'

const CACHE_TTL = CACHE.BIGQUERY_TTL

let cachedClientNames: string[] | null = null
let cacheTimestamp = 0

/**
 * Get cached client identifiers if still valid
 */
export function getCachedClientNames(): string[] | null {
  if (!cachedClientNames) return null
  if (Date.now() - cacheTimestamp > CACHE_TTL) {
    cachedClientNames = null
    cacheTimestamp = 0
    return null
  }
  return cachedClientNames
}

/**
 * Store client identifiers in cache
 */
export function setCachedClientNames(names: string[]): void {
  cachedClientNames = names
  cacheTimestamp = Date.now()
}

/**
 * Invalidate the client names cache.
 * Call this when partner mappings change so the UI
 * reflects the updated mapping state on next fetch.
 */
export function invalidateClientNamesCache(): void {
  cachedClientNames = null
  cacheTimestamp = 0
}
