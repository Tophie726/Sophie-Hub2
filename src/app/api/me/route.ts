import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/api-auth'
import { getPermissionsForRole } from '@/lib/auth/roles'

/**
 * GET /api/me
 * Returns the current user's info including role and permissions.
 * Used by frontend for role-based UI rendering.
 */
export async function GET() {
  const auth = await requireAuth()
  if (!auth.authenticated) return auth.response

  const { user } = auth

  return NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    staffRole: user.staffRole,
    permissions: getPermissionsForRole(user.role),
  })
}
