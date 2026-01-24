/**
 * Role-based access control (RBAC) system
 *
 * Roles:
 * - admin: Full access to everything
 * - pod_leader: Manages assigned partners and their team
 * - staff: Views assigned partners, manages own profile
 * - partner: External users viewing their own data (future)
 */

export const ROLES = {
  ADMIN: 'admin',
  POD_LEADER: 'pod_leader',
  STAFF: 'staff',
  PARTNER: 'partner',
} as const

export type Role = (typeof ROLES)[keyof typeof ROLES]

/**
 * Permission definitions
 * Format: 'resource:action:scope'
 *
 * Scopes:
 * - all: Can access all records
 * - assigned: Can access assigned records only
 * - own: Can access own records only
 */
export const PERMISSIONS = {
  // Partners
  'partners:read:all': [ROLES.ADMIN],
  'partners:read:assigned': [ROLES.ADMIN, ROLES.POD_LEADER, ROLES.STAFF],
  'partners:read:own': [ROLES.PARTNER],
  'partners:write:all': [ROLES.ADMIN],
  'partners:write:assigned': [ROLES.ADMIN, ROLES.POD_LEADER],

  // Staff
  'staff:read:all': [ROLES.ADMIN],
  'staff:read:team': [ROLES.ADMIN, ROLES.POD_LEADER],
  'staff:read:own': [ROLES.ADMIN, ROLES.POD_LEADER, ROLES.STAFF],
  'staff:write:all': [ROLES.ADMIN],
  'staff:write:own': [ROLES.ADMIN, ROLES.POD_LEADER, ROLES.STAFF],

  // Data enrichment (admin only)
  'data-enrichment:read': [ROLES.ADMIN],
  'data-enrichment:write': [ROLES.ADMIN],

  // Admin settings
  'admin:settings': [ROLES.ADMIN],
  'admin:users': [ROLES.ADMIN],
} as const

export type Permission = keyof typeof PERMISSIONS

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: Role | undefined, permission: Permission): boolean {
  if (!role) return false
  const allowedRoles = PERMISSIONS[permission] as readonly Role[]
  return allowedRoles?.includes(role) ?? false
}

/**
 * Check if a role is at least the specified level
 * Hierarchy: admin > pod_leader > staff > partner
 */
export function isRoleAtLeast(userRole: Role | undefined, minimumRole: Role): boolean {
  if (!userRole) return false

  const hierarchy: Role[] = [ROLES.PARTNER, ROLES.STAFF, ROLES.POD_LEADER, ROLES.ADMIN]
  const userLevel = hierarchy.indexOf(userRole)
  const requiredLevel = hierarchy.indexOf(minimumRole)

  return userLevel >= requiredLevel
}

/**
 * Get all permissions for a role
 */
export function getPermissionsForRole(role: Role): Permission[] {
  return (Object.entries(PERMISSIONS) as [Permission, readonly Role[]][])
    .filter(([, roles]) => roles.includes(role))
    .map(([permission]) => permission)
}
