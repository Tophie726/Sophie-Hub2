/**
 * Weekly Status Color Configuration
 *
 * This is the single source of truth for mapping partner weekly statuses to colors.
 * Statuses are matched using partial, case-insensitive matching.
 *
 * IMPORTANT: Gray-700 is reserved for null/empty (no data).
 * Every actual status value should map to a meaningful color.
 *
 * To add a new status: find the appropriate bucket and add the keyword.
 * If unsure which bucket, add to UNKNOWN and it will show purple for review.
 */

export type StatusColorBucket =
  | 'healthy'      // Green - all good
  | 'onboarding'   // Blue - being set up
  | 'warning'      // Amber - needs attention
  | 'paused'       // Gray-400 - temporarily inactive
  | 'offboarding'  // Orange - leaving soon
  | 'churned'      // Red - left/cancelled
  | 'unknown'      // Purple - unmapped (needs review)
  | 'no-data'      // Gray-700 - no status recorded

/**
 * Status keywords grouped by color bucket.
 * Matching is partial and case-insensitive.
 * Order matters - first match wins, so put more specific terms first.
 */
export const STATUS_BUCKETS: Record<Exclude<StatusColorBucket, 'no-data' | 'unknown'>, string[]> = {
  // Red: They've left
  churned: [
    'churn',
    'cancel',
    'terminated',
    'ended',
  ],

  // Orange: In process of leaving
  offboarding: [
    'offboard',
    'off-board',
    'winding down',
    'ending',
  ],

  // Amber: Needs attention
  warning: [
    'at risk',
    'at-risk',
    'under-perform',
    'underperform',
    'struggling',
    'needs attention',
    'concern',
    'issue',
    'problem',
    'declining',
  ],

  // Gray-400: Temporarily inactive
  paused: [
    'pause',
    'hold',
    'on hold',
    'on-hold',
    'inactive',
    'dormant',
    'suspended',
  ],

  // Blue: New partner being set up
  onboarding: [
    'onboard',
    'on-board',
    'waiting',
    'new',
    'setup',
    'set-up',
    'setting up',
    'getting started',
    'welcome',
  ],

  // Green: All good
  healthy: [
    'high perform',
    'high-perform',
    'outperform',
    'out-perform',
    'excellent',
    'great',
    'on track',
    'on-track',
    'active',
    'subscribed',
    'healthy',
    'good',
    'stable',
    'strong',
    'growing',
  ],
}

/**
 * Tailwind color classes for each bucket
 */
export const BUCKET_COLORS: Record<StatusColorBucket, string> = {
  healthy: 'bg-green-500',
  onboarding: 'bg-blue-500',
  warning: 'bg-amber-500',
  paused: 'bg-gray-400',
  offboarding: 'bg-orange-500',
  churned: 'bg-red-500',
  unknown: 'bg-purple-500',
  'no-data': 'bg-gray-700',
}

/**
 * Human-readable labels for each bucket
 */
export const BUCKET_LABELS: Record<StatusColorBucket, string> = {
  healthy: 'Healthy',
  onboarding: 'Onboarding',
  warning: 'Needs Attention',
  paused: 'Paused',
  offboarding: 'Offboarding',
  churned: 'Churned',
  unknown: 'Unknown (Unmapped)',
  'no-data': 'No Data',
}

/**
 * Get the color bucket for a status string
 */
export function getStatusBucket(status: string | null): StatusColorBucket {
  if (!status || !status.trim()) return 'no-data'

  const s = status.toLowerCase().trim()

  // Check each bucket in order (order defined by iteration)
  // More severe statuses checked first
  const bucketOrder: (keyof typeof STATUS_BUCKETS)[] = [
    'churned',
    'offboarding',
    'warning',
    'paused',
    'onboarding',
    'healthy',
  ]

  for (const bucket of bucketOrder) {
    const keywords = STATUS_BUCKETS[bucket]
    for (const keyword of keywords) {
      if (s.includes(keyword)) {
        return bucket
      }
    }
  }

  return 'unknown'
}

/**
 * Get the Tailwind color class for a status string
 */
export function getStatusColor(status: string | null): string {
  const bucket = getStatusBucket(status)
  return BUCKET_COLORS[bucket]
}

/**
 * Get all unique statuses that would be classified as "unknown"
 * Useful for identifying statuses that need to be mapped
 */
export function findUnmappedStatuses(statuses: (string | null)[]): string[] {
  const unmapped = new Set<string>()

  for (const status of statuses) {
    if (status && getStatusBucket(status) === 'unknown') {
      unmapped.add(status)
    }
  }

  return Array.from(unmapped).sort()
}
