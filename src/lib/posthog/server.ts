/**
 * Server-side PostHog utilities
 * Use these in API routes, server components, and middleware
 */

interface DecideResponse {
  featureFlags?: Record<string, boolean | string>
  featureFlagPayloads?: Record<string, unknown>
}

/**
 * Check if a feature flag is enabled server-side
 * Uses the PostHog /decide endpoint
 */
export async function isFeatureFlagEnabled(
  flagKey: string,
  userId?: string
): Promise<boolean> {
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com'

  if (!apiKey) return false

  try {
    const res = await fetch(`${host}/decide?v=3`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        distinct_id: userId || 'anonymous',
      }),
      // Don't cache feature flag decisions
      cache: 'no-store',
    })

    if (!res.ok) return false

    const data: DecideResponse = await res.json()
    return data.featureFlags?.[flagKey] === true
  } catch {
    return false
  }
}

/**
 * Get a feature flag value server-side (for multivariate flags)
 */
export async function getFeatureFlagValue(
  flagKey: string,
  userId?: string
): Promise<boolean | string | undefined> {
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com'

  if (!apiKey) return undefined

  try {
    const res = await fetch(`${host}/decide?v=3`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        distinct_id: userId || 'anonymous',
      }),
      cache: 'no-store',
    })

    if (!res.ok) return undefined

    const data: DecideResponse = await res.json()
    return data.featureFlags?.[flagKey]
  } catch {
    return undefined
  }
}

/**
 * Server-side event capture
 * Use for tracking events from API routes
 */
export async function captureServerEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>
): Promise<void> {
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com'

  if (!apiKey) return

  try {
    await fetch(`${host}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        distinct_id: distinctId,
        event,
        properties: {
          ...properties,
          $lib: 'server',
        },
      }),
    })
  } catch {
    // Silently fail - analytics shouldn't break the app
  }
}
