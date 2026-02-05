import { getAdminClient } from '@/lib/supabase/admin'
import { requirePermission } from '@/lib/auth/api-auth'
import { apiSuccess, apiValidationError, ApiErrors } from '@/lib/api/response'
import { TabMappingSchema } from '@/lib/validations/schemas'

// Use singleton Supabase client
const supabase = getAdminClient()

// PATCH - Update tab mapping status (admin only)
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requirePermission('data-enrichment:write')
  if (!auth.authenticated) return auth.response

  try {
    const body = await request.json()

    // Validate input
    const validation = TabMappingSchema.updateStatus.safeParse(body)
    if (!validation.success) {
      return apiValidationError(validation.error)
    }

    const { status, notes } = validation.data

    // CRITICAL: Keep is_active in sync with status
    // Only 'active' status should have is_active = true
    // All other statuses (hidden, reference, flagged) are inactive
    const is_active = status === 'active'

    // Update tab mapping
    const { data, error } = await supabase
      .from('tab_mappings')
      .update({
        status,
        is_active,
        notes: notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating tab status:', error)
      return ApiErrors.database(error.message)
    }

    return apiSuccess({ tab: data })
  } catch (error) {
    console.error('Error in PATCH /api/tab-mappings/[id]/status:', error)
    return ApiErrors.internal()
  }
}
