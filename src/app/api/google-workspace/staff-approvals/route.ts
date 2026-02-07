import { z } from 'zod'
import { requireRole } from '@/lib/auth/api-auth'
import { ROLES } from '@/lib/auth/roles'
import { apiSuccess, apiValidationError, ApiErrors } from '@/lib/api/response'
import { getAdminClient } from '@/lib/supabase/admin'

const QuerySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'ignored', 'resolved']).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
})

function isMissingTableError(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code
  return code === '42P01' || code === '42703' || code === 'PGRST204' || code === 'PGRST205'
}

export async function GET(request: Request) {
  const auth = await requireRole(ROLES.ADMIN)
  if (!auth.authenticated) {
    return auth.response
  }

  try {
    const { searchParams } = new URL(request.url)
    const parsed = QuerySchema.safeParse({
      status: searchParams.get('status') || undefined,
      limit: searchParams.get('limit') || undefined,
    })

    if (!parsed.success) {
      return apiValidationError(parsed.error)
    }

    const { status, limit } = parsed.data
    const supabase = getAdminClient()

    let query = supabase
      .from('staff_approval_queue')
      .select('id, source_user_id, email, full_name, title, org_unit_path, status, reason, suggested_at, last_seen_at, resolved_at')
      .eq('source', 'google_workspace')
      .order('last_seen_at', { ascending: false })
      .limit(limit)

    if (status) {
      query = query.eq('status', status)
    }

    const { data: rows, error } = await query
    if (error) {
      if (isMissingTableError(error)) {
        return apiSuccess({
          approvals: [],
          counts: {
            pending: 0,
            approved: 0,
            rejected: 0,
            ignored: 0,
            resolved: 0,
          },
          setup_required: true,
        })
      }
      console.error('Failed to fetch staff approval queue:', error)
      return ApiErrors.database()
    }

    const { data: allRows, error: countError } = await supabase
      .from('staff_approval_queue')
      .select('status')
      .eq('source', 'google_workspace')

    if (countError) {
      if (!isMissingTableError(countError)) {
        console.error('Failed to fetch staff approval queue counts:', countError)
      }
      return apiSuccess({
        approvals: rows || [],
        counts: {
          pending: 0,
          approved: 0,
          rejected: 0,
          ignored: 0,
          resolved: 0,
        },
      })
    }

    const counts = {
      pending: 0,
      approved: 0,
      rejected: 0,
      ignored: 0,
      resolved: 0,
    }

    for (const row of allRows || []) {
      if (row.status in counts) {
        counts[row.status as keyof typeof counts] += 1
      }
    }

    return apiSuccess({
      approvals: rows || [],
      counts,
    })
  } catch (error) {
    console.error('GET /api/google-workspace/staff-approvals error:', error)
    return ApiErrors.internal()
  }
}
