import { cookies } from 'next/headers'
import { createHmac } from 'crypto'
import type { SubjectIdentity } from './viewer-context'

const COOKIE_NAME = 'sophie-view'

// ---------------------------------------------------------------------------
// Signing helpers
// ---------------------------------------------------------------------------

function getSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) {
    throw new Error('NEXTAUTH_SECRET is required for view cookie signing')
  }
  return secret
}

function sign(payload: string): string {
  return createHmac('sha256', getSecret()).update(payload).digest('hex')
}

function verify(payload: string, signature: string): boolean {
  const expected = sign(payload)
  // Constant-time comparison to prevent timing attacks
  if (expected.length !== signature.length) return false
  let result = 0
  for (let i = 0; i < expected.length; i++) {
    result |= expected.charCodeAt(i) ^ signature.charCodeAt(i)
  }
  return result === 0
}

// ---------------------------------------------------------------------------
// Cookie payload shape
// ---------------------------------------------------------------------------

export interface ViewCookiePayload {
  subject: SubjectIdentity
  adminModeOn: boolean
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Set the sophie-view cookie with a signed SubjectIdentity + adminModeOn.
 * Must be called from a Server Action or Route Handler (writes response cookies).
 */
export function setViewCookie(subject: SubjectIdentity, adminModeOn: boolean): void {
  const payload = JSON.stringify({ subject, adminModeOn })
  const sig = sign(payload)
  const value = `${Buffer.from(payload).toString('base64')}.${sig}`

  const cookieStore = cookies()
  cookieStore.set(COOKIE_NAME, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  })
}

/**
 * Read and verify the sophie-view cookie.
 * Returns null if cookie is missing, malformed, or signature is invalid.
 */
export function getViewCookie(): ViewCookiePayload | null {
  const cookieStore = cookies()
  const raw = cookieStore.get(COOKIE_NAME)?.value
  if (!raw) return null

  const dotIndex = raw.lastIndexOf('.')
  if (dotIndex === -1) return null

  const encodedPayload = raw.slice(0, dotIndex)
  const sig = raw.slice(dotIndex + 1)

  let payload: string
  try {
    payload = Buffer.from(encodedPayload, 'base64').toString('utf-8')
  } catch {
    return null
  }

  if (!verify(payload, sig)) return null

  try {
    const parsed = JSON.parse(payload) as ViewCookiePayload
    // Basic shape validation
    if (!parsed.subject || typeof parsed.subject.type !== 'string') return null
    return parsed
  } catch {
    return null
  }
}

/**
 * Delete the sophie-view cookie.
 */
export function clearViewCookie(): void {
  const cookieStore = cookies()
  cookieStore.delete(COOKIE_NAME)
}
