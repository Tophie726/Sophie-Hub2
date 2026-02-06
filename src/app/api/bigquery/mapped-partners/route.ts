/**
 * GET /api/bigquery/mapped-partners
 *
 * Returns partners that have a BigQuery mapping in entity_external_ids.
 * Lightweight endpoint for the dashboard partner picker.
 */

import { getAdminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth/api-auth'
import { apiSuccess, ApiErrors } from '@/lib/api/response'

const supabase = getAdminClient()

export async function GET() {
  const auth = await requireAuth()
  if (!auth.authenticated) return auth.response

  try {
    // Fetch all BigQuery mappings
    const { data: mappings, error: mappingError } = await supabase
      .from('entity_external_ids')
      .select('entity_id, external_id')
      .eq('entity_type', 'partners')
      .eq('source', 'bigquery')

    if (mappingError) {
      return ApiErrors.database()
    }

    if (!mappings || mappings.length === 0) {
      return apiSuccess({ partners: [] })
    }

    // Fetch partner names for these IDs (batch in chunks of 500)
    const partnerIds = mappings.map(m => m.entity_id)
    const partnerNames: Record<string, string> = {}

    for (let i = 0; i < partnerIds.length; i += 500) {
      const chunk = partnerIds.slice(i, i + 500)
      const { data: partners } = await supabase
        .from('partners')
        .select('id, brand_name')
        .in('id', chunk)

      if (partners) {
        for (const p of partners) {
          partnerNames[p.id] = p.brand_name
        }
      }
    }

    // Build response
    const result = mappings
      .map(m => ({
        id: m.entity_id,
        brand_name: partnerNames[m.entity_id] || 'Unknown',
        bigquery_client_name: m.external_id,
      }))
      .filter(p => p.brand_name !== 'Unknown')
      .sort((a, b) => a.brand_name.localeCompare(b.brand_name))

    return apiSuccess({ partners: result })
  } catch {
    return ApiErrors.internal()
  }
}
