import { requireRole } from '@/lib/auth/api-auth'
import { ROLES } from '@/lib/auth/roles'
import { getAdminClient } from '@/lib/supabase/admin'
import { apiSuccess, apiError, ApiErrors } from '@/lib/api/response'

/**
 * GET /api/admin/status-mappings/all-statuses
 * Returns ALL unique weekly status values from partner data with their assigned colors
 */
export async function GET() {
  const authResult = await requireRole(ROLES.ADMIN)
  if (!authResult.authenticated) return authResult.response

  try {
    const supabase = getAdminClient()

    // Get all mappings (status_pattern is now exact status value)
    const { data: mappings, error: mappingsError } = await supabase
      .from('status_color_mappings')
      .select('id, status_pattern, bucket, priority, is_active')
      .eq('is_active', true)

    if (mappingsError) {
      return ApiErrors.database(mappingsError.message)
    }

    // Build a map of exact status -> color assignment
    const statusToMapping = new Map<string, { id: string; bucket: string }>()
    for (const m of mappings || []) {
      // Store by lowercase for case-insensitive lookup
      statusToMapping.set(m.status_pattern.toLowerCase(), { id: m.id, bucket: m.bucket })
    }

    // Get ALL partners with source_data (we need complete picture)
    // For performance, still limit but higher than before
    const { data: partners, error: partnersError } = await supabase
      .from('partners')
      .select('source_data')
      .not('source_data', 'is', null)
      .limit(500)

    if (partnersError) {
      return ApiErrors.database(partnersError.message)
    }

    // Extract unique status values from source_data weekly columns
    const statusCounts = new Map<string, number>()

    for (const partner of partners || []) {
      const sourceData = partner.source_data as Record<string, Record<string, Record<string, unknown>>> | null
      if (!sourceData) continue

      for (const connectorData of Object.values(sourceData)) {
        if (typeof connectorData !== 'object' || !connectorData) continue

        for (const tabData of Object.values(connectorData)) {
          if (typeof tabData !== 'object' || !tabData) continue

          for (const [columnName, value] of Object.entries(tabData)) {
            // Match weekly columns like "1/5/26\nWeek 2"
            if (!columnName.match(/\d+\/\d+\/\d+[\s\n]+Week/i)) continue

            if (typeof value === 'string' && value.trim()) {
              const status = value.trim()
              statusCounts.set(status, (statusCounts.get(status) || 0) + 1)
            }
          }
        }
      }
    }

    // Build response: categorized vs uncategorized
    const categorized: { status: string; count: number; bucket: string; mappingId: string }[] = []
    const uncategorized: { status: string; count: number }[] = []

    statusCounts.forEach((count, status) => {
      const mapping = statusToMapping.get(status.toLowerCase())
      if (mapping) {
        categorized.push({ status, count, bucket: mapping.bucket, mappingId: mapping.id })
      } else {
        uncategorized.push({ status, count })
      }
    })

    // Sort by count descending
    categorized.sort((a, b) => b.count - a.count)
    uncategorized.sort((a, b) => b.count - a.count)

    return apiSuccess({
      categorized,
      uncategorized,
      totalStatuses: statusCounts.size,
      totalCategorized: categorized.length,
      totalUncategorized: uncategorized.length,
    }, 200, {
      'Cache-Control': 'private, max-age=60, stale-while-revalidate=120',
    })
  } catch (error) {
    console.error('All statuses fetch error:', error)
    return apiError('INTERNAL_ERROR', 'Failed to fetch statuses', 500)
  }
}
