/**
 * Entity Field Registry
 *
 * Single source of truth for entity field definitions across
 * partners, staff, and asins. Encodes field types, reference
 * relationships, and UI grouping.
 *
 * Usage:
 * ```typescript
 * import { getFieldsForEntity, getGroupedFieldDefs, getSchemaDescription } from '@/lib/entity-fields'
 * ```
 */

// Types
export type {
  FieldType,
  ReferenceStorage,
  FieldGroup,
  ReferenceConfig,
  FieldDefinition,
  EntityFieldRegistry,
  FieldDefOption,
  GroupedFieldDefs,
} from './types'

// Data + Helpers
export {
  getFieldsForEntity,
  getFieldDefs,
  getGroupedFieldDefs,
  getFieldNames,
  getEntitySchema,
  getReferenceFields,
  getKeyField,
  getFieldDefinition,
  getReferencedEntities,
  getSchemaDescription,
} from './registry'
