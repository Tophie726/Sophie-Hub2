/**
 * /api/admin/views/[viewId]/sections
 *
 * View-scoped section management with isTrueAdmin gate.
 * POST: Create a section (validates dashboard belongs to view)
 * PATCH: Reorder sections (validates dashboard belongs to view)
 */

import { z } from 'zod'
import { requireTrueAdmin } from '@/lib/auth/api-auth'
import { getAdminClient } from '@/lib/supabase/admin'
import { apiSuccess, ApiErrors, apiValidationError } from '@/lib/api/response'
import { logSectionCreate, logSectionReorder } from '@/lib/audit/admin-audit'

const CreateSectionSchema = z.object({
  dashboardId: z.string().uuid(),
  title: z.string().min(1).max(200),
  sort_order: z.number().int().min(0).optional(),
})

const ReorderSectionsSchema = z.object({
  dashboardId: z.string().uuid(),
  order: z.array(z.object({
    id: z.string().uuid(),
    sort_order: z.number().int().min(0),
  })),
})

interface RouteContext {
  params: Promise<{ viewId: string }>
}

/** Verify a dashboard is assigned to a module in this view */
async function validateDashboardInView(
  supabase: ReturnType<typeof getAdminClient>,
  viewId: string,
  dashboardId: string,
) {
  const { data } = await supabase
    .from('view_profile_modules')
    .select('id')
    .eq('view_id', viewId)
    .eq('dashboard_id', dashboardId)
    .maybeSingle()

  return !!data
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireTrueAdmin()
  if (!auth.authenticated) return auth.response

  try {
    const { viewId } = await context.params
    const supabase = getAdminClient()
    const body = await request.json()
    const validation = CreateSectionSchema.safeParse(body)
    if (!validation.success) return apiValidationError(validation.error)

    const { dashboardId, title } = validation.data

    if (!(await validateDashboardInView(supabase, viewId, dashboardId))) {
      return ApiErrors.notFound('Dashboard in this view')
    }

    // Auto-assign sort_order if not provided
    let sortOrder = validation.data.sort_order
    if (sortOrder === undefined) {
      const { data: existing } = await supabase
        .from('dashboard_sections')
        .select('sort_order')
        .eq('dashboard_id', dashboardId)
        .order('sort_order', { ascending: false })
        .limit(1)

      sortOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0
    }

    const { data: section, error } = await supabase
      .from('dashboard_sections')
      .insert({
        dashboard_id: dashboardId,
        title,
        sort_order: sortOrder,
      })
      .select()
      .single()

    if (error) return ApiErrors.database()

    logSectionCreate(auth.user.id, auth.user.email, viewId, dashboardId, section.id)

    return apiSuccess({ section }, 201)
  } catch {
    return ApiErrors.internal()
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireTrueAdmin()
  if (!auth.authenticated) return auth.response

  try {
    const { viewId } = await context.params
    const supabase = getAdminClient()
    const body = await request.json()
    const validation = ReorderSectionsSchema.safeParse(body)
    if (!validation.success) return apiValidationError(validation.error)

    const { dashboardId, order } = validation.data

    if (!(await validateDashboardInView(supabase, viewId, dashboardId))) {
      return ApiErrors.notFound('Dashboard in this view')
    }

    const updates = order.map((item) =>
      supabase
        .from('dashboard_sections')
        .update({ sort_order: item.sort_order })
        .eq('id', item.id)
        .eq('dashboard_id', dashboardId)
    )

    await Promise.all(updates)

    logSectionReorder(auth.user.id, auth.user.email, viewId, dashboardId, order)

    return apiSuccess({ reordered: true })
  } catch {
    return ApiErrors.internal()
  }
}
