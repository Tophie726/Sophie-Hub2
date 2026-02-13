import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth/api-auth'
import { isTrueAdmin } from '@/lib/auth/admin-access'
import { getAdminClient } from '@/lib/supabase/admin'
import { apiSuccess, ApiErrors } from '@/lib/api/response'

/**
 * GET /api/admin/views/[viewId]/preview-context
 *
 * Returns the resolved payload for the view builder toolbar:
 * - view details
 * - audience rules
 * - assigned modules (with module metadata)
 *
 * Admin-only (isTrueAdmin gate, HR-7).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ viewId: string }> }
) {
  const auth = await requireAuth()
  if (!auth.authenticated) return auth.response

  if (!isTrueAdmin(auth.user.staffRole, auth.user.email)) {
    return ApiErrors.forbidden('Preview management is restricted to full admins')
  }

  const { viewId } = await params
  const supabase = getAdminClient()

  // Fetch view details
  const { data: view, error: viewError } = await supabase
    .from('view_profiles')
    .select('id, slug, name, description, is_default, is_active, created_at, updated_at')
    .eq('id', viewId)
    .single()

  if (viewError || !view) {
    return ApiErrors.notFound('View profile')
  }

  // Fetch audience rules
  const { data: rules } = await supabase
    .from('view_audience_rules')
    .select('id, tier, target_type, target_id, priority, is_active, created_at')
    .eq('view_id', viewId)
    .order('tier', { ascending: true })
    .order('priority', { ascending: true })

  // Fetch assigned modules with module metadata
  const { data: assignments } = await supabase
    .from('view_profile_modules')
    .select('id, module_id, dashboard_id, sort_order, config')
    .eq('view_id', viewId)
    .order('sort_order', { ascending: true })

  const moduleIds = Array.from(new Set((assignments || []).map((assignment) => assignment.module_id)))
  const { data: modules } = moduleIds.length === 0
    ? { data: [] as Array<{
      id: string
      slug: string
      name: string
      description: string | null
      icon: string | null
      color: string | null
    }> }
    : await supabase
      .from('modules')
      .select('id, slug, name, description, icon, color')
      .in('id', moduleIds)

  const moduleById = new Map((modules || []).map((module) => [module.id, module]))

  const assignedModules = (assignments || []).map((a) => {
    const mod = moduleById.get(a.module_id) || null

    return {
      assignmentId: a.id,
      moduleId: a.module_id,
      slug: mod?.slug ?? 'unknown',
      name: mod?.name ?? 'Unknown Module',
      description: mod?.description ?? null,
      icon: mod?.icon ?? 'Blocks',
      color: mod?.color ?? 'gray',
      sortOrder: a.sort_order,
      dashboardId: a.dashboard_id,
      config: a.config,
    }
  })

  return apiSuccess({
    view,
    audienceRules: rules || [],
    assignedModules,
  })
}
