import { requireAuth } from '@/lib/auth/api-auth'
import { getAdminClient } from '@/lib/supabase/admin'
import { apiSuccess, apiError, ApiErrors } from '@/lib/api/response'
import { BUCKET_COLORS, BUCKET_LABELS, STATUS_BUCKETS, type StatusColorBucket } from '@/lib/status-colors'

interface StatusMapping {
  status_pattern: string
  bucket: string
  priority: number
}

/**
 * Get fallback mappings from hardcoded STATUS_BUCKETS
 * Used when database table doesn't exist
 */
function getFallbackMappings(): StatusMapping[] {
  const priorityMap: Record<string, number> = {
    churned: 100,
    offboarding: 90,
    warning: 80,
    paused: 70,
    onboarding: 60,
    healthy: 50,
  }

  const mappings: StatusMapping[] = []
  for (const [bucket, keywords] of Object.entries(STATUS_BUCKETS)) {
    for (const pattern of keywords) {
      mappings.push({
        status_pattern: pattern,
        bucket,
        priority: priorityMap[bucket] || 50,
      })
    }
  }

  // Sort by priority descending
  mappings.sort((a, b) => b.priority - a.priority)
  return mappings
}

/**
 * Match a status string against database mappings
 * Uses partial case-insensitive matching, prioritized by priority value
 */
function matchStatusToBucket(
  status: string | null,
  mappings: StatusMapping[]
): StatusColorBucket {
  if (!status || !status.trim()) return 'no-data'

  const s = status.toLowerCase().trim()

  // Mappings are already sorted by priority DESC from the query
  for (const mapping of mappings) {
    if (s.includes(mapping.status_pattern)) {
      return mapping.bucket as StatusColorBucket
    }
  }

  return 'unknown'
}

/**
 * Extract the latest weekly status from partner source_data
 * Looks for columns matching pattern: "M/D/YY\nWeek N"
 * Returns both the status and the date it was recorded
 */
function getLatestWeeklyStatus(
  sourceData: Record<string, Record<string, Record<string, unknown>>> | null
): { status: string | null; date: Date | null } {
  if (!sourceData) return { status: null, date: null }

  let latestDate: Date | null = null
  let latestStatus: string | null = null

  // Iterate through connectors (e.g., gsheets)
  for (const connectorData of Object.values(sourceData)) {
    if (typeof connectorData !== 'object' || !connectorData) continue

    // Iterate through tabs
    for (const tabData of Object.values(connectorData)) {
      if (typeof tabData !== 'object' || !tabData) continue

      // Look for weekly columns
      for (const [columnName, value] of Object.entries(tabData)) {
        // Match columns like "1/5/26\nWeek 2" or "12/29/25\nWeek 1"
        const match = columnName.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})[\s\n]+Week/i)
        if (!match) continue

        // Parse date (assuming 20XX for 2-digit year)
        const month = parseInt(match[1], 10) - 1
        const day = parseInt(match[2], 10)
        const year = 2000 + parseInt(match[3], 10)
        const date = new Date(year, month, day)

        // Only consider past weeks (not future)
        if (date > new Date()) continue

        // Track the latest date with a status value
        if (typeof value === 'string' && value.trim()) {
          if (!latestDate || date > latestDate) {
            latestDate = date
            latestStatus = value.trim()
          }
        }
      }
    }
  }

  return { status: latestStatus, date: latestDate }
}

/**
 * GET /api/stats/health-distribution
 * Returns partner count distribution across health buckets
 */
export async function GET() {
  const authResult = await requireAuth()
  if (!authResult.authenticated) return authResult.response

  try {
    const supabase = getAdminClient()

    // Get all active status mappings, sorted by priority
    // Falls back to hardcoded mappings if table doesn't exist
    let mappings: StatusMapping[] = []
    const { data: dbMappings, error: mappingsError } = await supabase
      .from('status_color_mappings')
      .select('status_pattern, bucket, priority')
      .eq('is_active', true)
      .order('priority', { ascending: false })

    if (mappingsError) {
      console.warn('status_color_mappings table not available, using fallback:', mappingsError.message)
      mappings = getFallbackMappings()
    } else {
      mappings = dbMappings || getFallbackMappings()
    }

    // Get all partners with source_data and status
    const { data: partners, error: partnersError } = await supabase
      .from('partners')
      .select('id, brand_name, status, source_data')

    if (partnersError) {
      return ApiErrors.database(partnersError.message)
    }

    // Initialize bucket counts
    const distribution: Record<StatusColorBucket, number> = {
      healthy: 0,
      onboarding: 0,
      warning: 0,
      paused: 0,
      offboarding: 0,
      churned: 0,
      unknown: 0,
      'no-data': 0,
    }

    // Count partners per bucket based on latest weekly status
    // Exclude churned partners whose status is more than 2 weeks old
    const unmappedStatuses = new Map<string, number>()
    const twoWeeksAgo = new Date()
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)

    let includedCount = 0

    for (const partner of partners || []) {
      const sourceData = partner.source_data as Record<string, Record<string, Record<string, unknown>>> | null
      const { status: latestStatus, date: statusDate } = getLatestWeeklyStatus(sourceData)

      const bucket = matchStatusToBucket(latestStatus, mappings || [])

      // Skip old churned partners - they're not relevant to current health
      if (bucket === 'churned' && statusDate && statusDate < twoWeeksAgo) {
        continue
      }

      distribution[bucket]++
      includedCount++

      // Track unmapped statuses
      if (bucket === 'unknown' && latestStatus) {
        unmappedStatuses.set(latestStatus, (unmappedStatuses.get(latestStatus) || 0) + 1)
      }
    }

    // Convert unmapped to sorted array
    const unmapped = Array.from(unmappedStatuses.entries())
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count)

    // Build bucket metadata for UI
    const buckets = (['healthy', 'onboarding', 'warning', 'paused', 'offboarding', 'churned', 'unknown', 'no-data'] as StatusColorBucket[]).map(bucket => ({
      id: bucket,
      label: BUCKET_LABELS[bucket],
      color: BUCKET_COLORS[bucket],
      count: distribution[bucket],
    }))

    return apiSuccess({
      distribution,
      buckets,
      total: includedCount,
      totalPartners: partners?.length || 0, // Including old churned
      excludedChurned: (partners?.length || 0) - includedCount,
      unmappedCount: distribution.unknown,
      unmappedStatuses: unmapped.slice(0, 10), // Top 10 unmapped
      lastCalculated: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Health distribution fetch error:', error)
    return apiError('INTERNAL_ERROR', 'Failed to fetch health distribution', 500)
  }
}
