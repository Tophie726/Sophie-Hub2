/**
 * GET /api/modules
 *
 * List all enabled modules, ordered by sort_order.
 * All authenticated users can read modules.
 */

import { getAdminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth/api-auth'
import { apiSuccess, ApiErrors } from '@/lib/api/response'

const supabase = getAdminClient()

export async function GET() {
  const auth = await requireAuth()
  if (!auth.authenticated) return auth.response

  try {
    const { data: modules, error } = await supabase
      .from('modules')
      .select('*')
      .eq('enabled', true)
      .order('sort_order', { ascending: true })

    if (error) {
      return ApiErrors.database()
    }

    return apiSuccess({ modules: modules || [] })
  } catch {
    return ApiErrors.internal()
  }
}
