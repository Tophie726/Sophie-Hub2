import { z } from 'zod'
import { requireAuth } from '@/lib/auth/api-auth'
import { isTrueAdmin } from '@/lib/auth/admin-access'
import { getAdminClient } from '@/lib/supabase/admin'
import { apiSuccess, ApiErrors, apiValidationError } from '@/lib/api/response'
import { logModuleReorder } from '@/lib/audit/admin-audit'

const ReorderSchema = z.object({
  order: z.array(
    z.object({
      module_id: z.string().uuid(),
      sort_order: z.number().int().min(0),
    })
  ).min(1),
})

interface RouteContext {
  params: Promise<{ viewId: string }>
}

/**
 * PATCH /api/admin/views/[viewId]/modules/reorder
 *
 * Batch-update sort_order for module assignments in a view.
 * HR-7: isTrueAdmin gate (excludes operations_admin).
 */
export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAuth()
  if (!auth.authenticated) return auth.response

  // HR-7: isTrueAdmin gate (excludes operations_admin)
  if (!isTrueAdmin(auth.user.staffRole, auth.user.email)) {
    return ApiErrors.forbidden('Module reordering is restricted to full admins')
  }

  try {
    const { viewId } = await context.params
    const body = await request.json()
    const validation = ReorderSchema.safeParse(body)
    if (!validation.success) return apiValidationError(validation.error)

    const { order } = validation.data
    const supabase = getAdminClient()

    const { data: view, error: viewError } = await supabase
      .from('view_profiles')
      .select('id, slug')
      .eq('id', viewId)
      .single()

    if (viewError || !view) return ApiErrors.notFound('View profile')

    // Atomic reorder via RPC — all updates in a single transaction.
    // The function validates membership and raises on invalid module_ids.
    const { error: rpcError } = await supabase.rpc('reorder_view_modules', {
      p_view_id: viewId,
      p_order: order,
    })

    if (rpcError) {
      console.error('Failed to reorder modules:', rpcError.message)
      return ApiErrors.database(rpcError.message)
    }

    logModuleReorder(auth.user.id, auth.user.email, viewId, view.slug, order)

    return apiSuccess({ reordered: order.length })
  } catch (error) {
    console.error('Module reorder error:', error)
    return ApiErrors.internal()
  }
}
