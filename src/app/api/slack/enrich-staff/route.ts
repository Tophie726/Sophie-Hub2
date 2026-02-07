/**
 * POST /api/slack/enrich-staff
 *
 * Pull profile data (avatar, title, timezone, phone) from Slack
 * for all staff members that have a Slack mapping.
 * Updates the staff table with enriched data.
 */

import { requireRole } from '@/lib/auth/api-auth'
import { ROLES } from '@/lib/auth/roles'
import { apiSuccess, ApiErrors } from '@/lib/api/response'
import { slackConnector } from '@/lib/connectors/slack'
import { getAdminClient } from '@/lib/supabase/admin'

export async function POST() {
  const auth = await requireRole(ROLES.ADMIN)
  if (!auth.authenticated) {
    return auth.response
  }

  try {
    const supabase = getAdminClient()

    // 1. Fetch all staff ↔ Slack mappings
    const { data: mappings, error: mappingsError } = await supabase
      .from('entity_external_ids')
      .select('entity_id, external_id')
      .eq('entity_type', 'staff')
      .eq('source', 'slack_user')

    if (mappingsError) {
      console.error('Failed to fetch mappings:', mappingsError)
      return ApiErrors.database()
    }

    if (!mappings || mappings.length === 0) {
      return apiSuccess({
        enriched: 0,
        message: 'No staff-Slack mappings found. Run auto-match first.',
      })
    }

    // 2. Fetch all Slack users (includes profile data)
    const slackUsers = await slackConnector.listUsers({
      include_bots: true,
      include_deleted: true,
    })

    // Build lookup: slack_user_id → full Slack profile
    const slackById = new Map(slackUsers.map(u => [u.id, u]))

    // 3. Enrich each mapped staff member
    let enriched = 0
    let skipped = 0
    const updates: Array<{
      staff_id: string
      fields: Record<string, string | null>
    }> = []

    for (const mapping of mappings) {
      const slackUser = slackById.get(mapping.external_id)
      if (!slackUser) {
        skipped++
        continue
      }

      // Pick the best available avatar (prefer larger sizes)
      const avatarUrl =
        slackUser.profile.image_192 ||
        slackUser.profile.image_512 ||
        slackUser.profile.image_72 ||
        slackUser.profile.image_48 ||
        null

      const fieldsToUpdate: Record<string, string | null> = {}

      if (avatarUrl) fieldsToUpdate.avatar_url = avatarUrl
      if (slackUser.tz) fieldsToUpdate.timezone = slackUser.tz
      // Only update title if it's currently empty in the DB — don't overwrite manual entries
      if (slackUser.profile.title) fieldsToUpdate._slack_title = slackUser.profile.title
      if (slackUser.profile.phone) fieldsToUpdate._slack_phone = slackUser.profile.phone

      if (Object.keys(fieldsToUpdate).length > 0) {
        updates.push({ staff_id: mapping.entity_id, fields: fieldsToUpdate })
      }
    }

    // 4. Batch update staff records
    for (const update of updates) {
      const dbFields: Record<string, string | null> = {}

      // Always update avatar and timezone (these come from Slack)
      if (update.fields.avatar_url) dbFields.avatar_url = update.fields.avatar_url
      if (update.fields.timezone) dbFields.timezone = update.fields.timezone

      // For title and phone, only set if the DB field is currently empty
      if (update.fields._slack_title || update.fields._slack_phone) {
        const { data: existing } = await supabase
          .from('staff')
          .select('title, phone')
          .eq('id', update.staff_id)
          .single()

        if (existing) {
          if (!existing.title && update.fields._slack_title) {
            dbFields.title = update.fields._slack_title
          }
          if (!existing.phone && update.fields._slack_phone) {
            dbFields.phone = update.fields._slack_phone
          }
        }
      }

      if (Object.keys(dbFields).length > 0) {
        const { error } = await supabase
          .from('staff')
          .update(dbFields)
          .eq('id', update.staff_id)

        if (!error) {
          enriched++
        } else {
          console.error(`Failed to enrich staff ${update.staff_id}:`, error)
        }
      }
    }

    return apiSuccess({
      enriched,
      skipped,
      total_mappings: mappings.length,
      fields_updated: ['avatar_url', 'timezone', 'title (if empty)', 'phone (if empty)'],
    })
  } catch (error) {
    console.error('Staff enrichment error:', error)
    return ApiErrors.internal()
  }
}
