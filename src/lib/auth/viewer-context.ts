import { Role } from './roles'
import { getPermissionsForRole } from './roles'
import type { AuthUser } from './api-auth'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ViewerContext {
  actor: ActorIdentity
  subject: SubjectIdentity
  isImpersonating: boolean
  adminModeOn: boolean
}

export interface ActorIdentity {
  userId: string
  email: string
  role: Role
  permissions: string[]
}

export interface SubjectIdentity {
  type: 'self' | 'staff' | 'partner' | 'role' | 'partner_type'
  targetId: string | null
  targetLabel: string
  resolvedRole: Role
}

export interface ViewResolverInput {
  staffId: string | null
  roleSlug: string | null
  partnerId: string | null
  partnerTypeSlug: string | null
}

// Re-export AuthUser so downstream code can import from one place
export type { AuthUser }

// ---------------------------------------------------------------------------
// Runtime helpers
// ---------------------------------------------------------------------------

/**
 * Build a ViewerContext from an actor, subject, and admin-mode flag.
 * Pure function — no side effects.
 */
export function buildViewerContext(
  actor: ActorIdentity,
  subject: SubjectIdentity,
  adminModeOn: boolean,
): ViewerContext {
  return {
    actor,
    subject,
    isImpersonating: subject.type !== 'self',
    adminModeOn,
  }
}

/**
 * Build a "self" SubjectIdentity — used when no impersonation is active.
 */
export function buildSelfSubject(actor: ActorIdentity): SubjectIdentity {
  return {
    type: 'self',
    targetId: null,
    targetLabel: actor.email,
    resolvedRole: actor.role,
  }
}

/**
 * Map the existing AuthUser (from api-auth.ts) into an ActorIdentity.
 */
export function buildActorFromAuth(authUser: AuthUser): ActorIdentity {
  return {
    userId: authUser.id,
    email: authUser.email,
    role: authUser.role,
    permissions: getPermissionsForRole(authUser.role),
  }
}

/**
 * Build a ViewResolverInput from a SubjectIdentity and the actor.
 *
 * Pure mapping — DB lookups (e.g. staff role for a staff subject, or
 * partner type for a partner subject) are the caller's responsibility.
 * The SubjectIdentity.resolvedRole carries any pre-looked-up role slug.
 */
export function buildViewResolverInput(
  subject: SubjectIdentity,
  actor: ActorIdentity,
): ViewResolverInput {
  switch (subject.type) {
    case 'self':
      return {
        staffId: actor.userId,
        roleSlug: actor.role,
        partnerId: null,
        partnerTypeSlug: null,
      }
    case 'staff':
      return {
        staffId: subject.targetId,
        roleSlug: subject.resolvedRole,
        partnerId: null,
        partnerTypeSlug: null,
      }
    case 'partner':
      return {
        staffId: null,
        roleSlug: null,
        partnerId: subject.targetId,
        partnerTypeSlug: null,
      }
    case 'role':
      return {
        staffId: null,
        roleSlug: subject.targetId,
        partnerId: null,
        partnerTypeSlug: null,
      }
    case 'partner_type':
      return {
        staffId: null,
        roleSlug: null,
        partnerId: null,
        partnerTypeSlug: subject.targetId,
      }
  }
}
