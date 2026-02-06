/**
 * Module-level cache for BigQuery usage data.
 *
 * Usage stats change slowly (hourly aggregates), so a 1hr TTL
 * prevents repeated expensive INFORMATION_SCHEMA + Supabase queries.
 */

import { CACHE } from '@/lib/constants'
import type { UsageData } from '@/types/usage'

const CACHE_TTL = CACHE.USAGE_TTL

interface CacheEntry {
  data: UsageData
  timestamp: number
}

const cache = new Map<string, CacheEntry>()

export function getCachedUsage(period: string): UsageData | null {
  const entry = cache.get(period)
  if (!entry) return null

  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(period)
    return null
  }

  return entry.data
}

export function setCachedUsage(period: string, data: UsageData): void {
  cache.set(period, { data, timestamp: Date.now() })
}

export function invalidateUsageCache(): void {
  cache.clear()
}
