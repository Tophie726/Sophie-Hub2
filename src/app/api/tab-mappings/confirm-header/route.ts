import { getAdminClient } from '@/lib/supabase/admin'
import { requirePermission } from '@/lib/auth/api-auth'
import { apiSuccess, apiValidationError, ApiErrors } from '@/lib/api/response'
import { TabMappingSchema } from '@/lib/validations/schemas'

// Use singleton Supabase client
const supabase = getAdminClient()

// POST - Confirm header row selection for a tab (admin only)
// Creates tab_mapping if it doesn't exist, or updates header_confirmed = true
export async function POST(request: Request) {
  const auth = await requirePermission('data-enrichment:write')
  if (!auth.authenticated) return auth.response

  try {
    const body = await request.json()

    // Validate input
    const validation = TabMappingSchema.confirmHeader.safeParse(body)
    if (!validation.success) {
      return apiValidationError(validation.error)
    }

    const { data_source_id, tab_name, header_row } = validation.data

    // Check if tab mapping already exists
    const { data: existing } = await supabase
      .from('tab_mappings')
      .select('id')
      .eq('data_source_id', data_source_id)
      .eq('tab_name', tab_name)
      .single()

    if (existing) {
      // Update existing tab mapping
      const { data, error } = await supabase
        .from('tab_mappings')
        .update({
          header_row,
          header_confirmed: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single()

      if (error) throw error
      return apiSuccess({ tabMapping: data, created: false })
    }

    // Create new tab mapping with header confirmed
    const { data: tabMapping, error } = await supabase
      .from('tab_mappings')
      .insert({
        data_source_id,
        tab_name,
        header_row,
        header_confirmed: true,
        primary_entity: 'partners', // Default, will be updated when mapping columns
        status: 'active',
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating tab mapping:', error)
      return ApiErrors.database(error.message)
    }

    return apiSuccess({ tabMapping, created: true }, 201)
  } catch (error) {
    console.error('Error in POST /api/tab-mappings/confirm-header:', error)
    return ApiErrors.internal()
  }
}
