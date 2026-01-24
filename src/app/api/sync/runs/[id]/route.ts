import { getAdminClient } from '@/lib/supabase/admin'
import { requirePermission } from '@/lib/auth/api-auth'
import { apiSuccess, ApiErrors } from '@/lib/api/response'

const supabase = getAdminClient()

/**
 * GET /api/sync/runs/[id]
 *
 * Get detailed information about a specific sync run.
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     run: SyncRun & { data_source, tab_mapping }
 *   }
 * }
 */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requirePermission('data-enrichment:read')
  if (!auth.authenticated) return auth.response

  try {
    const { data: run, error } = await supabase
      .from('sync_runs')
      .select(
        `
        id,
        data_source_id,
        tab_mapping_id,
        status,
        started_at,
        completed_at,
        rows_processed,
        rows_created,
        rows_updated,
        rows_skipped,
        errors,
        triggered_by,
        created_at,
        data_sources (
          id,
          name,
          type
        ),
        tab_mappings (
          id,
          tab_name,
          primary_entity
        )
      `
      )
      .eq('id', params.id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return ApiErrors.notFound('Sync run')
      }
      console.error('Error fetching sync run:', error)
      return ApiErrors.database(error.message)
    }

    return apiSuccess({ run })
  } catch (error) {
    console.error('Error in GET /api/sync/runs/[id]:', error)
    return ApiErrors.internal()
  }
}
