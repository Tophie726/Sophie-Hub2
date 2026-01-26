'use client'

import { useState, useEffect, useCallback } from 'react'
import type { FlowMapResponse } from '../utils/transform'

interface UseFlowDataReturn {
  data: FlowMapResponse | null
  isLoading: boolean
  error: string | null
  refresh: () => void
}

/**
 * Hook to fetch and manage flow map data.
 * Shared between desktop (FlowCanvas) and mobile (MobileFlowList).
 */
export function useFlowData(): UseFlowDataReturn {
  const [data, setData] = useState<FlowMapResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/flow-map')
      if (!response.ok) {
        throw new Error(`Failed to fetch flow map data: ${response.statusText}`)
      }
      const json = await response.json()
      // Support standardized API response format
      const payload = json.data || json
      setData(payload)
    } catch (err) {
      console.error('Error fetching flow map data:', err)
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, isLoading, error, refresh: fetchData }
}
