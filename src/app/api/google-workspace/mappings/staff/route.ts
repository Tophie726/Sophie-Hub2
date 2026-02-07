/**
 * GET/POST/DELETE /api/google-workspace/mappings/staff
 *
 * CRUD for staff ↔ Google Workspace user mappings via entity_external_ids.
 *
 * - GET: List current mappings (google_workspace_user source)
 * - POST: Create/update a manual mapping
 * - DELETE: Remove a mapping
 */

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/auth/api-auth'
import { ROLES } from '@/lib/auth/roles'
import { apiSuccess, apiValidationError, ApiErrors } from '@/lib/api/response'
import { getAdminClient } from '@/lib/supabase/admin'
import { invalidateDirectoryUsersCache } from '@/lib/connectors/google-workspace-cache'
import {
  refreshGoogleWorkspaceStaffApprovalQueue,
  resolveGoogleWorkspaceApprovalByUserId,
} from '@/lib/google-workspace/staff-approval-queue'

// =============================================================================
// GET — List all staff-Google Workspace mappings
// =============================================================================

export async function GET() {
  const auth = await requireRole(ROLES.ADMIN)
  if (!auth.authenticated) {
    return auth.response
  }

  try {
    const supabase = getAdminClient()

    const { data: mappings, error } = await supabase
      .from('entity_external_ids')
      .select('id, entity_id, external_id, metadata, created_at, updated_at, created_by')
      .eq('entity_type', 'staff')
      .eq('source', 'google_workspace_user')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Failed to fetch GWS mappings:', error)
      return ApiErrors.database()
    }

    const staffIds = Array.from(new Set((mappings || []).map(m => m.entity_id)))
    let staffById = new Map<string, { full_name: string | null; avatar_url: string | null }>()

    if (staffIds.length > 0) {
      const { data: staffRows } = await supabase
        .from('staff')
        .select('id, full_name, avatar_url')
        .in('id', staffIds)

      staffById = new Map(
        (staffRows || []).map(s => [s.id, { full_name: s.full_name, avatar_url: s.avatar_url }])
      )
    }

    const enriched = (mappings || []).map(m => {
      const staff = staffById.get(m.entity_id)
      return {
        ...m,
        google_user_id: m.external_id,
        staff_id: m.entity_id,
        staff_name: staff?.full_name || null,
        staff_avatar_url: staff?.avatar_url || null,
      }
    })

    return apiSuccess({ mappings: enriched, count: enriched.length })
  } catch (error) {
    console.error('GWS mappings GET error:', error)
    return ApiErrors.internal()
  }
}

// =============================================================================
// POST — Create or update a manual mapping
// =============================================================================

const CreateMappingSchema = z.object({
  staff_id: z.string().uuid('staff_id must be a valid UUID'),
  google_user_id: z.string().min(1, 'google_user_id is required'),
  primary_email: z.string().email().optional(),
  org_unit_path: z.string().optional(),
  is_suspended: z.boolean().optional(),
  is_admin: z.boolean().optional(),
})

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

    const { staff_id, google_user_id, primary_email, org_unit_path, is_suspended, is_admin } = validation.data
    const supabase = getAdminClient()

    const { data, error } = await supabase
      .from('entity_external_ids')
      .upsert(
        {
          entity_type: 'staff',
          entity_id: staff_id,
          source: 'google_workspace_user',
          external_id: google_user_id,
          metadata: {
            primary_email: primary_email || null,
            org_unit_path: org_unit_path || null,
            is_suspended: is_suspended || false,
            is_admin: is_admin || false,
            matched_by: 'manual',
          },
          created_by: auth.user.email,
        },
        { onConflict: 'source,external_id' }
      )
      .select()
      .single()

    if (error) {
      console.error('Failed to create GWS mapping:', error)
      if (error.code === '23505') {
        return ApiErrors.conflict('This Google user is already mapped to another staff member')
      }
      return ApiErrors.database()
    }

    try {
      await resolveGoogleWorkspaceApprovalByUserId(google_user_id)
    } catch (queueError) {
      console.error('Failed to resolve staff approval candidate:', queueError)
    }

    invalidateDirectoryUsersCache()

    return apiSuccess({ mapping: data }, 201)
  } catch (error) {
    console.error('GWS mapping POST error:', error)
    return ApiErrors.internal()
  }
}

// =============================================================================
// DELETE — Remove a mapping
// =============================================================================

const DeleteMappingSchema = z.object({
  google_user_id: z.string().min(1, 'google_user_id is required'),
})

export async function DELETE(request: NextRequest) {
  const auth = await requireRole(ROLES.ADMIN)
  if (!auth.authenticated) {
    return auth.response
  }

  try {
    const body = await request.json()
    const validation = DeleteMappingSchema.safeParse(body)
    if (!validation.success) {
      return apiValidationError(validation.error)
    }

    const { google_user_id } = validation.data
    const supabase = getAdminClient()

    // Delete the user mapping
    const { error } = await supabase
      .from('entity_external_ids')
      .delete()
      .eq('source', 'google_workspace_user')
      .eq('external_id', google_user_id)

    if (error) {
      console.error('Failed to delete GWS mapping:', error)
      return ApiErrors.database()
    }

    // Also delete any alias mappings for the same Google user
    // (aliases are keyed by alias email, so we need to look them up first)
    // This is safe because alias rows belong to the same staff member
    const { error: aliasError } = await supabase
      .from('entity_external_ids')
      .delete()
      .eq('source', 'google_workspace_alias')
      .eq('metadata->>google_user_id', google_user_id)

    if (aliasError) {
      console.error('Failed to clean up alias mappings:', aliasError)
      // Non-fatal — user mapping was already deleted
    }

    try {
      await refreshGoogleWorkspaceStaffApprovalQueue()
    } catch (queueError) {
      console.error('Failed to refresh staff approval queue after delete:', queueError)
    }

    invalidateDirectoryUsersCache()

    return apiSuccess({ deleted: true })
  } catch (error) {
    console.error('GWS mapping DELETE error:', error)
    return ApiErrors.internal()
  }
}
