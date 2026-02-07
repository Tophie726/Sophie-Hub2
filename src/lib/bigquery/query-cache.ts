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
  data_mode?: 'snapshot' | 'live'
  force_refresh?: boolean
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
    dm: params.data_mode || 'live',
  })
}

function hashString(input: string): number {
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

function makeRng(seed: string): () => number {
  let state = hashString(seed) || 1
  return () => {
    state = (state * 1664525 + 1013904223) % 0x100000000
    return state / 0x100000000
  }
}

function generateDateLabels(count: number): string[] {
  const labels: string[] = []
  const end = new Date()
  end.setHours(0, 0, 0, 0)
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(end)
    d.setDate(end.getDate() - i)
    labels.push(d.toISOString().split('T')[0])
  }
  return labels
}

function sampleCell(metric: string, rowIndex: number, rng: () => number): string {
  const lower = metric.toLowerCase()
  if (lower.includes('date')) {
    return generateDateLabels(rowIndex + 1)[rowIndex]
  }
  if (lower.includes('asin')) {
    return `B0${Math.floor(rng() * 8999999 + 1000000)}`
  }
  if (lower.includes('name')) {
    return `Sample ${metric.replace(/_/g, ' ')} ${rowIndex + 1}`
  }
  if (lower.includes('id')) {
    return `${Math.floor(rng() * 100000 + 1000)}`
  }
  if (lower.includes('rate') || lower.includes('ctr') || lower.includes('cvr')) {
    return (rng() * 0.2).toFixed(4)
  }
  if (lower.includes('spend') || lower.includes('sales') || lower.includes('revenue')) {
    return (rng() * 5000 + 200).toFixed(2)
  }
  return `${Math.floor(rng() * 1000 + 1)}`
}

function generateSnapshotData(params: QueryParams): unknown {
  const seed = JSON.stringify({
    partner: params.partner_id,
    view: params.view,
    metrics: params.metrics,
    groupBy: params.group_by,
    mode: params.mode,
    range: params.date_range,
  })
  const rng = makeRng(seed)

  if (params.mode === 'raw') {
    const rowsCount = Math.min(params.limit || 25, 25)
    const headers = params.metrics
    const rows = Array.from({ length: rowsCount }, (_, rowIndex) =>
      headers.map((metric) => sampleCell(metric, rowIndex, rng))
    )
    return { headers, rows, total_rows: rowsCount }
  }

  if (params.group_by) {
    const points = 30
    const labels = generateDateLabels(points)
    const datasets = params.metrics.map((metric, metricIndex) => {
      const base = 50 + metricIndex * 35
      return {
        label: metric,
        data: labels.map(() => Math.round(base + rng() * 120)),
      }
    })
    return { labels, datasets }
  }

  if (params.metrics.length === 1) {
    return { value: Number((rng() * 10000 + 500).toFixed(2)) }
  }

  const data: Record<string, number> = {}
  for (const metric of params.metrics) {
    data[metric] = Number((rng() * 10000 + 100).toFixed(2))
  }
  return data
}

/**
 * Fetch BigQuery data with caching and deduplication.
 * Returns the parsed JSON `data` field from the API response.
 * Throws on error.
 */
export async function fetchBigQuery(params: QueryParams): Promise<unknown> {
  if (params.data_mode === 'snapshot') {
    return generateSnapshotData(params)
  }

  const key = buildKey(params)
  const forceRefresh = Boolean(params.force_refresh)

  // Check cache
  if (!forceRefresh) {
    const cached = cache.get(key)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data
    }
  }

  // Deduplicate in-flight requests
  if (!forceRefresh) {
    const existing = inflight.get(key)
    if (existing) {
      return existing
    }
  }

  const promise = (async () => {
    const res = await fetch('/api/bigquery/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...params,
        force_refresh: forceRefresh,
      }),
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
