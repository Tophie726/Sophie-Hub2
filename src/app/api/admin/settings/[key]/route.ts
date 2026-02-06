import { requireRole } from '@/lib/auth/api-auth'
import { ROLES } from '@/lib/auth/roles'
import { getAdminClient } from '@/lib/supabase/admin'
import { encrypt, decrypt, maskValue } from '@/lib/encryption'
import { apiSuccess, apiError, ApiErrors } from '@/lib/api/response'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'

interface RouteContext {
  params: Promise<{ key: string }>
}

/**
 * PUT /api/admin/settings/[key]
 * Update or create a system setting (admin only)
 */
export async function PUT(request: Request, context: RouteContext) {
  const authResult = await requireRole(ROLES.ADMIN)
  if (!authResult.authenticated) return authResult.response

  const rateLimit = checkRateLimit(authResult.user.id, 'admin:settings:write', RATE_LIMITS.STRICT)
  if (!rateLimit.allowed) {
    return ApiErrors.rateLimited('Too many settings updates. Please wait before trying again.')
  }

  const { key } = await context.params

  // Validate key format
  if (!key || !/^[a-z_]+$/.test(key)) {
    return apiError('VALIDATION_ERROR', 'Invalid setting key format', 400)
  }

  try {
    const body = await request.json()
    const { value } = body

    if (!value || typeof value !== 'string') {
      return apiError('VALIDATION_ERROR', 'Value is required', 400)
    }

    // Encrypt the value before storing
    let encryptedValue: string
    try {
      encryptedValue = encrypt(value)
    } catch (encryptError) {
      console.error('Encryption failed:', encryptError)
      return apiError(
        'ENCRYPTION_ERROR',
        'Encryption failed. Ensure ENCRYPTION_KEY is configured.',
        500
      )
    }

    const supabase = getAdminClient()

    // Upsert the setting
    const { data, error } = await supabase
      .from('system_settings')
      .upsert(
        {
          key,
          value: encryptedValue,
          encrypted: true,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'key',
        }
      )
      .select('key, value, updated_at')
      .single()

    if (error) {
      console.error('Failed to save setting:', error)
      return ApiErrors.database(error.message)
    }

    return apiSuccess({
      key: data.key,
      masked_value: maskValue(value),
      updated_at: data.updated_at,
    })
  } catch (error) {
    console.error('Settings update error:', error)
    return apiError('INTERNAL_ERROR', 'Failed to update setting', 500)
  }
}

/**
 * DELETE /api/admin/settings/[key]
 * Remove a system setting (admin only)
 */
export async function DELETE(request: Request, context: RouteContext) {
  const authResult = await requireRole(ROLES.ADMIN)
  if (!authResult.authenticated) return authResult.response

  const rateLimit = checkRateLimit(authResult.user.id, 'admin:settings:write', RATE_LIMITS.STRICT)
  if (!rateLimit.allowed) {
    return ApiErrors.rateLimited('Too many settings updates. Please wait before trying again.')
  }

  const { key } = await context.params

  if (!key) {
    return apiError('VALIDATION_ERROR', 'Key is required', 400)
  }

  try {
    const supabase = getAdminClient()

    const { error } = await supabase
      .from('system_settings')
      .delete()
      .eq('key', key)

    if (error) {
      console.error('Failed to delete setting:', error)
      return ApiErrors.database(error.message)
    }

    return apiSuccess({ deleted: true })
  } catch (error) {
    console.error('Settings delete error:', error)
    return apiError('INTERNAL_ERROR', 'Failed to delete setting', 500)
  }
}

/**
 * GET /api/admin/settings/[key]
 * Get decrypted value for a specific setting (admin only, for internal use)
 */
export async function GET(request: Request, context: RouteContext) {
  const authResult = await requireRole(ROLES.ADMIN)
  if (!authResult.authenticated) return authResult.response

  const { key } = await context.params

  if (!key) {
    return apiError('VALIDATION_ERROR', 'Key is required', 400)
  }

  try {
    const supabase = getAdminClient()

    const { data, error } = await supabase
      .from('system_settings')
      .select('key, value, encrypted, description, updated_at')
      .eq('key', key)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return ApiErrors.notFound('Setting')
      }
      console.error('Failed to fetch setting:', error)
      return ApiErrors.database(error.message)
    }

    // Decrypt if encrypted
    let decryptedValue = data.value
    if (data.encrypted && data.value) {
      try {
        decryptedValue = decrypt(data.value)
      } catch (decryptError) {
        console.error('Decryption failed:', decryptError)
        return apiError('DECRYPTION_ERROR', 'Failed to decrypt setting', 500)
      }
    }

    return apiSuccess({
      key: data.key,
      value: decryptedValue,
      description: data.description,
      updated_at: data.updated_at,
    })
  } catch (error) {
    console.error('Settings fetch error:', error)
    return apiError('INTERNAL_ERROR', 'Failed to fetch setting', 500)
  }
}
