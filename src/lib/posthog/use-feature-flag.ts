'use client'

import { useEffect, useState } from 'react'
import posthog from 'posthog-js'

/**
 * Hook to get a feature flag value from PostHog
 * Returns undefined while loading, then the flag value
 */
export function useFeatureFlag(flagKey: string): boolean | string | undefined {
  const [value, setValue] = useState<boolean | string | undefined>(undefined)

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Get initial value
    setValue(posthog.getFeatureFlag(flagKey))

    // Subscribe to flag updates
    const unsubscribe = posthog.onFeatureFlags(() => {
      setValue(posthog.getFeatureFlag(flagKey))
    })

    return unsubscribe
  }, [flagKey])

  return value
}

/**
 * Hook to check if a feature flag is enabled (boolean flags)
 * Returns false while loading or if flag is disabled
 */
export function useFeatureFlagEnabled(flagKey: string): boolean {
  const value = useFeatureFlag(flagKey)
  return value === true || value === 'true'
}

/**
 * Hook to get a feature flag payload (for multivariate flags)
 */
export function useFeatureFlagPayload<T = unknown>(flagKey: string): T | undefined {
  const [payload, setPayload] = useState<T | undefined>(undefined)

  useEffect(() => {
    if (typeof window === 'undefined') return

    setPayload(posthog.getFeatureFlagPayload(flagKey) as T)

    const unsubscribe = posthog.onFeatureFlags(() => {
      setPayload(posthog.getFeatureFlagPayload(flagKey) as T)
    })

    return unsubscribe
  }, [flagKey])

  return payload
}
