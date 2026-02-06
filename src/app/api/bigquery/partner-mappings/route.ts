/**
 * GET/POST/DELETE /api/bigquery/partner-mappings
 *
 * Manages BigQuery client_name → partner mappings in entity_external_ids table.
 */

import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { requireRole } from '@/lib/auth/api-auth'
import { apiSuccess, apiError, apiValidationError, ApiErrors } from '@/lib/api/response'
import { invalidateClientNamesCache } from '@/lib/connectors/bigquery-cache'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Zod schema for creating/updating mappings
const CreateMappingSchema = z.object({
  partner_id: z.string().uuid('partner_id must be a valid UUID'),
  client_name: z.string().min(1, 'client_name is required').max(255)
})

/**
 * GET - Fetch all BigQuery partner mappings with partner details
 */
export async function GET() {
  try {
    // Require admin role (Data Enrichment is admin-only)
    const authResult = await requireRole('admin')
    if (!authResult.authenticated) {
      return authResult.response
    }

    // Get all BigQuery mappings joined with partner info
    const { data: mappings, error } = await supabase
      .from('entity_external_ids')
      .select(`
        id,
        entity_id,
        external_id,
        metadata,
        created_at,
        updated_at
      `)
      .eq('entity_type', 'partners')
      .eq('source', 'bigquery')
      .order('external_id')

    if (error) {
      console.error('Error fetching mappings:', error)
      return ApiErrors.database()
    }

    // Get partner names for the mapped IDs
    const partnerIds = mappings?.map(m => m.entity_id) || []
    let partners: Record<string, { brand_name: string; tier: string | null; status: string | null }> = {}

    if (partnerIds.length > 0) {
      const { data: partnerData } = await supabase
        .from('partners')
        .select('id, brand_name, tier, status')
        .in('id', partnerIds)

      if (partnerData) {
        partners = Object.fromEntries(
          partnerData.map(p => [p.id, { brand_name: p.brand_name, tier: p.tier, status: p.status }])
        )
      }
    }

    // Enrich mappings with partner names, tier, and status
    const enrichedMappings = mappings?.map(m => {
      const partner = partners[m.entity_id]
      return {
        ...m,
        partner_name: partner?.brand_name || null,
        tier: partner?.tier || null,
        status: partner?.status || null,
      }
    }) || []

    // Add Cache-Control header - mappings change infrequently
    const response = apiSuccess({
      mappings: enrichedMappings,
      count: enrichedMappings.length
    })
    response.headers.set('Cache-Control', 'private, max-age=60') // 1 min cache
    return response
  } catch (error) {
    console.error('GET partner-mappings error:', error)
    return ApiErrors.internal(
      error instanceof Error ? error.message : 'Failed to fetch mappings'
    )
  }
}

/**
 * POST - Create or update a BigQuery partner mapping
 */
export async function POST(request: NextRequest) {
  try {
    // Require admin role (Data Enrichment is admin-only)
    const authResult = await requireRole('admin')
    if (!authResult.authenticated) {
      return authResult.response
    }

    const body = await request.json()

    // Validate input with Zod
    const validation = CreateMappingSchema.safeParse(body)
    if (!validation.success) {
      return apiValidationError(validation.error)
    }

    const { partner_id, client_name } = validation.data

    // Check if partner exists
    const { data: partner, error: partnerError } = await supabase
      .from('partners')
      .select('id, brand_name')
      .eq('id', partner_id)
      .single()

    if (partnerError || !partner) {
      return ApiErrors.notFound('Partner')
    }

    // Upsert the mapping
    const { data: mapping, error } = await supabase
      .from('entity_external_ids')
      .upsert({
        entity_type: 'partners',
        entity_id: partner_id,
        source: 'bigquery',
        external_id: client_name,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'entity_type,entity_id,source'
      })
      .select()
      .single()

    if (error) {
      // Check for unique constraint violation on external_id
      if (error.code === '23505' && error.message.includes('source_external')) {
        return apiError(
          'CONFLICT',
          `Client name "${client_name}" is already mapped to another partner`,
          409
        )
      }
      console.error('Error saving mapping:', error)
      return ApiErrors.database()
    }

    // Invalidate client names cache so mapping status is fresh
    invalidateClientNamesCache()

    return apiSuccess({
      mapping: {
        ...mapping,
        partner_name: partner.brand_name
      }
    }, 201)
  } catch (error) {
    console.error('POST partner-mappings error:', error)
    return ApiErrors.internal(
      error instanceof Error ? error.message : 'Failed to save mapping'
    )
  }
}

/**
 * DELETE - Remove a BigQuery partner mapping
 */
export async function DELETE(request: NextRequest) {
  try {
    // Require admin role (Data Enrichment is admin-only)
    const authResult = await requireRole('admin')
    if (!authResult.authenticated) {
      return authResult.response
    }

    const { searchParams } = new URL(request.url)
    const mappingId = searchParams.get('id')

    if (!mappingId) {
      return apiError('VALIDATION_ERROR', 'Mapping ID is required', 400)
    }

    const { error } = await supabase
      .from('entity_external_ids')
      .delete()
      .eq('id', mappingId)
      .eq('source', 'bigquery') // Safety: only delete BigQuery mappings

    if (error) {
      console.error('Error deleting mapping:', error)
      return ApiErrors.database()
    }

    // Invalidate client names cache so mapping status is fresh
    invalidateClientNamesCache()

    return apiSuccess({ deleted: true })
  } catch (error) {
    console.error('DELETE partner-mappings error:', error)
    return ApiErrors.internal(
      error instanceof Error ? error.message : 'Failed to delete mapping'
    )
  }
}
