'use client'

import { useEffect, useMemo, useState } from 'react'
import { DialRoot } from 'dialkit'

interface AuthMeUser {
  email?: string | null
  isAdmin?: boolean
}

interface AuthMeResponse {
  user?: AuthMeUser
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function getAllowedEmails(): Set<string> {
  const fromEnv = (process.env.NEXT_PUBLIC_DIALKIT_ALLOWED_EMAILS || '')
    .split(',')
    .map(normalizeEmail)
    .filter(Boolean)

  // Default to Tomas only, with optional expansion via NEXT_PUBLIC_DIALKIT_ALLOWED_EMAILS.
  return new Set(['tomas@sophiesociety.com', ...fromEnv])
}

function canUseDialKit(user: AuthMeUser | undefined, allowedEmails: Set<string>): boolean {
  if (!user?.isAdmin) return false
  if (!user.email) return false
  return allowedEmails.has(normalizeEmail(user.email))
}

export function DialKitGate() {
  const [enabled, setEnabled] = useState(false)
  const allowedEmails = useMemo(() => getAllowedEmails(), [])

  useEffect(() => {
    let cancelled = false

    async function loadAccess() {
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store' })
        if (!res.ok) {
          if (!cancelled) setEnabled(false)
          return
        }

        const data = (await res.json()) as AuthMeResponse
        if (!cancelled) {
          setEnabled(canUseDialKit(data.user, allowedEmails))
        }
      } catch {
        if (!cancelled) setEnabled(false)
      }
    }

    void loadAccess()
    return () => {
      cancelled = true
    }
  }, [allowedEmails])

  if (!enabled) return null
  return <DialRoot position="top-right" />
}
