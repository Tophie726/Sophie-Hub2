/**
 * POST /api/google-workspace/users/classification
 *
 * Persist a manual account-type override for a Google directory user.
 * - auto -> clears override (use heuristic)
 * - person -> force person
 * - shared_account -> force shared inbox/account
 */

import { z } from 'zod'
import { requireRole } from '@/lib/auth/api-auth'
import { ROLES } from '@/lib/auth/roles'
import { apiSuccess, apiError, ApiErrors, ErrorCodes } from '@/lib/api/response'
import { getAdminClient } from '@/lib/supabase/admin'
import { invalidateDirectoryUsersCache } from '@/lib/connectors/google-workspace-cache'
import { resolveGoogleAccountType } from '@/lib/google-workspace/account-classification'

const BodySchema = z.object({
  google_user_id: z.string().min(1),
  account_type_override: z.enum(['auto', 'person', 'shared_account']),
})

function isSchemaError(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code
  return code === '42P01' || code === '42703' || code === 'PGRST204' || code === 'PGRST205'
}

export async function POST(request: Request) {
  const auth = await requireRole(ROLES.ADMIN)
  if (!auth.authenticated) return auth.response

  try {
    const body = await request.json()
    const parsed = BodySchema.safeParse(body)
    if (!parsed.success) {
      return apiError(ErrorCodes.VALIDATION_ERROR, parsed.error.message, 400)
    }

    const supabase = getAdminClient()
    const override =
      parsed.data.account_type_override === 'auto' ? null : parsed.data.account_type_override

    const { data, error } = await supabase
      .from('google_workspace_directory_snapshot')
      .update({
        account_type_override: override,
        updated_at: new Date().toISOString(),
      })
      .eq('google_user_id', parsed.data.google_user_id)
      .select('google_user_id, primary_email, account_type_override')
      .single()

    if (error) {
      if (isSchemaError(error)) {
        return apiError(
          ErrorCodes.CONFLICT,
          'Google Workspace snapshot schema is out of date. Please apply migration: supabase/migrations/20260212_google_workspace_snapshot_extended.sql',
          409
        )
      }
      console.error('Failed to update Google account type override:', error)
      return ApiErrors.database()
    }

    const resolved = resolveGoogleAccountType(data.primary_email, data.account_type_override)
    invalidateDirectoryUsersCache()

    return apiSuccess({
      google_user_id: data.google_user_id,
      primary_email: data.primary_email,
      account_type_override: data.account_type_override,
      account_type: resolved.type,
      account_type_reason: resolved.reason,
      account_type_overridden: resolved.overridden,
    })
  } catch (error) {
    console.error('Google account classification override error:', error)
    return ApiErrors.internal()
  }
}
