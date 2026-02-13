/**
 * /api/admin/views/[viewId]/sections/[sectionId]
 *
 * View-scoped single-section operations with isTrueAdmin gate.
 * PATCH: Rename a section
 * DELETE: Delete a section (widgets cascade)
 */

import { z } from 'zod'
import { requireTrueAdmin } from '@/lib/auth/api-auth'
import { getAdminClient } from '@/lib/supabase/admin'
import { apiSuccess, ApiErrors, apiValidationError } from '@/lib/api/response'
import { logSectionDelete } from '@/lib/audit/admin-audit'

const RenameSectionSchema = z.object({
  title: z.string().min(1).max(200),
})

interface RouteContext {
  params: Promise<{ viewId: string; sectionId: string }>
}

/** Validate section exists and belongs to a dashboard assigned to this view */
async function validateSectionInView(
  supabase: ReturnType<typeof getAdminClient>,
  viewId: string,
  sectionId: string,
) {
  const { data: section } = await supabase
    .from('dashboard_sections')
    .select('id, dashboard_id')
    .eq('id', sectionId)
    .single()

  if (!section) return null

  const { data: assignment } = await supabase
    .from('view_profile_modules')
    .select('id')
    .eq('view_id', viewId)
    .eq('dashboard_id', section.dashboard_id)
    .maybeSingle()

  if (!assignment) return null

  return section
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireTrueAdmin()
  if (!auth.authenticated) return auth.response

  try {
    const { viewId, sectionId } = await context.params
    const supabase = getAdminClient()
    const body = await request.json()
    const validation = RenameSectionSchema.safeParse(body)
    if (!validation.success) return apiValidationError(validation.error)

    const section = await validateSectionInView(supabase, viewId, sectionId)
    if (!section) return ApiErrors.notFound('Section in this view')

    const { data: updated, error } = await supabase
      .from('dashboard_sections')
      .update({ title: validation.data.title })
      .eq('id', sectionId)
      .select()
      .single()

    if (error) return ApiErrors.database()

    return apiSuccess({ section: updated })
  } catch {
    return ApiErrors.internal()
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireTrueAdmin()
  if (!auth.authenticated) return auth.response

  try {
    const { viewId, sectionId } = await context.params
    const supabase = getAdminClient()

    const section = await validateSectionInView(supabase, viewId, sectionId)
    if (!section) return ApiErrors.notFound('Section in this view')

    // Delete widgets in section first (in case no FK cascade)
    await supabase
      .from('dashboard_widgets')
      .delete()
      .eq('section_id', sectionId)

    const { error } = await supabase
      .from('dashboard_sections')
      .delete()
      .eq('id', sectionId)

    if (error) return ApiErrors.database()

    logSectionDelete(auth.user.id, auth.user.email, viewId, section.dashboard_id, sectionId)

    return new Response(null, { status: 204 })
  } catch {
    return ApiErrors.internal()
  }
}
