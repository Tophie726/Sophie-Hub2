import { requireRole } from '@/lib/auth/api-auth'
import { ROLES } from '@/lib/auth/roles'
import { getAdminClient } from '@/lib/supabase/admin'
import { apiSuccess, apiError } from '@/lib/api/response'

const supabase = getAdminClient()

/**
 * GET /api/suptask/sync/status
 *
 * Returns the most recent sync runs and overall ticket stats.
 * Admin only.
 */
export async function GET() {
  const auth = await requireRole(ROLES.ADMIN)
  if (!auth.authenticated) return auth.response

  try {
    // Latest 10 sync runs
    const { data: runs, error: runsErr } = await supabase
      .from('suptask_sync_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(10)

    if (runsErr) {
      return apiError('DATABASE_ERROR', runsErr.message, 500)
    }

    // Ticket stats
    const { count: totalTickets } = await supabase
      .from('suptask_tickets')
      .select('id', { count: 'exact', head: true })

    const { count: resolvedRequesterCount } = await supabase
      .from('suptask_tickets')
      .select('id', { count: 'exact', head: true })
      .not('resolved_requester_staff_id', 'is', null)

    const { count: resolvedAssigneeCount } = await supabase
      .from('suptask_tickets')
      .select('id', { count: 'exact', head: true })
      .not('resolved_assignee_staff_id', 'is', null)

    return apiSuccess({
      runs: runs || [],
      stats: {
        totalTickets: totalTickets ?? 0,
        resolvedRequesters: resolvedRequesterCount ?? 0,
        resolvedAssignees: resolvedAssigneeCount ?? 0,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return apiError('DATABASE_ERROR', message, 500)
  }
}
