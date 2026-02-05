import { getAdminClient } from '@/lib/supabase/admin'
import { requireAuth, requireRole } from '@/lib/auth/api-auth'
import { ROLES } from '@/lib/auth/roles'
import { apiSuccess, apiError, ApiErrors, ErrorCodes, apiValidationError } from '@/lib/api/response'
import { computePartnerStatus, matchesStatusFilter } from '@/lib/partners/computed-status'
import { z } from 'zod'

const supabase = getAdminClient()

const QuerySchema = z.object({
  search: z.string().max(200).optional(),
  status: z.string().optional(),
  tier: z.string().optional(),
  sort: z.enum(['brand_name', 'created_at', 'tier', 'onboarding_date', 'partner_code', 'client_name', 'pod_leader_name']).optional().default('brand_name'),
  order: z.enum(['asc', 'desc']).optional().default('asc'),
  limit: z.coerce.number().int().min(1).max(5000).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
})

/**
 * GET /api/partners
 *
 * List partners with search, filter, sort, and pagination.
 *
 * Query params:
 * - search: string - Search brand_name, client_name, partner_code
 * - status: string - Comma-separated status filter (active,onboarding,churned)
 * - tier: string - Comma-separated tier filter
 * - sort: 'brand_name' | 'created_at' | 'tier' | 'onboarding_date'
 * - order: 'asc' | 'desc'
 * - limit: number (1-100, default 50)
 * - offset: number (default 0)
 */
export async function GET(request: Request) {
  const auth = await requireAuth()
  if (!auth.authenticated) return auth.response

  try {
    const { searchParams } = new URL(request.url)
    const params = {
      search: searchParams.get('search') || undefined,
      status: searchParams.get('status') || undefined,
      tier: searchParams.get('tier') || undefined,
      sort: searchParams.get('sort') || undefined,
      order: searchParams.get('order') || undefined,
      limit: searchParams.get('limit') || undefined,
      offset: searchParams.get('offset') || undefined,
    }

    const validation = QuerySchema.safeParse(params)
    if (!validation.success) {
      return apiError(ErrorCodes.VALIDATION_ERROR, validation.error.message, 400)
    }

    const { search, status, tier, sort, order, limit, offset } = validation.data

    // Parse status filter values
    const statusFilters = status
      ? status.split(',').map(s => s.trim()).filter(Boolean)
      : []

    // Query 1: Partners - select ALL columns including source_data
    // Note: Status filtering is done in JS based on computed status from weekly data
    let query = supabase
      .from('partners')
      .select('*')

    // Search across brand_name, client_name, partner_code
    if (search) {
      query = query.or(
        `brand_name.ilike.%${search}%,client_name.ilike.%${search}%,partner_code.ilike.%${search}%`
      )
    }

    // Filter by tier (DB-level filter is fine for tier)
    if (tier) {
      const tiers = tier.split(',').map(t => t.trim()).filter(Boolean)
      query = query.in('tier', tiers)
    }

    // Sort
    query = query.order(sort, { ascending: order === 'asc' })

    const { data: allPartners, error } = await query

    if (error) {
      console.error('Error fetching partners:', error)
      return ApiErrors.database(error.message)
    }

    // Compute status for each partner and apply status filter
    let filteredPartners = (allPartners || []).map(p => {
      const computed = computePartnerStatus(p.source_data, p.status)
      return {
        ...p,
        computed_status: computed.computedStatus,
        computed_status_label: computed.displayLabel,
        computed_status_bucket: computed.bucket,
        latest_weekly_status: computed.latestWeeklyStatus,
        status_matches: computed.matchesSheetStatus,
        weeks_without_data: computed.weeksWithoutData,
      }
    })

    // Apply status filter based on computed status
    if (statusFilters.length > 0) {
      filteredPartners = filteredPartners.filter(p =>
        matchesStatusFilter(p.source_data, p.status, statusFilters)
      )
    }

    // Apply pagination after filtering
    const total = filteredPartners.length
    const paginatedPartners = filteredPartners.slice(offset, offset + limit)

    // Query 2: Batch fetch pod_leader assignments for paginated partners
    const partnerIds = paginatedPartners.map(p => p.id)
    const podLeaders: Record<string, { id: string; full_name: string }> = {}

    if (partnerIds.length > 0) {
      const { data: assignments } = await supabase
        .from('partner_assignments')
        .select('partner_id, staff:staff_id(id, full_name)')
        .in('partner_id', partnerIds)
        .eq('assignment_role', 'pod_leader')
        .is('unassigned_at', null)

      if (assignments) {
        for (const a of assignments) {
          const staff = a.staff as unknown as { id: string; full_name: string } | null
          if (staff) {
            podLeaders[a.partner_id] = staff
          }
        }
      }
    }

    // Merge pod leaders into results
    const partnersWithLeaders = paginatedPartners.map(p => ({
      ...p,
      pod_leader: podLeaders[p.id] || null,
    }))

    return apiSuccess({
      partners: partnersWithLeaders,
      total,
      has_more: total > offset + limit,
    }, 200, {
      'Cache-Control': 'private, max-age=10, stale-while-revalidate=30',
    })
  } catch (error) {
    console.error('Error in GET /api/partners:', error)
    return ApiErrors.internal()
  }
}

// Schema for creating a new partner
const CreatePartnerSchema = z.object({
  brand_name: z.string().min(1, 'Brand name is required').max(200),
  client_name: z.string().max(200).optional(),
  client_email: z.string().email().optional().or(z.literal('')),
  status: z.enum(['active', 'onboarding', 'paused', 'churned']).optional().default('onboarding'),
  tier: z.enum(['tier_1', 'tier_2', 'tier_3']).optional(),
})

/**
 * POST /api/partners
 * Create a new partner (admin only)
 */
export async function POST(request: Request) {
  const auth = await requireRole(ROLES.ADMIN)
  if (!auth.authenticated) return auth.response

  try {
    const body = await request.json()
    const validation = CreatePartnerSchema.safeParse(body)

    if (!validation.success) {
      return apiValidationError(validation.error)
    }

    const { brand_name, client_name, client_email, status, tier } = validation.data

    // Check if partner with same brand_name already exists
    const { data: existing } = await supabase
      .from('partners')
      .select('id')
      .ilike('brand_name', brand_name)
      .maybeSingle()

    if (existing) {
      return apiError('DUPLICATE', `Partner "${brand_name}" already exists`, 409)
    }

    const { data: partner, error } = await supabase
      .from('partners')
      .insert({
        brand_name,
        client_name: client_name || null,
        client_email: client_email || null,
        status,
        tier: tier || null,
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to create partner:', error)
      return ApiErrors.database(error.message)
    }

    return apiSuccess({ partner }, 201)
  } catch (error) {
    console.error('Error in POST /api/partners:', error)
    return ApiErrors.internal()
  }
}
