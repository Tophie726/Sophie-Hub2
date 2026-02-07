/**
 * POST /api/slack/analytics/recompute
 *
 * Trigger recomputation of analytics metrics for a date range.
 * Optionally scoped to a single channel.
 * Calls computeAllChannels from analytics.ts.
 */

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/auth/api-auth'
import { ROLES } from '@/lib/auth/roles'
import { apiSuccess, apiValidationError, ApiErrors } from '@/lib/api/response'
import { computeAllChannels } from '@/lib/slack/analytics'

const BodySchema = z.object({
  channel_id: z.string().optional(),
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date_from must be YYYY-MM-DD'),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date_to must be YYYY-MM-DD'),
})

export async function POST(request: NextRequest) {
  const auth = await requireRole(ROLES.ADMIN)
  if (!auth.authenticated) return auth.response

  try {
    const body = await request.json()
    const validation = BodySchema.safeParse(body)

    if (!validation.success) {
      return apiValidationError(validation.error)
    }

    const { channel_id, date_from, date_to } = validation.data

    console.log(
      `Analytics recompute triggered by ${auth.user.email}: ` +
      `${date_from} to ${date_to}${channel_id ? ` (channel: ${channel_id})` : ' (all channels)'}`
    )

    const result = await computeAllChannels({
      dateFrom: date_from,
      dateTo: date_to,
      channelId: channel_id,
    })

    return apiSuccess({
      computed: result.computed,
      failed: result.failed,
      errors: result.errors.length > 0 ? result.errors.slice(0, 20) : [],
      date_range: { from: date_from, to: date_to },
      channel_id: channel_id || null,
    })
  } catch (error) {
    console.error('POST analytics/recompute error:', error)
    return ApiErrors.internal()
  }
}
