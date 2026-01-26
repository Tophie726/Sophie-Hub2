/**
 * Node data types for the Data Flow Map
 */

import type { EntityType } from '@/types/entities'
import type { FieldGroup } from '@/lib/entity-fields/types'

/** Data carried by an entity node (Partners, Staff, ASINs) */
export interface EntityNodeData {
  entityType: EntityType
  label: string
  fieldCount: number
  mappedFieldCount: number
  groups: EntityGroupData[]
  isExpanded: boolean
  onToggleExpand: (entityType: EntityType) => void
}

/** A single field within an entity group */
export interface EntityFieldData {
  name: string
  label: string
  isMapped: boolean
  isKey: boolean
  sources: Array<{
    sourceId: string
    sourceName: string
    tabName: string
    sourceColumn: string
    authority: string
  }>
}

/** Summary of a field group within an entity */
export interface EntityGroupData {
  name: FieldGroup
  fieldCount: number
  mappedFieldCount: number
  fields?: EntityFieldData[]
}

/** Data carried by a source node (Google Sheet, etc.) */
export interface SourceNodeData {
  sourceId: string
  name: string
  type: string
  tabCount: number
  tabs: SourceTabData[]
}

/** Summary of a tab within a source */
export interface SourceTabData {
  id: string
  tabName: string
  primaryEntity: EntityType | null
  columnCount: number
  mappedCount: number
}

/** Data carried by a field group node (expanded within entity) */
export interface FieldGroupNodeData {
  entityType: EntityType
  groupName: FieldGroup
  fieldCount: number
  mappedFieldCount: number
  parentEntityId: string
}
