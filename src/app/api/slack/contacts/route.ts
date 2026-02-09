/**
 * GET /api/slack/contacts
 *
 * Lists Slack users that are candidates for partner-contact mapping.
 * Source mapping key: entity_external_ids(source='slack_partner_contact', entity_type='partners')
 */

import { requireRole } from '@/lib/auth/api-auth'
import { ROLES } from '@/lib/auth/roles'
import { apiSuccess, ApiErrors } from '@/lib/api/response'
import { slackConnector } from '@/lib/connectors/slack'
import { getAdminClient } from '@/lib/supabase/admin'
import { classifySlackUser } from '@/lib/slack/types'

export async function GET() {
  const auth = await requireRole(ROLES.ADMIN)
  if (!auth.authenticated) {
    return auth.response
  }

  try {
    const supabase = getAdminClient()

    const allUsers = await slackConnector.listUsers({
      include_bots: true,
      include_deleted: false,
    })

    const { data: partnerMappings } = await supabase
      .from('entity_external_ids')
      .select('id, entity_id, external_id, metadata')
      .eq('source', 'slack_partner_contact')
      .eq('entity_type', 'partners')

    const { data: staffMappings } = await supabase
      .from('entity_external_ids')
      .select('entity_id, external_id')
      .eq('source', 'slack_user')
      .eq('entity_type', 'staff')

    const mappedPartnerIds = Array.from(new Set((partnerMappings || []).map(m => m.entity_id)))
    const mappedStaffIds = Array.from(new Set((staffMappings || []).map(m => m.entity_id)))

    let partnerNames: Record<string, string> = {}
    if (mappedPartnerIds.length > 0) {
      const { data: partners } = await supabase
        .from('partners')
        .select('id, brand_name')
        .in('id', mappedPartnerIds)
      if (partners) {
        partnerNames = Object.fromEntries(partners.map(p => [p.id, p.brand_name]))
      }
    }

    let staffNames: Record<string, string> = {}
    if (mappedStaffIds.length > 0) {
      const { data: staff } = await supabase
        .from('staff')
        .select('id, full_name')
        .in('id', mappedStaffIds)
      if (staff) {
        staffNames = Object.fromEntries(staff.map(s => [s.id, s.full_name]))
      }
    }

    const partnerBySlackUser = new Map<string, {
      partner_id: string
      mapping_id: string
      is_primary_contact: boolean
    }>()
    for (const m of partnerMappings || []) {
      partnerBySlackUser.set(m.external_id, {
        partner_id: m.entity_id,
        mapping_id: m.id,
        is_primary_contact: Boolean((m.metadata as Record<string, unknown>)?.is_primary_contact),
      })
    }

    const staffBySlackUser = new Map<string, string>()
    for (const m of staffMappings || []) {
      staffBySlackUser.set(m.external_id, m.entity_id)
    }

    const contacts = allUsers
      .map(user => {
        const userType = classifySlackUser(user)
        const partnerMapping = partnerBySlackUser.get(user.id)
        const partnerId = partnerMapping?.partner_id
        const staffId = staffBySlackUser.get(user.id)
        return {
          id: user.id,
          name: user.real_name || user.name,
          email: user.profile.email || null,
          image: user.profile.image_48 || null,
          user_type: userType,
          mapping_id: partnerMapping?.mapping_id || null,
          is_primary_contact: partnerMapping?.is_primary_contact || false,
          partner_id: partnerId || null,
          partner_name: partnerId ? partnerNames[partnerId] || null : null,
          is_mapped: !!partnerId,
          mapped_to_staff: !!staffId,
          staff_name: staffId ? staffNames[staffId] || null : null,
        }
      })
      .filter(user => {
        if (user.is_mapped) return true
        if (user.user_type === 'multi_channel_guest') return true
        if (user.user_type === 'single_channel_guest') return true
        if (user.user_type === 'connect') return true
        return false
      })

    return apiSuccess({
      contacts,
      total: contacts.length,
      mapped: contacts.filter(c => c.is_mapped).length,
      blocked_staff_mapped: contacts.filter(c => c.mapped_to_staff).length,
    })
  } catch (error) {
    console.error('Failed to fetch Slack partner contacts:', error)
    return ApiErrors.internal()
  }
}
