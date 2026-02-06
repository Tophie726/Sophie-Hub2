/**
 * /api/modules/dashboards/[dashboardId]
 *
 * GET: Single dashboard with sections and widgets
 * PATCH: Update dashboard metadata (admin only)
 * DELETE: Delete dashboard (admin only)
 */

import { NextRequest } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { requireAuth, requireRole } from '@/lib/auth/api-auth'
import { ROLES } from '@/lib/auth/roles'
import { apiSuccess, ApiErrors, apiValidationError } from '@/lib/api/response'
import { z } from 'zod'
import type { DashboardWithChildren, DashboardWidget, SectionWithWidgets } from '@/types/modules'

const supabase = getAdminClient()

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ dashboardId: string }> }
) {
  const auth = await requireAuth()
  if (!auth.authenticated) return auth.response

  try {
    const { dashboardId } = await params

    // Fetch dashboard
    const { data: dashboard, error: dbError } = await supabase
      .from('dashboards')
      .select('*')
      .eq('id', dashboardId)
      .maybeSingle()

    if (dbError) return ApiErrors.database()
    if (!dashboard) return ApiErrors.notFound('Dashboard')

    // Fetch sections ordered by sort_order
    const { data: sections } = await supabase
      .from('dashboard_sections')
      .select('*')
      .eq('dashboard_id', dashboardId)
      .order('sort_order', { ascending: true })

    // Fetch all widgets for this dashboard
    const { data: widgets } = await supabase
      .from('dashboard_widgets')
      .select('*')
      .eq('dashboard_id', dashboardId)
      .order('sort_order', { ascending: true })

    // Group widgets by section
    const widgetsBySection: Record<string, DashboardWidget[]> = {}
    for (const w of (widgets || []) as DashboardWidget[]) {
      if (!widgetsBySection[w.section_id]) {
        widgetsBySection[w.section_id] = []
      }
      widgetsBySection[w.section_id].push(w)
    }

    // Build nested response
    const sectionsWithWidgets: SectionWithWidgets[] = (sections || []).map((s) => ({
      ...s,
      widgets: widgetsBySection[s.id] || [],
    }))

    const result: DashboardWithChildren = {
      ...dashboard,
      sections: sectionsWithWidgets,
    }

    return apiSuccess({ dashboard: result })
  } catch {
    return ApiErrors.internal()
  }
}

const UpdateDashboardSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  date_range_default: z.enum(['7d', '30d', '90d', 'custom']).optional(),
  is_template: z.boolean().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ dashboardId: string }> }
) {
  const auth = await requireRole(ROLES.ADMIN)
  if (!auth.authenticated) return auth.response

  try {
    const { dashboardId } = await params
    const body = await request.json()
    const validation = UpdateDashboardSchema.safeParse(body)
    if (!validation.success) {
      return apiValidationError(validation.error)
    }

    const { data: dashboard, error } = await supabase
      .from('dashboards')
      .update(validation.data)
      .eq('id', dashboardId)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') return ApiErrors.notFound('Dashboard')
      return ApiErrors.database()
    }

    return apiSuccess({ dashboard })
  } catch {
    return ApiErrors.internal()
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ dashboardId: string }> }
) {
  const auth = await requireRole(ROLES.ADMIN)
  if (!auth.authenticated) return auth.response

  try {
    const { dashboardId } = await params

    const { error } = await supabase
      .from('dashboards')
      .delete()
      .eq('id', dashboardId)

    if (error) return ApiErrors.database()

    return apiSuccess({ deleted: true })
  } catch {
    return ApiErrors.internal()
  }
}
