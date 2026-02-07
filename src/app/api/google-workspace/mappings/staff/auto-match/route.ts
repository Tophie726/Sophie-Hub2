/**
 * POST /api/google-workspace/mappings/staff/auto-match
 *
 * Bulk auto-match staff to Google Workspace users:
 * 1. Primary email match → creates google_workspace_user mapping (auto-transfer OK)
 * 2. Alias email match → returned as suggestions only (no auto-transfer)
 * 3. Remaining → unmatched lists
 *
 * Per approved plan: aliases are suggestion-only, never auto-transferred.
 */

import { requireRole } from '@/lib/auth/api-auth'
import { ROLES } from '@/lib/auth/roles'
import { apiSuccess, ApiErrors } from '@/lib/api/response'
import { getAdminClient } from '@/lib/supabase/admin'
import { invalidateDirectoryUsersCache } from '@/lib/connectors/google-workspace-cache'
import type { DirectorySnapshotRow } from '@/lib/google-workspace/types'
import { resolveGoogleAccountType } from '@/lib/google-workspace/account-classification'
import { isStaffEligibleForAutoMapping } from '@/lib/staff/lifecycle'
import { refreshGoogleWorkspaceStaffApprovalQueue } from '@/lib/google-workspace/staff-approval-queue'

export async function POST() {
  const auth = await requireRole(ROLES.ADMIN)
  if (!auth.authenticated) {
    return auth.response
  }

  try {
    const supabase = getAdminClient()

    // 1. Fetch all directory users from snapshot
    const { data: directoryUsers, error: dirError } = await supabase
      .from('google_workspace_directory_snapshot')
      .select('*')

    if (dirError) {
      console.error('Failed to fetch directory snapshot:', dirError)
      return ApiErrors.database()
    }

    if (!directoryUsers || directoryUsers.length === 0) {
      return apiSuccess({
        matched: 0,
        message: 'No directory users in snapshot. Run a sync first.',
      })
    }

    const gwsUsers = directoryUsers as DirectorySnapshotRow[]
    const sharedGoogleUserIds = new Set(
      gwsUsers
        .filter(
          u =>
            resolveGoogleAccountType(u.primary_email, u.account_type_override, {
              fullName: u.full_name,
              orgUnitPath: u.org_unit_path,
              title: u.title,
            }).type ===
            'shared_account'
        )
        .map(u => u.google_user_id)
    )

    // 2. Fetch all staff with emails
    const { data: staff, error: staffError } = await supabase
      .from('staff')
      .select('id, full_name, email, status')
      .not('email', 'is', null)

    if (staffError) {
      console.error('Failed to fetch staff:', staffError)
      return ApiErrors.database()
    }

    // 3. Fetch existing mappings to skip already-mapped staff
    const { data: existingMappings } = await supabase
      .from('entity_external_ids')
      .select('entity_id, external_id')
      .eq('entity_type', 'staff')
      .eq('source', 'google_workspace_user')

    const alreadyMappedStaff = new Set((existingMappings || []).map(m => m.entity_id))
    const alreadyMappedGoogleUsers = new Set((existingMappings || []).map(m => m.external_id))

    // 4. Build lookup maps: Google users by primary email and alias email.
    const gwsByPrimaryEmail = new Map<string, DirectorySnapshotRow>()
    const gwsByAlias = new Map<string, DirectorySnapshotRow>()
    const existingStaffEmails = new Set(
      (staff || [])
        .map(s => (s.email || '').trim().toLowerCase())
        .filter(Boolean)
    )
    for (const u of gwsUsers) {
      gwsByPrimaryEmail.set(u.primary_email.toLowerCase(), u)
      if (u.aliases) {
        for (const alias of u.aliases) {
          gwsByAlias.set(alias.toLowerCase(), u)
        }
      }
    }

    // 5. Phase 1: Primary email match
    const matches: Array<{
      staff_id: string
      staff_name: string
      staff_email: string
      google_user_id: string
      google_email: string
    }> = []
    const unmatchedStaff: Array<{ id: string; name: string; email: string }> = []
    const matchedGoogleUserIds = new Set<string>()

    for (const s of staff || []) {
      if (!s.email) continue
      if (alreadyMappedStaff.has(s.id)) continue
      if (!isStaffEligibleForAutoMapping(s.status)) continue

      const gwsUser = gwsByPrimaryEmail.get(s.email.toLowerCase())
      if (
        gwsUser &&
        !sharedGoogleUserIds.has(gwsUser.google_user_id) &&
        !alreadyMappedGoogleUsers.has(gwsUser.google_user_id) &&
        !matchedGoogleUserIds.has(gwsUser.google_user_id)
      ) {
        matches.push({
          staff_id: s.id,
          staff_name: s.full_name,
          staff_email: s.email,
          google_user_id: gwsUser.google_user_id,
          google_email: gwsUser.primary_email,
        })
        matchedGoogleUserIds.add(gwsUser.google_user_id)
      } else if (!gwsUser) {
        unmatchedStaff.push({ id: s.id, name: s.full_name, email: s.email })
      }
    }

    // 6. Phase 2: Alias match for remaining unmatched staff (suggestions only)
    const suggestedAliasMatches: Array<{
      google_user_id: string
      google_email: string
      alias_email: string
      staff_id: string
      staff_name: string
      staff_email: string
    }> = []

    for (const unmatched of unmatchedStaff) {
      const gwsUser = gwsByAlias.get(unmatched.email.toLowerCase())
      if (
        gwsUser &&
        !sharedGoogleUserIds.has(gwsUser.google_user_id) &&
        !alreadyMappedGoogleUsers.has(gwsUser.google_user_id) &&
        !matchedGoogleUserIds.has(gwsUser.google_user_id)
      ) {
        suggestedAliasMatches.push({
          google_user_id: gwsUser.google_user_id,
          google_email: gwsUser.primary_email,
          alias_email: unmatched.email,
          staff_id: unmatched.id,
          staff_name: unmatched.name,
          staff_email: unmatched.email,
        })
      }
    }

    // Remove alias-suggested staff from unmatched list
    const suggestedStaffIds = new Set(suggestedAliasMatches.map(s => s.staff_id))
    const finalUnmatchedStaff = unmatchedStaff.filter(s => !suggestedStaffIds.has(s.id))

    // 7. Build unmatched Google users list
    const unmatchedGoogleUsers = gwsUsers
      .filter(
        u =>
          !sharedGoogleUserIds.has(u.google_user_id) &&
          !alreadyMappedGoogleUsers.has(u.google_user_id) &&
          !matchedGoogleUserIds.has(u.google_user_id)
      )
      .map(u => ({ id: u.google_user_id, email: u.primary_email, name: u.full_name || '' }))

    const staffApprovalCandidates = gwsUsers
      .filter(
        u =>
          !sharedGoogleUserIds.has(u.google_user_id) &&
          !alreadyMappedGoogleUsers.has(u.google_user_id) &&
          !matchedGoogleUserIds.has(u.google_user_id) &&
          !u.is_deleted &&
          !u.is_suspended &&
          !existingStaffEmails.has(u.primary_email.toLowerCase())
      )
      .map(u => ({
        google_user_id: u.google_user_id,
        email: u.primary_email,
        name: u.full_name || '',
        title: u.title || null,
        org_unit_path: u.org_unit_path || null,
        reason: 'unmatched_person_google_account',
      }))

    const sharedGoogleUsers = gwsUsers
      .filter(
        u =>
          sharedGoogleUserIds.has(u.google_user_id) &&
          !alreadyMappedGoogleUsers.has(u.google_user_id)
      )
      .map(u => ({ id: u.google_user_id, email: u.primary_email, name: u.full_name || '' }))

    // 8. Bulk upsert primary email matches into entity_external_ids
    if (matches.length > 0) {
      const records = matches.map(m => ({
        entity_type: 'staff' as const,
        entity_id: m.staff_id,
        source: 'google_workspace_user' as const,
        external_id: m.google_user_id,
        metadata: {
          primary_email: m.google_email,
          matched_by: 'auto_email',
          is_suspended: gwsByPrimaryEmail.get(m.google_email.toLowerCase())?.is_suspended || false,
          is_admin: gwsByPrimaryEmail.get(m.google_email.toLowerCase())?.is_admin || false,
          org_unit_path: gwsByPrimaryEmail.get(m.google_email.toLowerCase())?.org_unit_path || null,
        },
        created_by: auth.user.email,
      }))

      // Batch in groups of 50
      const BATCH_SIZE = 50
      for (let i = 0; i < records.length; i += BATCH_SIZE) {
        const batch = records.slice(i, i + BATCH_SIZE)
        const { error } = await supabase
          .from('entity_external_ids')
          .upsert(batch, { onConflict: 'source,external_id' })

        if (error) {
          console.error(`GWS auto-match batch ${i / BATCH_SIZE + 1} failed:`, error)
        }
      }

      // Also create alias mappings for matched users (insert-only, no transfer)
      for (const m of matches) {
        const gwsUser = gwsByPrimaryEmail.get(m.google_email.toLowerCase())
        if (gwsUser?.aliases) {
          for (const alias of gwsUser.aliases) {
            await supabase
              .from('entity_external_ids')
              .upsert(
                {
                  entity_type: 'staff',
                  entity_id: m.staff_id,
                  source: 'google_workspace_alias',
                  external_id: alias.toLowerCase(),
                  metadata: { alias_type: 'alias', google_user_id: gwsUser.google_user_id },
                  created_by: auth.user.email,
                },
                {
                  onConflict: 'source,external_id',
                  ignoreDuplicates: true, // DO NOTHING on conflict — never auto-transfer aliases
                }
              )
          }
        }
      }
    }

    invalidateDirectoryUsersCache()
    const approvalQueueSync = await refreshGoogleWorkspaceStaffApprovalQueue()

    return apiSuccess({
      total_staff: staff?.length || 0,
      total_google_users: gwsUsers.length,
      shared_google_users_skipped: sharedGoogleUsers.length,
      matched: matches.length,
      already_mapped: alreadyMappedStaff.size,
      suggested_alias_matches: suggestedAliasMatches,
      matches: matches.map(m => ({
        staff_name: m.staff_name,
        google_email: m.google_email,
      })),
      unmatched_staff: finalUnmatchedStaff.slice(0, 30),
      unmatched_google_users: unmatchedGoogleUsers.slice(0, 30),
      shared_google_users: sharedGoogleUsers.slice(0, 30),
      staff_approval_candidates: staffApprovalCandidates.slice(0, 50),
      staff_approvals_queue: approvalQueueSync,
    })
  } catch (error) {
    console.error('GWS staff auto-match error:', error)
    return ApiErrors.internal()
  }
}
