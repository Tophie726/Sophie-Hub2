/**
 * POST /api/slack/mappings/staff/auto-match
 *
 * Bulk auto-match staff to Slack users by email (case-insensitive).
 * Updates entity_external_ids and staff.slack_id.
 */

import { requireRole } from '@/lib/auth/api-auth'
import { ROLES } from '@/lib/auth/roles'
import { apiSuccess, ApiErrors } from '@/lib/api/response'
import { slackConnector } from '@/lib/connectors/slack'
import { getAdminClient } from '@/lib/supabase/admin'
import { invalidateUsersCache } from '@/lib/connectors/slack-cache'

export async function POST() {
  const auth = await requireRole(ROLES.ADMIN)
  if (!auth.authenticated) {
    return auth.response
  }

  try {
    const supabase = getAdminClient()

    // 1. Fetch all Slack users with emails
    const slackUsers = await slackConnector.listUsers()
    const slackByEmail = new Map<string, { id: string; name: string }>()
    for (const user of slackUsers) {
      const email = user.profile.email?.toLowerCase()
      if (email) {
        slackByEmail.set(email, { id: user.id, name: user.real_name || user.name })
      }
    }

    // 2. Fetch all staff with emails
    const { data: staff, error: staffError } = await supabase
      .from('staff')
      .select('id, full_name, email')
      .not('email', 'is', null)

    if (staffError) {
      console.error('Failed to fetch staff:', staffError)
      return ApiErrors.database()
    }

    // 3. Fetch existing mappings to skip already-mapped staff
    const { data: existingMappings } = await supabase
      .from('entity_external_ids')
      .select('entity_id, external_id')
      .eq('entity_type', 'staff')
      .eq('source', 'slack_user')

    const alreadyMappedStaff = new Set((existingMappings || []).map(m => m.entity_id))
    const alreadyMappedSlackUsers = new Set((existingMappings || []).map(m => m.external_id))

    // 4. Match by email
    const matches: Array<{
      staff_id: string
      staff_name: string
      staff_email: string
      slack_user_id: string
      slack_user_name: string
    }> = []
    const unmatchedStaff: string[] = []

    for (const member of staff || []) {
      if (!member.email) continue
      if (alreadyMappedStaff.has(member.id)) continue

      const slackUser = slackByEmail.get(member.email.toLowerCase())
      if (slackUser && !alreadyMappedSlackUsers.has(slackUser.id)) {
        matches.push({
          staff_id: member.id,
          staff_name: member.full_name,
          staff_email: member.email,
          slack_user_id: slackUser.id,
          slack_user_name: slackUser.name,
        })
        // Mark as used so we don't double-match
        alreadyMappedSlackUsers.add(slackUser.id)
      } else {
        unmatchedStaff.push(member.full_name)
      }
    }

    // 5. Bulk upsert matches into entity_external_ids
    if (matches.length > 0) {
      const records = matches.map(m => ({
        entity_type: 'staff' as const,
        entity_id: m.staff_id,
        source: 'slack_user' as const,
        external_id: m.slack_user_id,
        metadata: { slack_name: m.slack_user_name, match_type: 'auto' },
        created_by: auth.user.email,
      }))

      // Batch in groups of 50
      const BATCH_SIZE = 50
      for (let i = 0; i < records.length; i += BATCH_SIZE) {
        const batch = records.slice(i, i + BATCH_SIZE)
        const { error } = await supabase
          .from('entity_external_ids')
          .upsert(batch, { onConflict: 'source,external_id' })

        if (error) {
          console.error(`Batch ${i / BATCH_SIZE + 1} failed:`, error)
        }
      }

      // Also update staff.slack_id for all matches
      for (const m of matches) {
        await supabase
          .from('staff')
          .update({ slack_id: m.slack_user_id })
          .eq('id', m.staff_id)
      }
    }

    // Build unmatched Slack users list (not in any mapping, old or new)
    const unmatchedSlackUsers = slackUsers
      .filter(u => !alreadyMappedSlackUsers.has(u.id))
      .filter(u => u.profile.email) // Only show users with emails
      .map(u => u.real_name || u.name)
      .slice(0, 20) // Cap for readability

    invalidateUsersCache()

    return apiSuccess({
      total_staff: staff?.length || 0,
      total_slack_users: slackUsers.length,
      matched: matches.length,
      already_mapped: alreadyMappedStaff.size,
      matches: matches.map(m => ({
        staff_name: m.staff_name,
        slack_user_name: m.slack_user_name,
      })),
      unmatched_staff: unmatchedStaff.slice(0, 20),
      unmatched_slack_users: unmatchedSlackUsers,
    })
  } catch (error) {
    console.error('Staff auto-match error:', error)
    return ApiErrors.internal()
  }
}
