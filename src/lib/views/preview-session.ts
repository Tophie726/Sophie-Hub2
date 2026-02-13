import 'server-only'

import { createHmac, randomUUID } from 'crypto'
import type { Role } from '@/lib/auth/roles'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Preview tokens expire after 15 minutes */
export const PREVIEW_TOKEN_TTL_MS = 15 * 60 * 1000

// Subject type shortcodes for compact token payload
const SUBJECT_TYPE_MAP = {
  self: 's',
  staff: 'st',
  partner: 'p',
  role: 'r',
  partner_type: 'pt',
} as const

const SUBJECT_TYPE_REVERSE: Record<string, string> = Object.fromEntries(
  Object.entries(SUBJECT_TYPE_MAP).map(([k, v]) => [v, k])
)

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PreviewSessionPayload {
  /** Random session ID */
  sid: string
  /** View profile UUID */
  vid: string
  /** Subject type (full form) */
  subjectType: 'self' | 'staff' | 'partner' | 'role' | 'partner_type'
  /** Target ID (UUID or role slug) — no PII */
  targetId: string | null
  /** Resolved role for nav filtering */
  resolvedRole: Role
  /** Data mode */
  dataMode: 'snapshot' | 'live'
  /** Actor user ID (UUID — not email, per HR-8) */
  actorId: string
  /** Expiry epoch ms */
  expiresAt: number
}

/** Compact wire format — minimized payload (HR-8: no PII) */
interface TokenWirePayload {
  sid: string
  vid: string
  sub: string        // shortcode
  tid: string | null
  rol: string
  dm: 's' | 'l'
  act: string        // actor UUID
  exp: number
}

// ---------------------------------------------------------------------------
// Signing helpers (mirrors viewer-session.ts pattern)
// ---------------------------------------------------------------------------

function getSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) {
    throw new Error('NEXTAUTH_SECRET is required for preview token signing')
  }
  return secret
}

function sign(payload: string): string {
  return createHmac('sha256', getSecret()).update(payload).digest('hex')
}

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface CreatePreviewTokenInput {
  viewId: string
  subjectType: PreviewSessionPayload['subjectType']
  targetId: string | null
  resolvedRole: Role
  dataMode: 'snapshot' | 'live'
  actorId: string
}

/**
 * Create a signed preview token.
 *
 * Token is base64(JSON wire payload) + '.' + HMAC-SHA256 signature.
 * Payload contains only UUIDs, shortcodes, and timestamps (HR-8).
 */
export function createPreviewToken(input: CreatePreviewTokenInput): {
  token: string
  expiresAt: number
  sessionId: string
} {
  const now = Date.now()
  const sessionId = randomUUID()
  const expiresAt = now + PREVIEW_TOKEN_TTL_MS

  const wire: TokenWirePayload = {
    sid: sessionId,
    vid: input.viewId,
    sub: SUBJECT_TYPE_MAP[input.subjectType],
    tid: input.targetId,
    rol: input.resolvedRole,
    dm: input.dataMode === 'live' ? 'l' : 's',
    act: input.actorId,
    exp: expiresAt,
  }

  const payloadStr = JSON.stringify(wire)
  const encoded = Buffer.from(payloadStr).toString('base64url')
  const signature = sign(payloadStr)
  const token = `${encoded}.${signature}`

  return { token, expiresAt, sessionId }
}

/**
 * Verify a preview token signature and expiry.
 *
 * Returns the deserialized session payload, or null if invalid/expired.
 * Must only be called server-side (enforced by 'server-only' import).
 */
export function verifyPreviewToken(token: string): PreviewSessionPayload | null {
  const dotIndex = token.lastIndexOf('.')
  if (dotIndex === -1) return null

  const encoded = token.slice(0, dotIndex)
  const signature = token.slice(dotIndex + 1)

  let payloadStr: string
  try {
    payloadStr = Buffer.from(encoded, 'base64url').toString('utf-8')
  } catch {
    return null
  }

  // Verify HMAC signature (constant-time comparison)
  const expectedSig = sign(payloadStr)
  if (!constantTimeEquals(expectedSig, signature)) return null

  // Parse wire payload
  let wire: TokenWirePayload
  try {
    wire = JSON.parse(payloadStr)
  } catch {
    return null
  }

  // Validate required fields
  if (!wire.sid || !wire.vid || !wire.sub || !wire.rol || !wire.act || !wire.exp) {
    return null
  }

  // Check expiry
  if (wire.exp < Date.now()) return null

  // Reverse map subject type
  const subjectType = SUBJECT_TYPE_REVERSE[wire.sub]
  if (!subjectType) return null

  return {
    sid: wire.sid,
    vid: wire.vid,
    subjectType: subjectType as PreviewSessionPayload['subjectType'],
    targetId: wire.tid,
    resolvedRole: wire.rol as Role,
    dataMode: wire.dm === 'l' ? 'live' : 'snapshot',
    actorId: wire.act,
    expiresAt: wire.exp,
  }
}
