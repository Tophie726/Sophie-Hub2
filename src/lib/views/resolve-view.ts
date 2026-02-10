import { getAdminClient } from '@/lib/supabase/admin'
import { createLogger } from '@/lib/logger'
import type { ViewResolverInput } from '@/lib/auth/viewer-context'

const log = createLogger('views:resolver')

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ViewProfile {
  id: string
  slug: string
  name: string
  description: string | null
  is_default: boolean
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

interface AudienceRule {
  id: string
  view_id: string
  tier: number
  target_type: string
  target_id: string | null
  priority: number
  is_active: boolean
  created_at: string
}

// ---------------------------------------------------------------------------
// Tier query definitions
// ---------------------------------------------------------------------------

interface TierQuery {
  tier: number
  targetType: string
  targetId: string | null
  label: string
}

function buildTierQueries(input: ViewResolverInput): TierQuery[] {
  const queries: TierQuery[] = []

  if (input.staffId) {
    queries.push({ tier: 1, targetType: 'staff', targetId: input.staffId, label: `staff:${input.staffId}` })
  }
  if (input.roleSlug) {
    queries.push({ tier: 2, targetType: 'role', targetId: input.roleSlug, label: `role:${input.roleSlug}` })
  }
  if (input.partnerId) {
    queries.push({ tier: 3, targetType: 'partner', targetId: input.partnerId, label: `partner:${input.partnerId}` })
  }
  if (input.partnerTypeSlug) {
    queries.push({ tier: 4, targetType: 'partner_type', targetId: input.partnerTypeSlug, label: `partner_type:${input.partnerTypeSlug}` })
  }
  // Tier 5 (default) always checked as fallback
  queries.push({ tier: 5, targetType: 'default', targetId: null, label: 'default' })

  return queries
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve the effective view profile for a given viewer input.
 *
 * Walks tiers 1-5 in order, short-circuits on first match.
 * Within a tier, picks the rule with lowest priority (then earliest created_at).
 * Only considers active rules pointing to active view profiles.
 *
 * Returns null if no matching view is found.
 */
export async function resolveEffectiveView(input: ViewResolverInput): Promise<ViewProfile | null> {
  const supabase = getAdminClient()
  const tierQueries = buildTierQueries(input)

  for (const tq of tierQueries) {
    let query = supabase
      .from('view_audience_rules')
      .select('*, view_profiles!inner(id, slug, name, description, is_default, is_active, created_by, created_at, updated_at)')
      .eq('target_type', tq.targetType)
      .eq('is_active', true)
      .eq('view_profiles.is_active', true)
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true })

    if (tq.targetId !== null) {
      query = query.eq('target_id', tq.targetId)
    } else {
      query = query.is('target_id', null)
    }

    const { data: rules, error } = await query

    if (error) {
      log.error(`Tier ${tq.tier} query failed for ${tq.label}`, error)
      continue
    }

    if (!rules || rules.length === 0) continue

    // Log tie-breaks
    if (rules.length > 1) {
      log.info(`Tier ${tq.tier} (${tq.label}): ${rules.length} matching rules, selecting priority=${rules[0].priority}`, {
        ruleIds: rules.map((r: AudienceRule) => r.id),
      })
    }

    const winner = rules[0]
    const viewProfile = winner.view_profiles as unknown as ViewProfile

    log.info(`Resolved view: "${viewProfile.name}" (${viewProfile.slug}) via tier ${tq.tier} (${tq.label})`)

    return viewProfile
  }

  log.info('No matching view found, returning null')
  return null
}
