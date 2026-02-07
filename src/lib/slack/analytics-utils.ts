/**
 * Slack Analytics Utilities
 *
 * Helpers for response time computation: statistical aggregation,
 * bucket classification, and date range utilities.
 */

import type { ResponseTimeBucket } from './types'

// =============================================================================
// Statistical Functions
// =============================================================================

/**
 * Compute median of a sorted numeric array.
 * Returns null for empty arrays.
 * For even-length arrays, returns the average of the two middle values.
 */
export function median(sorted: number[]): number | null {
  const n = sorted.length
  if (n === 0) return null
  if (n === 1) return sorted[0]

  const mid = Math.floor(n / 2)
  if (n % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2
  }
  return sorted[mid]
}

/**
 * Compute the p-th percentile of a sorted numeric array.
 * Uses the nearest-rank method.
 * Returns null for empty arrays.
 */
export function percentile(sorted: number[], p: number): number | null {
  const n = sorted.length
  if (n === 0) return null
  if (n === 1) return sorted[0]

  // Nearest-rank: ceil(p/100 * n) - 1 as zero-based index
  const rank = Math.ceil((p / 100) * n) - 1
  const index = Math.max(0, Math.min(rank, n - 1))
  return sorted[index]
}

/**
 * Compute p95 using the percentile helper.
 */
export function p95(sorted: number[]): number | null {
  return percentile(sorted, 95)
}

/**
 * Compute average of a numeric array. Returns null for empty arrays.
 */
export function average(values: number[]): number | null {
  if (values.length === 0) return null
  const sum = values.reduce((a, b) => a + b, 0)
  return sum / values.length
}

// =============================================================================
// Response Time Buckets
// =============================================================================

const THIRTY_MINUTES = 30
const ONE_HOUR = 60
const FOUR_HOURS = 240
const TWENTY_FOUR_HOURS = 1440

/**
 * Classify a response time (in minutes) into a bucket.
 */
export function classifyBucket(responseTimeMinutes: number): ResponseTimeBucket {
  if (responseTimeMinutes < THIRTY_MINUTES) return 'under_30m'
  if (responseTimeMinutes < ONE_HOUR) return '30m_to_1h'
  if (responseTimeMinutes < FOUR_HOURS) return '1h_to_4h'
  if (responseTimeMinutes < TWENTY_FOUR_HOURS) return '4h_to_24h'
  return 'over_24h'
}

/**
 * Count response times into buckets.
 * Returns a map of bucket -> count.
 */
export function bucketCounts(responseTimesMinutes: number[]): Record<ResponseTimeBucket, number> {
  const counts: Record<ResponseTimeBucket, number> = {
    under_30m: 0,
    '30m_to_1h': 0,
    '1h_to_4h': 0,
    '4h_to_24h': 0,
    over_24h: 0,
  }

  for (const rt of responseTimesMinutes) {
    const bucket = classifyBucket(rt)
    counts[bucket]++
  }

  return counts
}

// =============================================================================
// Date Utilities
// =============================================================================

/**
 * Generate an array of date strings (YYYY-MM-DD) for a range inclusive of start and end.
 */
export function dateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = []
  const start = new Date(startDate + 'T00:00:00Z')
  const end = new Date(endDate + 'T00:00:00Z')

  const current = new Date(start)
  while (current <= end) {
    dates.push(current.toISOString().split('T')[0])
    current.setUTCDate(current.getUTCDate() + 1)
  }

  return dates
}

/**
 * Add days to a date string (YYYY-MM-DD) and return a new date string.
 */
export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().split('T')[0]
}

/**
 * Get the date portion (YYYY-MM-DD) from a Date or ISO string.
 */
export function toDateString(date: Date | string): string {
  if (typeof date === 'string') {
    return date.split('T')[0]
  }
  return date.toISOString().split('T')[0]
}

/**
 * Compute the difference between two timestamps in minutes.
 */
export function diffMinutes(later: Date, earlier: Date): number {
  return (later.getTime() - earlier.getTime()) / (1000 * 60)
}

/**
 * Round a number to 2 decimal places (for storing in NUMERIC(10,2)).
 */
export function round2(value: number | null): number | null {
  if (value === null) return null
  return Math.round(value * 100) / 100
}
