import { requireRole } from '@/lib/auth/api-auth'
import { ROLES } from '@/lib/auth/roles'
import { getAdminClient } from '@/lib/supabase/admin'
import { apiSuccess, apiError, ApiErrors, apiValidationError } from '@/lib/api/response'
import { z } from 'zod'
import { BUCKET_COLORS, BUCKET_LABELS, type StatusColorBucket } from '@/lib/status-colors'
import { invalidateMappingsCache } from '@/lib/status-colors/cache'

// Valid buckets for validation
const VALID_BUCKETS = ['healthy', 'onboarding', 'warning', 'paused', 'offboarding', 'churned'] as const

const CreateMappingSchema = z.object({
  status_pattern: z.string().min(1).max(100).transform(s => s.toLowerCase().trim()),
  bucket: z.enum(VALID_BUCKETS),
  priority: z.number().int().min(0).max(200).optional().default(50),
})

/**
 * GET /api/admin/status-mappings
 * Returns all status color mappings (admin only)
 */
export async function GET() {
  const authResult = await requireRole(ROLES.ADMIN)
  if (!authResult.authenticated) return authResult.response

  try {
    const supabase = getAdminClient()

    const { data: mappings, error } = await supabase
      .from('status_color_mappings')
      .select('*')
      .order('priority', { ascending: false })
      .order('status_pattern')

    if (error) {
      console.error('Failed to fetch status mappings:', error)
      return ApiErrors.database(error.message)
    }

    // Include bucket metadata
    const buckets = VALID_BUCKETS.map(bucket => ({
      id: bucket,
      label: BUCKET_LABELS[bucket as StatusColorBucket],
      color: BUCKET_COLORS[bucket as StatusColorBucket],
    }))

    return apiSuccess({
      mappings: mappings || [],
      buckets,
    })
  } catch (error) {
    console.error('Status mappings fetch error:', error)
    return apiError('INTERNAL_ERROR', 'Failed to fetch status mappings', 500)
  }
}

/**
 * POST /api/admin/status-mappings
 * Creates a new status color mapping (admin only)
 */
export async function POST(request: Request) {
  const authResult = await requireRole(ROLES.ADMIN)
  if (!authResult.authenticated) return authResult.response

  try {
    const body = await request.json()
    const validation = CreateMappingSchema.safeParse(body)

    if (!validation.success) {
      return apiValidationError(validation.error)
    }

    const { status_pattern, bucket, priority } = validation.data
    const supabase = getAdminClient()

    // Check if pattern already exists
    const { data: existing } = await supabase
      .from('status_color_mappings')
      .select('id')
      .eq('status_pattern', status_pattern)
      .maybeSingle()

    if (existing) {
      return apiError('DUPLICATE', `Pattern "${status_pattern}" already exists`, 409)
    }

    const { data: mapping, error } = await supabase
      .from('status_color_mappings')
      .insert({
        status_pattern,
        bucket,
        priority,
        is_system_default: false,
        is_active: true,
        created_by: authResult.user?.id || null,
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to create status mapping:', error)
      return ApiErrors.database(error.message)
    }

    // Invalidate cache so new mapping takes effect
    invalidateMappingsCache()

    return apiSuccess({ mapping }, 201)
  } catch (error) {
    console.error('Status mapping creation error:', error)
    return apiError('INTERNAL_ERROR', 'Failed to create status mapping', 500)
  }
}
