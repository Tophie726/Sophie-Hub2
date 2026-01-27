import { getAdminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth/api-auth'
import { apiSuccess, apiError, ApiErrors, ErrorCodes } from '@/lib/api/response'
import { z } from 'zod'

const supabase = getAdminClient()

const QuerySchema = z.object({
  search: z.string().max(200).optional(),
  status: z.string().optional(),
  role: z.string().optional(),
  department: z.string().optional(),
  sort: z.enum(['full_name', 'created_at', 'role', 'hire_date']).optional().default('full_name'),
  order: z.enum(['asc', 'desc']).optional().default('asc'),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
})

/**
 * GET /api/staff
 *
 * List staff with search, filter, sort, and pagination.
 *
 * Query params:
 * - search: string - Search full_name, email, staff_code
 * - status: string - Comma-separated status filter
 * - role: string - Comma-separated role filter
 * - department: string - Comma-separated department filter
 * - sort: 'full_name' | 'created_at' | 'role' | 'hire_date'
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
      role: searchParams.get('role') || undefined,
      department: searchParams.get('department') || undefined,
      sort: searchParams.get('sort') || undefined,
      order: searchParams.get('order') || undefined,
      limit: searchParams.get('limit') || undefined,
      offset: searchParams.get('offset') || undefined,
    }

    const validation = QuerySchema.safeParse(params)
    if (!validation.success) {
      return apiError(ErrorCodes.VALIDATION_ERROR, validation.error.message, 400)
    }

    const { search, status, role, department, sort, order, limit, offset } = validation.data

    let query = supabase
      .from('staff')
      .select(
        'id, staff_code, full_name, email, role, department, title, status, max_clients, current_client_count, services, hire_date, created_at',
        { count: 'exact' }
      )

    // Search across full_name, email, staff_code
    if (search) {
      query = query.or(
        `full_name.ilike.%${search}%,email.ilike.%${search}%,staff_code.ilike.%${search}%`
      )
    }

    if (status) {
      const statuses = status.split(',').map(s => s.trim()).filter(Boolean)
      query = query.in('status', statuses)
    }

    if (role) {
      const roles = role.split(',').map(r => r.trim()).filter(Boolean)
      query = query.in('role', roles)
    }

    if (department) {
      const departments = department.split(',').map(d => d.trim()).filter(Boolean)
      query = query.in('department', departments)
    }

    query = query
      .order(sort, { ascending: order === 'asc' })
      .range(offset, offset + limit - 1)

    const { data: staff, error, count } = await query

    if (error) {
      console.error('Error fetching staff:', error)
      return ApiErrors.database(error.message)
    }

    return apiSuccess({
      staff: staff || [],
      total: count || 0,
      has_more: (count || 0) > offset + limit,
    }, 200, {
      'Cache-Control': 'private, max-age=10, stale-while-revalidate=30',
    })
  } catch (error) {
    console.error('Error in GET /api/staff:', error)
    return ApiErrors.internal()
  }
}
