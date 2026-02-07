/**
 * POST /api/google-workspace/test-connection
 *
 * Verify service account credentials and domain-wide delegation.
 * Returns workspace domain and approximate user count.
 */

import { requireRole } from '@/lib/auth/api-auth'
import { ROLES } from '@/lib/auth/roles'
import { apiSuccess, ApiErrors } from '@/lib/api/response'
import { testConnection } from '@/lib/google-workspace/client'

export async function POST() {
  const auth = await requireRole(ROLES.ADMIN)
  if (!auth.authenticated) {
    return auth.response
  }

  try {
    const domain = process.env.GOOGLE_WORKSPACE_DOMAIN
    if (!domain) {
      return apiSuccess({
        connected: false,
        error: 'GOOGLE_WORKSPACE_DOMAIN environment variable is not set',
      })
    }

    const info = await testConnection(domain)
    return apiSuccess({
      connected: true,
      domain: info.domain,
      user_count: info.userCount,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Connection failed'

    // Provide specific guidance for common errors
    let hint = ''
    if (msg.includes('Not Authorized') || msg.includes('forbidden')) {
      hint = ' Ensure domain-wide delegation is configured in Google Workspace Admin Console with admin.directory.user.readonly scope.'
    } else if (msg.includes('GOOGLE_WORKSPACE_')) {
      hint = ' Check that all required environment variables are set.'
    }

    return apiSuccess({
      connected: false,
      error: msg + hint,
    })
  }
}

export async function GET() {
  return ApiErrors.notFound('Use POST method')
}
