/**
 * Sync Engine
 *
 * Core synchronization engine for pulling data from external sources
 * and writing to Sophie Hub entity tables.
 */

import { getAdminClient } from '@/lib/supabase/admin'
import { getConnector, type GoogleSheetConnectorConfig } from '@/lib/connectors'
import { applyTransform } from './transforms'
import type {
  SyncOptions,
  SyncConfig,
  SyncResult,
  SyncStats,
  SyncError,
  EntityChange,
  FieldLineageEntry,
  TransformType,
} from './types'
import type { EntityType } from '@/types/entities'

// =============================================================================
// Sync Engine Class
// =============================================================================

export class SyncEngine {
  private supabase = getAdminClient()

  /**
   * Sync a single tab mapping
   */
  async syncTab(
    tabMappingId: string,
    accessToken: string,
    options: SyncOptions = {}
  ): Promise<SyncResult> {
    const startTime = Date.now()

    // 1. Load configuration
    const config = await this.loadConfig(tabMappingId)

    // 2. Create sync run record
    const syncRunId = await this.createSyncRun(
      config.dataSource.id,
      tabMappingId,
      options.triggeredBy
    )

    try {
      // 3. Fetch source data
      // Cast connection_config through unknown since it's stored as Record<string, unknown> in DB
      const connector = getConnector<GoogleSheetConnectorConfig>('google_sheet')
      const connectorConfig = config.dataSource.connection_config as unknown as GoogleSheetConnectorConfig
      const sourceData = await connector.getData(
        accessToken,
        connectorConfig,
        config.tabMapping.tab_name
      )

      // 4. Process rows and determine changes
      const { changes, errors } = await this.processRows(
        sourceData,
        config,
        options
      )

      // 5. Apply changes (unless dry run)
      if (!options.dryRun) {
        await this.applyChanges(changes, syncRunId, config)
      }

      // 6. Calculate stats and complete sync run
      const stats = this.calculateStats(changes, errors)
      await this.completeSyncRun(syncRunId, stats)

      return {
        success: true,
        syncRunId,
        stats,
        changes: options.dryRun ? changes : [],
        durationMs: Date.now() - startTime,
      }
    } catch (error) {
      await this.failSyncRun(
        syncRunId,
        error instanceof Error ? error.message : 'Unknown error'
      )
      throw error
    }
  }

  /**
   * Sync all active tabs for a data source
   */
  async syncDataSource(
    dataSourceId: string,
    accessToken: string,
    options: SyncOptions = {}
  ): Promise<SyncResult[]> {
    const { data: tabMappings } = await this.supabase
      .from('tab_mappings')
      .select('id')
      .eq('data_source_id', dataSourceId)
      .eq('status', 'active')

    const results: SyncResult[] = []

    for (const tab of tabMappings || []) {
      try {
        const result = await this.syncTab(tab.id, accessToken, options)
        results.push(result)
      } catch (error) {
        // Log error but continue with other tabs
        console.error(`Sync failed for tab ${tab.id}:`, error)
        results.push({
          success: false,
          syncRunId: '',
          stats: {
            rowsProcessed: 0,
            rowsCreated: 0,
            rowsUpdated: 0,
            rowsSkipped: 0,
            errors: [{
              row: 0,
              message: error instanceof Error ? error.message : 'Unknown error',
              severity: 'error',
            }],
          },
          changes: [],
          durationMs: 0,
        })
      }
    }

    return results
  }

  // ===========================================================================
  // Private: Configuration Loading
  // ===========================================================================

  private async loadConfig(tabMappingId: string): Promise<SyncConfig> {
    // Load tab mapping with data source
    const { data: tabMapping, error: tabError } = await this.supabase
      .from('tab_mappings')
      .select(`
        id,
        tab_name,
        header_row,
        primary_entity,
        data_sources (
          id,
          name,
          type,
          connection_config
        )
      `)
      .eq('id', tabMappingId)
      .single()

    if (tabError || !tabMapping) {
      throw new Error(`Tab mapping not found: ${tabMappingId}`)
    }

    // Load column mappings
    const { data: columnMappings, error: colError } = await this.supabase
      .from('column_mappings')
      .select('*')
      .eq('tab_mapping_id', tabMappingId)

    if (colError) {
      throw new Error(`Failed to load column mappings: ${colError.message}`)
    }

    const dataSource = tabMapping.data_sources as unknown as SyncConfig['dataSource']

    return {
      dataSource,
      tabMapping: {
        id: tabMapping.id,
        tab_name: tabMapping.tab_name,
        header_row: tabMapping.header_row,
        primary_entity: tabMapping.primary_entity as EntityType,
      },
      columnMappings: columnMappings || [],
    }
  }

  // ===========================================================================
  // Private: Row Processing
  // ===========================================================================

  private async processRows(
    sourceData: { headers: string[]; rows: string[][] },
    config: SyncConfig,
    options: SyncOptions
  ): Promise<{ changes: EntityChange[]; errors: SyncError[] }> {
    const changes: EntityChange[] = []
    const errors: SyncError[] = []

    // Find key column
    const keyMapping = config.columnMappings.find((m) => m.is_key)
    if (!keyMapping || !keyMapping.target_field) {
      throw new Error('No key column defined for this mapping')
    }

    const keyColumnIndex = sourceData.headers.findIndex(
      (h) => h === keyMapping.source_column
    )
    if (keyColumnIndex === -1) {
      throw new Error(`Key column '${keyMapping.source_column}' not found in source`)
    }

    // Process each row
    const rowsToProcess = options.rowLimit
      ? sourceData.rows.slice(0, options.rowLimit)
      : sourceData.rows

    for (let i = 0; i < rowsToProcess.length; i++) {
      const row = rowsToProcess[i]
      const rowNumber = i + 2 // 1-indexed + header row

      try {
        const keyValue = row[keyColumnIndex]?.trim()
        if (!keyValue) {
          changes.push({
            entity: config.tabMapping.primary_entity,
            keyField: keyMapping.target_field,
            keyValue: '',
            type: 'skip',
            fields: {},
            skipReason: 'Empty key value',
          })
          continue
        }

        // Build entity update from mapped columns
        const fields = this.buildEntityFields(
          row,
          sourceData.headers,
          config.columnMappings,
          errors,
          rowNumber
        )

        // Check for existing record
        const existing = await this.findExisting(
          config.tabMapping.primary_entity,
          keyMapping.target_field,
          keyValue
        )

        // Apply authority rules
        const authorizedFields = options.forceOverwrite
          ? fields
          : this.filterByAuthority(fields, config.columnMappings, !!existing)

        // Determine change type
        if (Object.keys(authorizedFields).length === 0) {
          changes.push({
            entity: config.tabMapping.primary_entity,
            keyField: keyMapping.target_field,
            keyValue,
            type: 'skip',
            fields: {},
            existing: existing ?? undefined,
            skipReason: 'No authorized fields to update',
          })
        } else {
          changes.push({
            entity: config.tabMapping.primary_entity,
            keyField: keyMapping.target_field,
            keyValue,
            type: existing ? 'update' : 'create',
            fields: authorizedFields,
            existing: existing ?? undefined,
          })
        }
      } catch (error) {
        errors.push({
          row: rowNumber,
          message: error instanceof Error ? error.message : 'Unknown error',
          severity: 'error',
        })
      }
    }

    return { changes, errors }
  }

  private buildEntityFields(
    row: string[],
    headers: string[],
    mappings: SyncConfig['columnMappings'],
    errors: SyncError[],
    rowNumber: number
  ): Record<string, unknown> {
    const fields: Record<string, unknown> = {}

    for (const mapping of mappings) {
      // Skip non-entity mappings
      if (!mapping.target_field) continue
      if (mapping.is_key) continue // Key is handled separately
      if (mapping.category === 'weekly' || mapping.category === 'computed') continue
      if (mapping.category === 'skip') continue

      const colIndex = headers.findIndex((h) => h === mapping.source_column)
      if (colIndex === -1) continue

      const rawValue = row[colIndex] || ''

      try {
        const transformedValue = applyTransform(
          rawValue,
          mapping.transform_type as TransformType | null,
          mapping.transform_config || undefined
        )

        // Only include non-null values
        if (transformedValue !== null && transformedValue !== undefined) {
          fields[mapping.target_field] = transformedValue
        }
      } catch (error) {
        errors.push({
          row: rowNumber,
          column: mapping.source_column,
          message: `Transform failed: ${error instanceof Error ? error.message : 'Unknown'}`,
          severity: 'warning',
        })
      }
    }

    return fields
  }

  private filterByAuthority(
    fields: Record<string, unknown>,
    mappings: SyncConfig['columnMappings'],
    isUpdate: boolean
  ): Record<string, unknown> {
    // For creates, all fields are allowed
    if (!isUpdate) return fields

    // For updates, only source_of_truth fields can overwrite
    const authorized: Record<string, unknown> = {}

    for (const [fieldName, value] of Object.entries(fields)) {
      const mapping = mappings.find((m) => m.target_field === fieldName)
      if (mapping?.authority === 'source_of_truth') {
        authorized[fieldName] = value
      }
    }

    return authorized
  }

  private async findExisting(
    entity: EntityType,
    keyField: string,
    keyValue: string
  ): Promise<Record<string, unknown> | null> {
    const { data } = await this.supabase
      .from(entity)
      .select('*')
      .eq(keyField, keyValue)
      .single()

    return data
  }

  // ===========================================================================
  // Private: Apply Changes
  // ===========================================================================

  private async applyChanges(
    changes: EntityChange[],
    syncRunId: string,
    config: SyncConfig
  ): Promise<void> {
    const creates: EntityChange[] = []
    const updates: EntityChange[] = []

    for (const change of changes) {
      if (change.type === 'create') {
        creates.push(change)
      } else if (change.type === 'update') {
        updates.push(change)
      }
    }

    // Batch creates
    if (creates.length > 0) {
      const createRecords = creates.map((c) => ({
        [c.keyField]: c.keyValue,
        ...c.fields,
      }))

      // Insert in batches of 50
      for (let i = 0; i < createRecords.length; i += 50) {
        const batch = createRecords.slice(i, i + 50)
        const { error } = await this.supabase
          .from(config.tabMapping.primary_entity)
          .insert(batch)

        if (error) {
          console.error('Batch insert error:', error)
          // Continue with remaining batches
        }
      }

      // Record lineage for creates
      await this.recordLineage(creates, syncRunId, config, 'create')
    }

    // Individual updates (to track lineage per field)
    for (const update of updates) {
      const { error } = await this.supabase
        .from(config.tabMapping.primary_entity)
        .update(update.fields)
        .eq(update.keyField, update.keyValue)

      if (error) {
        console.error('Update error:', error)
      }
    }

    // Record lineage for updates
    if (updates.length > 0) {
      await this.recordLineage(updates, syncRunId, config, 'update')
    }
  }

  private async recordLineage(
    changes: EntityChange[],
    syncRunId: string,
    config: SyncConfig,
    changeType: 'create' | 'update'
  ): Promise<void> {
    const lineageEntries: FieldLineageEntry[] = []

    for (const change of changes) {
      // Find entity ID (for new records, we'd need to fetch it)
      const entityId = change.existing?.id as string || 'pending'

      for (const [fieldName, newValue] of Object.entries(change.fields)) {
        const mapping = config.columnMappings.find(
          (m) => m.target_field === fieldName
        )

        lineageEntries.push({
          entityType: change.entity,
          entityId,
          fieldName,
          sourceType: 'google_sheet',
          sourceId: config.dataSource.id,
          sourceRef: `${config.dataSource.name} → ${config.tabMapping.tab_name} → ${mapping?.source_column || fieldName}`,
          previousValue: changeType === 'update' ? change.existing?.[fieldName] : null,
          newValue,
          syncRunId,
        })
      }
    }

    // Insert lineage records (if table exists)
    // This will fail gracefully if the migration hasn't been applied
    if (lineageEntries.length > 0) {
      try {
        await this.supabase.from('field_lineage').insert(
          lineageEntries.map((e) => ({
            entity_type: e.entityType,
            entity_id: e.entityId,
            field_name: e.fieldName,
            source_type: e.sourceType,
            source_id: e.sourceId,
            source_ref: e.sourceRef,
            previous_value: e.previousValue,
            new_value: e.newValue,
            sync_run_id: e.syncRunId,
          }))
        )
      } catch {
        // Lineage table may not exist yet - that's OK
      }
    }
  }

  // ===========================================================================
  // Private: Sync Run Management
  // ===========================================================================

  private async createSyncRun(
    dataSourceId: string,
    tabMappingId: string,
    triggeredBy?: string
  ): Promise<string> {
    const { data, error } = await this.supabase
      .from('sync_runs')
      .insert({
        data_source_id: dataSourceId,
        tab_mapping_id: tabMappingId,
        status: 'running',
        triggered_by: triggeredBy || null,
      })
      .select('id')
      .single()

    if (error) throw new Error(`Failed to create sync run: ${error.message}`)
    return data.id
  }

  private async completeSyncRun(
    syncRunId: string,
    stats: SyncStats
  ): Promise<void> {
    await this.supabase
      .from('sync_runs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        rows_processed: stats.rowsProcessed,
        rows_created: stats.rowsCreated,
        rows_updated: stats.rowsUpdated,
        rows_skipped: stats.rowsSkipped,
        errors: stats.errors.length > 0 ? stats.errors : null,
      })
      .eq('id', syncRunId)
  }

  private async failSyncRun(syncRunId: string, error: string): Promise<void> {
    await this.supabase
      .from('sync_runs')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        errors: [{ row: 0, message: error, severity: 'error' }],
      })
      .eq('id', syncRunId)
  }

  private calculateStats(
    changes: EntityChange[],
    errors: SyncError[]
  ): SyncStats {
    return {
      rowsProcessed: changes.length,
      rowsCreated: changes.filter((c) => c.type === 'create').length,
      rowsUpdated: changes.filter((c) => c.type === 'update').length,
      rowsSkipped: changes.filter((c) => c.type === 'skip').length,
      errors,
    }
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

let engineInstance: SyncEngine | null = null

export function getSyncEngine(): SyncEngine {
  if (!engineInstance) {
    engineInstance = new SyncEngine()
  }
  return engineInstance
}
