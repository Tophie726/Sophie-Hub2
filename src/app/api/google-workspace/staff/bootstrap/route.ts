/**
 * POST /api/google-workspace/staff/bootstrap
 *
 * First-run bootstrap flow:
 * - Create staff records from Google Workspace person accounts (email anchor).
 * - Create staff<->google mappings for both newly created and existing-by-email staff.
 *
 * Excludes shared inboxes and suspended/deleted directory accounts.
 */

import { requireRole } from '@/lib/auth/api-auth'
import { ROLES } from '@/lib/auth/roles'
import { apiSuccess, ApiErrors } from '@/lib/api/response'
import { getAdminClient } from '@/lib/supabase/admin'
import { classifyGoogleAccountEmail } from '@/lib/google-workspace/account-classification'
import {
  refreshGoogleWorkspaceStaffApprovalQueue,
  resolveGoogleWorkspaceApprovalByUserId,
} from '@/lib/google-workspace/staff-approval-queue'
import { invalidateDirectoryUsersCache } from '@/lib/connectors/google-workspace-cache'

type SnapshotRow = {
  google_user_id: string
  primary_email: string
  full_name: string | null
  title: string | null
  org_unit_path: string | null
  thumbnail_photo_url: string | null
  is_suspended: boolean
  is_deleted: boolean
  is_admin: boolean
}

function nameFromEmail(email: string): string {
  const local = email.split('@')[0] || ''
  return local
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || email
}

export async function POST() {
  const auth = await requireRole(ROLES.ADMIN)
  if (!auth.authenticated) {
    return auth.response
  }

  try {
    const supabase = getAdminClient()

    const { data: snapshot, error: snapshotError } = await supabase
      .from('google_workspace_directory_snapshot')
      .select('google_user_id, primary_email, full_name, title, org_unit_path, thumbnail_photo_url, is_suspended, is_deleted, is_admin')
      .order('primary_email', { ascending: true })

    if (snapshotError) {
      console.error('Failed to load directory snapshot for bootstrap:', snapshotError)
      return ApiErrors.database()
    }

    const sourceUsers = (snapshot || []) as SnapshotRow[]
    if (sourceUsers.length === 0) {
      return apiSuccess({
        created_staff: 0,
        mapped_existing_staff: 0,
        skipped: {
          shared: 0,
          suspended_or_deleted: 0,
          already_mapped_google_user: 0,
        },
        message: 'No Google Workspace users found in snapshot. Run Sync Directory first.',
      })
    }

    const [{ data: existingMappings }, { data: existingStaff }] = await Promise.all([
      supabase
        .from('entity_external_ids')
        .select('external_id')
        .eq('entity_type', 'staff')
        .eq('source', 'google_workspace_user'),
      supabase
        .from('staff')
        .select('id, email')
        .not('email', 'is', null),
    ])

    const mappedGoogleUsers = new Set((existingMappings || []).map(m => m.external_id))
    const staffByEmail = new Map(
      (existingStaff || []).map(s => [String(s.email).toLowerCase(), s.id as string])
    )

    let createdStaff = 0
    let mappedExistingStaff = 0
    let skippedShared = 0
    let skippedSuspendedOrDeleted = 0
    let skippedAlreadyMappedGoogle = 0

    for (const user of sourceUsers) {
      if (user.is_suspended || user.is_deleted) {
        skippedSuspendedOrDeleted++
        continue
      }

      const classification = classifyGoogleAccountEmail(user.primary_email)
      if (classification.type === 'shared_account') {
        skippedShared++
        continue
      }

      if (mappedGoogleUsers.has(user.google_user_id)) {
        skippedAlreadyMappedGoogle++
        continue
      }

      const emailKey = user.primary_email.toLowerCase()
      let staffId = staffByEmail.get(emailKey) || null

      if (!staffId) {
        const fullName = (user.full_name || '').trim() || nameFromEmail(user.primary_email)
        const { data: inserted, error: insertError } = await supabase
          .from('staff')
          .insert({
            full_name: fullName,
            email: user.primary_email,
            role: 'staff',
            status: 'onboarding',
            title: user.title,
            avatar_url: user.thumbnail_photo_url,
            timezone: null,
          })
          .select('id')
          .single()

        if (insertError) {
          // If another process created the same email concurrently, re-read and continue.
          if (insertError.code === '23505') {
            const { data: existingByEmail } = await supabase
              .from('staff')
              .select('id')
              .eq('email', user.primary_email)
              .single()
            staffId = existingByEmail?.id || null
          } else {
            console.error(`Failed to insert staff for ${user.primary_email}:`, insertError)
            continue
          }
        } else {
          staffId = inserted?.id || null
          if (staffId) {
            createdStaff++
            staffByEmail.set(emailKey, staffId)
          }
        }
      } else {
        mappedExistingStaff++
      }

      if (!staffId) continue

      const { error: mapError } = await supabase
        .from('entity_external_ids')
        .upsert(
          {
            entity_type: 'staff',
            entity_id: staffId,
            source: 'google_workspace_user',
            external_id: user.google_user_id,
            metadata: {
              primary_email: user.primary_email,
              matched_by: 'bootstrap_google',
              is_suspended: user.is_suspended,
              is_admin: user.is_admin,
              org_unit_path: user.org_unit_path,
            },
            created_by: auth.user.email,
          },
          { onConflict: 'source,external_id' }
        )

      if (mapError) {
        console.error(`Failed to map ${user.primary_email} -> staff ${staffId}:`, mapError)
        continue
      }

      mappedGoogleUsers.add(user.google_user_id)
      try {
        await resolveGoogleWorkspaceApprovalByUserId(user.google_user_id)
      } catch (queueError) {
        console.error('Failed to resolve queue item during bootstrap:', queueError)
      }
    }

    invalidateDirectoryUsersCache()
    const queueSync = await refreshGoogleWorkspaceStaffApprovalQueue()

    return apiSuccess({
      created_staff: createdStaff,
      mapped_existing_staff: mappedExistingStaff,
      skipped: {
        shared: skippedShared,
        suspended_or_deleted: skippedSuspendedOrDeleted,
        already_mapped_google_user: skippedAlreadyMappedGoogle,
      },
      staff_approvals_queue: queueSync,
    })
  } catch (error) {
    console.error('Google Workspace staff bootstrap error:', error)
    return ApiErrors.internal()
  }
}
