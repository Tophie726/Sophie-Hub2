/**
 * POST /api/slack/sync/channel/[channelId]
 *
 * Sync a single channel. Used for testing/debugging from the admin UI.
 * Calls syncSingleChannel which handles staff lookup, bot membership,
 * forward sync, and backfill for one channel.
 */

import { NextRequest } from 'next/server'
import { requireRole } from '@/lib/auth/api-auth'
import { ROLES } from '@/lib/auth/roles'
import { apiSuccess, apiError, ApiErrors } from '@/lib/api/response'
import { syncSingleChannel } from '@/lib/slack/sync'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const auth = await requireRole(ROLES.ADMIN)
  if (!auth.authenticated) return auth.response

  const { channelId } = await params

  if (!channelId) {
    return apiError('VALIDATION_ERROR', 'channelId is required', 400)
  }

  try {
    console.log(`Single channel sync triggered by ${auth.user.email}: ${channelId}`)

    const result = await syncSingleChannel(channelId)

    if (!result.success) {
      return apiError(
        'INTERNAL_ERROR',
        result.error || 'Channel sync failed',
        500,
        { channel_id: result.channel_id, channel_name: result.channel_name }
      )
    }

    return apiSuccess({
      channel_id: result.channel_id,
      channel_name: result.channel_name,
      messages_synced: result.messages_synced,
    })
  } catch (error) {
    console.error(`POST sync/channel/${channelId} error:`, error)
    return ApiErrors.internal()
  }
}
