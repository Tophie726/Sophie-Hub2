/**
 * POST /api/google-workspace/sync
 *
 * Trigger a full directory sync: pull all users from Google, upsert into
 * local snapshot, tombstone users no longer present.
 *
 * Critical safety rule (from approved plan):
 * Tombstones (is_deleted = true) are ONLY applied after a successful full
 * directory pull (all pages consumed). Partial/failed runs must NOT
 * tombstone unseen users.
 */

import { requireRole } from '@/lib/auth/api-auth'
import { ROLES } from '@/lib/auth/roles'
import { apiSuccess, ApiErrors } from '@/lib/api/response'
import { getAdminClient } from '@/lib/supabase/admin'
import { googleWorkspaceConnector } from '@/lib/connectors/google-workspace'
import { invalidateDirectoryUsersCache } from '@/lib/connectors/google-workspace-cache'
import type { GoogleDirectoryUser } from '@/lib/google-workspace/types'
import type { DirectoryDriftEvent } from '@/lib/google-workspace/types'
import { refreshGoogleWorkspaceStaffApprovalQueue } from '@/lib/google-workspace/staff-approval-queue'

function isSnapshotSchemaError(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code
  return code === '42P01' || code === '42703' || code === 'PGRST204' || code === 'PGRST205'
}

export async function POST() {
  const auth = await requireRole(ROLES.ADMIN)
  if (!auth.authenticated) {
    return auth.response
  }

  try {
    const domain = process.env.GOOGLE_WORKSPACE_DOMAIN
    if (!domain) {
      return apiSuccess({
        success: false,
        error: 'GOOGLE_WORKSPACE_DOMAIN environment variable is not set',
      })
    }

    const supabase = getAdminClient()

    // 1. Pull full directory from Google API (all pages)
    let directoryUsers: GoogleDirectoryUser[]
    try {
      directoryUsers = await googleWorkspaceConnector.listDirectoryUsers(domain, {
        includeSuspended: true,
        includeDeleted: false, // Google's deleted-user API has a 20-day window; we handle tombstones locally
      })
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Directory pull failed'
      console.error('Directory sync: API pull failed:', msg)
      return apiSuccess({
        success: false,
        error: `Directory pull failed: ${msg}. No changes applied.`,
        tombstoned: 0,
      })
    }

    // 2. Fetch existing snapshot for drift detection
    const { data: existingSnapshot, error: existingSnapshotError } = await supabase
      .from('google_workspace_directory_snapshot')
      .select('google_user_id, primary_email, is_suspended, is_deleted')

    if (existingSnapshotError) {
      if (isSnapshotSchemaError(existingSnapshotError)) {
        return apiSuccess({
          success: false,
          error: 'Google Workspace snapshot table is missing or out of date. Please apply migration: supabase/migrations/20260207_google_workspace_connector.sql',
          tombstoned: 0,
        })
      }
      console.error('Directory sync: failed to read existing snapshot:', existingSnapshotError)
      return ApiErrors.database()
    }

    const existingByGoogleId = new Map(
      (existingSnapshot || []).map(r => [r.google_user_id, r])
    )

    // 3. Upsert each directory user into snapshot
    const now = new Date().toISOString()
    const driftEvents: DirectoryDriftEvent[] = []
    const pulledGoogleIds = new Set<string>()
    let upserted = 0

    for (const user of directoryUsers) {
      pulledGoogleIds.add(user.id)

      const existing = existingByGoogleId.get(user.id)
      const primaryPhone = user.phones?.find(p => p.primary)?.value || user.phones?.[0]?.value || null
      const aliases = Array.from(new Set([...(user.aliases || []), ...(user.nonEditableAliases || [])]))

      // Detect drift events
      if (!existing) {
        driftEvents.push({
          type: 'new_user',
          google_user_id: user.id,
          email: user.primaryEmail,
          name: user.name.fullName,
        })
      } else {
        if (existing.primary_email !== user.primaryEmail) {
          driftEvents.push({
            type: 'email_changed',
            google_user_id: user.id,
            email: user.primaryEmail,
            name: user.name.fullName,
            details: `Changed from ${existing.primary_email}`,
          })
        }
        if (!existing.is_suspended && user.suspended) {
          driftEvents.push({
            type: 'user_suspended',
            google_user_id: user.id,
            email: user.primaryEmail,
            name: user.name.fullName,
          })
        }
        if (existing.is_suspended && !user.suspended) {
          driftEvents.push({
            type: 'user_reinstated',
            google_user_id: user.id,
            email: user.primaryEmail,
            name: user.name.fullName,
          })
        }
      }

      // Upsert into snapshot
      const { error } = await supabase
        .from('google_workspace_directory_snapshot')
        .upsert(
          {
            google_user_id: user.id,
            primary_email: user.primaryEmail,
            full_name: user.name.fullName,
            given_name: user.name.givenName || null,
            family_name: user.name.familyName || null,
            org_unit_path: user.orgUnitPath || null,
            is_suspended: user.suspended,
            is_deleted: false, // User is present in pull → not deleted
            is_admin: user.isAdmin,
            is_delegated_admin: user.isDelegatedAdmin || false,
            title: user.title || null,
            phone: primaryPhone,
            thumbnail_photo_url: user.thumbnailPhotoUrl || null,
            aliases,
            non_editable_aliases: user.nonEditableAliases || [],
            creation_time: user.creationTime || null,
            last_login_time: user.lastLoginTime || null,
            department: user.department || null,
            cost_center: user.costCenter || null,
            location: user.location || null,
            manager_email: user.managerEmail || null,
            raw_profile: user.rawProfile || null,
            last_seen_at: now,
          },
          { onConflict: 'google_user_id' }
        )

      if (error) {
        if (isSnapshotSchemaError(error)) {
          return apiSuccess({
            success: false,
            error: 'Google Workspace snapshot table is missing or out of date. Please apply migration: supabase/migrations/20260212_google_workspace_snapshot_extended.sql',
            tombstoned: 0,
          })
        }
        console.error(`Failed to upsert snapshot for ${user.primaryEmail}:`, error)
      } else {
        upserted++
      }
    }

    // 4. Tombstone users NOT in this pull (safe: full pull completed successfully)
    let tombstoned = 0
    for (const [googleId, existing] of Array.from(existingByGoogleId.entries())) {
      if (!pulledGoogleIds.has(googleId) && !existing.is_deleted) {
        const { error } = await supabase
          .from('google_workspace_directory_snapshot')
          .update({ is_deleted: true, updated_at: now })
          .eq('google_user_id', googleId)

        if (!error) {
          tombstoned++
          driftEvents.push({
            type: 'user_deleted',
            google_user_id: googleId,
            email: existing.primary_email,
            name: '',
            details: 'No longer in directory pull',
          })
        }
      }
    }

    invalidateDirectoryUsersCache()
    const approvalQueueSync = await refreshGoogleWorkspaceStaffApprovalQueue()

    return apiSuccess({
      success: true,
      total_pulled: directoryUsers.length,
      upserted,
      tombstoned,
      drift_events: driftEvents,
      staff_approvals_queue: approvalQueueSync,
      completed_at: now,
    })
  } catch (error) {
    console.error('Directory sync error:', error)
    return ApiErrors.internal()
  }
}
