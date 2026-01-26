'use client'

import { memo } from 'react'
import { BaseEdge, getBezierPath } from '@xyflow/react'
import type { EdgeProps } from '@xyflow/react'
import type { MappingEdgeData } from './types'

/**
 * Solid edge representing a source-to-entity data mapping.
 * Thicker stroke for more mapped fields.
 */
function MappingEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  style,
}: EdgeProps) {
  const edgeData = data as unknown as MappingEdgeData | undefined
  const mappedCount = edgeData?.mappedFieldCount ?? 0

  // Scale stroke width with mapped field count (min 1.5, max 4)
  const strokeWidth = Math.min(4, Math.max(1.5, 1.5 + mappedCount * 0.3))

  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      style={{
        ...style,
        strokeWidth,
        opacity: 0.7,
      }}
    />
  )
}

export const MappingEdge = memo(MappingEdgeComponent)
