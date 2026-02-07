/**
 * GET/POST/DELETE /api/slack/mappings/staff
 *
 * Manages staff ↔ Slack user mappings in entity_external_ids table.
 * Source: 'slack_user', entity_type: 'staff'
 */

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/auth/api-auth'
import { ROLES } from '@/lib/auth/roles'
import { apiSuccess, apiError, apiValidationError, ApiErrors } from '@/lib/api/response'
import { getAdminClient } from '@/lib/supabase/admin'
import { invalidateUsersCache } from '@/lib/connectors/slack-cache'

const CreateMappingSchema = z.object({
  staff_id: z.string().uuid('staff_id must be a valid UUID'),
  slack_user_id: z.string().min(1, 'slack_user_id is required'),
  slack_user_name: z.string().optional(),
})

/**
 * GET — Fetch all staff ↔ Slack user mappings
 */
export async function GET() {
  const auth = await requireRole(ROLES.ADMIN)
  if (!auth.authenticated) {
    return auth.response
  }

  try {
    const supabase = getAdminClient()

    const { data: mappings, error } = await supabase
      .from('entity_external_ids')
      .select('id, entity_id, external_id, metadata, created_at')
      .eq('entity_type', 'staff')
      .eq('source', 'slack_user')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching staff-slack mappings:', error)
      return ApiErrors.database()
    }

    // Get staff names
    const staffIds = mappings?.map(m => m.entity_id) || []
    let staffInfo: Record<string, { full_name: string; email: string }> = {}
    if (staffIds.length > 0) {
      const { data: staff } = await supabase
        .from('staff')
        .select('id, full_name, email')
        .in('id', staffIds)
      if (staff) {
        staffInfo = Object.fromEntries(staff.map(s => [s.id, { full_name: s.full_name, email: s.email }]))
      }
    }

    const enriched = mappings?.map(m => ({
      id: m.id,
      staff_id: m.entity_id,
      staff_name: staffInfo[m.entity_id]?.full_name || null,
      staff_email: staffInfo[m.entity_id]?.email || null,
      slack_user_id: m.external_id,
      slack_user_name: (m.metadata as Record<string, unknown>)?.slack_name || null,
      created_at: m.created_at,
    })) || []

    return apiSuccess({ mappings: enriched, count: enriched.length })
  } catch (error) {
    console.error('GET staff-slack mappings error:', error)
    return ApiErrors.internal()
  }
}

/**
 * POST — Create or update a staff ↔ Slack user mapping
 */
export async function POST(request: NextRequest) {
  const auth = await requireRole(ROLES.ADMIN)
  if (!auth.authenticated) {
    return auth.response
  }

  try {
    const body = await request.json()
    const validation = CreateMappingSchema.safeParse(body)
    if (!validation.success) {
      return apiValidationError(validation.error)
    }

    const { staff_id, slack_user_id, slack_user_name } = validation.data
    const supabase = getAdminClient()

    // Verify staff exists
    const { data: staff, error: staffError } = await supabase
      .from('staff')
      .select('id, full_name')
      .eq('id', staff_id)
      .single()

    if (staffError || !staff) {
      return ApiErrors.notFound('Staff member')
    }

    // Staff ↔ Slack is one-to-one per staff member. Update existing mapping row
    // if present, otherwise insert a new row. This avoids delete-then-insert races.
    const { data: existingRows, error: existingError } = await supabase
      .from('entity_external_ids')
      .select('id')
      .eq('entity_type', 'staff')
      .eq('entity_id', staff_id)
      .eq('source', 'slack_user')
      .order('updated_at', { ascending: false })
      .limit(1)

    if (existingError) {
      console.error('Error fetching existing staff-slack mapping:', existingError)
      return ApiErrors.database()
    }

    const payload = {
      entity_type: 'staff' as const,
      entity_id: staff_id,
      source: 'slack_user' as const,
      external_id: slack_user_id,
      metadata: slack_user_name ? { slack_name: slack_user_name } : {},
      updated_at: new Date().toISOString(),
    }

    let mapping: Record<string, unknown> | null = null
    let error: { code?: string; message: string } | null = null

    if (existingRows && existingRows.length > 0) {
      const { data: updated, error: updateError } = await supabase
        .from('entity_external_ids')
        .update(payload)
        .eq('id', existingRows[0].id)
        .select()
        .single()
      mapping = updated as Record<string, unknown>
      error = updateError ? { code: updateError.code, message: updateError.message } : null
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from('entity_external_ids')
        .insert(payload)
        .select()
        .single()
      mapping = inserted as Record<string, unknown>
      error = insertError ? { code: insertError.code, message: insertError.message } : null
    }

    if (error) {
      if (error.code === '23505') {
        return apiError('CONFLICT', 'This Slack user is already mapped to another staff member', 409)
      }
      console.error('Error saving staff-slack mapping:', error)
      return ApiErrors.database()
    }

    // Also update staff.slack_id field
    await supabase
      .from('staff')
      .update({ slack_id: slack_user_id })
      .eq('id', staff_id)

    invalidateUsersCache()

    return apiSuccess({
      mapping: {
        ...mapping,
        staff_name: staff.full_name,
      },
    }, 201)
  } catch (error) {
    console.error('POST staff-slack mapping error:', error)
    return ApiErrors.internal()
  }
}

/**
 * DELETE — Remove a staff ↔ Slack user mapping
 */
export async function DELETE(request: NextRequest) {
  const auth = await requireRole(ROLES.ADMIN)
  if (!auth.authenticated) {
    return auth.response
  }

  try {
    const { searchParams } = new URL(request.url)
    const mappingId = searchParams.get('id')

    if (!mappingId) {
      return apiError('VALIDATION_ERROR', 'Mapping ID is required', 400)
    }

    const supabase = getAdminClient()

    // Get the mapping first to clear staff.slack_id
    const { data: existing } = await supabase
      .from('entity_external_ids')
      .select('entity_id')
      .eq('id', mappingId)
      .eq('source', 'slack_user')
      .single()

    const { error } = await supabase
      .from('entity_external_ids')
      .delete()
      .eq('id', mappingId)
      .eq('source', 'slack_user')

    if (error) {
      console.error('Error deleting staff-slack mapping:', error)
      return ApiErrors.database()
    }

    // Clear staff.slack_id
    if (existing) {
      await supabase
        .from('staff')
        .update({ slack_id: null })
        .eq('id', existing.entity_id)
    }

    invalidateUsersCache()

    return apiSuccess({ deleted: true })
  } catch (error) {
    console.error('DELETE staff-slack mapping error:', error)
    return ApiErrors.internal()
  }
}
