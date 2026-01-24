import { getAdminClient } from '@/lib/supabase/admin'
import { requirePermission } from '@/lib/auth/api-auth'
import { apiSuccess, apiError, ApiErrors, ErrorCodes } from '@/lib/api/response'
import { z } from 'zod'

const supabase = getAdminClient()

// Query params validation
const QuerySchema = z.object({
  data_source_id: z.string().uuid().optional(),
  tab_mapping_id: z.string().uuid().optional(),
  status: z.enum(['running', 'completed', 'failed']).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
})

/**
 * GET /api/sync/runs
 *
 * List sync runs with optional filtering.
 *
 * Query params:
 * - data_source_id: UUID - Filter by data source
 * - tab_mapping_id: UUID - Filter by tab mapping
 * - status: 'running' | 'completed' | 'failed' - Filter by status
 * - limit: number (1-100, default 20)
 * - offset: number (default 0)
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     runs: SyncRun[],
 *     total: number,
 *     has_more: boolean
 *   }
 * }
 */
export async function GET(request: Request) {
  const auth = await requirePermission('data-enrichment:read')
  if (!auth.authenticated) return auth.response

  try {
    const { searchParams } = new URL(request.url)
    const params = {
      data_source_id: searchParams.get('data_source_id') || undefined,
      tab_mapping_id: searchParams.get('tab_mapping_id') || undefined,
      status: searchParams.get('status') || undefined,
      limit: searchParams.get('limit') || undefined,
      offset: searchParams.get('offset') || undefined,
    }

    // Validate params
    const validation = QuerySchema.safeParse(params)
    if (!validation.success) {
      return apiError(ErrorCodes.VALIDATION_ERROR, validation.error.message, 400)
    }

    const { data_source_id, tab_mapping_id, status, limit, offset } = validation.data

    // Build query
    let query = supabase
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
          name
        ),
        tab_mappings (
          id,
          tab_name
        )
      `,
        { count: 'exact' }
      )
      .order('started_at', { ascending: false })

    // Apply filters
    if (data_source_id) {
      query = query.eq('data_source_id', data_source_id)
    }
    if (tab_mapping_id) {
      query = query.eq('tab_mapping_id', tab_mapping_id)
    }
    if (status) {
      query = query.eq('status', status)
    }

    // Pagination
    query = query.range(offset, offset + limit - 1)

    const { data: runs, error, count } = await query

    if (error) {
      console.error('Error fetching sync runs:', error)
      return ApiErrors.database(error.message)
    }

    return apiSuccess({
      runs: runs || [],
      total: count || 0,
      has_more: (count || 0) > offset + limit,
    })
  } catch (error) {
    console.error('Error in GET /api/sync/runs:', error)
    return ApiErrors.internal()
  }
}
