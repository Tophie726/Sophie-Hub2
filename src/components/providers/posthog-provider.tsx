'use client'

import posthog from 'posthog-js'
import { PostHogProvider as PHProvider } from 'posthog-js/react'
import { Suspense, useEffect, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

/**
 * PostHog Analytics Provider
 *
 * Features enabled:
 * - Session replay (see exactly what users did)
 * - Error tracking (global error listeners + $exception events)
 * - Analytics (page views, custom events)
 * - User identification (links sessions to authenticated users)
 * - Feature flags (client-side flag evaluation)
 *
 * MCP Integration: Use `npx @anthropic-ai/claude-code mcp add posthog`
 * to debug errors directly in Claude Code.
 */

// Initialize PostHog only on client side
if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
    person_profiles: 'identified_only',
    // Session replay settings
    capture_pageview: false, // We handle this manually for SPA routing
    capture_pageleave: true,
    // Session replay
    session_recording: {
      recordCrossOriginIframes: true,
    },
    // Error tracking
    autocapture: true,
  })

  // Capture unhandled errors
  window.addEventListener('error', (event) => {
    posthog.capture('$exception', {
      $exception_type: event.error?.name || 'Error',
      $exception_message: event.message,
      $exception_stack_trace_raw: event.error?.stack,
      $exception_source: 'window.onerror',
    })
  })

  // Capture unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    posthog.capture('$exception', {
      $exception_type: 'UnhandledPromiseRejection',
      $exception_message: event.reason?.message || String(event.reason),
      $exception_stack_trace_raw: event.reason?.stack,
      $exception_source: 'unhandledrejection',
    })
  })
}

/**
 * Tracks page views on route changes (for Next.js App Router)
 */
function PostHogPageView() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (pathname && typeof window !== 'undefined') {
      let url = window.origin + pathname
      if (searchParams?.toString()) {
        url = url + '?' + searchParams.toString()
      }
      posthog.capture('$pageview', { $current_url: url })
    }
  }, [pathname, searchParams])

  return null
}

/**
 * Identifies users in PostHog after authentication
 */
function PostHogUserIdentifier() {
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

  return null
}

/**
 * PostHog Provider wrapper for the app
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  // Don't render anything if PostHog is not configured
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    return <>{children}</>
  }

  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      <PostHogUserIdentifier />
      {children}
    </PHProvider>
  )
}

/**
 * Hook to access PostHog client
 *
 * Usage:
 * ```tsx
 * import { usePostHog } from '@/components/providers/posthog-provider'
 *
 * function MyComponent() {
 *   const posthog = usePostHog()
 *
 *   const handleClick = () => {
 *     posthog?.capture('button_clicked', { button: 'submit' })
 *   }
 * }
 * ```
 */
export function usePostHog() {
  if (typeof window === 'undefined') return null
  return posthog
}

/**
 * Get the current PostHog session ID (for linking to feedback)
 */
export function getPostHogSessionId(): string | null {
  if (typeof window === 'undefined') return null
  return posthog.get_session_id() || null
}
