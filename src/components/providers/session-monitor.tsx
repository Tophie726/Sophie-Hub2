'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import { toast } from 'sonner'

/**
 * SessionMonitor - Automatically handles auth errors across the app
 *
 * Features:
 * 1. Checks for session.error (e.g., RefreshAccessTokenError)
 * 2. Intercepts 401 responses from fetch calls
 * 3. Shows toast notification with clear message
 * 4. Redirects to sign-in page with return URL
 *
 * Add this component to your layout - no manual error handling needed in components.
 */
export function SessionMonitor() {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const hasShownError = useRef(false)
  const originalFetch = useRef<typeof fetch | null>(null)

  // Handle redirect to sign-in
  const redirectToSignIn = useCallback(() => {
    if (hasShownError.current) return
    hasShownError.current = true

    const returnUrl = encodeURIComponent(pathname || '/')

    toast.error('Session expired', {
      description: 'Please sign in again to continue.',
      duration: 3000,
    })

    // Short delay so user can read the toast
    setTimeout(() => {
      signOut({ callbackUrl: `/signin?callbackUrl=${returnUrl}` })
    }, 1500)
  }, [pathname])

  // Check for session errors (like RefreshAccessTokenError)
  useEffect(() => {
    if (status === 'loading') return

    // Check if session has an error (token refresh failed)
    if (session?.error === 'RefreshAccessTokenError') {
      redirectToSignIn()
    }
  }, [session, status, redirectToSignIn])

  // Intercept fetch to catch 401 errors globally
  useEffect(() => {
    // Only intercept on client side and only once
    if (typeof window === 'undefined' || originalFetch.current) return

    originalFetch.current = window.fetch

    window.fetch = async (...args) => {
      const response = await originalFetch.current!(...args)

      // Check if it's a 401 from our API
      if (response.status === 401) {
        const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url

        // Only handle 401s from our own API routes
        if (url.startsWith('/api/') || url.includes('/api/')) {
          // Clone response so we can still read it
          const clonedResponse = response.clone()

          try {
            const data = await clonedResponse.json()

            // Check for specific auth error messages
            if (
              data.error?.includes('Session expired') ||
              data.error?.includes('Not authenticated') ||
              data.error?.code === 'UNAUTHORIZED'
            ) {
              redirectToSignIn()
            }
          } catch {
            // If we can't parse JSON, still handle the 401
            redirectToSignIn()
          }
        }
      }

      return response
    }

    // Cleanup on unmount
    return () => {
      if (originalFetch.current) {
        window.fetch = originalFetch.current
      }
    }
  }, [redirectToSignIn])

  // Reset error flag when pathname changes (user navigated away)
  useEffect(() => {
    hasShownError.current = false
  }, [pathname])

  // This component doesn't render anything
  return null
}
