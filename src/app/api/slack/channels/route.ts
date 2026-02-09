/**
 * GET /api/slack/channels
 *
 * List all Slack channels with mapping status.
 * Returns channels enriched with partner mapping info from entity_external_ids.
 */

import { requireRole } from '@/lib/auth/api-auth'
import { ROLES } from '@/lib/auth/roles'
import { apiSuccess, ApiErrors } from '@/lib/api/response'
import { slackConnector } from '@/lib/connectors/slack'
import { getAdminClient } from '@/lib/supabase/admin'
import { SLACK } from '@/lib/constants'

type SlackChannelType = 'partner_facing' | 'alerts' | 'internal'

function detectChannelType(channelName: string): SlackChannelType {
  const lower = channelName.toLowerCase()
  if (SLACK.PARTNER_CHANNEL_SUFFIXES.some((suffix) => lower.endsWith(suffix))) return 'alerts'
  if (SLACK.PARTNER_CHANNEL_INTERNAL_SUFFIXES.some((suffix) => lower.endsWith(suffix))) return 'internal'
  return 'partner_facing'
}

export async function GET() {
  const auth = await requireRole(ROLES.ADMIN)
  if (!auth.authenticated) {
    return auth.response
  }

  try {
    // Fetch channels from Slack (cached)
    const channels = await slackConnector.listChannels()

    // Fetch existing channel→partner mappings
    const supabase = getAdminClient()
    const { data: mappings } = await supabase
      .from('entity_external_ids')
      .select('entity_id, external_id, metadata')
      .eq('source', 'slack_channel')
      .eq('entity_type', 'partners')

    // Build lookup: channel_id → partner mapping
    const mappingByChannel = new Map<string, { partner_id: string; metadata: Record<string, unknown> | null }>()
    for (const m of mappings || []) {
      mappingByChannel.set(m.external_id, {
        partner_id: m.entity_id,
        metadata: m.metadata,
      })
    }

    // Get partner names for mapped channels
    const partnerIds = Array.from(new Set((mappings || []).map(m => m.entity_id)))
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

    // Enrich channels with mapping info
    const enrichedChannels = channels.map(ch => {
      const mapping = mappingByChannel.get(ch.id)
      return {
        id: ch.id,
        name: ch.name,
        is_private: ch.is_private,
        num_members: ch.num_members,
        purpose: ch.purpose?.value || '',
        partner_id: mapping?.partner_id || null,
        partner_name: mapping ? partnerNames[mapping.partner_id] || null : null,
        channel_type:
          ((mapping?.metadata as Record<string, unknown> | undefined)?.channel_type as SlackChannelType | undefined) ||
          detectChannelType(ch.name),
        is_mapped: !!mapping,
      }
    })

    const response = apiSuccess({
      channels: enrichedChannels,
      total: enrichedChannels.length,
      mapped: enrichedChannels.filter(c => c.is_mapped).length,
    })

    // Browser-side caching: fresh for 2 min, stale-while-revalidate for 5 min
    response.headers.set(
      'Cache-Control',
      'private, max-age=120, stale-while-revalidate=300'
    )

    return response
  } catch (error) {
    console.error('Failed to fetch Slack channels:', error)
    return ApiErrors.internal()
  }
}
