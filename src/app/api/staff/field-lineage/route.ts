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
 * GET /api/staff/field-lineage
 *
 * Returns mapping lineage for staff fields.
 */
export async function GET() {
  const auth = await requireAuth()
  if (!auth.authenticated) return auth.response

  try {
    const { data, error } = await supabase
      .from('column_mappings')
      .select(`
        target_field,
        source_column,
        source_column_index,
        tab_mapping:tab_mapping_id (
          tab_name,
          primary_entity,
          is_active,
          data_source:data_source_id (
            id,
            name
          )
        )
      `)
      .not('target_field', 'is', null)

    if (error) {
      console.error('Error fetching staff field lineage:', error)
      return ApiErrors.database()
    }

    const lineage: Record<string, FieldLineageInfo> = {}

    for (const row of data || []) {
      const tabMappingRaw = row.tab_mapping as unknown as {
        tab_name: string
        primary_entity: string
        is_active: boolean
        data_source: { id: string; name: string } | null
      } | null

      const sourceColumnIndex = (row as { source_column_index?: number }).source_column_index

      if (!tabMappingRaw) continue
      if (tabMappingRaw.primary_entity !== 'staff') continue
      if (!tabMappingRaw.is_active) continue
      if (!row.target_field) continue

      const sourceColumn = row.source_column && row.source_column.trim() !== ''
        ? row.source_column
        : sourceColumnIndex !== null && sourceColumnIndex !== undefined
          ? `Column ${String.fromCharCode(65 + sourceColumnIndex)}`
          : 'Unknown'

      lineage[row.target_field] = {
        targetField: row.target_field,
        sourceColumn,
        tabName: tabMappingRaw.tab_name || 'Unknown Tab',
        sheetName: tabMappingRaw.data_source?.name || 'Unknown',
        dataSourceId: tabMappingRaw.data_source?.id || '',
      }
    }

    return apiSuccess({ lineage })
  } catch (error) {
    console.error('Error in GET /api/staff/field-lineage:', error)
    return ApiErrors.internal()
  }
}
