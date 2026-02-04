import { requireRole } from '@/lib/auth/api-auth'
import { ROLES } from '@/lib/auth/roles'
import { getAdminClient } from '@/lib/supabase/admin'
import { apiSuccess, apiError, ApiErrors } from '@/lib/api/response'

/**
 * GET /api/admin/status-mappings/unmapped
 * Discovers status strings in partner data that don't match any mapping (admin only)
 */
export async function GET() {
  const authResult = await requireRole(ROLES.ADMIN)
  if (!authResult.authenticated) return authResult.response

  try {
    const supabase = getAdminClient()

    // Get all active mappings
    const { data: mappings, error: mappingsError } = await supabase
      .from('status_color_mappings')
      .select('status_pattern')
      .eq('is_active', true)

    if (mappingsError) {
      return ApiErrors.database(mappingsError.message)
    }

    const patterns = (mappings || []).map(m => m.status_pattern.toLowerCase())

    // Get all partners with source_data
    const { data: partners, error: partnersError } = await supabase
      .from('partners')
      .select('source_data')
      .not('source_data', 'is', null)

    if (partnersError) {
      return ApiErrors.database(partnersError.message)
    }

    // Extract unique status values from source_data weekly columns
    const statusCounts = new Map<string, number>()

    for (const partner of partners || []) {
      const sourceData = partner.source_data as Record<string, Record<string, Record<string, unknown>>> | null
      if (!sourceData) continue

      // Iterate through connectors (e.g., gsheets)
      for (const connectorData of Object.values(sourceData)) {
        if (typeof connectorData !== 'object' || !connectorData) continue

        // Iterate through tabs
        for (const tabData of Object.values(connectorData)) {
          if (typeof tabData !== 'object' || !tabData) continue

          // Look for weekly columns
          for (const [columnName, value] of Object.entries(tabData)) {
            // Match columns like "1/5/26\nWeek 2"
            if (!columnName.match(/\d+\/\d+\/\d+[\s\n]+Week/i)) continue

            // Extract status value
            if (typeof value === 'string' && value.trim()) {
              const status = value.trim()
              statusCounts.set(status, (statusCounts.get(status) || 0) + 1)
            }
          }
        }
      }
    }

    // Filter to only unmapped statuses
    const unmapped: { status: string; count: number }[] = []

    statusCounts.forEach((count, status) => {
      const statusLower = status.toLowerCase()
      // Check if any pattern matches this status
      const isMatched = patterns.some(pattern => statusLower.includes(pattern))
      if (!isMatched) {
        unmapped.push({ status, count })
      }
    })

    // Sort by count descending (most common first)
    unmapped.sort((a, b) => b.count - a.count)

    return apiSuccess({
      unmapped,
      totalUnmappedPartners: unmapped.reduce((sum, u) => sum + u.count, 0),
      uniqueUnmappedStatuses: unmapped.length,
    })
  } catch (error) {
    console.error('Unmapped statuses fetch error:', error)
    return apiError('INTERNAL_ERROR', 'Failed to fetch unmapped statuses', 500)
  }
}
