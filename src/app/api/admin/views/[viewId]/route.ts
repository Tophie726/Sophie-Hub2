import { requireRole } from '@/lib/auth/api-auth'
import { ROLES } from '@/lib/auth/roles'
import { getAdminClient } from '@/lib/supabase/admin'
import { apiSuccess, ApiErrors, apiValidationError } from '@/lib/api/response'
import { z } from 'zod'
import { logViewChange } from '@/lib/audit/admin-audit'

const supabase = getAdminClient()

const UpdateViewSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  is_default: z.boolean().optional(),
  is_active: z.boolean().optional(),
})

interface RouteContext {
  params: Promise<{ viewId: string }>
}

/**
 * GET /api/admin/views/[viewId]
 * Get a single view profile with audience rules and module assignments.
 */
export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireRole(ROLES.ADMIN)
  if (!auth.authenticated) return auth.response

  try {
    const { viewId } = await context.params

    const { data: view, error } = await supabase
      .from('view_profiles')
      .select(`
        *,
        view_audience_rules(id, tier, target_type, target_id, priority, is_active, created_at),
        view_profile_modules(id, module_id, dashboard_id, sort_order, config)
      `)
      .eq('id', viewId)
      .single()

    if (error || !view) {
      return ApiErrors.notFound('View profile')
    }

    return apiSuccess({ view })
  } catch (error) {
    console.error('View profile fetch error:', error)
    return ApiErrors.internal()
  }
}

/**
 * PATCH /api/admin/views/[viewId]
 * Update a view profile.
 */
export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireRole(ROLES.ADMIN)
  if (!auth.authenticated) return auth.response

  try {
    const { viewId } = await context.params
    const body = await request.json()
    const validation = UpdateViewSchema.safeParse(body)
    if (!validation.success) return apiValidationError(validation.error)

    const updates = validation.data

    if (Object.keys(updates).length === 0) {
      return apiSuccess({ message: 'No updates provided' })
    }

    const { data: view, error } = await supabase
      .from('view_profiles')
      .update(updates)
      .eq('id', viewId)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') return ApiErrors.notFound('View profile')
      console.error('Failed to update view profile:', error)
      return ApiErrors.database(error.message)
    }

    logViewChange('view.update', auth.user.id, auth.user.email, viewId, view.slug, { updated_fields: Object.keys(updates) })

    return apiSuccess({ view })
  } catch (error) {
    console.error('View profile update error:', error)
    return ApiErrors.internal()
  }
}

/**
 * DELETE /api/admin/views/[viewId]
 * Delete a view profile. Cascades to rules and module assignments.
 */
export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireRole(ROLES.ADMIN)
  if (!auth.authenticated) return auth.response

  try {
    const { viewId } = await context.params

    // Verify it exists
    const { data: existing, error: fetchError } = await supabase
      .from('view_profiles')
      .select('id, slug')
      .eq('id', viewId)
      .single()

    if (fetchError || !existing) {
      return ApiErrors.notFound('View profile')
    }

    const { error } = await supabase
      .from('view_profiles')
      .delete()
      .eq('id', viewId)

    if (error) {
      console.error('Failed to delete view profile:', error)
      return ApiErrors.database(error.message)
    }

    logViewChange('view.delete', auth.user.id, auth.user.email, viewId, existing.slug)

    return new Response(null, { status: 204 })
  } catch (error) {
    console.error('View profile deletion error:', error)
    return ApiErrors.internal()
  }
}
