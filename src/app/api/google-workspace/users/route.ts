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
import { resolveGoogleAccountType } from '@/lib/google-workspace/account-classification'

function isSnapshotSchemaError(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code
  return code === '42P01' || code === '42703' || code === 'PGRST204' || code === 'PGRST205'
}

async function fetchSnapshotUsers(): Promise<DirectorySnapshotRow[]> {
  const supabase = getAdminClient()

  const { data, error } = await supabase
    .from('google_workspace_directory_snapshot')
    .select('*')
    .order('primary_email', { ascending: true })

  if (error) {
    if (isSnapshotSchemaError(error)) {
      // First-run or schema drift: treat as empty snapshot so UI can guide operator to sync.
      return []
    }
    console.error('Failed to fetch directory snapshot:', error)
    throw error
  }

  return (data || []) as DirectorySnapshotRow[]
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
          user.account_type_override
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
        user.account_type_override
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
