/**
 * Transform API response into React Flow nodes and edges
 */

import type { Node, Edge } from '@xyflow/react'
import type { EntityType } from '@/types/entities'
import type { FieldGroup } from '@/lib/entity-fields/types'
import type { EntityNodeData, SourceNodeData, FieldGroupNodeData } from '../nodes/types'
import type { MappingEdgeData, ReferenceEdgeData } from '../edges/types'
import { entityColors, sourceColor } from './colors'

// React Flow expects data as Record<string, unknown>
// We cast our typed data to satisfy this constraint,
// then cast back in the node components.
type FlowData = Record<string, unknown>

/** The shape of the flow-map API response */
export interface FlowMapResponse {
  entities: Array<{
    type: EntityType
    fieldCount: number
    mappedFieldCount: number
    groups: Array<{
      name: FieldGroup
      fields: Array<{
        name: string
        label: string
        type: string
        isMapped: boolean
        isKey: boolean
        reference?: {
          entity: string
          matchField: string
          storage: string
          junctionTable?: string
          junctionRole?: string
        }
        sources: Array<{
          sourceId: string
          sourceName: string
          tabName: string
          sourceColumn: string
          authority: string
        }>
      }>
    }>
  }>
  sources: Array<{
    id: string
    name: string
    type: string
    tabs: Array<{
      id: string
      tabName: string
      primaryEntity: EntityType | null
      columnCount: number
      mappedCount: number
    }>
  }>
  relationships: Array<{
    from: { entity: string; field: string }
    to: { entity: string; field: string }
    type: 'reference' | 'junction'
    junctionTable?: string
    junctionRole?: string
  }>
  stats: {
    totalFields: number
    mappedFields: number
    totalSources: number
    totalTabs: number
  }
}

interface TransformOptions {
  expandedEntities: Set<EntityType>
  onToggleExpand: (entity: EntityType) => void
}

/** Layout constants */
const LAYOUT = {
  sourceX: 0,
  entityX: 420,
  sourceGap: 130,
  entityGap: 200,
  groupGap: 70,
  groupOffsetX: 20,
  groupStartY: 120,
  topMargin: 50,
}

const ENTITY_LABELS: Record<EntityType, string> = {
  partners: 'Partners',
  staff: 'Staff',
  asins: 'ASINs',
}

/**
 * Transform API data into React Flow nodes and edges
 */
export function transformToFlowElements(
  data: FlowMapResponse,
  options: TransformOptions
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = []
  const edges: Edge[] = []
  const { expandedEntities, onToggleExpand } = options

  // Track which entities each source connects to
  const sourceEntityMap = new Map<string, Set<EntityType>>()
  for (const entity of data.entities) {
    for (const group of entity.groups) {
      for (const field of group.fields) {
        for (const source of field.sources) {
          if (!sourceEntityMap.has(source.sourceId)) {
            sourceEntityMap.set(source.sourceId, new Set())
          }
          sourceEntityMap.get(source.sourceId)!.add(entity.type)
        }
      }
    }
  }

  // Calculate entity Y positions accounting for expanded entities
  const entityPositions = new Map<EntityType, { x: number; y: number }>()
  let currentY = LAYOUT.topMargin
  const entityOrder: EntityType[] = ['partners', 'staff', 'asins']

  for (const entityType of entityOrder) {
    const entityData = data.entities.find((e) => e.type === entityType)
    if (!entityData) continue

    entityPositions.set(entityType, { x: LAYOUT.entityX, y: currentY })

    if (expandedEntities.has(entityType)) {
      currentY += LAYOUT.groupStartY + entityData.groups.length * LAYOUT.groupGap + 40
    } else {
      currentY += LAYOUT.entityGap
    }
  }

  // Sort sources by primary entity to minimize edge crossings.
  // Sources connecting primarily to partners appear at top, staff in middle, asins at bottom.
  const sortedSources = [...data.sources].sort((a, b) => {
    const getPrimaryEntityIndex = (sourceId: string): number => {
      const entities = sourceEntityMap.get(sourceId)
      if (!entities || entities.size === 0) return entityOrder.length
      // Find entity with most connections from this source
      let bestIdx = entityOrder.length
      let maxCount = 0
      for (const entityType of Array.from(entities)) {
        let count = 0
        const entityData = data.entities.find((e) => e.type === entityType)
        if (entityData) {
          for (const group of entityData.groups) {
            for (const field of group.fields) {
              if (field.sources.some((s) => s.sourceId === sourceId)) count++
            }
          }
        }
        if (count > maxCount) {
          maxCount = count
          bestIdx = entityOrder.indexOf(entityType)
        }
      }
      return bestIdx
    }
    return getPrimaryEntityIndex(a.id) - getPrimaryEntityIndex(b.id)
  })

  // Create source nodes (sorted to align with their primary entity)
  sortedSources.forEach((source, i) => {
    const nodeData: SourceNodeData = {
      sourceId: source.id,
      name: source.name,
      type: source.type,
      tabCount: source.tabs.length,
      tabs: source.tabs.map((t) => ({
        id: t.id,
        tabName: t.tabName,
        primaryEntity: t.primaryEntity,
        columnCount: t.columnCount,
        mappedCount: t.mappedCount,
      })),
    }

    nodes.push({
      id: `source-${source.id}`,
      type: 'sourceNode',
      position: { x: LAYOUT.sourceX, y: LAYOUT.topMargin + i * LAYOUT.sourceGap },
      data: nodeData as unknown as FlowData,
      style: {
        borderColor: sourceColor.border,
      },
    })
  })

  // Create entity nodes
  for (const entity of data.entities) {
    const pos = entityPositions.get(entity.type)
    if (!pos) continue

    const isExpanded = expandedEntities.has(entity.type)

    const nodeData: EntityNodeData = {
      entityType: entity.type,
      label: ENTITY_LABELS[entity.type],
      fieldCount: entity.fieldCount,
      mappedFieldCount: entity.mappedFieldCount,
      groups: entity.groups.map((g) => ({
        name: g.name,
        fieldCount: g.fields.length,
        mappedFieldCount: g.fields.filter((f) => f.isMapped).length,
      })),
      isExpanded,
      onToggleExpand,
    }

    nodes.push({
      id: `entity-${entity.type}`,
      type: 'entityNode',
      position: pos,
      data: nodeData as unknown as FlowData,
      style: {
        borderColor: entityColors[entity.type].border,
      },
    })

    // If expanded, add group nodes
    if (isExpanded) {
      entity.groups.forEach((group, gi) => {
        const groupData: FieldGroupNodeData = {
          entityType: entity.type,
          groupName: group.name,
          fieldCount: group.fields.length,
          mappedFieldCount: group.fields.filter((f) => f.isMapped).length,
          parentEntityId: `entity-${entity.type}`,
        }

        nodes.push({
          id: `group-${entity.type}-${group.name}`,
          type: 'fieldGroupNode',
          position: {
            x: pos.x + LAYOUT.groupOffsetX,
            y: pos.y + LAYOUT.groupStartY + gi * LAYOUT.groupGap,
          },
          data: groupData as unknown as FlowData,
          parentId: `entity-${entity.type}`,
          extent: 'parent' as const,
          style: {
            borderColor: entityColors[entity.type].border,
          },
        })
      })
    }
  }

  // Create source-to-entity edges (mapping edges)
  for (const source of data.sources) {
    const connectedEntities = sourceEntityMap.get(source.id)
    if (!connectedEntities) continue

    for (const entityType of Array.from(connectedEntities)) {
      // Count mapped fields from this source to this entity
      let mappedCount = 0
      const entityData = data.entities.find((e) => e.type === entityType)
      if (entityData) {
        for (const group of entityData.groups) {
          for (const field of group.fields) {
            if (field.sources.some((s) => s.sourceId === source.id)) {
              mappedCount++
            }
          }
        }
      }

      const edgeData: MappingEdgeData = {
        sourceId: source.id,
        sourceName: source.name,
        entityType,
        mappedFieldCount: mappedCount,
      }

      edges.push({
        id: `mapping-${source.id}-${entityType}`,
        type: 'mappingEdge',
        source: `source-${source.id}`,
        target: `entity-${entityType}`,
        sourceHandle: 'mapping-source',
        targetHandle: 'mapping-target',
        data: edgeData as unknown as FlowData,
        style: {
          stroke: entityColors[entityType as EntityType].primary,
          strokeWidth: 2,
        },
        animated: false,
      })
    }
  }

  // Create entity-to-entity edges (reference edges)
  // Deduplicate: one edge per entity pair
  const seenRefEdges = new Set<string>()
  for (const rel of data.relationships) {
    const edgeKey = `${rel.from.entity}-${rel.to.entity}`
    if (seenRefEdges.has(edgeKey)) continue
    seenRefEdges.add(edgeKey)

    const edgeData: ReferenceEdgeData = {
      fromEntity: rel.from.entity,
      toEntity: rel.to.entity,
      fieldName: rel.from.field,
      fieldLabel: rel.from.field,
      referenceType: rel.type === 'junction' ? 'junction' : 'direct',
    }

    edges.push({
      id: `ref-${edgeKey}`,
      type: 'referenceEdge',
      source: `entity-${rel.from.entity}`,
      target: `entity-${rel.to.entity}`,
      sourceHandle: 'ref-source',
      targetHandle: 'ref-target',
      data: edgeData as unknown as FlowData,
      style: {
        stroke: '#9ca3af', // gray-400
        strokeWidth: 1.5,
        strokeDasharray: '6 3',
      },
    })
  }

  return { nodes, edges }
}
