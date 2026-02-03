import { getAdminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth/api-auth'
import { apiSuccess, ApiErrors } from '@/lib/api/response'

const supabase = getAdminClient()

/**
 * GET /api/partners/[id]
 *
 * Get a single partner with assignments, ASINs, and recent weekly statuses.
 * Runs 4 queries in parallel for performance.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth()
  if (!auth.authenticated) return auth.response

  try {
    const { id } = await params

    // Run all queries in parallel
    const [partnerResult, assignmentsResult, asinsResult, statusesResult] = await Promise.all([
      supabase
        .from('partners')
        .select('*')
        .eq('id', id)
        .single(),
      supabase
        .from('partner_assignments')
        .select('id, assignment_role, is_primary, assigned_at, staff:staff_id(id, full_name, email, role)')
        .eq('partner_id', id)
        .is('unassigned_at', null)
        .order('assignment_role'),
      supabase
        .from('asins')
        .select('id, asin_code, title, status, is_parent')
        .eq('partner_id', id)
        .order('asin_code'),
      supabase
        .from('weekly_statuses')
        .select('id, week_start_date, status, notes')
        .eq('partner_id', id)
        .order('week_start_date', { ascending: false })
        .limit(156), // 3 years of weekly data for the Weekly Status tab
    ])

    if (partnerResult.error) {
      if (partnerResult.error.code === 'PGRST116') {
        return ApiErrors.notFound('Partner')
      }
      console.error('Error fetching partner:', partnerResult.error)
      return ApiErrors.database(partnerResult.error.message)
    }

    return apiSuccess({
      partner: {
        ...partnerResult.data,
        assignments: assignmentsResult.data || [],
        asins: asinsResult.data || [],
        recent_statuses: statusesResult.data || [],
      },
    })
  } catch (error) {
    console.error('Error in GET /api/partners/[id]:', error)
    return ApiErrors.internal()
  }
}
