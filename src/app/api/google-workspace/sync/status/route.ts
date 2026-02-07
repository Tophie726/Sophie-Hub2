/**
 * GET /api/google-workspace/sync/status
 *
 * Return current sync state: snapshot stats, last sync time, drift summary.
 */

import { requireRole } from '@/lib/auth/api-auth'
import { ROLES } from '@/lib/auth/roles'
import { apiSuccess, ApiErrors } from '@/lib/api/response'
import { getAdminClient } from '@/lib/supabase/admin'
import { classifyGoogleAccountEmail } from '@/lib/google-workspace/account-classification'
import { isStaffEligibleForAutoMapping } from '@/lib/staff/lifecycle'

function isSnapshotSchemaError(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code
  return code === '42P01' || code === '42703' || code === 'PGRST204' || code === 'PGRST205'
}

function isQueueSchemaError(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code
  return code === '42P01' || code === '42703' || code === 'PGRST204' || code === 'PGRST205'
}

export async function GET() {
  const auth = await requireRole(ROLES.ADMIN)
  if (!auth.authenticated) {
    return auth.response
  }

  try {
    const supabase = getAdminClient()

    // Get snapshot stats
    const { data: snapshot, error } = await supabase
      .from('google_workspace_directory_snapshot')
      .select('google_user_id, is_suspended, is_deleted, last_seen_at, primary_email')

    if (error) {
      if (isSnapshotSchemaError(error)) {
        return apiSuccess({
          snapshot_stats: {
            total: 0,
            active: 0,
            active_people: 0,
            active_shared: 0,
            suspended: 0,
            deleted: 0,
          },
          mappings: 0,
          pending_staff_approvals: 0,
          last_sync_at: null,
          has_snapshot: false,
          setup_required: true,
        })
      }
      console.error('Failed to fetch sync status:', error)
      return ApiErrors.database()
    }

    const rows = snapshot || []
    const { data: mappedRows } = await supabase
      .from('entity_external_ids')
      .select('external_id, entity_id')
      .eq('entity_type', 'staff')
      .eq('source', 'google_workspace_user')

    const mappedStaffIds = Array.from(new Set((mappedRows || []).map(m => m.entity_id)))
    const inactiveStaffIds = new Set<string>()
    if (mappedStaffIds.length > 0) {
      const { data: mappedStaffRows } = await supabase
        .from('staff')
        .select('id, status')
        .in('id', mappedStaffIds)

      for (const row of mappedStaffRows || []) {
        if (!isStaffEligibleForAutoMapping(row.status)) {
          inactiveStaffIds.add(row.id)
        }
      }
    }

    const inactiveMappedGoogleUsers = new Set(
      (mappedRows || [])
        .filter(m => inactiveStaffIds.has(m.entity_id))
        .map(m => m.external_id)
    )

    const total = rows.length
    const active = rows.filter(r => !r.is_suspended && !r.is_deleted).length
    const activePeople = rows.filter(
      r =>
        !r.is_suspended &&
        !r.is_deleted &&
        !inactiveMappedGoogleUsers.has(r.google_user_id) &&
        classifyGoogleAccountEmail(r.primary_email).type !== 'shared_account'
    ).length
    const activeShared = rows.filter(
      r =>
        !r.is_suspended &&
        !r.is_deleted &&
        classifyGoogleAccountEmail(r.primary_email).type === 'shared_account'
    ).length
    const suspended = rows.filter(r => r.is_suspended && !r.is_deleted).length
    const deleted = rows.filter(r => r.is_deleted).length

    // Find the most recent last_seen_at as "last sync time"
    const lastSyncAt = rows.length > 0
      ? rows.reduce((latest, r) => r.last_seen_at > latest ? r.last_seen_at : latest, rows[0].last_seen_at)
      : null

    // Count mappings
    const { count: mappingCount } = await supabase
      .from('entity_external_ids')
      .select('id', { count: 'exact', head: true })
      .eq('entity_type', 'staff')
      .eq('source', 'google_workspace_user')

    const { count: pendingApprovals, error: approvalError } = await supabase
      .from('staff_approval_queue')
      .select('id', { count: 'exact', head: true })
      .eq('source', 'google_workspace')
      .eq('status', 'pending')

    if (approvalError && !isQueueSchemaError(approvalError)) {
      console.error('Failed to fetch pending staff approvals:', approvalError)
    }

    return apiSuccess({
      snapshot_stats: {
        total,
        active,
        active_people: activePeople,
        active_shared: activeShared,
        suspended,
        deleted,
      },
      mappings: mappingCount || 0,
      pending_staff_approvals: approvalError ? 0 : (pendingApprovals || 0),
      last_sync_at: lastSyncAt,
      has_snapshot: total > 0,
    })
  } catch (error) {
    console.error('Sync status error:', error)
    return ApiErrors.internal()
  }
}
