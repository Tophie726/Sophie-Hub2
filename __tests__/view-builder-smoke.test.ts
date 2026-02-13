/**
 * VB22: View Builder Smoke Tests
 *
 * 6-test smoke matrix from 02-claude-agent-plan.md § Wave 3.
 *
 * | # | Flow              | What we verify                                          |
 * |---|-------------------|---------------------------------------------------------|
 * | 1 | Happy path        | Token for Staff/Role/PPC Strategist round-trips         |
 * | 2 | Happy path        | Module assignment token signals correct view             |
 * | 3 | Failure path      | Non-admin (operations_admin) is rejected by isTrueAdmin |
 * | 4 | Security edge     | Tampered token is rejected by verifyPreviewToken        |
 * | 5 | Security edge     | Partner subject token carries partner role, not admin    |
 * | 6 | Mapping integrity | Switching subject types produces deterministic payloads  |
 */

import { ROLES } from '@/lib/auth/roles'
import {
  createPreviewToken,
  verifyPreviewToken,
  type CreatePreviewTokenInput,
} from '@/lib/views/preview-session'
import { isTrueAdmin } from '@/lib/auth/admin-access'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ACTOR_ID = '660e8400-e29b-41d4-a716-446655440001'
const VIEW_ID = '550e8400-e29b-41d4-a716-446655440000'

function makeInput(overrides: Partial<CreatePreviewTokenInput> = {}): CreatePreviewTokenInput {
  return {
    viewId: VIEW_ID,
    subjectType: 'role',
    targetId: 'pod_leader',
    resolvedRole: ROLES.POD_LEADER,
    dataMode: 'snapshot',
    actorId: ACTOR_ID,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Smoke #1: Happy path — PPC Strategist role preview
// ---------------------------------------------------------------------------

describe('Smoke #1: PPC Strategist role preview', () => {
  it('creates a valid token for role/pod_leader and round-trips correctly', () => {
    const input = makeInput({ subjectType: 'role', targetId: 'pod_leader', resolvedRole: ROLES.POD_LEADER })
    const { token, sessionId, expiresAt } = createPreviewToken(input)

    expect(token).toBeTruthy()
    expect(sessionId).toBeTruthy()
    expect(expiresAt).toBeGreaterThan(Date.now())

    const payload = verifyPreviewToken(token)
    expect(payload).not.toBeNull()
    expect(payload!.subjectType).toBe('role')
    expect(payload!.targetId).toBe('pod_leader')
    expect(payload!.resolvedRole).toBe(ROLES.POD_LEADER)
    expect(payload!.vid).toBe(VIEW_ID)
  })
})

// ---------------------------------------------------------------------------
// Smoke #2: Happy path — module assignment token carries correct view
// ---------------------------------------------------------------------------

describe('Smoke #2: Module assignment token', () => {
  it('token payload binds to the correct view ID for module operations', () => {
    const viewA = '11111111-1111-1111-1111-111111111111'
    const viewB = '22222222-2222-2222-2222-222222222222'

    const tokenA = createPreviewToken(makeInput({ viewId: viewA }))
    const tokenB = createPreviewToken(makeInput({ viewId: viewB }))

    const payloadA = verifyPreviewToken(tokenA.token)
    const payloadB = verifyPreviewToken(tokenB.token)

    expect(payloadA!.vid).toBe(viewA)
    expect(payloadB!.vid).toBe(viewB)
    expect(payloadA!.vid).not.toBe(payloadB!.vid)
  })
})

// ---------------------------------------------------------------------------
// Smoke #3: Failure path — non-admin rejected
// ---------------------------------------------------------------------------

describe('Smoke #3: Non-admin rejection', () => {
  it('operations_admin is NOT a true admin', () => {
    expect(isTrueAdmin('operations_admin', 'ops@example.com')).toBe(false)
  })

  it('regular staff is NOT a true admin', () => {
    expect(isTrueAdmin('staff', 'staff@example.com')).toBe(false)
    expect(isTrueAdmin('pod_leader', 'pl@example.com')).toBe(false)
  })

  it('admin role IS a true admin', () => {
    expect(isTrueAdmin('admin', 'admin@example.com')).toBe(true)
  })

  it('ADMIN_EMAILS listed user IS a true admin regardless of role', () => {
    // Static admin emails defined in admin-access.ts
    expect(isTrueAdmin('staff', 'aviana@codesignery.com')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Smoke #4: Security edge — tampered token
// ---------------------------------------------------------------------------

describe('Smoke #4: Tampered token rejection', () => {
  it('rejects payload with modified view ID', () => {
    const { token } = createPreviewToken(makeInput())
    const dotIndex = token.lastIndexOf('.')
    const sig = token.slice(dotIndex + 1)

    // Forge a new payload with different view ID
    const forged = Buffer.from(JSON.stringify({
      sid: 'forged-session',
      vid: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      sub: 'r',
      tid: 'pod_leader',
      rol: ROLES.POD_LEADER,
      dm: 's',
      act: ACTOR_ID,
      exp: Date.now() + 999_999,
    })).toString('base64url')

    // Re-use original signature — should fail
    expect(verifyPreviewToken(`${forged}.${sig}`)).toBeNull()
  })

  it('rejects token with flipped signature bytes', () => {
    const { token } = createPreviewToken(makeInput())
    const dotIndex = token.lastIndexOf('.')
    const encoded = token.slice(0, dotIndex)

    expect(verifyPreviewToken(`${encoded}.${'a'.repeat(64)}`)).toBeNull()
  })

  it('rejects expired token', () => {
    const { token, expiresAt } = createPreviewToken(makeInput())
    const originalDateNow = Date.now
    Date.now = () => expiresAt + 1000

    try {
      expect(verifyPreviewToken(token)).toBeNull()
    } finally {
      Date.now = originalDateNow
    }
  })
})

// ---------------------------------------------------------------------------
// Smoke #5: Security edge — partner subject carries partner role
// ---------------------------------------------------------------------------

describe('Smoke #5: Partner subject role enforcement', () => {
  it('partner subject token resolves to PARTNER role, not ADMIN', () => {
    const input = makeInput({
      subjectType: 'partner',
      targetId: 'brand-uuid-123',
      resolvedRole: ROLES.PARTNER,
    })

    const { token } = createPreviewToken(input)
    const payload = verifyPreviewToken(token)

    expect(payload).not.toBeNull()
    expect(payload!.subjectType).toBe('partner')
    expect(payload!.resolvedRole).toBe(ROLES.PARTNER)
    expect(payload!.resolvedRole).not.toBe(ROLES.ADMIN)
  })

  it('partner_type subject also resolves to PARTNER role', () => {
    const input = makeInput({
      subjectType: 'partner_type',
      targetId: 'ppc_basic',
      resolvedRole: ROLES.PARTNER,
    })

    const { token } = createPreviewToken(input)
    const payload = verifyPreviewToken(token)

    expect(payload).not.toBeNull()
    expect(payload!.subjectType).toBe('partner_type')
    expect(payload!.resolvedRole).toBe(ROLES.PARTNER)
  })
})

// ---------------------------------------------------------------------------
// Smoke #6: Mapping integrity — deterministic subject type switching
// ---------------------------------------------------------------------------

describe('Smoke #6: Deterministic subject type switching', () => {
  it('switching partner_type → partner → partner_type produces identical types', () => {
    // First: partner_type with ppc_basic
    const ptInput = makeInput({
      subjectType: 'partner_type',
      targetId: 'ppc_basic',
      resolvedRole: ROLES.PARTNER,
    })
    const pt1 = verifyPreviewToken(createPreviewToken(ptInput).token)

    // Switch to specific partner
    const partnerInput = makeInput({
      subjectType: 'partner',
      targetId: 'brand-uuid-123',
      resolvedRole: ROLES.PARTNER,
    })
    const p = verifyPreviewToken(createPreviewToken(partnerInput).token)

    // Switch back to partner_type
    const pt2 = verifyPreviewToken(createPreviewToken(ptInput).token)

    // partner_type payloads should be identical (except session ID + expiry)
    expect(pt1!.subjectType).toBe(pt2!.subjectType)
    expect(pt1!.targetId).toBe(pt2!.targetId)
    expect(pt1!.resolvedRole).toBe(pt2!.resolvedRole)
    expect(pt1!.dataMode).toBe(pt2!.dataMode)

    // The partner payload should differ
    expect(p!.subjectType).toBe('partner')
    expect(p!.targetId).toBe('brand-uuid-123')
  })

  it('all five subject types produce distinct subjectType values in payload', () => {
    const configs: Array<[CreatePreviewTokenInput['subjectType'], string | null, string]> = [
      ['self', null, ROLES.ADMIN],
      ['staff', 'staff-uuid', ROLES.STAFF],
      ['partner', 'partner-uuid', ROLES.PARTNER],
      ['role', 'pod_leader', ROLES.POD_LEADER],
      ['partner_type', 'ppc_basic', ROLES.PARTNER],
    ]

    const subjectTypes = configs.map(([subjectType, targetId, resolvedRole]) => {
      const input = makeInput({ subjectType, targetId, resolvedRole: resolvedRole as typeof ROLES[keyof typeof ROLES] })
      const { token } = createPreviewToken(input)
      const payload = verifyPreviewToken(token)
      return payload!.subjectType
    })

    // All should be unique
    expect(new Set(subjectTypes).size).toBe(5)
    // All should match their input
    expect(subjectTypes).toEqual(['self', 'staff', 'partner', 'role', 'partner_type'])
  })

  it('snapshot and live data modes produce distinct tokens', () => {
    const snap = verifyPreviewToken(createPreviewToken(makeInput({ dataMode: 'snapshot' })).token)
    const live = verifyPreviewToken(createPreviewToken(makeInput({ dataMode: 'live' })).token)

    expect(snap!.dataMode).toBe('snapshot')
    expect(live!.dataMode).toBe('live')
  })
})
