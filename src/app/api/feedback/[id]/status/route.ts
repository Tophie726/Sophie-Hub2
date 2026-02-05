import { getAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth/api-auth'
import { apiSuccess, ApiErrors } from '@/lib/api/response'
import { ROLES } from '@/lib/auth/roles'
import { z } from 'zod'

const supabase = getAdminClient()

const StatusUpdateSchema = z.object({
  status: z.enum(['new', 'reviewed', 'in_progress', 'resolved', 'wont_fix']),
})

/**
 * PATCH /api/feedback/[id]/status
 * Update feedback status (admin only)
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(ROLES.ADMIN)
  if (!auth.authenticated) return auth.response

  const { id } = await params

  try {
    const body = await request.json()
    const validation = StatusUpdateSchema.safeParse(body)

    if (!validation.success) {
      return ApiErrors.validation(validation.error.errors.map(e => e.message).join(', '))
    }

    const { status } = validation.data

    // Set resolved_at timestamp if status is resolved or wont_fix
    const resolved_at = ['resolved', 'wont_fix'].includes(status)
      ? new Date().toISOString()
      : null

    const { data, error } = await supabase
      .from('feedback')
      .update({
        status,
        resolved_at,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating feedback status:', error)
      return ApiErrors.database(error.message)
    }

    if (!data) {
      return ApiErrors.notFound('Feedback')
    }

    return apiSuccess({ feedback: data })
  } catch (error) {
    console.error('Error in PATCH /api/feedback/[id]/status:', error)
    return ApiErrors.internal()
  }
}
