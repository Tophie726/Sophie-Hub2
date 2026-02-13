import { z } from 'zod'
import { getAdminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth/api-auth'
import { apiSuccess, ApiErrors, apiError, ErrorCodes } from '@/lib/api/response'
import { logStaffBulkUpdate } from '@/lib/audit/admin-audit'

const supabase = getAdminClient()

const TagOperationSchema = z.enum(['set', 'add', 'remove', 'clear'])

const StaffBulkPatchSchema = z.object({
  staff_ids: z.array(z.string().uuid()).min(1).max(500),
  updates: z.object({
    role: z.string().min(1).max(100).optional(),
    status: z.string().min(1).max(100).optional(),
    status_tags: z.array(z.string().min(1).max(64)).max(20).optional(),
  }).optional(),
  status_tags_op: TagOperationSchema.optional(),
}).superRefine((data, ctx) => {
  const hasFieldUpdates = Boolean(
    data.updates &&
    (data.updates.role !== undefined ||
      data.updates.status !== undefined ||
      data.updates.status_tags !== undefined)
  )
  const hasTagOp = data.status_tags_op !== undefined

  if (!hasFieldUpdates && !hasTagOp) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'At least one update is required',
      path: ['updates'],
    })
  }

  if (
    data.status_tags_op &&
    data.status_tags_op !== 'clear' &&
    (!data.updates?.status_tags || data.updates.status_tags.length === 0)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'status_tags are required for this tag operation',
      path: ['updates', 'status_tags'],
    })
  }
})

function normalizeToken(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '_')
}

function normalizeTokens(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const normalized = value
    .map((entry) => (typeof entry === 'string' ? normalizeToken(entry) : ''))
    .filter(Boolean)
  return Array.from(new Set(normalized))
}

type ExistingStaffRow = {
  id: string
  status: string | null
  status_tags: string[] | null
}

function computeNextTags(
  existing: ExistingStaffRow,
  op: z.infer<typeof TagOperationSchema> | undefined,
  requestedTags: string[],
  nextStatus: string | undefined
): string[] {
  const current = normalizeTokens(existing.status_tags)
  let next = current

  if (op === 'set') {
    next = [...requestedTags]
  } else if (op === 'add') {
    next = Array.from(new Set([...current, ...requestedTags]))
  } else if (op === 'remove') {
    const removeSet = new Set(requestedTags)
    next = current.filter((tag) => !removeSet.has(tag))
  } else if (op === 'clear') {
    next = []
  }

  const primaryStatus = normalizeToken(nextStatus ?? existing.status ?? '')
  if (primaryStatus) {
    next = next.filter((tag) => tag !== primaryStatus)
  }

  return next
}

/**
 * PATCH /api/staff/bulk
 *
 * Bulk update staff lifecycle metadata (role/status/status_tags).
 * Admin-only endpoint.
 */
export async function PATCH(request: Request) {
  const auth = await requireAuth()
  if (!auth.authenticated) return auth.response
  if (auth.user.role !== 'admin') {
    return ApiErrors.forbidden('Only admins can bulk update staff records')
  }

  try {
    const body = await request.json()
    const parsed = StaffBulkPatchSchema.safeParse(body)

    if (!parsed.success) {
      return apiError(ErrorCodes.VALIDATION_ERROR, parsed.error.message, 400)
    }

    const { staff_ids, updates, status_tags_op } = parsed.data
    const normalizedRole = updates?.role?.trim()
    const normalizedStatus = updates?.status ? normalizeToken(updates.status) : undefined
    const requestedTags = normalizeTokens(updates?.status_tags)

    const { data: existingRows, error: existingError } = await supabase
      .from('staff')
      .select('id, status, status_tags')
      .in('id', staff_ids)

    if (existingError) {
      console.error('Error loading staff for bulk update:', existingError)
      return ApiErrors.database(existingError.message)
    }

    const currentRows = (existingRows || []) as ExistingStaffRow[]
    if (currentRows.length === 0) {
      return ApiErrors.notFound('Staff records')
    }

    const rowIds = currentRows.map((row) => row.id)
    const updatePayloadById = new Map<string, Record<string, unknown>>()

    for (const row of currentRows) {
      const payload: Record<string, unknown> = {}
      if (normalizedRole !== undefined) payload.role = normalizedRole
      if (normalizedStatus !== undefined) payload.status = normalizedStatus

      if (status_tags_op !== undefined || updates?.status_tags !== undefined || normalizedStatus !== undefined) {
        payload.status_tags = computeNextTags(row, status_tags_op, requestedTags, normalizedStatus)
      }

      if (Object.keys(payload).length > 0) {
        updatePayloadById.set(row.id, payload)
      }
    }

    if (updatePayloadById.size === 0) {
      return apiSuccess({
        updated_count: 0,
        selected_count: rowIds.length,
      })
    }

    const updatePromises = Array.from(updatePayloadById.entries()).map(([id, payload]) =>
      supabase
        .from('staff')
        .update(payload)
        .eq('id', id)
    )

    const updateResults = await Promise.all(updatePromises)
    const firstError = updateResults.find((result) => result.error)?.error
    if (firstError) {
      console.error('Error bulk updating staff:', firstError)
      return ApiErrors.database(firstError.message)
    }

    const updatedCount = updatePayloadById.size

    await logStaffBulkUpdate(auth.user.id, auth.user.email, {
      selected_count: rowIds.length,
      updated_count: updatedCount,
      updated_ids_sample: rowIds.slice(0, 25),
      role: normalizedRole ?? null,
      status: normalizedStatus ?? null,
      status_tags_operation: status_tags_op ?? null,
      status_tags: requestedTags,
    })

    return apiSuccess({
      selected_count: rowIds.length,
      updated_count: updatedCount,
    })
  } catch (error) {
    console.error('Error in PATCH /api/staff/bulk:', error)
    return ApiErrors.internal()
  }
}
