'use client'

import { useState, useMemo, useCallback } from 'react'
import type { Node, Edge } from '@xyflow/react'
import type { EntityType } from '@/types/entities'
import type { FlowMapResponse } from '../utils/transform'
import { transformToFlowElements } from '../utils/transform'

interface UseFlowLayoutReturn {
  nodes: Node[]
  edges: Edge[]
  expandedEntities: Set<EntityType>
  toggleEntityExpand: (entity: EntityType) => void
}

/**
 * Hook to compute React Flow nodes and edges from API data.
 * Manages expansion state for entity nodes.
 */
export function useFlowLayout(data: FlowMapResponse | null): UseFlowLayoutReturn {
  const [expandedEntities, setExpandedEntities] = useState<Set<EntityType>>(new Set())

  const toggleEntityExpand = useCallback((entity: EntityType) => {
    setExpandedEntities((prev) => {
      const next = new Set(prev)
      if (next.has(entity)) {
        next.delete(entity)
      } else {
        next.add(entity)
      }
      return next
    })
  }, [])

  const { nodes, edges } = useMemo(() => {
    if (!data) return { nodes: [], edges: [] }

    return transformToFlowElements(data, {
      expandedEntities,
      onToggleExpand: toggleEntityExpand,
    })
  }, [data, expandedEntities, toggleEntityExpand])

  return { nodes, edges, expandedEntities, toggleEntityExpand }
}
