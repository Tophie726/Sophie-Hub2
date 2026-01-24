import { getAdminClient } from '@/lib/supabase/admin'
import { requirePermission } from '@/lib/auth/api-auth'
import { apiSuccess, apiValidationError, apiError, ApiErrors } from '@/lib/api/response'
import { TabMappingSchema } from '@/lib/validations/schemas'

// Use singleton Supabase client
const supabase = getAdminClient()

// GET - Load draft state for a tab (admin only)
export async function GET(request: Request) {
  const auth = await requirePermission('data-enrichment:read')
  if (!auth.authenticated) return auth.response

  try {
    const { searchParams } = new URL(request.url)
    const dataSourceId = searchParams.get('data_source_id')
    const tabName = searchParams.get('tab_name')

    if (!dataSourceId || !tabName) {
      return apiError('VALIDATION_ERROR', 'data_source_id and tab_name are required', 400)
    }

    // Look up the tab mapping
    const { data: tabMapping, error } = await supabase
      .from('tab_mappings')
      .select('id, draft_state, draft_updated_by, draft_updated_at')
      .eq('data_source_id', dataSourceId)
      .eq('tab_name', tabName)
      .single()

    if (error && error.code !== 'PGRST116') {
      // PGRST116 is "not found" which is OK
      console.error('Error loading draft:', error)
      return ApiErrors.database(error.message)
    }

    if (!tabMapping || !tabMapping.draft_state) {
      return apiSuccess({ draft: null })
    }

    return apiSuccess({
      draft: tabMapping.draft_state,
      updatedBy: tabMapping.draft_updated_by,
      updatedAt: tabMapping.draft_updated_at,
    })
  } catch (error) {
    console.error('Error in GET /api/tab-mappings/draft:', error)
    return ApiErrors.internal()
  }
}

// POST - Save draft state for a tab (admin only)
export async function POST(request: Request) {
  const auth = await requirePermission('data-enrichment:write')
  if (!auth.authenticated) return auth.response

  try {
    const body = await request.json()

    // Validate input
    const validation = TabMappingSchema.draft.safeParse(body)
    if (!validation.success) {
      return apiValidationError(validation.error)
    }

    const { data_source_id, tab_name, draft_state, updated_by } = validation.data

    // Check if tab mapping exists
    const { data: existing } = await supabase
      .from('tab_mappings')
      .select('id')
      .eq('data_source_id', data_source_id)
      .eq('tab_name', tab_name)
      .single()

    if (existing) {
      // Update existing tab mapping with draft
      const { error } = await supabase
        .from('tab_mappings')
        .update({
          draft_state,
          draft_updated_by: updated_by || null,
          draft_updated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)

      if (error) throw error
    } else {
      // Create new tab mapping with draft
      const { error } = await supabase
        .from('tab_mappings')
        .insert({
          data_source_id,
          tab_name,
          header_row: draft_state.headerRow || 0,
          primary_entity: 'partners', // Default, will be updated when mapping completes
          draft_state,
          draft_updated_by: updated_by || null,
          draft_updated_at: new Date().toISOString(),
        })

      if (error) throw error
    }

    return apiSuccess({ saved: true })
  } catch (error) {
    console.error('Error in POST /api/tab-mappings/draft:', error)
    return ApiErrors.internal()
  }
}

// DELETE - Clear draft state for a tab (admin only)
export async function DELETE(request: Request) {
  const auth = await requirePermission('data-enrichment:write')
  if (!auth.authenticated) return auth.response

  try {
    const { searchParams } = new URL(request.url)
    const dataSourceId = searchParams.get('data_source_id')
    const tabName = searchParams.get('tab_name')

    if (!dataSourceId || !tabName) {
      return apiError('VALIDATION_ERROR', 'data_source_id and tab_name are required', 400)
    }

    // Clear draft state (don't delete the tab mapping, just the draft)
    const { error } = await supabase
      .from('tab_mappings')
      .update({
        draft_state: null,
        draft_updated_by: null,
        draft_updated_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('data_source_id', dataSourceId)
      .eq('tab_name', tabName)

    if (error && error.code !== 'PGRST116') {
      throw error
    }

    return apiSuccess({ cleared: true })
  } catch (error) {
    console.error('Error in DELETE /api/tab-mappings/draft:', error)
    return ApiErrors.internal()
  }
}
