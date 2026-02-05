import { requireAuth } from '@/lib/auth/api-auth'
import { apiSuccess, ApiErrors } from '@/lib/api/response'
import { getAdminClient } from '@/lib/supabase/admin'

const supabase = getAdminClient()

export interface FieldLineageInfo {
  targetField: string
  sourceColumn: string
  tabName: string
  sheetName: string
  dataSourceId: string
}

/**
 * GET /api/partners/field-lineage
 *
 * Returns the mapping lineage for all partner fields.
 * Shows which sheet, tab, and column each field was mapped from.
 */
export async function GET() {
  const auth = await requireAuth()
  if (!auth.authenticated) return auth.response

  try {
    // Query the column mappings with joins to get full lineage
    // Foreign key is tab_mapping_id -> tab_mappings, and data_source_id -> data_sources
    const { data, error } = await supabase
      .from('column_mappings')
      .select(`
        target_field,
        source_column,
        tab_mapping:tab_mapping_id (
          tab_name,
          primary_entity,
          data_source:data_source_id (
            id,
            name
          )
        )
      `)
      .not('target_field', 'is', null)

    if (error) {
      console.error('Error fetching field lineage:', error)
      return ApiErrors.database(error.message)
    }

    // Transform to a clean structure, filtering for partners
    const lineage: Record<string, FieldLineageInfo> = {}

    for (const row of data || []) {
      const tabMapping = row.tab_mapping as {
        tab_name: string
        primary_entity: string
        data_source: { id: string; name: string }
      } | null

      // Skip if join failed or not a partner mapping
      if (!tabMapping) continue
      if (tabMapping.primary_entity !== 'partners') continue
      if (!row.target_field) continue

      lineage[row.target_field] = {
        targetField: row.target_field,
        sourceColumn: row.source_column,
        tabName: tabMapping.tab_name,
        sheetName: tabMapping.data_source?.name || 'Unknown',
        dataSourceId: tabMapping.data_source?.id || '',
      }
    }

    return apiSuccess({ lineage })
  } catch (error) {
    console.error('Error in GET /api/partners/field-lineage:', error)
    return ApiErrors.internal()
  }
}
