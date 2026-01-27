/**
 * Sync Engine Types
 *
 * Type definitions for the data synchronization system.
 */

import type { EntityType } from '@/types/entities'

// =============================================================================
// Sync Options & Configuration
// =============================================================================

/**
 * Options for controlling sync behavior
 */
export interface SyncOptions {
  /** Preview changes without applying to database */
  dryRun?: boolean
  /** Ignore authority rules and overwrite all fields (admin only) */
  forceOverwrite?: boolean
  /** Limit number of rows to process (for testing) */
  rowLimit?: number
  /** User ID triggering the sync (null for scheduled) */
  triggeredBy?: string
}

/**
 * Configuration loaded for a sync operation
 */
export interface SyncConfig {
  dataSource: {
    id: string
    name: string
    type: string
    connection_config: Record<string, unknown>
  }
  tabMapping: {
    id: string
    tab_name: string
    header_row: number
    primary_entity: EntityType
  }
  columnMappings: Array<{
    id: string
    source_column: string
    source_column_index: number
    category: string
    target_field: string | null
    authority: 'source_of_truth' | 'reference' | 'derived'
    is_key: boolean
    transform_type: string | null
    transform_config: Record<string, unknown> | null
  }>
  columnPatterns: Array<{
    id: string
    pattern_name: string
    category: string
    match_config: Record<string, unknown>
    target_table: string | null
    target_field: string | null
    priority: number
    is_active: boolean
  }>
}

// =============================================================================
// Sync Results
// =============================================================================

/**
 * Statistics from a sync operation
 */
export interface SyncStats {
  rowsProcessed: number
  rowsCreated: number
  rowsUpdated: number
  rowsSkipped: number
  errors: SyncError[]
}

/**
 * Error encountered during sync (non-fatal)
 */
export interface SyncError {
  row: number
  column?: string
  message: string
  severity: 'warning' | 'error'
}

/**
 * Result of a sync operation
 */
export interface SyncResult {
  success: boolean
  syncRunId: string
  stats: SyncStats
  changes: EntityChange[]
  durationMs: number
}

// =============================================================================
// Entity Changes
// =============================================================================

/**
 * A change to be applied to an entity
 */
export interface EntityChange {
  /** Target entity type */
  entity: EntityType
  /** Key field name (e.g., 'brand_name', 'email') */
  keyField: string
  /** Key field value */
  keyValue: string
  /** Type of change */
  type: 'create' | 'update' | 'skip'
  /** Fields to update */
  fields: Record<string, unknown>
  /** Existing record (for updates) */
  existing?: Record<string, unknown>
  /** Reason for skip (if type is 'skip') */
  skipReason?: string
}

// =============================================================================
// Lineage Tracking
// =============================================================================

/**
 * Record of where a field value came from
 */
export interface FieldLineageEntry {
  entityType: EntityType
  entityId: string
  fieldName: string
  sourceType: 'google_sheet' | 'api' | 'app' | 'manual'
  sourceId?: string
  sourceRef: string
  previousValue: unknown
  newValue: unknown
  syncRunId?: string
  changedBy?: string
}

// =============================================================================
// Transform Types
// =============================================================================

/**
 * Transform function signature
 */
export type TransformFn = (
  value: string,
  config?: Record<string, unknown>
) => unknown

/**
 * Available transform types
 */
export type TransformType =
  | 'none'
  | 'trim'
  | 'lowercase'
  | 'uppercase'
  | 'date'
  | 'currency'
  | 'boolean'
  | 'number'
  | 'json'

// =============================================================================
// Sync Run Status
// =============================================================================

/**
 * Status of a sync run
 */
export type SyncRunStatus = 'running' | 'completed' | 'failed'

/**
 * Sync run record from database
 */
export interface SyncRun {
  id: string
  data_source_id: string
  tab_mapping_id: string | null
  status: SyncRunStatus
  started_at: string
  completed_at: string | null
  rows_processed: number
  rows_created: number
  rows_updated: number
  rows_skipped: number
  errors: SyncError[] | null
  triggered_by: string | null
  created_at: string
}
