/**
 * GET /api/slack/users
 *
 * List all Slack users with staff mapping status.
 * Returns users enriched with staff mapping info from entity_external_ids.
 */

import { requireRole } from '@/lib/auth/api-auth'
import { ROLES } from '@/lib/auth/roles'
import { apiSuccess, ApiErrors } from '@/lib/api/response'
import { slackConnector } from '@/lib/connectors/slack'
import { getAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const auth = await requireRole(ROLES.ADMIN)
  if (!auth.authenticated) {
    return auth.response
  }

  try {
    // Fetch users from Slack (cached)
    const users = await slackConnector.listUsers()

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

    // Enrich users with mapping info
    const enrichedUsers = users.map(user => {
      const staffId = mappingBySlackUser.get(user.id)
      return {
        id: user.id,
        name: user.real_name || user.name,
        display_name: user.profile.display_name,
        email: user.profile.email || null,
        image: user.profile.image_48 || null,
        staff_id: staffId || null,
        staff_name: staffId ? staffNames[staffId] || null : null,
        is_mapped: !!staffId,
      }
    })

    return apiSuccess({
      users: enrichedUsers,
      total: enrichedUsers.length,
      mapped: enrichedUsers.filter(u => u.is_mapped).length,
    })
  } catch (error) {
    console.error('Failed to fetch Slack users:', error)
    return ApiErrors.internal()
  }
}
