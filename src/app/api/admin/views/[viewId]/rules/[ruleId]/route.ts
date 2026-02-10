import { requireRole } from '@/lib/auth/api-auth'
import { ROLES } from '@/lib/auth/roles'
import { getAdminClient } from '@/lib/supabase/admin'
import { apiSuccess, ApiErrors, apiValidationError } from '@/lib/api/response'
import { z } from 'zod'
import { logRuleChange } from '@/lib/audit/admin-audit'

const supabase = getAdminClient()

const UpdateRuleSchema = z.object({
  priority: z.number().int().min(0).max(1000).optional(),
  is_active: z.boolean().optional(),
})

interface RouteContext {
  params: Promise<{ viewId: string; ruleId: string }>
}

/**
 * PATCH /api/admin/views/[viewId]/rules/[ruleId]
 * Update an audience rule (priority, is_active).
 */
export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireRole(ROLES.ADMIN)
  if (!auth.authenticated) return auth.response

  try {
    const { viewId, ruleId } = await context.params
    const body = await request.json()
    const validation = UpdateRuleSchema.safeParse(body)
    if (!validation.success) return apiValidationError(validation.error)

    const updates = validation.data

    if (Object.keys(updates).length === 0) {
      return apiSuccess({ message: 'No updates provided' })
    }

    // Verify rule belongs to this view
    const { data: existing, error: fetchError } = await supabase
      .from('view_audience_rules')
      .select('id, view_id')
      .eq('id', ruleId)
      .single()

    if (fetchError || !existing) return ApiErrors.notFound('Audience rule')
    if (existing.view_id !== viewId) return ApiErrors.notFound('Audience rule')

    const { data: rule, error } = await supabase
      .from('view_audience_rules')
      .update(updates)
      .eq('id', ruleId)
      .select()
      .single()

    if (error) {
      console.error('Failed to update audience rule:', error)
      return ApiErrors.database(error.message)
    }

    logRuleChange('rule.update', auth.user.id, auth.user.email, ruleId, viewId, { updated_fields: Object.keys(updates) })

    return apiSuccess({ rule })
  } catch (error) {
    console.error('Audience rule update error:', error)
    return ApiErrors.internal()
  }
}

/**
 * DELETE /api/admin/views/[viewId]/rules/[ruleId]
 * Remove an audience rule.
 */
export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireRole(ROLES.ADMIN)
  if (!auth.authenticated) return auth.response

  try {
    const { viewId, ruleId } = await context.params

    // Verify rule belongs to this view
    const { data: existing, error: fetchError } = await supabase
      .from('view_audience_rules')
      .select('id, view_id')
      .eq('id', ruleId)
      .single()

    if (fetchError || !existing) return ApiErrors.notFound('Audience rule')
    if (existing.view_id !== viewId) return ApiErrors.notFound('Audience rule')

    const { error } = await supabase
      .from('view_audience_rules')
      .delete()
      .eq('id', ruleId)

    if (error) {
      console.error('Failed to delete audience rule:', error)
      return ApiErrors.database(error.message)
    }

    logRuleChange('rule.delete', auth.user.id, auth.user.email, ruleId, viewId)

    return new Response(null, { status: 204 })
  } catch (error) {
    console.error('Audience rule deletion error:', error)
    return ApiErrors.internal()
  }
}
