/**
 * POST /api/slack/test-connection
 *
 * Verify Slack bot token and return workspace info.
 */

import { requireRole } from '@/lib/auth/api-auth'
import { ROLES } from '@/lib/auth/roles'
import { apiSuccess, ApiErrors } from '@/lib/api/response'
import { testConnection } from '@/lib/slack/client'

export async function POST() {
  const auth = await requireRole(ROLES.ADMIN)
  if (!auth.authenticated) {
    return auth.response
  }

  try {
    const info = await testConnection()
    return apiSuccess({
      connected: true,
      workspace_name: info.workspace_name,
      bot_user_id: info.bot_user_id,
    })
  } catch (error) {
    return apiSuccess({
      connected: false,
      error: error instanceof Error ? error.message : 'Connection failed',
    })
  }
}

export async function GET() {
  return ApiErrors.notFound('Use POST method')
}
