/**
 * POST /api/slack/sync/start
 *
 * Trigger a new sync run. Creates a sync_run record with status 'pending'
 * and returns the run_id immediately. The Vercel cron handler picks it up
 * and processes channels in chunks.
 */

import { requireRole } from '@/lib/auth/api-auth'
import { ROLES } from '@/lib/auth/roles'
import { apiSuccess, apiError, ApiErrors } from '@/lib/api/response'
import { createSyncRun } from '@/lib/slack/sync'

export async function POST() {
  const auth = await requireRole(ROLES.ADMIN)
  if (!auth.authenticated) return auth.response

  try {
    const runId = await createSyncRun(auth.user.email)

    console.log(`Sync run started by ${auth.user.email}: ${runId}`)

    return apiSuccess({ run_id: runId }, 201)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    // createSyncRun throws if a run is already in progress
    if (message.includes('already')) {
      return apiError('CONFLICT', message, 409)
    }

    console.error('POST sync/start error:', error)
    return ApiErrors.internal()
  }
}
