/**
 * Sync Module
 *
 * Data synchronization from external sources to Sophie Hub entities.
 *
 * Usage:
 * ```typescript
 * import { getSyncEngine } from '@/lib/sync'
 *
 * const engine = getSyncEngine()
 * const result = await engine.syncTab(tabMappingId, accessToken, {
 *   dryRun: true,  // Preview changes first
 * })
 * ```
 */

// Types
export type {
  SyncOptions,
  SyncConfig,
  SyncResult,
  SyncStats,
  SyncError,
  EntityChange,
  FieldLineageEntry,
  TransformType,
  SyncRunStatus,
  SyncRun,
} from './types'

// Engine
export { SyncEngine, getSyncEngine } from './engine'

// Transforms
export { applyTransform, getTransform, isValidTransform } from './transforms'
