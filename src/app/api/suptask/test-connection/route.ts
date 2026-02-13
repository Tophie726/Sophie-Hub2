import { requireRole } from '@/lib/auth/api-auth'
import { ROLES } from '@/lib/auth/roles'
import { testConnection, sanitizeError } from '@/lib/suptask/client'
import { apiSuccess, apiError } from '@/lib/api/response'

/**
 * POST /api/suptask/test-connection
 *
 * Tests connectivity to the SupTask API using configured env credentials.
 * Admin only.
 */
export async function POST() {
  const auth = await requireRole(ROLES.ADMIN)
  if (!auth.authenticated) return auth.response

  try {
    const info = await testConnection()
    return apiSuccess({
      connected: true,
      sampleTicketNumber: info.sampleTicketNumber,
    })
  } catch (err) {
    const rawMessage = err instanceof Error ? err.message : 'Connection failed'
    return apiError('CONNECTION_FAILED', sanitizeError(rawMessage), 502)
  }
}
