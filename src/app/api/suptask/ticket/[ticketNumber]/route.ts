import { NextRequest } from 'next/server'
import { requireRole } from '@/lib/auth/api-auth'
import { ROLES } from '@/lib/auth/roles'
import { getTicketByNumber, sanitizeError } from '@/lib/suptask/client'
import { apiSuccess, apiError } from '@/lib/api/response'

/**
 * GET /api/suptask/ticket/[ticketNumber]
 *
 * Debug/smoke route: fetches a single ticket from the SupTask API.
 * Does NOT write to the database — purely a read-through proxy.
 * Admin only.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ ticketNumber: string }> }
) {
  const auth = await requireRole(ROLES.ADMIN)
  if (!auth.authenticated) return auth.response

  const { ticketNumber: raw } = await params
  const ticketNumber = parseInt(raw, 10)

  if (isNaN(ticketNumber) || ticketNumber < 1) {
    return apiError('VALIDATION_ERROR', 'ticketNumber must be a positive integer', 400)
  }

  try {
    const ticket = await getTicketByNumber(ticketNumber)
    return apiSuccess({ ticket })
  } catch (err) {
    const rawMessage = err instanceof Error ? err.message : 'Failed to fetch ticket'
    const safeMessage = sanitizeError(rawMessage)
    if (safeMessage.includes('500')) {
      return apiError('UPSTREAM_ERROR', `SupTask returned 500 for ticket #${ticketNumber}`, 502)
    }
    return apiError('FETCH_FAILED', safeMessage, 502)
  }
}
