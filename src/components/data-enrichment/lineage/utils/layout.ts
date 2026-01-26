/**
 * Layout computation for the Data Flow Map
 *
 * Positions nodes in a left-to-right flow:
 * Sources (left) -> Entities (center) -> Reference arrows (right)
 */

import type { EntityType } from '@/types/entities'
import type { FieldGroup } from '@/lib/entity-fields/types'

export interface NodePosition {
  x: number
  y: number
}

/** Layout constants */
const LAYOUT = {
  /** X position for source column */
  sourceX: 0,
  /** X position for entity column */
  entityX: 400,
  /** Vertical gap between source nodes */
  sourceGap: 120,
  /** Vertical gap between entity nodes */
  entityGap: 180,
  /** Vertical gap between group nodes */
  groupGap: 80,
  /** Horizontal offset for group nodes from entity */
  groupOffsetX: 60,
  /** Starting Y offset for group nodes below entity */
  groupStartY: 100,
  /** Top margin */
  topMargin: 50,
}

/** Compute positions for source nodes */
export function layoutSourceNodes(
  sourceIds: string[]
): Map<string, NodePosition> {
  const positions = new Map<string, NodePosition>()
  sourceIds.forEach((id, i) => {
    positions.set(id, {
      x: LAYOUT.sourceX,
      y: LAYOUT.topMargin + i * LAYOUT.sourceGap,
    })
  })
  return positions
}

/** Compute positions for entity nodes */
export function layoutEntityNodes(
  entities: EntityType[]
): Map<EntityType, NodePosition> {
  const positions = new Map<EntityType, NodePosition>()
  entities.forEach((entity, i) => {
    positions.set(entity, {
      x: LAYOUT.entityX,
      y: LAYOUT.topMargin + i * LAYOUT.entityGap,
    })
  })
  return positions
}

/** Compute positions for field group nodes when an entity is expanded */
export function layoutGroupNodes(
  entityPosition: NodePosition,
  groups: FieldGroup[]
): Map<FieldGroup, NodePosition> {
  const positions = new Map<FieldGroup, NodePosition>()
  groups.forEach((group, i) => {
    positions.set(group, {
      x: entityPosition.x + LAYOUT.groupOffsetX,
      y: entityPosition.y + LAYOUT.groupStartY + i * LAYOUT.groupGap,
    })
  })
  return positions
}

/** Get the entity node height based on expansion state */
export function getEntityNodeHeight(isExpanded: boolean, groupCount: number): number {
  if (!isExpanded) return 100
  return 100 + groupCount * LAYOUT.groupGap + 20
}

/** Compute vertical offset for entities below an expanded one */
export function computeExpandedOffset(groupCount: number): number {
  return groupCount * LAYOUT.groupGap + 40
}
