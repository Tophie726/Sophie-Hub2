/**
 * /api/modules/dashboards/[dashboardId]/widgets
 *
 * POST: Add a widget to a dashboard section (admin only)
 * PATCH: Update a widget's config or position (admin only)
 * DELETE: Remove a widget (admin only)
 */

import { NextRequest } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth/api-auth'
import { ROLES } from '@/lib/auth/roles'
import { apiSuccess, apiError, ApiErrors, apiValidationError } from '@/lib/api/response'
import { z } from 'zod'

const supabase = getAdminClient()

function checkConfigSize(config: Record<string, unknown>): boolean {
  try {
    return JSON.stringify(config).length <= 10_000
  } catch {
    return false
  }
}

function maxDepth(obj: unknown, depth = 0): number {
  if (depth > 5) return depth // bail early
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return depth
  const values = Object.values(obj)
  if (values.length === 0) return depth
  return Math.max(...values.map(v => maxDepth(v, depth + 1)))
}

const VALID_WIDGET_TYPES = ['metric', 'chart', 'table', 'text'] as const

const CreateWidgetSchema = z.object({
  section_id: z.string().uuid(),
  widget_type: z.enum(VALID_WIDGET_TYPES),
  title: z.string().min(1).max(200),
  grid_column: z.number().int().min(1).optional().default(1),
  grid_row: z.number().int().min(1).optional().default(1),
  col_span: z.number().int().min(1).max(4).optional().default(1),
  row_span: z.number().int().min(1).max(4).optional().default(1),
  sort_order: z.number().int().min(0).optional(),
  config: z.record(z.string(), z.unknown()).default({}),
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
    const validation = CreateWidgetSchema.safeParse(body)
    if (!validation.success) {
      return apiValidationError(validation.error)
    }

    if (!checkConfigSize(validation.data.config)) {
      return apiError('VALIDATION_ERROR', 'Widget config exceeds maximum size (10KB)', 400)
    }
    if (maxDepth(validation.data.config) > 3) {
      return apiError('VALIDATION_ERROR', 'Widget config nesting too deep (max 3 levels)', 400)
    }

    // Verify section belongs to this dashboard
    const { data: section } = await supabase
      .from('dashboard_sections')
      .select('id')
      .eq('id', validation.data.section_id)
      .eq('dashboard_id', dashboardId)
      .maybeSingle()

    if (!section) {
      return apiError('NOT_FOUND', 'Section not found in this dashboard', 404)
    }

    // Auto-assign sort_order if not provided
    let sortOrder = validation.data.sort_order
    if (sortOrder === undefined) {
      const { data: existing } = await supabase
        .from('dashboard_widgets')
        .select('sort_order')
        .eq('section_id', validation.data.section_id)
        .order('sort_order', { ascending: false })
        .limit(1)

      sortOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0
    }

    const { data: widget, error } = await supabase
      .from('dashboard_widgets')
      .insert({
        dashboard_id: dashboardId,
        section_id: validation.data.section_id,
        widget_type: validation.data.widget_type,
        title: validation.data.title,
        grid_column: validation.data.grid_column,
        grid_row: validation.data.grid_row,
        col_span: validation.data.col_span,
        row_span: validation.data.row_span,
        sort_order: sortOrder,
        config: validation.data.config,
      })
      .select()
      .single()

    if (error) return ApiErrors.database()

    return apiSuccess({ widget }, 201)
  } catch {
    return ApiErrors.internal()
  }
}

const UpdateWidgetSchema = z.object({
  widget_id: z.string().uuid(),
  title: z.string().min(1).max(200).optional(),
  grid_column: z.number().int().min(1).optional(),
  grid_row: z.number().int().min(1).optional(),
  col_span: z.number().int().min(1).max(4).optional(),
  row_span: z.number().int().min(1).max(4).optional(),
  sort_order: z.number().int().min(0).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
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
    const validation = UpdateWidgetSchema.safeParse(body)
    if (!validation.success) {
      return apiValidationError(validation.error)
    }

    if (validation.data.config) {
      if (!checkConfigSize(validation.data.config)) {
        return apiError('VALIDATION_ERROR', 'Widget config exceeds maximum size (10KB)', 400)
      }
      if (maxDepth(validation.data.config) > 3) {
        return apiError('VALIDATION_ERROR', 'Widget config nesting too deep (max 3 levels)', 400)
      }
    }

    const { widget_id, ...updates } = validation.data

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

    return apiSuccess({ widget })
  } catch {
    return ApiErrors.internal()
  }
}

const DeleteWidgetSchema = z.object({
  widget_id: z.string().uuid(),
})

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ dashboardId: string }> }
) {
  const auth = await requireRole(ROLES.ADMIN)
  if (!auth.authenticated) return auth.response

  try {
    const { dashboardId } = await params
    const body = await request.json()
    const validation = DeleteWidgetSchema.safeParse(body)
    if (!validation.success) {
      return apiValidationError(validation.error)
    }

    const { error } = await supabase
      .from('dashboard_widgets')
      .delete()
      .eq('id', validation.data.widget_id)
      .eq('dashboard_id', dashboardId)

    if (error) return ApiErrors.database()

    return apiSuccess({ deleted: true })
  } catch {
    return ApiErrors.internal()
  }
}
