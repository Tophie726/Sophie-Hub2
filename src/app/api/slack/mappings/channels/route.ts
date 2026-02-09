/**
 * GET/POST/DELETE /api/slack/mappings/channels
 *
 * Manages channel ↔ partner mappings in entity_external_ids table.
 * Source: 'slack_channel', entity_type: 'partners'
 */

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/auth/api-auth'
import { ROLES } from '@/lib/auth/roles'
import { apiSuccess, apiError, apiValidationError, ApiErrors } from '@/lib/api/response'
import { getAdminClient } from '@/lib/supabase/admin'
import { invalidateChannelsCache } from '@/lib/connectors/slack-cache'
import { SLACK } from '@/lib/constants'

const CreateMappingSchema = z.object({
  partner_id: z.string().uuid('partner_id must be a valid UUID'),
  channel_id: z.string().min(1, 'channel_id is required'),
  channel_name: z.string().optional(),
})

type SlackChannelType = 'partner_facing' | 'alerts' | 'internal'

function detectChannelType(channelName: string): SlackChannelType {
  const lower = channelName.toLowerCase()
  if (SLACK.PARTNER_CHANNEL_SUFFIXES.some((suffix) => lower.endsWith(suffix))) return 'alerts'
  if (SLACK.PARTNER_CHANNEL_INTERNAL_SUFFIXES.some((suffix) => lower.endsWith(suffix))) return 'internal'
  return 'partner_facing'
}

/**
 * GET — Fetch all channel ↔ partner mappings
 */
export async function GET() {
  const auth = await requireRole(ROLES.ADMIN)
  if (!auth.authenticated) {
    return auth.response
  }

  try {
    const supabase = getAdminClient()

    const { data: mappings, error } = await supabase
      .from('entity_external_ids')
      .select('id, entity_id, external_id, metadata, created_at')
      .eq('entity_type', 'partners')
      .eq('source', 'slack_channel')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching channel-partner mappings:', error)
      return ApiErrors.database()
    }

    // Get partner names
    const partnerIds = mappings?.map(m => m.entity_id) || []
    let partnerInfo: Record<string, { brand_name: string; tier: string | null }> = {}
    if (partnerIds.length > 0) {
      const { data: partners } = await supabase
        .from('partners')
        .select('id, brand_name, tier')
        .in('id', partnerIds)
      if (partners) {
        partnerInfo = Object.fromEntries(partners.map(p => [p.id, { brand_name: p.brand_name, tier: p.tier }]))
      }
    }

    const enriched = mappings?.map(m => ({
      id: m.id,
      partner_id: m.entity_id,
      partner_name: partnerInfo[m.entity_id]?.brand_name || null,
      partner_tier: partnerInfo[m.entity_id]?.tier || null,
      channel_id: m.external_id,
      channel_name: (m.metadata as Record<string, unknown>)?.channel_name || null,
      channel_type:
        ((m.metadata as Record<string, unknown>)?.channel_type as SlackChannelType | undefined) || 'partner_facing',
      created_at: m.created_at,
    })) || []

    return apiSuccess({ mappings: enriched, count: enriched.length })
  } catch (error) {
    console.error('GET channel-partner mappings error:', error)
    return ApiErrors.internal()
  }
}

/**
 * POST — Create or update a channel ↔ partner mapping
 */
export async function POST(request: NextRequest) {
  const auth = await requireRole(ROLES.ADMIN)
  if (!auth.authenticated) {
    return auth.response
  }

  try {
    const body = await request.json()
    const validation = CreateMappingSchema.safeParse(body)
    if (!validation.success) {
      return apiValidationError(validation.error)
    }

    const { partner_id, channel_id, channel_name } = validation.data
    const supabase = getAdminClient()
    const resolvedChannelName = channel_name || channel_id
    const channelType = detectChannelType(resolvedChannelName)

    // Verify partner exists
    const { data: partner, error: partnerError } = await supabase
      .from('partners')
      .select('id, brand_name')
      .eq('id', partner_id)
      .single()

    if (partnerError || !partner) {
      return ApiErrors.notFound('Partner')
    }

    // Upsert the mapping — conflict on (source, external_id) prevents the same
    // channel being double-mapped to two different partners, while allowing a
    // partner to have multiple channels (e.g., "client-acme-general" + "client-acme-finance").
    const { data: mapping, error } = await supabase
      .from('entity_external_ids')
      .upsert({
        entity_type: 'partners',
        entity_id: partner_id,
        source: 'slack_channel',
        external_id: channel_id,
        metadata: {
          channel_name: resolvedChannelName,
          channel_type: channelType,
          match_type: 'manual',
        },
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'source,external_id',
      })
      .select()
      .single()

    if (error) {
      console.error('Error saving channel-partner mapping:', error)
      return ApiErrors.database()
    }

    // Create/update sync state entry for this channel
    await supabase
      .from('slack_sync_state')
      .upsert({
        channel_id,
        channel_name: resolvedChannelName,
        partner_id,
      }, {
        onConflict: 'channel_id',
      })

    invalidateChannelsCache()

    return apiSuccess({
      mapping: {
        ...mapping,
        partner_name: partner.brand_name,
      },
    }, 201)
  } catch (error) {
    console.error('POST channel-partner mapping error:', error)
    return ApiErrors.internal()
  }
}

/**
 * DELETE — Remove a channel ↔ partner mapping
 */
export async function DELETE(request: NextRequest) {
  const auth = await requireRole(ROLES.ADMIN)
  if (!auth.authenticated) {
    return auth.response
  }

  try {
    const { searchParams } = new URL(request.url)
    const mappingId = searchParams.get('id')

    if (!mappingId) {
      return apiError('VALIDATION_ERROR', 'Mapping ID is required', 400)
    }

    const supabase = getAdminClient()

    // Fetch the mapping first so we know which channel to clean up in sync state
    const { data: existing } = await supabase
      .from('entity_external_ids')
      .select('external_id')
      .eq('id', mappingId)
      .eq('source', 'slack_channel')
      .single()

    const { error } = await supabase
      .from('entity_external_ids')
      .delete()
      .eq('id', mappingId)
      .eq('source', 'slack_channel')

    if (error) {
      console.error('Error deleting channel-partner mapping:', error)
      return ApiErrors.database()
    }

    // Nullify the partner_id in sync state for the unmapped channel
    if (existing?.external_id) {
      await supabase
        .from('slack_sync_state')
        .update({ partner_id: null })
        .eq('channel_id', existing.external_id)
    }

    invalidateChannelsCache()

    return apiSuccess({ deleted: true })
  } catch (error) {
    console.error('DELETE channel-partner mapping error:', error)
    return ApiErrors.internal()
  }
}
