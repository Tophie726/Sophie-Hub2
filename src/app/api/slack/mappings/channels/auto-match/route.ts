/**
 * POST /api/slack/mappings/channels/auto-match
 *
 * Bulk auto-match Slack channels to partners by naming convention.
 * User provides a pattern (e.g., "client-{brand_name}"), system strips prefix,
 * normalizes, and matches against partners.brand_name.
 */

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/auth/api-auth'
import { ROLES } from '@/lib/auth/roles'
import { apiSuccess, apiValidationError, ApiErrors } from '@/lib/api/response'
import { slackConnector } from '@/lib/connectors/slack'
import { getAdminClient } from '@/lib/supabase/admin'
import { invalidateChannelsCache } from '@/lib/connectors/slack-cache'
import { SLACK } from '@/lib/constants'

const AutoMatchSchema = z.object({
  /** Channel prefix to strip (e.g., "client-") */
  prefix: z.string().min(1, 'Prefix is required').default('client-'),
  /** Additional prefixes to skip (internal channels) */
  skip_prefixes: z.array(z.string()).optional(),
})

/**
 * Normalize a string for fuzzy matching:
 * lowercase, strip hyphens/underscores/spaces, trim
 */
function normalize(str: string): string {
  return str.toLowerCase().replace(/[-_\s]+/g, '').trim()
}

type SlackChannelType = 'partner_facing' | 'alerts' | 'internal'

function detectChannelType(str: string): SlackChannelType {
  if (SLACK.PARTNER_CHANNEL_SUFFIXES.some((suffix) => str.endsWith(suffix))) return 'alerts'
  if (SLACK.PARTNER_CHANNEL_INTERNAL_SUFFIXES.some((suffix) => str.endsWith(suffix))) return 'internal'
  return 'partner_facing'
}

function stripPartnerSuffixes(str: string): string {
  let value = str
  const allSuffixes = [...SLACK.PARTNER_CHANNEL_SUFFIXES, ...SLACK.PARTNER_CHANNEL_INTERNAL_SUFFIXES]
  for (const suffix of allSuffixes) {
    if (value.endsWith(suffix)) {
      value = value.slice(0, -suffix.length)
      break
    }
  }
  return value
}

export async function POST(request: NextRequest) {
  const auth = await requireRole(ROLES.ADMIN)
  if (!auth.authenticated) {
    return auth.response
  }

  try {
    const body = await request.json()
    const validation = AutoMatchSchema.safeParse(body)
    if (!validation.success) {
      return apiValidationError(validation.error)
    }

    const { prefix, skip_prefixes } = validation.data
    const allSkipPrefixes = [...SLACK.INTERNAL_PREFIXES, ...(skip_prefixes || [])]

    const supabase = getAdminClient()

    // 1. Fetch all channels
    const channels = await slackConnector.listChannels()

    // 2. Fetch all partners
    const { data: partners, error: partnerError } = await supabase
      .from('partners')
      .select('id, brand_name')
      .order('brand_name')

    if (partnerError) {
      console.error('Failed to fetch partners:', partnerError)
      return ApiErrors.database()
    }

    // 3. Build partner lookup (normalized name → partner)
    const partnerByNormalized = new Map<string, { id: string; brand_name: string }>()
    for (const p of partners || []) {
      partnerByNormalized.set(normalize(p.brand_name), p)
    }

    // 4. Fetch existing mappings to skip
    const { data: existingMappings } = await supabase
      .from('entity_external_ids')
      .select('entity_id, external_id')
      .eq('entity_type', 'partners')
      .eq('source', 'slack_channel')

    const alreadyMappedChannels = new Set((existingMappings || []).map(m => m.external_id))

    // 5. Match channels to partners
    const matches: Array<{
      channel_id: string
      channel_name: string
      partner_id: string
      partner_name: string
      channel_type: SlackChannelType
      brand_key: string
      confidence: number
    }> = []
    const unmatchedChannels: string[] = []
    let skippedInternal = 0

    for (const channel of channels) {
      // Skip already mapped
      if (alreadyMappedChannels.has(channel.id)) continue

      // Skip internal channels
      if (allSkipPrefixes.some(p => channel.name.startsWith(p))) {
        skippedInternal++
        continue
      }

      // Skip archived channels
      if (channel.is_archived) continue

      // Strip prefix and partner-channel suffixes (e.g. "brand-alerts")
      let channelBrand = channel.name
      if (channelBrand.startsWith(prefix)) {
        channelBrand = channelBrand.slice(prefix.length)
      } else {
        // Channel doesn't match pattern, skip
        continue
      }
      const channelType = detectChannelType(channelBrand)
      channelBrand = stripPartnerSuffixes(channelBrand)
      if (!channelBrand.trim()) continue

      const normalizedChannel = normalize(channelBrand)

      // Try exact match first
      const exactMatch = partnerByNormalized.get(normalizedChannel)
      if (exactMatch) {
        matches.push({
          channel_id: channel.id,
          channel_name: channel.name,
          partner_id: exactMatch.id,
          partner_name: exactMatch.brand_name,
          confidence: 1.0,
          channel_type: channelType,
          brand_key: normalizedChannel,
        })
        continue
      }

      // Try partial/contains match
      let bestMatch: { id: string; brand_name: string; score: number } | null = null
      for (const [normalizedPartner, partner] of Array.from(partnerByNormalized.entries())) {
        // Check if one contains the other
        if (normalizedChannel.includes(normalizedPartner) || normalizedPartner.includes(normalizedChannel)) {
          const score = Math.min(normalizedChannel.length, normalizedPartner.length) /
                       Math.max(normalizedChannel.length, normalizedPartner.length)
          if (!bestMatch || score > bestMatch.score) {
            bestMatch = { ...partner, score }
          }
        }
      }

      if (bestMatch && bestMatch.score > 0.6) {
        matches.push({
          channel_id: channel.id,
          channel_name: channel.name,
          partner_id: bestMatch.id,
          partner_name: bestMatch.brand_name,
          confidence: bestMatch.score,
          channel_type: channelType,
          brand_key: normalizedChannel,
        })
      } else {
        unmatchedChannels.push(channel.name)
      }
    }

    // 6. Bulk upsert high-confidence matches (>= 0.8)
    const highConfidence = matches.filter(m => m.confidence >= 0.8)
    if (highConfidence.length > 0) {
      const records = highConfidence.map(m => ({
        entity_type: 'partners' as const,
        entity_id: m.partner_id,
        source: 'slack_channel' as const,
        external_id: m.channel_id,
        metadata: {
          channel_name: m.channel_name,
          channel_type: m.channel_type,
          brand_key: m.brand_key,
          match_type: 'auto',
          confidence: m.confidence,
        },
        created_by: auth.user.email,
      }))

      const BATCH_SIZE = 50
      for (let i = 0; i < records.length; i += BATCH_SIZE) {
        const batch = records.slice(i, i + BATCH_SIZE)
        const { error } = await supabase
          .from('entity_external_ids')
          .upsert(batch, { onConflict: 'source,external_id' })

        if (error) {
          console.error(`Channel mapping batch ${i / BATCH_SIZE + 1} failed:`, error)
        }
      }

      // Also create sync state entries
      for (const m of highConfidence) {
        await supabase
          .from('slack_sync_state')
          .upsert({
            channel_id: m.channel_id,
            channel_name: m.channel_name,
            partner_id: m.partner_id,
          }, { onConflict: 'channel_id' })
      }
    }

    invalidateChannelsCache()

    // Separate results into auto-saved and needs-review
    const lowConfidence = matches.filter(m => m.confidence < 0.8)

    return apiSuccess({
      total_channels: channels.length,
      total_partners: partners?.length || 0,
      auto_matched: highConfidence.length,
      needs_review: lowConfidence.length,
      skipped_internal: skippedInternal,
      already_mapped: alreadyMappedChannels.size,
      auto_matched_list: highConfidence.map(m => ({
        channel_name: m.channel_name,
        partner_name: m.partner_name,
        channel_type: m.channel_type,
        confidence: m.confidence,
      })),
      needs_review_list: lowConfidence.map(m => ({
        channel_id: m.channel_id,
        channel_name: m.channel_name,
        partner_id: m.partner_id,
        partner_name: m.partner_name,
        channel_type: m.channel_type,
        confidence: m.confidence,
      })),
      unmatched_channels: unmatchedChannels.slice(0, 30),
    })
  } catch (error) {
    console.error('Channel auto-match error:', error)
    return ApiErrors.internal()
  }
}
