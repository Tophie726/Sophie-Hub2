/**
 * /api/admin/views/[viewId]/widgets
 *
 * View-scoped widget CRUD with isTrueAdmin gate.
 * POST: Create a widget
 * PATCH: Update a widget (position, config, title)
 * DELETE: Remove a widget
 *
 * All operations validate that dashboardId belongs to a module in this view.
 */

import { z } from 'zod'
import { requireTrueAdmin } from '@/lib/auth/api-auth'
import { getAdminClient } from '@/lib/supabase/admin'
import { apiSuccess, apiError, ApiErrors, apiValidationError } from '@/lib/api/response'
import { logWidgetCreate, logWidgetUpdate, logWidgetDelete } from '@/lib/audit/admin-audit'

const VALID_WIDGET_TYPES = ['metric', 'chart', 'table', 'text', 'ai_text', 'smart_text'] as const

const CreateWidgetSchema = z.object({
  dashboardId: z.string().uuid(),
  section_id: z.string().uuid(),
  widget_type: z.enum(VALID_WIDGET_TYPES),
  title: z.string().min(1).max(200),
  grid_column: z.number().int().min(1).optional().default(1),
  grid_row: z.number().int().min(1).optional().default(1),
  col_span: z.number().int().min(1).max(8).optional().default(1),
  row_span: z.number().int().min(1).max(4).optional().default(1),
  sort_order: z.number().int().min(0).optional(),
  config: z.record(z.string(), z.unknown()).default({}),
})

const UpdateWidgetSchema = z.object({
  dashboardId: z.string().uuid(),
  widget_id: z.string().uuid(),
  title: z.string().min(1).max(200).optional(),
  grid_column: z.number().int().min(1).optional(),
  grid_row: z.number().int().min(1).optional(),
  col_span: z.number().int().min(1).max(8).optional(),
  row_span: z.number().int().min(1).max(4).optional(),
  sort_order: z.number().int().min(0).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
})

const DeleteWidgetSchema = z.object({
  dashboardId: z.string().uuid(),
  widget_id: z.string().uuid(),
})

interface RouteContext {
  params: Promise<{ viewId: string }>
}

function checkConfigSize(config: Record<string, unknown>): boolean {
  try {
    return JSON.stringify(config).length <= 10_000
  } catch {
    return false
  }
}

/** Verify dashboard belongs to a module assignment in this view */
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
    const validation = CreateWidgetSchema.safeParse(body)
    if (!validation.success) return apiValidationError(validation.error)

    const { dashboardId, ...widgetData } = validation.data

    if (!checkConfigSize(widgetData.config)) {
      return apiError('VALIDATION_ERROR', 'Widget config exceeds maximum size (10KB)', 400)
    }

    if (!(await validateDashboardInView(supabase, viewId, dashboardId))) {
      return ApiErrors.notFound('Dashboard in this view')
    }

    // Verify section belongs to this dashboard
    const { data: section } = await supabase
      .from('dashboard_sections')
      .select('id')
      .eq('id', widgetData.section_id)
      .eq('dashboard_id', dashboardId)
      .maybeSingle()

    if (!section) return ApiErrors.notFound('Section in this dashboard')

    // Auto-assign sort_order
    let sortOrder = widgetData.sort_order
    if (sortOrder === undefined) {
      const { data: existing } = await supabase
        .from('dashboard_widgets')
        .select('sort_order')
        .eq('section_id', widgetData.section_id)
        .order('sort_order', { ascending: false })
        .limit(1)

      sortOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0
    }

    const { data: widget, error } = await supabase
      .from('dashboard_widgets')
      .insert({
        dashboard_id: dashboardId,
        section_id: widgetData.section_id,
        widget_type: widgetData.widget_type,
        title: widgetData.title,
        grid_column: widgetData.grid_column,
        grid_row: widgetData.grid_row,
        col_span: widgetData.col_span,
        row_span: widgetData.row_span,
        sort_order: sortOrder,
        config: widgetData.config,
      })
      .select()
      .single()

    if (error) return ApiErrors.database()

    logWidgetCreate(auth.user.id, auth.user.email, viewId, dashboardId, widget.id)

    return apiSuccess({ widget }, 201)
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
    const validation = UpdateWidgetSchema.safeParse(body)
    if (!validation.success) return apiValidationError(validation.error)

    const { dashboardId, widget_id, ...updates } = validation.data

    if (updates.config && !checkConfigSize(updates.config)) {
      return apiError('VALIDATION_ERROR', 'Widget config exceeds maximum size (10KB)', 400)
    }

    if (!(await validateDashboardInView(supabase, viewId, dashboardId))) {
      return ApiErrors.notFound('Dashboard in this view')
    }

    const { data: widget, error } = await supabase
      .from('dashboard_widgets')
      .update(updates)
      .eq('id', widget_id)
      .eq('dashboard_id', dashboardId)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') return ApiErrors.notFound('Widget')
      return ApiErrors.database()
    }

    logWidgetUpdate(auth.user.id, auth.user.email, viewId, dashboardId, widget_id)

    return apiSuccess({ widget })
  } catch {
    return ApiErrors.internal()
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = await requireTrueAdmin()
  if (!auth.authenticated) return auth.response

  try {
    const { viewId } = await context.params
    const supabase = getAdminClient()
    const body = await request.json()
    const validation = DeleteWidgetSchema.safeParse(body)
    if (!validation.success) return apiValidationError(validation.error)

    const { dashboardId, widget_id } = validation.data

    if (!(await validateDashboardInView(supabase, viewId, dashboardId))) {
      return ApiErrors.notFound('Dashboard in this view')
    }

    const { error } = await supabase
      .from('dashboard_widgets')
      .delete()
      .eq('id', widget_id)
      .eq('dashboard_id', dashboardId)

    if (error) return ApiErrors.database()

    logWidgetDelete(auth.user.id, auth.user.email, viewId, dashboardId, widget_id)

    return apiSuccess({ deleted: true })
  } catch {
    return ApiErrors.internal()
  }
}
