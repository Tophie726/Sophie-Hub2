import { requireRole } from '@/lib/auth/api-auth'
import { ROLES } from '@/lib/auth/roles'
import { getAdminClient } from '@/lib/supabase/admin'
import { apiSuccess, ApiErrors, apiValidationError } from '@/lib/api/response'
import { z } from 'zod'
import { logRuleChange } from '@/lib/audit/admin-audit'

const supabase = getAdminClient()

/**
 * Tier derivation from target_type (defense in depth — DB CHECK also enforces).
 */
const TARGET_TYPE_TO_TIER: Record<string, number> = {
  staff: 1,
  role: 2,
  partner: 3,
  partner_type: 4,
  default: 5,
}

const VALID_TARGET_TYPES = Object.keys(TARGET_TYPE_TO_TIER)
const VALID_ROLE_SLUGS = Object.values(ROLES)

const CreateRuleSchema = z.object({
  target_type: z.enum(VALID_TARGET_TYPES as [string, ...string[]]),
  target_id: z.string().nullable().optional(),
  priority: z.number().int().min(0).max(1000).optional().default(0),
})

interface RouteContext {
  params: Promise<{ viewId: string }>
}

/**
 * GET /api/admin/views/[viewId]/rules
 * List audience rules for a view, ordered by tier ASC, priority ASC.
 */
export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireRole(ROLES.ADMIN)
  if (!auth.authenticated) return auth.response

  try {
    const { viewId } = await context.params

    // Verify view exists
    const { data: view, error: viewError } = await supabase
      .from('view_profiles')
      .select('id')
      .eq('id', viewId)
      .single()

    if (viewError || !view) return ApiErrors.notFound('View profile')

    const { data: rules, error } = await supabase
      .from('view_audience_rules')
      .select('*')
      .eq('view_id', viewId)
      .order('tier', { ascending: true })
      .order('priority', { ascending: true })

    if (error) {
      console.error('Failed to fetch audience rules:', error)
      return ApiErrors.database(error.message)
    }

    return apiSuccess({ rules: rules || [] })
  } catch (error) {
    console.error('Audience rules fetch error:', error)
    return ApiErrors.internal()
  }
}

/**
 * POST /api/admin/views/[viewId]/rules
 * Add an audience rule. Tier is auto-derived from target_type.
 */
export async function POST(request: Request, context: RouteContext) {
  const auth = await requireRole(ROLES.ADMIN)
  if (!auth.authenticated) return auth.response

  try {
    const { viewId } = await context.params
    const body = await request.json()
    const validation = CreateRuleSchema.safeParse(body)
    if (!validation.success) return apiValidationError(validation.error)

    const { target_type, target_id, priority } = validation.data
    const tier = TARGET_TYPE_TO_TIER[target_type]

    // Validate target_id requirements
    if (target_type === 'default' && target_id) {
      return ApiErrors.forbidden('target_id must be null for default rules')
    }
    if (target_type !== 'default' && !target_id) {
      return ApiErrors.forbidden('target_id is required for non-default rules')
    }

    // Verify view exists
    const { data: view, error: viewError } = await supabase
      .from('view_profiles')
      .select('id')
      .eq('id', viewId)
      .single()

    if (viewError || !view) return ApiErrors.notFound('View profile')

    // Validate target_id exists for the given type
    if (target_id) {
      const valid = await validateTargetId(target_type, target_id)
      if (!valid) {
        return ApiErrors.notFound(`${target_type} target "${target_id}"`)
      }
    }

    const { data: rule, error } = await supabase
      .from('view_audience_rules')
      .insert({
        view_id: viewId,
        tier,
        target_type,
        target_id: target_id || null,
        priority,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return ApiErrors.conflict(`A rule for this target already exists on this view`)
      }
      console.error('Failed to create audience rule:', error)
      return ApiErrors.database(error.message)
    }

    logRuleChange('rule.create', auth.user.id, auth.user.email, rule.id, viewId, {
      target_type,
      target_id: target_id || null,
      tier,
      priority,
    })

    return apiSuccess({ rule }, 201)
  } catch (error) {
    console.error('Audience rule creation error:', error)
    return ApiErrors.internal()
  }
}

/**
 * Validate that a target_id is valid for its target_type.
 */
async function validateTargetId(targetType: string, targetId: string): Promise<boolean> {
  switch (targetType) {
    case 'staff': {
      const { data } = await supabase
        .from('staff')
        .select('id')
        .eq('id', targetId)
        .maybeSingle()
      return !!data
    }
    case 'partner': {
      const { data } = await supabase
        .from('partners')
        .select('id')
        .eq('id', targetId)
        .maybeSingle()
      return !!data
    }
    case 'role': {
      return VALID_ROLE_SLUGS.includes(targetId as typeof VALID_ROLE_SLUGS[number])
    }
    case 'partner_type': {
      // Partner types are canonical slugs — accept any non-empty string for now.
      // Future: validate against a partner_types reference table.
      return targetId.length > 0
    }
    default:
      return false
  }
}
