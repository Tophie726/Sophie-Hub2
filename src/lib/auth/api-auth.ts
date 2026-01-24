import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authOptions } from './config'
import { Role, Permission, ROLES, hasPermission } from './roles'

// Server-side Supabase client for auth lookups
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface AuthUser {
  id: string
  email: string
  name: string | null
  role: Role
  staffRole: string | null // Original role from staff table (pod_leader, ppc_manager, etc.)
}

interface AuthSuccess {
  authenticated: true
  session: Awaited<ReturnType<typeof getServerSession>>
  user: AuthUser
}

interface AuthFailure {
  authenticated: false
  response: NextResponse
}

export type AuthResult = AuthSuccess | AuthFailure

/**
 * Map staff table roles to access levels
 * - admin → ADMIN
 * - pod_leader → POD_LEADER
 * - everything else → STAFF
 *
 * You can add an `access_level` column to staff table for more control
 */
function mapRoleToAccessLevel(staffRole: string | null, email: string): Role {
  // Admin emails from environment variable (comma-separated)
  // Example: ADMIN_EMAILS=admin@example.com,tomas@sophiesociety.com
  const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim().toLowerCase()).filter(Boolean) ?? []

  if (adminEmails.includes(email.toLowerCase())) {
    return ROLES.ADMIN
  }

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

/**
 * Check if the request is authenticated.
 * Returns the session and user info if authenticated.
 */
export async function requireAuth(): Promise<AuthResult> {
  const session = await getServerSession(authOptions)

  if (!session?.user?.email) {
    return {
      authenticated: false,
      response: NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      ),
    }
  }

  // Look up user in staff table
  const { data: staffUser } = await supabase
    .from('staff')
    .select('id, full_name, email, role')
    .eq('email', session.user.email)
    .single()

  // Allow auth even if user not in staff table (for initial setup)
  // Role is determined by mapRoleToAccessLevel which checks ADMIN_EMAILS env var
  const user: AuthUser = staffUser
    ? {
        id: staffUser.id,
        email: staffUser.email,
        name: staffUser.full_name,
        staffRole: staffUser.role,
        role: mapRoleToAccessLevel(staffUser.role, staffUser.email),
      }
    : {
        id: 'temp-' + session.user.email,
        email: session.user.email,
        name: session.user.name || null,
        staffRole: null,
        role: mapRoleToAccessLevel(null, session.user.email), // Check ADMIN_EMAILS even for users not in DB
      }

  return {
    authenticated: true,
    session,
    user,
  }
}

/**
 * Check if the request is authenticated AND has a specific permission.
 */
export async function requirePermission(permission: Permission): Promise<AuthResult> {
  const auth = await requireAuth()

  if (!auth.authenticated) {
    return auth
  }

  if (!hasPermission(auth.user.role, permission)) {
    return {
      authenticated: false,
      response: NextResponse.json(
        { error: 'Forbidden', message: `Missing permission: ${permission}` },
        { status: 403 }
      ),
    }
  }

  return auth
}

/**
 * Check if the request is authenticated AND has one of the specified roles.
 */
export async function requireRole(...roles: Role[]): Promise<AuthResult> {
  const auth = await requireAuth()

  if (!auth.authenticated) {
    return auth
  }

  if (!roles.includes(auth.user.role)) {
    return {
      authenticated: false,
      response: NextResponse.json(
        { error: 'Forbidden', message: `Required role: ${roles.join(' or ')}` },
        { status: 403 }
      ),
    }
  }

  return auth
}

/**
 * Check if user can access a specific partner.
 * Admins can access all, others must have an assignment.
 */
export async function canAccessPartner(userId: string, userRole: Role, partnerId: string): Promise<boolean> {
  // Admins can access everything
  if (userRole === ROLES.ADMIN) {
    return true
  }

  // Check if user has an assignment to this partner
  const { data } = await supabase
    .from('partner_assignments')
    .select('id')
    .eq('staff_id', userId)
    .eq('partner_id', partnerId)
    .single()

  return !!data
}
