import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/api-auth'
import { ROLES } from '@/lib/auth/roles'
import { getAdminClient } from '@/lib/supabase/admin'
import { maskValue } from '@/lib/encryption'
import { apiSuccess, apiError, ApiErrors } from '@/lib/api/response'

/**
 * GET /api/admin/settings
 * Returns all system settings with masked values (admin only)
 */
export async function GET() {
  const authResult = await requireRole(ROLES.ADMIN)
  if (!authResult.authenticated) return authResult.response

  try {
    const supabase = getAdminClient()

    const { data: settings, error } = await supabase
      .from('system_settings')
      .select('key, value, encrypted, description, updated_at, updated_by')
      .order('key')

    if (error) {
      console.error('Failed to fetch settings:', error)
      return ApiErrors.database(error.message)
    }

    // Mask sensitive values before returning
    const maskedSettings = (settings || []).map(setting => ({
      key: setting.key,
      is_set: !!setting.value,
      masked_value: setting.value ? maskValue(setting.value) : null,
      description: setting.description,
      updated_at: setting.updated_at,
      updated_by: setting.updated_by,
    }))

    return apiSuccess({ settings: maskedSettings })
  } catch (error) {
    console.error('Settings fetch error:', error)
    return apiError('INTERNAL_ERROR', 'Failed to fetch settings', 500)
  }
}
