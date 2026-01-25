import { getAdminClient } from '@/lib/supabase/admin'
import { requirePermission } from '@/lib/auth/api-auth'
import { apiSuccess, apiError, apiValidationError, ApiErrors } from '@/lib/api/response'
import { TabMappingSchema } from '@/lib/validations/schemas'
import { z } from 'zod'

// Use singleton Supabase client
const supabase = getAdminClient()

// Schema for PATCH updates
const PatchTabMappingSchema = z.object({
  tab_mapping_id: z.string().uuid('Invalid tab mapping ID'),
  ai_summary: z.object({
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
  }).optional(),
})

// POST - Create a new tab mapping (admin only)
export async function POST(request: Request) {
  const auth = await requirePermission('data-enrichment:write')
  if (!auth.authenticated) return auth.response

  try {
    const body = await request.json()

    // Validate input
    const validation = TabMappingSchema.create.safeParse(body)
    if (!validation.success) {
      return apiValidationError(validation.error)
    }

    const { data_source_id, tab_name, status, notes } = validation.data

    // Check if this tab mapping already exists
    const { data: existing } = await supabase
      .from('tab_mappings')
      .select('id')
      .eq('data_source_id', data_source_id)
      .eq('tab_name', tab_name)
      .single()

    if (existing) {
      // Update existing
      const { data, error } = await supabase
        .from('tab_mappings')
        .update({
          status: status || 'active',
          notes: notes || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single()

      if (error) throw error
      return apiSuccess({ tabMapping: data })
    }

    // Create new tab mapping
    const { data: tabMapping, error } = await supabase
      .from('tab_mappings')
      .insert({
        data_source_id,
        tab_name,
        header_row: 0,
        primary_entity: 'partners', // Default, will be updated when mapping columns
        status: status || 'active',
        notes: notes || null,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating tab mapping:', error)
      return ApiErrors.database(error.message)
    }

    return apiSuccess({ tabMapping }, 201)
  } catch (error) {
    console.error('Error in POST /api/tab-mappings:', error)
    return ApiErrors.internal()
  }
}

// PATCH - Update a tab mapping (e.g., save AI summary)
export async function PATCH(request: Request) {
  const auth = await requirePermission('data-enrichment:write')
  if (!auth.authenticated) return auth.response

  try {
    const body = await request.json()

    // Validate input
    const validation = PatchTabMappingSchema.safeParse(body)
    if (!validation.success) {
      return apiValidationError(validation.error)
    }

    const { tab_mapping_id, ai_summary } = validation.data

    // Build update object
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (ai_summary !== undefined) {
      updates.ai_summary = ai_summary
      // Also update primary_entity if it changed
      if (ai_summary.primary_entity) {
        updates.primary_entity = ai_summary.primary_entity
      }
    }

    const { data, error } = await supabase
      .from('tab_mappings')
      .update(updates)
      .eq('id', tab_mapping_id)
      .select()
      .single()

    if (error) {
      console.error('Error updating tab mapping:', error)
      return ApiErrors.database(error.message)
    }

    if (!data) {
      return apiError('NOT_FOUND', 'Tab mapping not found', 404)
    }

    return apiSuccess({ tabMapping: data })
  } catch (error) {
    console.error('Error in PATCH /api/tab-mappings:', error)
    return ApiErrors.internal()
  }
}
