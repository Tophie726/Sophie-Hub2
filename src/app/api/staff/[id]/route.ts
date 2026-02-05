import { getAdminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth/api-auth'
import { apiSuccess, ApiErrors } from '@/lib/api/response'
import { deduplicateLineage, type FieldLineageRow } from '@/types/lineage'

const supabase = getAdminClient()

/**
 * GET /api/staff/[id]
 *
 * Get a single staff member with partner assignments.
 * Runs queries in parallel for performance.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth()
  if (!auth.authenticated) return auth.response

  try {
    const { id } = await params

    const [staffResult, assignmentsResult, lineageResult] = await Promise.all([
      supabase
        .from('staff')
        .select('*')
        .eq('id', id)
        .single(),
      supabase
        .from('partner_assignments')
        .select('id, assignment_role, is_primary, partner:partner_id(id, brand_name, status)')
        .eq('staff_id', id)
        .is('unassigned_at', null)
        .order('assignment_role'),
      supabase
        .from('field_lineage')
        .select('field_name, source_type, source_ref, previous_value, new_value, changed_at, sync_run_id')
        .eq('entity_type', 'staff')
        .eq('entity_id', id)
        .order('changed_at', { ascending: false }),
    ])

    if (staffResult.error) {
      if (staffResult.error.code === 'PGRST116') {
        return ApiErrors.notFound('Staff member')
      }
      console.error('Error fetching staff:', staffResult.error)
      return ApiErrors.database(staffResult.error.message)
    }

    // Deduplicate lineage to get most recent per field
    const lineage = deduplicateLineage((lineageResult.data || []) as FieldLineageRow[])

    return apiSuccess({
      staff: {
        ...staffResult.data,
        assigned_partners: assignmentsResult.data || [],
        lineage,
      },
    })
  } catch (error) {
    console.error('Error in GET /api/staff/[id]:', error)
    return ApiErrors.internal()
  }
}
