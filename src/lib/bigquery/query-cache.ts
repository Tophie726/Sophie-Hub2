/**
 * Client-side BigQuery query cache with request deduplication.
 *
 * - Caches results keyed by request params (partner, view, metrics, dateRange, etc.)
 * - Deduplicates in-flight requests: if two widgets make the same query, only one
 *   fetch fires and both share the result.
 * - 5-minute TTL; cache clears on page refresh.
 */

interface QueryParams {
  partner_id: string
  view: string
  metrics: string[]
  aggregation?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  date_range?: any
  mode?: string
  group_by?: string
  sort_by?: string
  sort_direction?: string
  limit?: number
}

interface CacheEntry {
  data: unknown
  timestamp: number
}

const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// Result cache
const cache = new Map<string, CacheEntry>()

// In-flight request deduplication
const inflight = new Map<string, Promise<unknown>>()

function buildKey(params: QueryParams): string {
  return JSON.stringify({
    p: params.partner_id,
    v: params.view,
    m: params.metrics.slice().sort(),
    a: params.aggregation,
    dr: params.date_range,
    mo: params.mode,
    gb: params.group_by,
    sb: params.sort_by,
    sd: params.sort_direction,
    l: params.limit,
  })
}

/**
 * Fetch BigQuery data with caching and deduplication.
 * Returns the parsed JSON `data` field from the API response.
 * Throws on error.
 */
export async function fetchBigQuery(params: QueryParams): Promise<unknown> {
  const key = buildKey(params)

  // Check cache
  const cached = cache.get(key)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data
  }

  // Deduplicate in-flight requests
  const existing = inflight.get(key)
  if (existing) {
    return existing
  }

  const promise = (async () => {
    const res = await fetch('/api/bigquery/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })

    if (!res.ok) {
      const json = await res.json()
      throw new Error(json.error?.message || 'BigQuery query failed')
    }

    const json = await res.json()
    const data = json.data

    // Store in cache
    cache.set(key, { data, timestamp: Date.now() })

    return data
  })()

  inflight.set(key, promise)

  try {
    const result = await promise
    return result
  } finally {
    inflight.delete(key)
  }
}

/** Clear all cached data (e.g., when partner or date range changes) */
export function clearQueryCache(): void {
  cache.clear()
  // Don't clear inflight — let running requests finish
}
