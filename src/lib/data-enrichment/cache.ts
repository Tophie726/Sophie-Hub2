/**
 * Module-level cache for Data Enrichment data.
 *
 * This cache survives component unmounts, making navigation between
 * Data Enrichment and other pages instant on return.
 *
 * Pattern: Similar to SmartMapper's rawDataCache, but for sources/previews.
 */

// Default TTL: 5 minutes
const DEFAULT_TTL = 5 * 60 * 1000

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

// Type-safe cache keys
type CacheKey =
  | 'data-sources'
  | `sheet-preview:${string}` // spreadsheetId
  | `smart-mapper:${string}:${string}` // dataSourceId:tabName

// Module-level cache maps
const cache = new Map<CacheKey, CacheEntry<unknown>>()

/**
 * Get cached data if fresh, or null if stale/missing
 */
export function getCached<T>(key: CacheKey, ttl = DEFAULT_TTL): T | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined
  if (!entry) return null

  const age = Date.now() - entry.timestamp
  if (age > (entry.ttl || ttl)) {
    cache.delete(key)
    return null
  }

  return entry.data
}

/**
 * Store data in cache with timestamp
 */
export function setCache<T>(key: CacheKey, data: T, ttl = DEFAULT_TTL): void {
  cache.set(key, {
    data,
    timestamp: Date.now(),
    ttl,
  })
}

/**
 * Invalidate specific cache entry
 */
export function invalidateCache(key: CacheKey): void {
  cache.delete(key)
}

/**
 * Invalidate all cache entries matching a prefix
 */
export function invalidateCachePrefix(prefix: string): void {
  Array.from(cache.keys()).forEach(key => {
    if (key.startsWith(prefix)) {
      cache.delete(key)
    }
  })
}

/**
 * Clear entire cache (useful on logout)
 */
export function clearCache(): void {
  cache.clear()
}

/**
 * Check if cache has fresh entry
 */
export function hasFreshCache(key: CacheKey, ttl = DEFAULT_TTL): boolean {
  return getCached(key, ttl) !== null
}

// =============================================================================
// Type-safe helpers for specific data types
// =============================================================================

import type { CategoryStats } from '@/types/entities'

export interface CachedDataSource {
  id: string
  name: string
  type: string
  spreadsheet_id: string
  spreadsheet_url: string
  tabCount: number
  mappedFieldsCount: number
  tabs: {
    id: string
    tab_name: string
    primary_entity: 'partners' | 'staff' | 'asins'
    header_row: number
    header_confirmed?: boolean
    columnCount: number
    categoryStats?: CategoryStats
    status?: 'active' | 'reference' | 'hidden' | 'flagged'
    notes?: string | null
    updated_at?: string | null
  }[]
}

export interface CachedSheetPreview {
  spreadsheetId: string
  title: string
  tabs: {
    sheetId: number
    title: string
    rowCount: number
    columnCount: number
  }[]
}

/**
 * Get cached data sources
 */
export function getCachedSources(): CachedDataSource[] | null {
  return getCached<CachedDataSource[]>('data-sources')
}

/**
 * Set cached data sources
 */
export function setCachedSources(sources: CachedDataSource[]): void {
  setCache('data-sources', sources)
}

/**
 * Get cached sheet preview
 */
export function getCachedPreview(spreadsheetId: string): CachedSheetPreview | null {
  return getCached<CachedSheetPreview>(`sheet-preview:${spreadsheetId}`)
}

/**
 * Set cached sheet preview
 */
export function setCachedPreview(spreadsheetId: string, preview: CachedSheetPreview): void {
  setCache(`sheet-preview:${spreadsheetId}`, preview)
}

/**
 * Invalidate sources cache (call after adding/removing a source)
 */
export function invalidateSources(): void {
  invalidateCache('data-sources')
}

/**
 * Invalidate preview cache (call after modifying tabs)
 */
export function invalidatePreview(spreadsheetId: string): void {
  invalidateCache(`sheet-preview:${spreadsheetId}`)
}

// =============================================================================
// SmartMapper state caching (per tab)
// =============================================================================

export interface CachedSmartMapperState {
  phase: 'preview' | 'classify' | 'map'
  headerRow: number
  columns: Array<{
    sourceIndex: number
    sourceColumn: string
    category: 'partner' | 'staff' | 'asin' | 'weekly' | 'computed' | 'skip' | null
    targetField: string | null
    authority: 'source_of_truth' | 'reference'
    isKey: boolean
    tagIds?: string[]
    aiSuggested?: boolean
    aiConfidence?: number
    isEmpty?: boolean
  }>
  timestamp: number
}

/**
 * Get cached SmartMapper state for a tab
 */
export function getCachedMapperState(dataSourceId: string, tabName: string): CachedSmartMapperState | null {
  return getCached<CachedSmartMapperState>(`smart-mapper:${dataSourceId}:${tabName}`)
}

/**
 * Set cached SmartMapper state for a tab
 */
export function setCachedMapperState(dataSourceId: string, tabName: string, state: CachedSmartMapperState): void {
  setCache(`smart-mapper:${dataSourceId}:${tabName}`, state)
}

/**
 * Invalidate SmartMapper cache for a tab (call after saving mappings)
 */
export function invalidateMapperState(dataSourceId: string, tabName: string): void {
  invalidateCache(`smart-mapper:${dataSourceId}:${tabName}`)
}
