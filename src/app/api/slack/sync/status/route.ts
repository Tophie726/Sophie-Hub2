/**
 * GET /api/slack/sync/status
 *
 * Get the latest sync run status plus per-channel sync state.
 * Returns the most recent sync run record and channel-level details.
 */

import { requireRole } from '@/lib/auth/api-auth'
import { ROLES } from '@/lib/auth/roles'
import { apiSuccess, ApiErrors } from '@/lib/api/response'
import { getAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const auth = await requireRole(ROLES.ADMIN)
  if (!auth.authenticated) return auth.response

  try {
    const supabase = getAdminClient()

    // Fetch latest sync run
    const { data: latestRun, error: runError } = await supabase
      .from('slack_sync_runs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (runError) {
      console.error('Error fetching sync run:', runError)
      return ApiErrors.database()
    }

    // Fetch per-channel sync state for mapped channels
    const { data: channels, error: channelsError } = await supabase
      .from('slack_sync_state')
      .select('channel_id, channel_name, partner_id, latest_ts, oldest_ts, is_backfill_complete, message_count, last_synced_at, error, bot_is_member')
      .not('partner_id', 'is', null)
      .order('last_synced_at', { ascending: false, nullsFirst: false })

    if (channelsError) {
      console.error('Error fetching channel sync state:', channelsError)
      return ApiErrors.database()
    }

    // Fetch partner names for channels
    const partnerIds = Array.from(new Set((channels || []).map(c => c.partner_id).filter(Boolean)))
    let partnerNames: Record<string, string> = {}
    if (partnerIds.length > 0) {
      const { data: partners } = await supabase
        .from('partners')
        .select('id, brand_name')
        .in('id', partnerIds)
      if (partners) {
        partnerNames = Object.fromEntries(partners.map(p => [p.id, p.brand_name]))
      }
    }

    const enrichedChannels = (channels || []).map(ch => ({
      ...ch,
      partner_name: ch.partner_id ? partnerNames[ch.partner_id] || null : null,
    }))

    return apiSuccess({
      latest_run: latestRun || null,
      channels: enrichedChannels,
      total_mapped_channels: enrichedChannels.length,
    })
  } catch (error) {
    console.error('GET sync/status error:', error)
    return ApiErrors.internal()
  }
}
