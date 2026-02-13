/**
 * POST /api/admin/views/[viewId]/fork-dashboard
 *
 * Fork a template dashboard for per-view customization.
 * Auth: isTrueAdmin (excludes operations_admin).
 *
 * Fork decision:
 *   (a) dashboard_id IS NULL → find module template, clone it
 *   (b) dashboard IS NOT NULL AND is_template = true → clone it
 *   (c) dashboard IS NOT NULL AND is_template = false → no-op
 *
 * Returns 422 if no template dashboard exists for the module.
 */

import { z } from 'zod'
import { requireTrueAdmin } from '@/lib/auth/api-auth'
import { getAdminClient } from '@/lib/supabase/admin'
import { apiSuccess, apiError, ApiErrors, apiValidationError } from '@/lib/api/response'
import { logDashboardFork } from '@/lib/audit/admin-audit'

const ForkSchema = z.object({
  moduleAssignmentId: z.string().uuid(),
})

interface RouteContext {
  params: Promise<{ viewId: string }>
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireTrueAdmin()
  if (!auth.authenticated) return auth.response

  try {
    const { viewId } = await context.params
    const supabase = getAdminClient()
    const body = await request.json()
    const validation = ForkSchema.safeParse(body)
    if (!validation.success) return apiValidationError(validation.error)

    // Look up assignment with view_id binding (P1-2: cross-view safety)
    const { data: assignment, error: assignmentError } = await supabase
      .from('view_profile_modules')
      .select('id, dashboard_id, module_id')
      .eq('id', validation.data.moduleAssignmentId)
      .eq('view_id', viewId)
      .single()

    if (assignmentError || !assignment) {
      return ApiErrors.notFound('Module assignment')
    }

    // Determine if fork is needed (P1-1: is_template check, not nullability)
    let needsFork = false
    let templateDashboardId: string | null = null

    if (!assignment.dashboard_id) {
      // Case (a): no dashboard assigned at all
      needsFork = true
    } else {
      const { data: dashboard, error: dashError } = await supabase
        .from('dashboards')
        .select('id, is_template')
        .eq('id', assignment.dashboard_id)
        .single()

      if (!dashboard || dashError) {
        // Orphan reference, treat like null
        needsFork = true
      } else if (dashboard.is_template) {
        // Case (b): shared template, must fork
        needsFork = true
        templateDashboardId = dashboard.id
      }
      // else: case (c): already a non-template fork, no-op
    }

    if (!needsFork) {
      return apiSuccess({ dashboardId: assignment.dashboard_id, forked: false })
    }

    // Resolve template to clone
    if (!templateDashboardId) {
      const { data: templates } = await supabase
        .from('dashboards')
        .select('id')
        .eq('module_id', assignment.module_id)
        .eq('is_template', true)
        .order('updated_at', { ascending: false })
        .limit(1)

      templateDashboardId = templates?.[0]?.id || null
    }

    // P3 from Round 12: explicit 422 when module has no template
    if (!templateDashboardId) {
      return apiError(
        'UNPROCESSABLE_ENTITY',
        'Module has no template dashboard to fork. Create a dashboard for this module first.',
        422
      )
    }

    // Fetch template with sections and widgets for cloning
    const { data: template, error: templateError } = await supabase
      .from('dashboards')
      .select('*, dashboard_sections(*, dashboard_widgets(*))')
      .eq('id', templateDashboardId)
      .single()

    if (templateError || !template) {
      return apiError('UNPROCESSABLE_ENTITY', 'Failed to read template dashboard', 422)
    }

    // Clone dashboard row
    const { data: forkedDashboard, error: forkError } = await supabase
      .from('dashboards')
      .insert({
        module_id: template.module_id,
        title: template.title,
        description: template.description,
        is_template: false,
        partner_id: null,
        date_range_default: template.date_range_default,
      })
      .select()
      .single()

    if (forkError || !forkedDashboard) {
      return ApiErrors.database()
    }

    // Clone sections and widgets
    const sections = template.dashboard_sections || []
    for (const section of sections) {
      const { data: newSection, error: sectionError } = await supabase
        .from('dashboard_sections')
        .insert({
          dashboard_id: forkedDashboard.id,
          title: section.title,
          sort_order: section.sort_order,
          is_collapsed: section.is_collapsed,
        })
        .select()
        .single()

      if (sectionError || !newSection) continue

      const widgets = section.dashboard_widgets || []
      if (widgets.length > 0) {
        await supabase
          .from('dashboard_widgets')
          .insert(
            widgets.map((w: Record<string, unknown>) => ({
              dashboard_id: forkedDashboard.id,
              section_id: newSection.id,
              widget_type: w.widget_type,
              title: w.title,
              grid_column: w.grid_column,
              grid_row: w.grid_row,
              col_span: w.col_span,
              row_span: w.row_span,
              sort_order: w.sort_order,
              config: w.config || {},
            }))
          )
      }
    }

    // Update assignment to point to fork
    await supabase
      .from('view_profile_modules')
      .update({ dashboard_id: forkedDashboard.id })
      .eq('id', assignment.id)

    logDashboardFork(
      auth.user.id,
      auth.user.email,
      viewId,
      forkedDashboard.id,
      templateDashboardId,
    )

    return apiSuccess({ dashboardId: forkedDashboard.id, forked: true }, 201)
  } catch (error) {
    console.error('Fork dashboard error:', error)
    return ApiErrors.internal()
  }
}
