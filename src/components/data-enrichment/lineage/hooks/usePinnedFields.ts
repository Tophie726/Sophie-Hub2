'use client'

import { useState, useCallback, useEffect } from 'react'

const STORAGE_KEY = 'sophie-flow-map-pins'

interface PinnedItem {
  id: string
  label: string
  type: 'entity' | 'source' | 'group' | 'field'
}

interface UsePinnedFieldsReturn {
  pinnedItems: PinnedItem[]
  isPinned: (id: string) => boolean
  togglePin: (item: PinnedItem) => void
  clearPins: () => void
}

/**
 * Hook to manage pinned items in the flow map.
 * Persists to localStorage.
 */
export function usePinnedFields(): UsePinnedFieldsReturn {
  const [pinnedItems, setPinnedItems] = useState<PinnedItem[]>([])

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        setPinnedItems(JSON.parse(stored))
      }
    } catch {
      // Ignore parse errors
    }
  }, [])

  // Save to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pinnedItems))
    } catch {
      // Ignore storage errors
    }
  }, [pinnedItems])

  const isPinned = useCallback(
    (id: string) => pinnedItems.some((item) => item.id === id),
    [pinnedItems]
  )

  const togglePin = useCallback((item: PinnedItem) => {
    setPinnedItems((prev) => {
      const exists = prev.some((p) => p.id === item.id)
      if (exists) {
        return prev.filter((p) => p.id !== item.id)
      }
      return [...prev, item]
    })
  }, [])

  const clearPins = useCallback(() => {
    setPinnedItems([])
  }, [])

  return { pinnedItems, isPinned, togglePin, clearPins }
}
