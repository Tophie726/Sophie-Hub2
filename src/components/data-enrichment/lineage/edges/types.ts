/**
 * Edge data types for the Data Flow Map
 */

/** Data for a source-to-entity mapping edge (solid line) */
export interface MappingEdgeData {
  sourceId: string
  sourceName: string
  entityType: string
  mappedFieldCount: number
}

/** Data for an entity-to-entity reference edge (dashed line) */
export interface ReferenceEdgeData {
  fromEntity: string
  toEntity: string
  fieldName: string
  fieldLabel: string
  referenceType: 'direct' | 'junction'
}
