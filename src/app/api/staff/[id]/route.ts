import { getAdminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth/api-auth'
import { apiSuccess, ApiErrors } from '@/lib/api/response'

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

    const [staffResult, assignmentsResult] = await Promise.all([
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
    ])

    if (staffResult.error) {
      if (staffResult.error.code === 'PGRST116') {
        return ApiErrors.notFound('Staff member')
      }
      console.error('Error fetching staff:', staffResult.error)
      return ApiErrors.database(staffResult.error.message)
    }

    return apiSuccess({
      staff: {
        ...staffResult.data,
        assigned_partners: assignmentsResult.data || [],
      },
    })
  } catch (error) {
    console.error('Error in GET /api/staff/[id]:', error)
    return ApiErrors.internal()
  }
}
