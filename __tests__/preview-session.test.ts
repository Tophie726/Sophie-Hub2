/**
 * Tests for preview session token utility
 *
 * Source: src/lib/views/preview-session.ts
 *
 * Covers:
 * - Token creation returns valid structure
 * - Round-trip: create then verify returns original payload
 * - Tampered payload is rejected
 * - Tampered signature is rejected
 * - Expired tokens are rejected
 * - Malformed tokens are rejected
 * - All subject types are handled correctly
 */

// 'server-only' is stubbed via jest.config.js moduleNameMapper

import { ROLES } from '@/lib/auth/roles'
import {
  createPreviewToken,
  verifyPreviewToken,
  PREVIEW_TOKEN_TTL_MS,
  type CreatePreviewTokenInput,
} from '@/lib/views/preview-session'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseInput: CreatePreviewTokenInput = {
  viewId: '550e8400-e29b-41d4-a716-446655440000',
  subjectType: 'role',
  targetId: 'pod_leader',
  resolvedRole: ROLES.POD_LEADER,
  dataMode: 'snapshot',
  actorId: '660e8400-e29b-41d4-a716-446655440001',
}

// ---------------------------------------------------------------------------
// Token Creation
// ---------------------------------------------------------------------------

describe('createPreviewToken()', () => {
  it('returns a token string with base64url payload and hex signature', () => {
    const result = createPreviewToken(baseInput)

    expect(result.token).toBeDefined()
    expect(typeof result.token).toBe('string')

    // Token format: base64url.hexSignature
    const dotIndex = result.token.lastIndexOf('.')
    expect(dotIndex).toBeGreaterThan(0)

    const encoded = result.token.slice(0, dotIndex)
    const sig = result.token.slice(dotIndex + 1)

    // base64url portion should decode to valid JSON
    const decoded = Buffer.from(encoded, 'base64url').toString('utf-8')
    expect(() => JSON.parse(decoded)).not.toThrow()

    // Signature should be a hex string (64 chars for SHA-256)
    expect(sig).toMatch(/^[a-f0-9]{64}$/)
  })

  it('returns a unique session ID', () => {
    const a = createPreviewToken(baseInput)
    const b = createPreviewToken(baseInput)
    expect(a.sessionId).not.toBe(b.sessionId)
  })

  it('returns expiresAt approximately 15 minutes from now', () => {
    const before = Date.now()
    const result = createPreviewToken(baseInput)
    const after = Date.now()

    // expiresAt should be within the TTL range
    expect(result.expiresAt).toBeGreaterThanOrEqual(before + PREVIEW_TOKEN_TTL_MS)
    expect(result.expiresAt).toBeLessThanOrEqual(after + PREVIEW_TOKEN_TTL_MS)
  })

  it('uses compact wire format with shortcodes', () => {
    const result = createPreviewToken(baseInput)
    const dotIndex = result.token.lastIndexOf('.')
    const decoded = Buffer.from(result.token.slice(0, dotIndex), 'base64url').toString('utf-8')
    const wire = JSON.parse(decoded)

    // Subject type should be shortcoded
    expect(wire.sub).toBe('r') // 'role' → 'r'
    // Data mode should be shortcoded
    expect(wire.dm).toBe('s') // 'snapshot' → 's'
    // Full field names should NOT be in wire format
    expect(wire.subjectType).toBeUndefined()
    expect(wire.dataMode).toBeUndefined()
    expect(wire.resolvedRole).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Round-Trip Verification
// ---------------------------------------------------------------------------

describe('verifyPreviewToken() — round trip', () => {
  it('returns the original payload for a freshly created token', () => {
    const { token } = createPreviewToken(baseInput)
    const payload = verifyPreviewToken(token)

    expect(payload).not.toBeNull()
    expect(payload!.vid).toBe(baseInput.viewId)
    expect(payload!.subjectType).toBe(baseInput.subjectType)
    expect(payload!.targetId).toBe(baseInput.targetId)
    expect(payload!.resolvedRole).toBe(baseInput.resolvedRole)
    expect(payload!.dataMode).toBe(baseInput.dataMode)
    expect(payload!.actorId).toBe(baseInput.actorId)
  })

  it('handles null targetId correctly', () => {
    const input: CreatePreviewTokenInput = {
      ...baseInput,
      subjectType: 'self',
      targetId: null,
    }
    const { token } = createPreviewToken(input)
    const payload = verifyPreviewToken(token)

    expect(payload).not.toBeNull()
    expect(payload!.targetId).toBeNull()
    expect(payload!.subjectType).toBe('self')
  })

  it('handles live data mode correctly', () => {
    const input: CreatePreviewTokenInput = {
      ...baseInput,
      dataMode: 'live',
    }
    const { token } = createPreviewToken(input)
    const payload = verifyPreviewToken(token)

    expect(payload).not.toBeNull()
    expect(payload!.dataMode).toBe('live')
  })
})

// ---------------------------------------------------------------------------
// Subject Type Coverage
// ---------------------------------------------------------------------------

describe('verifyPreviewToken() — subject types', () => {
  const subjectTypes: CreatePreviewTokenInput['subjectType'][] = [
    'self', 'staff', 'partner', 'role', 'partner_type',
  ]

  it.each(subjectTypes)('round-trips subject type "%s"', (subjectType) => {
    const input: CreatePreviewTokenInput = {
      ...baseInput,
      subjectType,
      targetId: subjectType === 'self' ? null : 'target-id',
    }
    const { token } = createPreviewToken(input)
    const payload = verifyPreviewToken(token)

    expect(payload).not.toBeNull()
    expect(payload!.subjectType).toBe(subjectType)
  })
})

// ---------------------------------------------------------------------------
// Rejection Cases
// ---------------------------------------------------------------------------

describe('verifyPreviewToken() — tampered tokens', () => {
  it('rejects a token with tampered payload', () => {
    const { token } = createPreviewToken(baseInput)
    const dotIndex = token.lastIndexOf('.')
    const sig = token.slice(dotIndex + 1)

    // Tamper: change the view ID in the payload
    const tampered = Buffer.from(JSON.stringify({
      sid: 'fake-sid',
      vid: 'fake-view-id',
      sub: 'r',
      tid: null,
      rol: 'admin',
      dm: 's',
      act: 'fake-actor',
      exp: Date.now() + 999999,
    })).toString('base64url')

    expect(verifyPreviewToken(`${tampered}.${sig}`)).toBeNull()
  })

  it('rejects a token with tampered signature', () => {
    const { token } = createPreviewToken(baseInput)
    const dotIndex = token.lastIndexOf('.')
    const encoded = token.slice(0, dotIndex)

    expect(verifyPreviewToken(`${encoded}.deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef`)).toBeNull()
  })
})

describe('verifyPreviewToken() — expired tokens', () => {
  it('rejects an expired token', () => {
    // Create a valid token, then mock Date.now to be past expiry
    const { token, expiresAt } = createPreviewToken(baseInput)

    // Advance time past expiry
    const originalDateNow = Date.now
    Date.now = () => expiresAt + 1000

    try {
      expect(verifyPreviewToken(token)).toBeNull()
    } finally {
      Date.now = originalDateNow
    }
  })
})

describe('verifyPreviewToken() — malformed input', () => {
  it('rejects empty string', () => {
    expect(verifyPreviewToken('')).toBeNull()
  })

  it('rejects string without dot separator', () => {
    expect(verifyPreviewToken('nodothere')).toBeNull()
  })

  it('rejects invalid base64 payload', () => {
    expect(verifyPreviewToken('!!!.abcdef')).toBeNull()
  })

  it('rejects valid base64 but invalid JSON', () => {
    const notJson = Buffer.from('this is not json').toString('base64url')
    expect(verifyPreviewToken(`${notJson}.abcdef`)).toBeNull()
  })

  it('rejects payload missing required fields', () => {
    // Valid JSON but missing fields
    const incomplete = Buffer.from(JSON.stringify({ sid: 'x' })).toString('base64url')
    expect(verifyPreviewToken(`${incomplete}.abcdef`)).toBeNull()
  })

  it('rejects payload with unknown subject type shortcode', () => {
    // Craft a token-like string with unknown subject type
    const wire = {
      sid: 'test-sid',
      vid: 'test-vid',
      sub: 'zz', // invalid shortcode
      tid: null,
      rol: 'admin',
      dm: 's',
      act: 'test-act',
      exp: Date.now() + 999999,
    }
    const payloadStr = JSON.stringify(wire)
    const encoded = Buffer.from(payloadStr).toString('base64url')

    // We need a valid signature for this payload to test subject type validation
    // (otherwise it fails at signature check first)
    const { createHmac } = require('crypto')
    const sig = createHmac('sha256', process.env.NEXTAUTH_SECRET!).update(payloadStr).digest('hex')

    expect(verifyPreviewToken(`${encoded}.${sig}`)).toBeNull()
  })
})
