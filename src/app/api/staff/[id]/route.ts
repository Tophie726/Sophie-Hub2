import { getAdminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth/api-auth'
import { apiSuccess, ApiErrors, apiError, ErrorCodes } from '@/lib/api/response'
import { deduplicateLineage, type FieldLineageRow } from '@/types/lineage'
import { z } from 'zod'

const supabase = getAdminClient()

function normalizeStatusTag(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '_')
}

function normalizeStatusTags(value: unknown): string[] {
  if (!Array.isArray(value)) return []

  const normalized = value
    .map((tag) => (typeof tag === 'string' ? normalizeStatusTag(tag) : ''))
    .filter(Boolean)

  return Array.from(new Set(normalized))
}

const StaffUpdateSchema = z.object({
  role: z.string().min(1).max(100).optional(),
  status: z.string().min(1).max(100).optional(),
  status_tags: z.array(z.string().min(1).max(64)).max(20).optional(),
}).refine(data => data.role !== undefined || data.status !== undefined || data.status_tags !== undefined, {
  message: 'At least one field is required',
})

/**
 * GET /api/staff/[id]
 *
 * Get a single staff member with partner assignments.
 * Runs queries in parallel for performance.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth()
  if (!auth.authenticated) return auth.response

  try {
    const { id } = await params

    const [staffResult, assignmentsResult, lineageResult] = await Promise.all([
      supabase
        .from('staff')
        .select('*')
        .eq('id', id)
        .single(),
      supabase
        .from('partner_assignments')
        .select('id, assignment_role, is_primary, partner:partner_id(id, brand_name, status)')
        .eq('staff_id', id)
        .is('unassigned_at', null)
        .order('assignment_role'),
      supabase
        .from('field_lineage')
        .select('field_name, source_type, source_ref, previous_value, new_value, changed_at, sync_run_id')
        .eq('entity_type', 'staff')
        .eq('entity_id', id)
        .order('changed_at', { ascending: false }),
    ])

    if (staffResult.error) {
      if (staffResult.error.code === 'PGRST116') {
        return ApiErrors.notFound('Staff member')
      }
      console.error('Error fetching staff:', staffResult.error)
      return ApiErrors.database(staffResult.error.message)
    }

    // Deduplicate lineage to get most recent per field
    const lineage = deduplicateLineage((lineageResult.data || []) as FieldLineageRow[])

    return apiSuccess({
      staff: {
        ...staffResult.data,
        status_tags: normalizeStatusTags(staffResult.data.status_tags),
        assigned_partners: assignmentsResult.data || [],
        lineage,
      },
    })
  } catch (error) {
    console.error('Error in GET /api/staff/[id]:', error)
    return ApiErrors.internal()
  }
}

/**
 * PATCH /api/staff/[id]
 *
 * Update editable staff fields from list/detail UI.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth()
  if (!auth.authenticated) return auth.response
  if (auth.user.role !== 'admin') {
    return ApiErrors.forbidden('Only admins can update staff records')
  }

  try {
    const { id } = await params
    const body = await request.json()
    const parsed = StaffUpdateSchema.safeParse(body)

    if (!parsed.success) {
      return apiError(ErrorCodes.VALIDATION_ERROR, parsed.error.message, 400)
    }

    const updates: Record<string, unknown> = {}
    if (parsed.data.role !== undefined) updates.role = parsed.data.role.trim()
    if (parsed.data.status !== undefined) updates.status = normalizeStatusTag(parsed.data.status)
    if (parsed.data.status_tags !== undefined) updates.status_tags = normalizeStatusTags(parsed.data.status_tags)

    const { data, error } = await supabase
      .from('staff')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return ApiErrors.notFound('Staff member')
      }
      console.error('Error updating staff:', error)
      return ApiErrors.database(error.message)
    }

    return apiSuccess({
      staff: {
        ...data,
        status_tags: normalizeStatusTags(data.status_tags),
      },
    })
  } catch (error) {
    console.error('Error in PATCH /api/staff/[id]:', error)
    return ApiErrors.internal()
  }
}
