/**
 * /api/modules/dashboards
 *
 * GET: List dashboards with optional ?module_id and ?partner_id filters
 * POST: Create a new dashboard (admin only)
 */

import { getAdminClient } from '@/lib/supabase/admin'
import { requireAuth, requireRole } from '@/lib/auth/api-auth'
import { ROLES } from '@/lib/auth/roles'
import { apiSuccess, apiError, ApiErrors, apiValidationError } from '@/lib/api/response'
import { z } from 'zod'
import { getViewCookie } from '@/lib/auth/viewer-session'
import { buildActorFromAuth, buildSelfSubject, buildViewResolverInput } from '@/lib/auth/viewer-context'
import { resolveEffectiveView } from '@/lib/views/resolve-view'

const supabase = getAdminClient()

const ListQuerySchema = z.object({
  module_id: z.string().uuid().optional(),
  partner_id: z.string().uuid().optional(),
  is_template: z.enum(['true', 'false']).optional(),
})

export async function GET(request: Request) {
  const auth = await requireAuth()
  if (!auth.authenticated) return auth.response

  try {
    const { searchParams } = new URL(request.url)
    const params = {
      module_id: searchParams.get('module_id') || undefined,
      partner_id: searchParams.get('partner_id') || undefined,
      is_template: searchParams.get('is_template') || undefined,
    }

    const validation = ListQuerySchema.safeParse(params)
    if (!validation.success) {
      return apiValidationError(validation.error)
    }

    // Resolve effective view from signed cookie (P1.1: server-derived only)
    const actor = buildActorFromAuth(auth.user)
    const cookie = getViewCookie()
    const subject = cookie ? cookie.subject : buildSelfSubject(actor)
    const resolverInput = buildViewResolverInput(subject, actor)
    const resolvedView = await resolveEffectiveView(resolverInput)

    // If a view is resolved, get the allowed module IDs for filtering
    let allowedModuleIds: Set<string> | null = null
    if (resolvedView) {
      const { data: viewModules } = await supabase
        .from('view_profile_modules')
        .select('module_id')
        .eq('view_id', resolvedView.id)

      if (viewModules && viewModules.length > 0) {
        allowedModuleIds = new Set(viewModules.map(vm => vm.module_id))
      }
    }

    let query = supabase
      .from('dashboards')
      .select('*')
      .order('created_at', { ascending: false })

    if (validation.data.module_id) {
      query = query.eq('module_id', validation.data.module_id)
    }
    if (validation.data.partner_id) {
      query = query.eq('partner_id', validation.data.partner_id)
    }
    if (validation.data.is_template !== undefined) {
      query = query.eq('is_template', validation.data.is_template === 'true')
    }

    // Filter by allowed modules if a view was resolved with module assignments
    if (allowedModuleIds) {
      query = query.in('module_id', Array.from(allowedModuleIds))
    }

    const { data: dashboards, error } = await query

    if (error) {
      return ApiErrors.database()
    }

    return apiSuccess({
      dashboards: dashboards || [],
      resolved_view: resolvedView
        ? { id: resolvedView.id, slug: resolvedView.slug, name: resolvedView.name }
        : null,
    })
  } catch {
    return ApiErrors.internal()
  }
}

const CreateDashboardSchema = z.object({
  module_id: z.string().uuid(),
  partner_id: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  is_template: z.boolean().optional().default(false),
  date_range_default: z.enum(['7d', '30d', '90d', 'custom']).optional().default('30d'),
})

export async function POST(request: Request) {
  const auth = await requireRole(ROLES.ADMIN)
  if (!auth.authenticated) return auth.response

  try {
    const body = await request.json()
    const validation = CreateDashboardSchema.safeParse(body)
    if (!validation.success) {
      return apiValidationError(validation.error)
    }

    // Verify module exists
    const { data: module } = await supabase
      .from('modules')
      .select('id')
      .eq('id', validation.data.module_id)
      .maybeSingle()

    if (!module) {
      return apiError('NOT_FOUND', 'Module not found', 404)
    }

    const { data: dashboard, error } = await supabase
      .from('dashboards')
      .insert({
        ...validation.data,
        created_by: auth.user.id,
      })
      .select()
      .single()

    if (error) {
      return ApiErrors.database()
    }

    return apiSuccess({ dashboard }, 201)
  } catch {
    return ApiErrors.internal()
  }
}
