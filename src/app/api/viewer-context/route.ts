import { z } from 'zod'
import { requireAuth } from '@/lib/auth/api-auth'
import { isAdminEmail } from '@/lib/auth/admin-access'
import { ROLES } from '@/lib/auth/roles'
import { getAdminClient } from '@/lib/supabase/admin'
import { apiSuccess, apiValidationError, ApiErrors } from '@/lib/api/response'
import { CANONICAL_PARTNER_TYPE_LABELS } from '@/lib/partners/computed-partner-type'
import {
  buildActorFromAuth,
  buildSelfSubject,
  buildViewerContext,
  type SubjectIdentity,
} from '@/lib/auth/viewer-context'
import {
  getViewCookie,
  setViewCookie,
  clearViewCookie,
} from '@/lib/auth/viewer-session'
import { logContextSwitch, logContextClear } from '@/lib/audit/admin-audit'

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const VALID_ROLES = Object.values(ROLES)

const PostBodySchema = z.object({
  type: z.enum(['self', 'staff', 'partner', 'role', 'partner_type']),
  targetId: z.string().nullable(),
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const supabase = getAdminClient()

/**
 * Gate: only true admins (staffRole === 'admin') or ADMIN_EMAILS can
 * set/clear the view context. operations_admin is excluded per W0.4.
 */
function isTrueAdmin(staffRole: string | null, email: string): boolean {
  if (isAdminEmail(email)) return true
  return staffRole === 'admin'
}

// ---------------------------------------------------------------------------
// GET /api/viewer-context
// ---------------------------------------------------------------------------

export async function GET() {
  const auth = await requireAuth()
  if (!auth.authenticated) return auth.response

  const actor = buildActorFromAuth(auth.user)

  // Read cookie — derive context server-side (P1.1: never trust request body)
  const cookie = getViewCookie()

  if (!cookie) {
    const subject = buildSelfSubject(actor)
    const ctx = buildViewerContext(actor, subject, false)
    return apiSuccess({ viewerContext: ctx })
  }

  const ctx = buildViewerContext(actor, cookie.subject, cookie.adminModeOn)
  return apiSuccess({ viewerContext: ctx })
}

// ---------------------------------------------------------------------------
// POST /api/viewer-context
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  const auth = await requireAuth()
  if (!auth.authenticated) return auth.response

  // W0.4 gate: operations_admin excluded
  if (!isTrueAdmin(auth.user.staffRole, auth.user.email)) {
    return ApiErrors.forbidden('See-As is restricted to full admins')
  }

  const body = await request.json()
  const validation = PostBodySchema.safeParse(body)
  if (!validation.success) return apiValidationError(validation.error)

  const { type, targetId } = validation.data
  const actor = buildActorFromAuth(auth.user)

  // type=self: clear cookie and return self context
  if (type === 'self') {
    clearViewCookie()
    logContextClear(auth.user.id, auth.user.email)
    const subject = buildSelfSubject(actor)
    const ctx = buildViewerContext(actor, subject, false)
    return apiSuccess({ viewerContext: ctx })
  }

  // Build SubjectIdentity based on type
  let subject: SubjectIdentity

  switch (type) {
    case 'staff': {
      if (!targetId) return ApiErrors.forbidden('targetId is required for staff type')
      const { data: staff, error } = await supabase
        .from('staff')
        .select('id, full_name, email, role')
        .eq('id', targetId)
        .single()
      if (error || !staff) return ApiErrors.notFound('Staff member')
      subject = {
        type: 'staff',
        targetId: staff.id,
        targetLabel: staff.full_name || staff.email,
        resolvedRole: mapStaffRole(staff.role),
      }
      break
    }

    case 'partner': {
      if (!targetId) return ApiErrors.forbidden('targetId is required for partner type')
      const { data: partner, error } = await supabase
        .from('partners')
        .select('id, brand_name, source_data')
        .eq('id', targetId)
        .single()
      if (error || !partner) return ApiErrors.notFound('Partner')
      subject = {
        type: 'partner',
        targetId: partner.id,
        targetLabel: partner.brand_name || 'Unknown Partner',
        resolvedRole: ROLES.PARTNER,
      }
      break
    }

    case 'role': {
      if (!targetId || !VALID_ROLES.includes(targetId as typeof VALID_ROLES[number])) {
        return ApiErrors.forbidden(`Invalid role slug: ${targetId}`)
      }
      const roleLabels: Record<string, string> = {
        admin: 'Admin',
        pod_leader: 'PPC Strategist',
        staff: 'Staff',
        partner: 'Partner',
      }
      subject = {
        type: 'role',
        targetId,
        targetLabel: roleLabels[targetId] || targetId,
        resolvedRole: targetId as typeof VALID_ROLES[number],
      }
      break
    }

    case 'partner_type': {
      if (!targetId) return ApiErrors.forbidden('targetId is required for partner_type type')
      const normalizedTarget = targetId as keyof typeof CANONICAL_PARTNER_TYPE_LABELS
      subject = {
        type: 'partner_type',
        targetId,
        targetLabel: CANONICAL_PARTNER_TYPE_LABELS[normalizedTarget] || targetId,
        resolvedRole: ROLES.PARTNER,
      }
      break
    }
  }

  setViewCookie(subject, false)
  logContextSwitch(auth.user.id, auth.user.email, subject.type, subject.targetId, subject.targetLabel)
  const ctx = buildViewerContext(actor, subject, false)
  return apiSuccess({ viewerContext: ctx })
}

// ---------------------------------------------------------------------------
// DELETE /api/viewer-context
// ---------------------------------------------------------------------------

export async function DELETE() {
  const auth = await requireAuth()
  if (!auth.authenticated) return auth.response

  // W0.4 gate: operations_admin excluded
  if (!isTrueAdmin(auth.user.staffRole, auth.user.email)) {
    return ApiErrors.forbidden('See-As is restricted to full admins')
  }

  clearViewCookie()
  logContextClear(auth.user.id, auth.user.email)
  return new Response(null, { status: 204 })
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Map a staff table role string to the RBAC Role type.
 * Mirrors the logic in api-auth.ts mapRoleToAccessLevel but without
 * the ADMIN_EMAILS check (we're just resolving for view context, not auth).
 */
function mapStaffRole(staffRole: string | null): typeof VALID_ROLES[number] {
  if (!staffRole) return ROLES.STAFF
  switch (staffRole.toLowerCase()) {
    case 'admin':
    case 'operations_admin':
      return ROLES.ADMIN
    case 'pod_leader':
      return ROLES.POD_LEADER
    default:
      return ROLES.STAFF
  }
}
