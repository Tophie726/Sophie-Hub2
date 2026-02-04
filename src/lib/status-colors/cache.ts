/**
 * Module-level cache for status color mappings.
 *
 * Caches database-fetched mappings for fast lookup without
 * repeated database queries. Survives component unmounts,
 * cleared on page refresh.
 */

// Cache TTL: 5 minutes
const CACHE_TTL = 5 * 60 * 1000

export interface StatusMapping {
  id: string
  status_pattern: string
  bucket: string
  priority: number
  is_system_default: boolean
  is_active: boolean
}

interface CacheEntry {
  mappings: StatusMapping[]
  timestamp: number
}

// Module-level cache
let mappingsCache: CacheEntry | null = null

/**
 * Get cached mappings if fresh
 */
export function getCachedMappings(): StatusMapping[] | null {
  if (!mappingsCache) return null

  const age = Date.now() - mappingsCache.timestamp
  if (age > CACHE_TTL) {
    mappingsCache = null
    return null
  }

  return mappingsCache.mappings
}

/**
 * Store mappings in cache
 */
export function setCachedMappings(mappings: StatusMapping[]): void {
  mappingsCache = {
    mappings,
    timestamp: Date.now(),
  }
}

/**
 * Invalidate the mappings cache
 * Call after creating, updating, or deleting mappings
 */
export function invalidateMappingsCache(): void {
  mappingsCache = null
}

/**
 * Check if cache is fresh
 */
export function hasFreshMappingsCache(): boolean {
  return getCachedMappings() !== null
}
