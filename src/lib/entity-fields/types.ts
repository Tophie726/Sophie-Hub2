/**
 * Entity Field Registry - Type Definitions
 *
 * Single source of truth for field types, reference relationships,
 * and grouping across partners, staff, and asins entities.
 */

import type { EntityType } from '@/types/entities'

// =============================================================================
// Field Types
// =============================================================================

export type FieldType = 'text' | 'number' | 'date' | 'boolean' | 'reference' | 'array'

export type ReferenceStorage = 'direct' | 'junction'

export type FieldGroup =
  | 'Core Info'
  | 'Contact'
  | 'Financial'
  | 'Dates'
  | 'Staff Assignments'
  | 'Metrics'
  | 'Status & Role'
  | 'Links'
  | 'Product Info'

// =============================================================================
// Reference Configuration
// =============================================================================

export interface ReferenceConfig {
  /** The entity type this field references */
  entity: EntityType
  /** The field on the referenced entity used for matching (e.g. 'full_name') */
  matchField: string
  /** How the reference is stored: 'direct' (FK column) or 'junction' (junction table) */
  storage: ReferenceStorage
  /** Junction table name (when storage === 'junction') */
  junctionTable?: string
  /** Role in the junction table (when storage === 'junction') */
  junctionRole?: string
  /** FK column name (when storage === 'direct') */
  fkColumn?: string
}

// =============================================================================
// Field Definition
// =============================================================================

export interface FieldDefinition {
  /** Database column name */
  name: string
  /** UI display label */
  label: string
  /** Tooltip/help text description */
  description: string
  /** Data type */
  type: FieldType
  /** UI grouping category */
  group: FieldGroup
  /** Whether this field is the key/identifier for the entity */
  isKey?: boolean
  /** Reference configuration (only when type === 'reference') */
  reference?: ReferenceConfig
  /** Hint for the sync engine on how to transform incoming data */
  suggestedTransform?: string
}

// =============================================================================
// Registry Type
// =============================================================================

export type EntityFieldRegistry = Record<EntityType, FieldDefinition[]>

// =============================================================================
// Helper Return Types
// =============================================================================

/** Backward-compatible dropdown format used by SmartMapper */
export interface FieldDefOption {
  value: string
  label: string
  description?: string
}

/** Grouped field definitions for Select with groups */
export interface GroupedFieldDefs {
  group: FieldGroup
  fields: FieldDefOption[]
}
