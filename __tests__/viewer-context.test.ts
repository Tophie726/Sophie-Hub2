/**
 * Tests for ViewerContext resolver utilities
 *
 * Source: src/lib/auth/viewer-context.ts
 */
import { ROLES, getPermissionsForRole } from '@/lib/auth/roles'
import {
  buildViewerContext,
  buildSelfSubject,
  buildActorFromAuth,
  buildViewResolverInput,
  type ActorIdentity,
  type SubjectIdentity,
} from '@/lib/auth/viewer-context'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const adminActor: ActorIdentity = {
  userId: 'staff-001',
  email: 'tomas@sophiesociety.com',
  role: ROLES.ADMIN,
  permissions: getPermissionsForRole(ROLES.ADMIN),
}

const staffActor: ActorIdentity = {
  userId: 'staff-042',
  email: 'jane@sophiesociety.com',
  role: ROLES.STAFF,
  permissions: getPermissionsForRole(ROLES.STAFF),
}

const selfSubject: SubjectIdentity = {
  type: 'self',
  targetId: null,
  targetLabel: 'tomas@sophiesociety.com',
  resolvedRole: ROLES.ADMIN,
}

const staffSubject: SubjectIdentity = {
  type: 'staff',
  targetId: 'staff-042',
  targetLabel: 'Jane Doe',
  resolvedRole: ROLES.STAFF,
}

const roleSubject: SubjectIdentity = {
  type: 'role',
  targetId: null,
  targetLabel: 'Pod Leader',
  resolvedRole: ROLES.POD_LEADER,
}

// ---------------------------------------------------------------------------
// buildViewerContext
// ---------------------------------------------------------------------------

describe('buildViewerContext()', () => {
  it('sets isImpersonating=false when subject is self', () => {
    const ctx = buildViewerContext(adminActor, selfSubject, true)
    expect(ctx.isImpersonating).toBe(false)
    expect(ctx.actor).toBe(adminActor)
    expect(ctx.subject).toBe(selfSubject)
    expect(ctx.adminModeOn).toBe(true)
  })

  it('sets isImpersonating=true when subject is a staff member', () => {
    const ctx = buildViewerContext(adminActor, staffSubject, false)
    expect(ctx.isImpersonating).toBe(true)
    expect(ctx.subject.type).toBe('staff')
    expect(ctx.adminModeOn).toBe(false)
  })

  it('sets isImpersonating=true when subject is a role', () => {
    const ctx = buildViewerContext(adminActor, roleSubject, false)
    expect(ctx.isImpersonating).toBe(true)
    expect(ctx.subject.type).toBe('role')
  })

  it('passes through adminModeOn flag', () => {
    const on = buildViewerContext(adminActor, selfSubject, true)
    const off = buildViewerContext(adminActor, selfSubject, false)
    expect(on.adminModeOn).toBe(true)
    expect(off.adminModeOn).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// buildSelfSubject
// ---------------------------------------------------------------------------

describe('buildSelfSubject()', () => {
  it('returns type=self with actor email as label', () => {
    const subject = buildSelfSubject(adminActor)
    expect(subject.type).toBe('self')
    expect(subject.targetId).toBeNull()
    expect(subject.targetLabel).toBe(adminActor.email)
    expect(subject.resolvedRole).toBe(adminActor.role)
  })

  it('inherits role from actor', () => {
    const subject = buildSelfSubject(staffActor)
    expect(subject.resolvedRole).toBe(ROLES.STAFF)
  })
})

// ---------------------------------------------------------------------------
// buildActorFromAuth
// ---------------------------------------------------------------------------

describe('buildActorFromAuth()', () => {
  it('maps AuthUser fields to ActorIdentity', () => {
    const actor = buildActorFromAuth({
      id: 'staff-001',
      email: 'tomas@sophiesociety.com',
      name: 'Tomas',
      role: ROLES.ADMIN,
      staffRole: 'admin',
    })
    expect(actor.userId).toBe('staff-001')
    expect(actor.email).toBe('tomas@sophiesociety.com')
    expect(actor.role).toBe(ROLES.ADMIN)
    expect(actor.permissions).toEqual(getPermissionsForRole(ROLES.ADMIN))
  })

  it('resolves permissions for staff role', () => {
    const actor = buildActorFromAuth({
      id: 'staff-042',
      email: 'jane@sophiesociety.com',
      name: 'Jane',
      role: ROLES.STAFF,
      staffRole: 'ppc_manager',
    })
    expect(actor.permissions).toEqual(getPermissionsForRole(ROLES.STAFF))
    expect(actor.permissions).not.toContain('partners:read:all')
  })

  it('resolves permissions for pod_leader role', () => {
    const actor = buildActorFromAuth({
      id: 'staff-010',
      email: 'lead@sophiesociety.com',
      name: 'Lead',
      role: ROLES.POD_LEADER,
      staffRole: 'pod_leader',
    })
    expect(actor.permissions).toEqual(getPermissionsForRole(ROLES.POD_LEADER))
    expect(actor.permissions).toContain('partners:write:assigned')
  })
})

// ---------------------------------------------------------------------------
// buildViewResolverInput
// ---------------------------------------------------------------------------

describe('buildViewResolverInput()', () => {
  it('type=self: uses actor userId and role', () => {
    const result = buildViewResolverInput(selfSubject, adminActor)
    expect(result).toEqual({
      staffId: adminActor.userId,
      roleSlug: adminActor.role,
      partnerId: null,
      partnerTypeSlug: null,
    })
  })

  it('type=staff: uses targetId as staffId and resolvedRole as roleSlug', () => {
    const result = buildViewResolverInput(staffSubject, adminActor)
    expect(result).toEqual({
      staffId: 'staff-042',
      roleSlug: ROLES.STAFF,
      partnerId: null,
      partnerTypeSlug: null,
    })
  })

  it('type=partner: uses targetId as partnerId', () => {
    const partnerSubject: SubjectIdentity = {
      type: 'partner',
      targetId: 'partner-100',
      targetLabel: 'Acme Corp',
      resolvedRole: ROLES.PARTNER,
    }
    const result = buildViewResolverInput(partnerSubject, adminActor)
    expect(result).toEqual({
      staffId: null,
      roleSlug: null,
      partnerId: 'partner-100',
      partnerTypeSlug: null,
    })
  })

  it('type=role: uses targetId as roleSlug', () => {
    const roleSubjectWithId: SubjectIdentity = {
      type: 'role',
      targetId: 'pod_leader',
      targetLabel: 'Pod Leader',
      resolvedRole: ROLES.POD_LEADER,
    }
    const result = buildViewResolverInput(roleSubjectWithId, adminActor)
    expect(result).toEqual({
      staffId: null,
      roleSlug: 'pod_leader',
      partnerId: null,
      partnerTypeSlug: null,
    })
  })

  it('type=partner_type: uses targetId as partnerTypeSlug', () => {
    const partnerTypeSubject: SubjectIdentity = {
      type: 'partner_type',
      targetId: 'wholesale',
      targetLabel: 'Wholesale',
      resolvedRole: ROLES.PARTNER,
    }
    const result = buildViewResolverInput(partnerTypeSubject, adminActor)
    expect(result).toEqual({
      staffId: null,
      roleSlug: null,
      partnerId: null,
      partnerTypeSlug: 'wholesale',
    })
  })
})
