import { getAdminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth/api-auth'
import { apiSuccess, apiError, ApiErrors, ErrorCodes } from '@/lib/api/response'
import { z } from 'zod'

const supabase = getAdminClient()

const QuerySchema = z.object({
  search: z.string().max(200).optional(),
  status: z.string().optional(),
  tier: z.string().optional(),
  sort: z.enum(['brand_name', 'created_at', 'tier', 'onboarding_date']).optional().default('brand_name'),
  order: z.enum(['asc', 'desc']).optional().default('asc'),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
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

    // Query 1: Partners with count - select ALL columns including source_data
    // This enables dynamic column display without code changes
    let query = supabase
      .from('partners')
      .select('*', { count: 'exact' })

    // Search across brand_name, client_name, partner_code
    if (search) {
      query = query.or(
        `brand_name.ilike.%${search}%,client_name.ilike.%${search}%,partner_code.ilike.%${search}%`
      )
    }

    // Filter by status
    if (status) {
      const statuses = status.split(',').map(s => s.trim()).filter(Boolean)
      query = query.in('status', statuses)
    }

    // Filter by tier
    if (tier) {
      const tiers = tier.split(',').map(t => t.trim()).filter(Boolean)
      query = query.in('tier', tiers)
    }

    // Sort + paginate
    query = query
      .order(sort, { ascending: order === 'asc' })
      .range(offset, offset + limit - 1)

    const { data: partners, error, count } = await query

    if (error) {
      console.error('Error fetching partners:', error)
      return ApiErrors.database(error.message)
    }

    // Query 2: Batch fetch pod_leader assignments for returned partners
    const partnerIds = (partners || []).map(p => p.id)
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
    const partnersWithLeaders = (partners || []).map(p => ({
      ...p,
      pod_leader: podLeaders[p.id] || null,
    }))

    return apiSuccess({
      partners: partnersWithLeaders,
      total: count || 0,
      has_more: (count || 0) > offset + limit,
    }, 200, {
      'Cache-Control': 'private, max-age=10, stale-while-revalidate=30',
    })
  } catch (error) {
    console.error('Error in GET /api/partners:', error)
    return ApiErrors.internal()
  }
}
