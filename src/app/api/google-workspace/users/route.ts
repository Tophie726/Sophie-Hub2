/**
 * GET /api/google-workspace/users
 *
 * List directory users from the local snapshot table (not live API).
 * Cached with stale-while-revalidate pattern.
 *
 * Returns all users including suspended/deleted for admin visibility.
 */

import { requireRole } from '@/lib/auth/api-auth'
import { ROLES } from '@/lib/auth/roles'
import { apiSuccess, ApiErrors } from '@/lib/api/response'
import { getAdminClient } from '@/lib/supabase/admin'
import {
  getCachedDirectoryUsers,
  setCachedDirectoryUsers,
  isDirectoryUsersCacheStale,
  getDirectoryUsersRefreshInProgress,
  setDirectoryUsersRefreshInProgress,
} from '@/lib/connectors/google-workspace-cache'
import type { DirectorySnapshotRow } from '@/lib/google-workspace/types'

/** Snapshot row without raw_profile — used for browser-facing responses */
type DirectoryUserRow = Omit<DirectorySnapshotRow, 'raw_profile'>
import { resolveGoogleAccountType } from '@/lib/google-workspace/account-classification'

function isSnapshotSchemaError(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code
  return code === '42P01' || code === '42703' || code === 'PGRST204' || code === 'PGRST205'
}

async function fetchSnapshotUsers(): Promise<DirectoryUserRow[]> {
  const supabase = getAdminClient()

  const { data, error } = await supabase
    .from('google_workspace_directory_snapshot')
    .select(
      'id, google_user_id, primary_email, full_name, given_name, family_name, ' +
      'org_unit_path, is_suspended, is_deleted, is_admin, is_delegated_admin, ' +
      'title, phone, thumbnail_photo_url, aliases, non_editable_aliases, ' +
      'creation_time, last_login_time, department, cost_center, location, ' +
      'manager_email, account_type_override, last_seen_at, first_seen_at, ' +
      'created_at, updated_at'
    )
    .order('primary_email', { ascending: true })

  if (error) {
    if (isSnapshotSchemaError(error)) {
      // First-run or schema drift: treat as empty snapshot so UI can guide operator to sync.
      return []
    }
    console.error('Failed to fetch directory snapshot:', error)
    throw error
  }

  return (data || []) as unknown as DirectoryUserRow[]
}

export async function GET() {
  const auth = await requireRole(ROLES.ADMIN)
  if (!auth.authenticated) {
    return auth.response
  }

  try {
    // Check cache first
    const cached = getCachedDirectoryUsers()
    if (cached) {
      // If stale, trigger background refresh
      if (isDirectoryUsersCacheStale() && !getDirectoryUsersRefreshInProgress()) {
        setDirectoryUsersRefreshInProgress(true)
        fetchSnapshotUsers()
          .then(users => setCachedDirectoryUsers(users))
          .catch(err => console.error('Background directory refresh failed:', err))
          .finally(() => setDirectoryUsersRefreshInProgress(false))
      }

      const users = cached.map(user => {
        const classification = resolveGoogleAccountType(
          user.primary_email,
          user.account_type_override,
          {
            fullName: user.full_name,
            orgUnitPath: user.org_unit_path,
            title: user.title,
          }
        )
        return {
          ...user,
          account_type: classification.type,
          account_type_reason: classification.reason,
          account_type_overridden: classification.overridden,
        }
      })

      return apiSuccess({
        users,
        total: users.length,
        cached: true,
      })
    }

    // Cache miss — fetch from DB
    const users = await fetchSnapshotUsers()
    setCachedDirectoryUsers(users)

    const classifiedUsers = users.map(user => {
      const classification = resolveGoogleAccountType(
        user.primary_email,
        user.account_type_override,
        {
          fullName: user.full_name,
          orgUnitPath: user.org_unit_path,
          title: user.title,
        }
      )
      return {
        ...user,
        account_type: classification.type,
        account_type_reason: classification.reason,
        account_type_overridden: classification.overridden,
      }
    })

    return apiSuccess({
      users: classifiedUsers,
      total: classifiedUsers.length,
      cached: false,
    })
  } catch (error) {
    console.error('Directory users error:', error)
    return ApiErrors.database()
  }
}
