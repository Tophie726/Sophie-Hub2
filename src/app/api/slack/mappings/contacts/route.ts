/**
 * GET/POST/DELETE /api/slack/mappings/contacts
 *
 * Manages partner-contact ↔ Slack user mappings.
 * Source: 'slack_partner_contact', entity_type: 'partners'
 */

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/auth/api-auth'
import { ROLES } from '@/lib/auth/roles'
import { apiSuccess, apiError, apiValidationError, ApiErrors } from '@/lib/api/response'
import { getAdminClient } from '@/lib/supabase/admin'

const CreateMappingSchema = z.object({
  partner_id: z.string().uuid('partner_id must be a valid UUID'),
  slack_user_id: z.string().min(1, 'slack_user_id is required'),
  slack_user_name: z.string().optional(),
})

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
      .eq('source', 'slack_partner_contact')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching partner-contact mappings:', error)
      return ApiErrors.database()
    }

    const partnerIds = mappings?.map(m => m.entity_id) || []
    let partnerInfo: Record<string, { brand_name: string }> = {}
    if (partnerIds.length > 0) {
      const { data: partners } = await supabase
        .from('partners')
        .select('id, brand_name')
        .in('id', partnerIds)
      if (partners) {
        partnerInfo = Object.fromEntries(partners.map(p => [p.id, { brand_name: p.brand_name }]))
      }
    }

    const enriched = mappings?.map(m => ({
      id: m.id,
      partner_id: m.entity_id,
      partner_name: partnerInfo[m.entity_id]?.brand_name || null,
      slack_user_id: m.external_id,
      slack_user_name: (m.metadata as Record<string, unknown>)?.slack_name || null,
      is_primary_contact: Boolean((m.metadata as Record<string, unknown>)?.is_primary_contact),
      created_at: m.created_at,
    })) || []

    return apiSuccess({ mappings: enriched, count: enriched.length })
  } catch (error) {
    console.error('GET partner-contact mappings error:', error)
    return ApiErrors.internal()
  }
}

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

    const { partner_id, slack_user_id, slack_user_name } = validation.data
    const supabase = getAdminClient()

    const { data: partner, error: partnerError } = await supabase
      .from('partners')
      .select('id, brand_name')
      .eq('id', partner_id)
      .single()

    if (partnerError || !partner) {
      return ApiErrors.notFound('Partner')
    }

    // Guardrail: a Slack user already mapped to staff should not also be mapped
    // as a partner contact.
    const { data: staffMapping } = await supabase
      .from('entity_external_ids')
      .select('id')
      .eq('source', 'slack_user')
      .eq('entity_type', 'staff')
      .eq('external_id', slack_user_id)
      .limit(1)
      .maybeSingle()

    if (staffMapping) {
      return apiError(
        'CONFLICT',
        'This Slack user is already mapped to staff. Remove staff mapping first.',
        409
      )
    }

    const { count: existingCount, error: countError } = await supabase
      .from('entity_external_ids')
      .select('id', { count: 'exact', head: true })
      .eq('source', 'slack_partner_contact')
      .eq('entity_type', 'partners')
      .eq('entity_id', partner_id)

    if (countError) {
      console.error('Error checking existing partner contacts:', countError)
      return ApiErrors.database()
    }

    const { data: mapping, error } = await supabase
      .from('entity_external_ids')
      .upsert({
        entity_type: 'partners',
        entity_id: partner_id,
        source: 'slack_partner_contact',
        external_id: slack_user_id,
        metadata: {
          ...(slack_user_name ? { slack_name: slack_user_name } : {}),
          is_primary_contact: (existingCount || 0) === 0,
          match_type: 'manual',
        },
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'source,external_id',
      })
      .select()
      .single()

    if (error) {
      console.error('Error saving partner-contact mapping:', error)
      return ApiErrors.database()
    }

    return apiSuccess({
      mapping: {
        ...mapping,
        partner_name: partner.brand_name,
      },
    }, 201)
  } catch (error) {
    console.error('POST partner-contact mapping error:', error)
    return ApiErrors.internal()
  }
}

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
    const { error } = await supabase
      .from('entity_external_ids')
      .delete()
      .eq('id', mappingId)
      .eq('source', 'slack_partner_contact')

    if (error) {
      console.error('Error deleting partner-contact mapping:', error)
      return ApiErrors.database()
    }

    return apiSuccess({ deleted: true })
  } catch (error) {
    console.error('DELETE partner-contact mapping error:', error)
    return ApiErrors.internal()
  }
}
