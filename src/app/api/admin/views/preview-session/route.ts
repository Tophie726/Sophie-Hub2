import { z } from 'zod'
import { requireAuth } from '@/lib/auth/api-auth'
import { isTrueAdmin } from '@/lib/auth/admin-access'
import { ROLES } from '@/lib/auth/roles'
import { getAdminClient } from '@/lib/supabase/admin'
import { apiSuccess, apiValidationError, ApiErrors } from '@/lib/api/response'
import { createPreviewToken } from '@/lib/views/preview-session'
import { logPreviewCreate } from '@/lib/audit/admin-audit'
import { CANONICAL_PARTNER_TYPE_LABELS } from '@/lib/partners/computed-partner-type'

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const CreateSessionSchema = z.object({
  viewId: z.string().uuid(),
  subjectType: z.enum(['self', 'staff', 'partner', 'role', 'partner_type']),
  subjectTargetId: z.string().nullable().optional().default(null),
  dataMode: z.enum(['snapshot', 'live']).optional().default('snapshot'),
})

// ---------------------------------------------------------------------------
// POST /api/admin/views/preview-session
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  const auth = await requireAuth()
  if (!auth.authenticated) return auth.response

  // HR-7: isTrueAdmin gate (excludes operations_admin)
  if (!isTrueAdmin(auth.user.staffRole, auth.user.email)) {
    return ApiErrors.forbidden('Preview management is restricted to full admins')
  }

  const body = await request.json()
  const validation = CreateSessionSchema.safeParse(body)
  if (!validation.success) return apiValidationError(validation.error)

  const { viewId, subjectType, subjectTargetId, dataMode } = validation.data
  const supabase = getAdminClient()

  // Verify view exists and is active
  const { data: view, error: viewError } = await supabase
    .from('view_profiles')
    .select('id, name, slug, is_active')
    .eq('id', viewId)
    .single()

  if (viewError || !view) {
    return ApiErrors.notFound('View profile')
  }

  if (!view.is_active) {
    return apiSuccess({ error: 'View is not active' }, 400)
  }

  // Resolve the role for the subject
  let resolvedRole = auth.user.role // default to actor role for 'self'

  switch (subjectType) {
    case 'self':
      resolvedRole = auth.user.role
      break

    case 'staff': {
      if (!subjectTargetId) {
        return ApiErrors.forbidden('subjectTargetId is required for staff type')
      }
      const { data: staff } = await supabase
        .from('staff')
        .select('role')
        .eq('id', subjectTargetId)
        .single()
      if (!staff) return ApiErrors.notFound('Staff member')
      // Map staff role to RBAC role
      const staffRole = staff.role?.toLowerCase()
      if (staffRole === 'admin' || staffRole === 'operations_admin') {
        resolvedRole = ROLES.ADMIN
      } else if (staffRole === 'pod_leader') {
        resolvedRole = ROLES.POD_LEADER
      } else {
        resolvedRole = ROLES.STAFF
      }
      break
    }

    case 'partner':
      resolvedRole = ROLES.PARTNER
      break

    case 'role': {
      const validRoles = Object.values(ROLES)
      if (!subjectTargetId || !validRoles.includes(subjectTargetId as typeof validRoles[number])) {
        return ApiErrors.forbidden(`Invalid role slug: ${subjectTargetId}`)
      }
      resolvedRole = subjectTargetId as typeof validRoles[number]
      break
    }

    case 'partner_type': {
      if (!subjectTargetId) {
        return ApiErrors.forbidden('subjectTargetId is required for partner_type')
      }
      // Validate it's a known partner type
      if (!(subjectTargetId in CANONICAL_PARTNER_TYPE_LABELS)) {
        return ApiErrors.forbidden(`Unknown partner type: ${subjectTargetId}`)
      }
      resolvedRole = ROLES.PARTNER
      break
    }
  }

  // HR-9: Live mode requires concrete entity target
  if (dataMode === 'live' && (subjectType === 'role' || subjectType === 'partner_type' || subjectType === 'self')) {
    return ApiErrors.forbidden('Live data mode requires a specific partner or staff member target')
  }

  // Create token (HR-8: no PII in payload — only UUIDs + shortcodes)
  const { token, expiresAt, sessionId } = createPreviewToken({
    viewId,
    subjectType,
    targetId: subjectTargetId,
    resolvedRole,
    dataMode,
    actorId: auth.user.id,
  })

  // Audit log (VB21)
  logPreviewCreate(
    auth.user.id,
    auth.user.email,
    viewId,
    sessionId,
    subjectType,
    subjectTargetId,
    dataMode,
  )

  return apiSuccess({
    token,
    expiresAt,
    previewUrl: `/preview?token=${encodeURIComponent(token)}`,
  })
}
