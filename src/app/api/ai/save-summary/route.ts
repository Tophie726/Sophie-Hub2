import { NextRequest } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { requirePermission } from '@/lib/auth/api-auth'
import { apiSuccess, apiError, apiValidationError, ApiErrors } from '@/lib/api/response'
import { z } from 'zod'

// =============================================================================
// Validation Schema
// =============================================================================

const SaveSummarySchema = z.object({
  data_source_id: z.string().uuid('Invalid data source ID'),
  tab_name: z.string().min(1, 'Tab name is required'),
  summary: z.object({
    primary_entity: z.string(),
    confidence: z.number(),
    summary: z.string(),
    purpose: z.string(),
    key_column: z.string(),
    column_categories: z.object({
      core_fields: z.array(z.string()).optional(),
      relationship_fields: z.array(z.string()).optional(),
      weekly_date_fields: z.array(z.string()).optional(),
      skip_candidates: z.number().optional(),
    }),
    data_quality_notes: z.array(z.string()).optional(),
  }),
})

// =============================================================================
// POST /api/ai/save-summary
// =============================================================================

export async function POST(request: NextRequest) {
  const auth = await requirePermission('data-enrichment:write')
  if (!auth.authenticated) return auth.response

  try {
    const body = await request.json()
    const validation = SaveSummarySchema.safeParse(body)
    if (!validation.success) {
      return apiValidationError(validation.error)
    }

    const { data_source_id, tab_name, summary } = validation.data
    const supabase = getAdminClient()

    // Find existing tab mapping
    const { data: existing } = await supabase
      .from('tab_mappings')
      .select('id')
      .eq('data_source_id', data_source_id)
      .eq('tab_name', tab_name)
      .single()

    if (existing) {
      // Update existing tab mapping with AI summary
      const { data, error } = await supabase
        .from('tab_mappings')
        .update({
          ai_summary: summary,
          primary_entity: summary.primary_entity,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single()

      if (error) {
        console.error('Error updating AI summary:', error)
        return ApiErrors.database(error.message)
      }

      return apiSuccess({ tabMapping: data })
    }

    // Create new tab mapping with AI summary
    const { data: newMapping, error } = await supabase
      .from('tab_mappings')
      .insert({
        data_source_id,
        tab_name,
        header_row: 0, // Will be updated when mapping is confirmed
        primary_entity: summary.primary_entity,
        ai_summary: summary,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating tab mapping with AI summary:', error)
      return ApiErrors.database(error.message)
    }

    return apiSuccess({ tabMapping: newMapping }, 201)
  } catch (error) {
    console.error('Error in POST /api/ai/save-summary:', error)
    return ApiErrors.internal()
  }
}

// =============================================================================
// GET /api/ai/save-summary - Load existing summary
// =============================================================================

export async function GET(request: NextRequest) {
  const auth = await requirePermission('data-enrichment:read')
  if (!auth.authenticated) return auth.response

  try {
    const { searchParams } = new URL(request.url)
    const dataSourceId = searchParams.get('data_source_id')
    const tabName = searchParams.get('tab_name')

    if (!dataSourceId || !tabName) {
      return apiError('VALIDATION_ERROR', 'data_source_id and tab_name are required', 400)
    }

    const supabase = getAdminClient()

    const { data: tabMapping, error } = await supabase
      .from('tab_mappings')
      .select('id, ai_summary, primary_entity')
      .eq('data_source_id', dataSourceId)
      .eq('tab_name', tabName)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error loading AI summary:', error)
      return ApiErrors.database(error.message)
    }

    return apiSuccess({
      summary: tabMapping?.ai_summary || null,
      tabMappingId: tabMapping?.id || null,
    }, 200, {
      'Cache-Control': 'private, max-age=60, stale-while-revalidate=120',
    })
  } catch (error) {
    console.error('Error in GET /api/ai/save-summary:', error)
    return ApiErrors.internal()
  }
}
