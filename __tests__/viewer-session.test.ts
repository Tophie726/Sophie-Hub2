/**
 * Tests for viewer session cookie adapter
 *
 * Source: src/lib/auth/viewer-session.ts
 */
import { createHmac } from 'crypto'
import { ROLES } from '@/lib/auth/roles'
import type { SubjectIdentity } from '@/lib/auth/viewer-context'

// ---------------------------------------------------------------------------
// Mock next/headers cookies()
// ---------------------------------------------------------------------------

const cookieJar = new Map<string, string>()

jest.mock('next/headers', () => ({
  cookies: () => ({
    get: (name: string) => {
      const value = cookieJar.get(name)
      return value ? { name, value } : undefined
    },
    set: (name: string, value: string, _opts?: Record<string, unknown>) => {
      cookieJar.set(name, value)
    },
    delete: (name: string) => {
      cookieJar.delete(name)
    },
  }),
}))

// Import after mocks are set up
import { setViewCookie, getViewCookie, clearViewCookie } from '@/lib/auth/viewer-session'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  cookieJar.clear()
})

describe('setViewCookie()', () => {
  it('sets a cookie in the cookie store', () => {
    setViewCookie(selfSubject, true)
    expect(cookieJar.has('sophie-view')).toBe(true)
  })

  it('cookie value contains base64 payload and signature separated by dot', () => {
    setViewCookie(selfSubject, false)
    const value = cookieJar.get('sophie-view')!
    const dotIndex = value.lastIndexOf('.')
    expect(dotIndex).toBeGreaterThan(0)

    const encodedPayload = value.slice(0, dotIndex)
    const decoded = Buffer.from(encodedPayload, 'base64').toString('utf-8')
    const parsed = JSON.parse(decoded)
    expect(parsed.subject).toEqual(selfSubject)
    expect(parsed.adminModeOn).toBe(false)
  })
})

describe('getViewCookie()', () => {
  it('returns null when no cookie is set', () => {
    expect(getViewCookie()).toBeNull()
  })

  it('returns parsed payload for a valid cookie', () => {
    setViewCookie(staffSubject, true)
    const result = getViewCookie()
    expect(result).not.toBeNull()
    expect(result!.subject).toEqual(staffSubject)
    expect(result!.adminModeOn).toBe(true)
  })

  it('returns null for tampered payload', () => {
    setViewCookie(staffSubject, false)
    const value = cookieJar.get('sophie-view')!
    const dotIndex = value.lastIndexOf('.')
    const sig = value.slice(dotIndex + 1)

    // Tamper with the payload
    const tampered = Buffer.from(JSON.stringify({
      subject: { ...staffSubject, resolvedRole: ROLES.ADMIN },
      adminModeOn: true,
    })).toString('base64')

    cookieJar.set('sophie-view', `${tampered}.${sig}`)
    expect(getViewCookie()).toBeNull()
  })

  it('returns null for tampered signature', () => {
    setViewCookie(selfSubject, false)
    const value = cookieJar.get('sophie-view')!
    const dotIndex = value.lastIndexOf('.')
    const encodedPayload = value.slice(0, dotIndex)

    cookieJar.set('sophie-view', `${encodedPayload}.deadbeef`)
    expect(getViewCookie()).toBeNull()
  })

  it('returns null for malformed cookie (no dot)', () => {
    cookieJar.set('sophie-view', 'nodothere')
    expect(getViewCookie()).toBeNull()
  })

  it('returns null for invalid base64', () => {
    cookieJar.set('sophie-view', '!!!invalid!!!.abcdef')
    // Invalid base64 still decodes (Buffer.from is lenient), but JSON.parse will fail
    // or signature check will fail
    expect(getViewCookie()).toBeNull()
  })
})

describe('clearViewCookie()', () => {
  it('removes the cookie', () => {
    setViewCookie(selfSubject, false)
    expect(cookieJar.has('sophie-view')).toBe(true)

    clearViewCookie()
    expect(cookieJar.has('sophie-view')).toBe(false)
  })

  it('is safe to call when no cookie exists', () => {
    expect(() => clearViewCookie()).not.toThrow()
  })
})

describe('round-trip integrity', () => {
  it('set then get returns the same data', () => {
    setViewCookie(staffSubject, true)
    const result = getViewCookie()
    expect(result).toEqual({ subject: staffSubject, adminModeOn: true })
  })

  it('set, clear, get returns null', () => {
    setViewCookie(selfSubject, false)
    clearViewCookie()
    expect(getViewCookie()).toBeNull()
  })

  it('overwriting cookie replaces previous value', () => {
    setViewCookie(selfSubject, false)
    setViewCookie(staffSubject, true)
    const result = getViewCookie()
    expect(result!.subject).toEqual(staffSubject)
    expect(result!.adminModeOn).toBe(true)
  })
})
