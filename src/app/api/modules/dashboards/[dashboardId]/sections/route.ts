/**
 * /api/modules/dashboards/[dashboardId]/sections
 *
 * POST: Add a new section to a dashboard (admin only)
 * PATCH: Reorder sections (admin only)
 */

import { NextRequest } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth/api-auth'
import { ROLES } from '@/lib/auth/roles'
import { apiSuccess, ApiErrors, apiValidationError } from '@/lib/api/response'
import { z } from 'zod'

const supabase = getAdminClient()

const CreateSectionSchema = z.object({
  title: z.string().min(1).max(200),
  sort_order: z.number().int().min(0).optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ dashboardId: string }> }
) {
  const auth = await requireRole(ROLES.ADMIN)
  if (!auth.authenticated) return auth.response

  try {
    const { dashboardId } = await params
    const body = await request.json()
    const validation = CreateSectionSchema.safeParse(body)
    if (!validation.success) {
      return apiValidationError(validation.error)
    }

    // Verify dashboard exists
    const { data: dashboard } = await supabase
      .from('dashboards')
      .select('id')
      .eq('id', dashboardId)
      .maybeSingle()

    if (!dashboard) return ApiErrors.notFound('Dashboard')

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
        title: validation.data.title,
        sort_order: sortOrder,
      })
      .select()
      .single()

    if (error) return ApiErrors.database()

    return apiSuccess({ section }, 201)
  } catch {
    return ApiErrors.internal()
  }
}

const ReorderSchema = z.object({
  order: z.array(z.object({
    id: z.string().uuid(),
    sort_order: z.number().int().min(0),
  })),
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
    const validation = ReorderSchema.safeParse(body)
    if (!validation.success) {
      return apiValidationError(validation.error)
    }

    // Update each section's sort_order
    const updates = validation.data.order.map((item) =>
      supabase
        .from('dashboard_sections')
        .update({ sort_order: item.sort_order })
        .eq('id', item.id)
        .eq('dashboard_id', dashboardId)
    )

    await Promise.all(updates)

    return apiSuccess({ reordered: true })
  } catch {
    return ApiErrors.internal()
  }
}
