'use client'

import { useEffect, useRef } from 'react'
import posthog from 'posthog-js'

/**
 * Hook to identify users in PostHog after authentication
 * Call this once in a top-level provider component
 */
export function usePostHogIdentify() {
  const identified = useRef(false)

  useEffect(() => {
    if (identified.current || typeof window === 'undefined') return

    fetch('/api/auth/me')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.user && !identified.current) {
          posthog.identify(data.user.id, {
            email: data.user.email,
            name: data.user.name,
            role: data.user.role,
            is_admin: data.user.isAdmin,
          })
          identified.current = true
        }
      })
      .catch(() => {
        // Silently fail - user may not be logged in
      })
  }, [])
}

/**
 * Reset PostHog identity on logout
 * Call this before signing out the user
 */
export function resetPostHogIdentity() {
  if (typeof window === 'undefined') return
  posthog.reset()
}
