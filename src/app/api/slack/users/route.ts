/**
 * GET /api/slack/users
 *
 * List all Slack users with staff mapping status and user type classification.
 * Returns users enriched with:
 * - Staff mapping info from entity_external_ids
 * - User type (member, multi_channel_guest, single_channel_guest, bot, deactivated, connect)
 * - Breakdown stats by user type
 */

import { requireRole } from '@/lib/auth/api-auth'
import { ROLES } from '@/lib/auth/roles'
import { apiSuccess, ApiErrors } from '@/lib/api/response'
import { slackConnector } from '@/lib/connectors/slack'
import { getAdminClient } from '@/lib/supabase/admin'
import { classifySlackUser, type SlackUserType } from '@/lib/slack/types'

export async function GET() {
  const auth = await requireRole(ROLES.ADMIN)
  if (!auth.authenticated) {
    return auth.response
  }

  try {
    // Fetch ALL users from Slack (cached) — include bots and deleted for breakdown
    const allUsers = await slackConnector.listUsers({ include_bots: true, include_deleted: true })

    // Fetch existing staff→Slack user mappings
    const supabase = getAdminClient()
    const { data: mappings } = await supabase
      .from('entity_external_ids')
      .select('entity_id, external_id')
      .eq('source', 'slack_user')
      .eq('entity_type', 'staff')

    // Build lookup: slack_user_id → staff_id
    const mappingBySlackUser = new Map<string, string>()
    for (const m of mappings || []) {
      mappingBySlackUser.set(m.external_id, m.entity_id)
    }

    // Get staff names for mapped users
    const staffIds = Array.from(new Set((mappings || []).map(m => m.entity_id)))
    let staffNames: Record<string, string> = {}
    if (staffIds.length > 0) {
      const { data: staff } = await supabase
        .from('staff')
        .select('id, full_name')
        .in('id', staffIds)
      if (staff) {
        staffNames = Object.fromEntries(staff.map(s => [s.id, s.full_name]))
      }
    }

    // Classify and enrich users
    const breakdown: Record<SlackUserType, number> = {
      member: 0,
      multi_channel_guest: 0,
      single_channel_guest: 0,
      bot: 0,
      deactivated: 0,
      connect: 0,
    }

    const enrichedUsers = allUsers.map(user => {
      const staffId = mappingBySlackUser.get(user.id)
      const userType = classifySlackUser(user)
      breakdown[userType]++

      return {
        id: user.id,
        name: user.real_name || user.name,
        display_name: user.profile.display_name,
        email: user.profile.email || null,
        image: user.profile.image_48 || null,
        image_72: user.profile.image_72 || null,
        title: user.profile.title || null,
        timezone: user.tz || null,
        tz_label: user.tz_label || null,
        staff_id: staffId || null,
        staff_name: staffId ? staffNames[staffId] || null : null,
        is_mapped: !!staffId,
        user_type: userType,
      }
    })

    // Active users = everyone except bots and deactivated (these are the mappable users)
    const activeUsers = enrichedUsers.filter(u => u.user_type !== 'bot' && u.user_type !== 'deactivated')
    const mappedCount = activeUsers.filter(u => u.is_mapped).length

    return apiSuccess({
      users: enrichedUsers,
      total: enrichedUsers.length,
      active_total: activeUsers.length,
      mapped: mappedCount,
      breakdown,
    })
  } catch (error) {
    console.error('Failed to fetch Slack users:', error)
    return ApiErrors.internal()
  }
}
