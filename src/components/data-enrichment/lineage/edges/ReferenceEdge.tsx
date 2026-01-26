'use client'

import { memo } from 'react'
import { BaseEdge, getBezierPath } from '@xyflow/react'
import type { EdgeProps } from '@xyflow/react'

/**
 * Dashed edge representing an entity-to-entity reference relationship.
 * E.g., Partners -> Staff (via partner_assignments junction table)
 */
function ReferenceEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
}: EdgeProps) {
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
        strokeDasharray: '6 3',
        opacity: 0.5,
      }}
    />
  )
}

export const ReferenceEdge = memo(ReferenceEdgeComponent)
