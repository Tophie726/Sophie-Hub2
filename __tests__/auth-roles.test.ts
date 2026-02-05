/**
 * Tests for RBAC system: hasPermission(), isRoleAtLeast(), getPermissionsForRole()
 *
 * Source: src/lib/auth/roles.ts
 */
import {
  ROLES,
  PERMISSIONS,
  hasPermission,
  isRoleAtLeast,
  getPermissionsForRole,
  type Role,
  type Permission,
} from '@/lib/auth/roles'

describe('ROLES constant', () => {
  it('has all four roles defined', () => {
    expect(ROLES.ADMIN).toBe('admin')
    expect(ROLES.POD_LEADER).toBe('pod_leader')
    expect(ROLES.STAFF).toBe('staff')
    expect(ROLES.PARTNER).toBe('partner')
  })
})

describe('hasPermission()', () => {
  // Admin should have all permissions
  it('grants admin all permissions', () => {
    const allPermissions = Object.keys(PERMISSIONS) as Permission[]
    for (const perm of allPermissions) {
      if ((PERMISSIONS[perm] as readonly Role[]).includes(ROLES.ADMIN)) {
        expect(hasPermission(ROLES.ADMIN, perm)).toBe(true)
      }
    }
  })

  it('grants admin partners:read:all', () => {
    expect(hasPermission(ROLES.ADMIN, 'partners:read:all')).toBe(true)
  })

  it('grants admin data-enrichment:write', () => {
    expect(hasPermission(ROLES.ADMIN, 'data-enrichment:write')).toBe(true)
  })

  // Pod leader permissions
  it('grants pod_leader partners:read:assigned', () => {
    expect(hasPermission(ROLES.POD_LEADER, 'partners:read:assigned')).toBe(true)
  })

  it('grants pod_leader partners:write:assigned', () => {
    expect(hasPermission(ROLES.POD_LEADER, 'partners:write:assigned')).toBe(true)
  })

  it('denies pod_leader partners:read:all', () => {
    expect(hasPermission(ROLES.POD_LEADER, 'partners:read:all')).toBe(false)
  })

  it('denies pod_leader data-enrichment:write', () => {
    expect(hasPermission(ROLES.POD_LEADER, 'data-enrichment:write')).toBe(false)
  })

  // Staff permissions
  it('grants staff partners:read:assigned', () => {
    expect(hasPermission(ROLES.STAFF, 'partners:read:assigned')).toBe(true)
  })

  it('denies staff partners:write:assigned', () => {
    expect(hasPermission(ROLES.STAFF, 'partners:write:assigned')).toBe(false)
  })

  it('denies staff admin:settings', () => {
    expect(hasPermission(ROLES.STAFF, 'admin:settings')).toBe(false)
  })

  // Partner (external) permissions
  it('grants partner partners:read:own', () => {
    expect(hasPermission(ROLES.PARTNER, 'partners:read:own')).toBe(true)
  })

  it('denies partner partners:read:all', () => {
    expect(hasPermission(ROLES.PARTNER, 'partners:read:all')).toBe(false)
  })

  it('denies partner partners:read:assigned', () => {
    expect(hasPermission(ROLES.PARTNER, 'partners:read:assigned')).toBe(false)
  })

  // Edge cases
  it('returns false for undefined role', () => {
    expect(hasPermission(undefined, 'partners:read:all')).toBe(false)
  })
})

describe('isRoleAtLeast()', () => {
  it('admin is at least admin', () => {
    expect(isRoleAtLeast(ROLES.ADMIN, ROLES.ADMIN)).toBe(true)
  })

  it('admin is at least staff', () => {
    expect(isRoleAtLeast(ROLES.ADMIN, ROLES.STAFF)).toBe(true)
  })

  it('admin is at least partner', () => {
    expect(isRoleAtLeast(ROLES.ADMIN, ROLES.PARTNER)).toBe(true)
  })

  it('pod_leader is at least pod_leader', () => {
    expect(isRoleAtLeast(ROLES.POD_LEADER, ROLES.POD_LEADER)).toBe(true)
  })

  it('pod_leader is at least staff', () => {
    expect(isRoleAtLeast(ROLES.POD_LEADER, ROLES.STAFF)).toBe(true)
  })

  it('pod_leader is NOT at least admin', () => {
    expect(isRoleAtLeast(ROLES.POD_LEADER, ROLES.ADMIN)).toBe(false)
  })

  it('staff is NOT at least pod_leader', () => {
    expect(isRoleAtLeast(ROLES.STAFF, ROLES.POD_LEADER)).toBe(false)
  })

  it('partner is NOT at least staff', () => {
    expect(isRoleAtLeast(ROLES.PARTNER, ROLES.STAFF)).toBe(false)
  })

  it('returns false for undefined role', () => {
    expect(isRoleAtLeast(undefined, ROLES.STAFF)).toBe(false)
  })
})

describe('getPermissionsForRole()', () => {
  it('returns all admin-only permissions for admin', () => {
    const perms = getPermissionsForRole(ROLES.ADMIN)
    expect(perms).toContain('partners:read:all')
    expect(perms).toContain('partners:write:all')
    expect(perms).toContain('data-enrichment:read')
    expect(perms).toContain('data-enrichment:write')
    expect(perms).toContain('admin:settings')
    expect(perms).toContain('admin:users')
  })

  it('returns correct permissions for staff', () => {
    const perms = getPermissionsForRole(ROLES.STAFF)
    expect(perms).toContain('partners:read:assigned')
    expect(perms).toContain('staff:read:own')
    expect(perms).toContain('staff:write:own')
    expect(perms).not.toContain('partners:read:all')
    expect(perms).not.toContain('data-enrichment:write')
  })

  it('returns minimal permissions for partner', () => {
    const perms = getPermissionsForRole(ROLES.PARTNER)
    expect(perms).toContain('partners:read:own')
    expect(perms).not.toContain('partners:read:all')
    expect(perms).not.toContain('admin:settings')
  })
})
