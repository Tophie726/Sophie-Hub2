import { requireRole } from '@/lib/auth/api-auth'
import { ROLES } from '@/lib/auth/roles'
import { getAdminClient } from '@/lib/supabase/admin'
import { apiSuccess, ApiErrors, apiValidationError } from '@/lib/api/response'
import { z } from 'zod'
import { logViewChange } from '@/lib/audit/admin-audit'

const supabase = getAdminClient()

const CreateViewSchema = z.object({
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  is_default: z.boolean().optional(),
})

/**
 * GET /api/admin/views
 * List all view profiles with audience rule counts.
 */
export async function GET(request: Request) {
  const auth = await requireRole(ROLES.ADMIN)
  if (!auth.authenticated) return auth.response

  try {
    const { searchParams } = new URL(request.url)
    const isActive = searchParams.get('is_active')

    let query = supabase
      .from('view_profiles')
      .select('*, view_audience_rules(count)')
      .order('created_at', { ascending: false })

    if (isActive === 'true') {
      query = query.eq('is_active', true)
    } else if (isActive === 'false') {
      query = query.eq('is_active', false)
    }

    const { data: views, error } = await query

    if (error) {
      console.error('Failed to fetch view profiles:', error)
      return ApiErrors.database(error.message)
    }

    // Flatten the count from the nested aggregate
    const result = (views || []).map(v => ({
      ...v,
      rule_count: v.view_audience_rules?.[0]?.count ?? 0,
      view_audience_rules: undefined,
    }))

    return apiSuccess({ views: result })
  } catch (error) {
    console.error('View profiles fetch error:', error)
    return ApiErrors.internal()
  }
}

/**
 * POST /api/admin/views
 * Create a new view profile.
 */
export async function POST(request: Request) {
  const auth = await requireRole(ROLES.ADMIN)
  if (!auth.authenticated) return auth.response

  try {
    const body = await request.json()
    const validation = CreateViewSchema.safeParse(body)
    if (!validation.success) return apiValidationError(validation.error)

    const { slug, name, description, is_default } = validation.data

    const userId = auth.user.id
    const validUserId = userId && !userId.startsWith('temp-') ? userId : null

    const { data: view, error } = await supabase
      .from('view_profiles')
      .insert({
        slug,
        name,
        description: description || null,
        is_default: is_default || false,
        created_by: validUserId,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return ApiErrors.conflict(`View with slug "${slug}" already exists`)
      }
      console.error('Failed to create view profile:', error)
      return ApiErrors.database(error.message)
    }

    logViewChange('view.create', auth.user.id, auth.user.email, view.id, slug, { name })

    return apiSuccess({ view }, 201)
  } catch (error) {
    console.error('View profile creation error:', error)
    return ApiErrors.internal()
  }
}
