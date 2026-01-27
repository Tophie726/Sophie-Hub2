/**
 * Sync Engine
 *
 * Core synchronization engine for pulling data from external sources
 * and writing to Sophie Hub entity tables.
 */

import { getAdminClient } from '@/lib/supabase/admin'
import { getConnector, type GoogleSheetConnectorConfig } from '@/lib/connectors'
import { audit } from '@/lib/audit'
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
import { matchesPattern, type ColumnPatternMatchConfig } from '@/types/enrichment'

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

    // Log sync start
    await audit.logSync(
      'sync_start',
      syncRunId,
      `${config.dataSource.name} → ${config.tabMapping.tab_name}`,
      options.triggeredBy,
      undefined,
      { dry_run: options.dryRun }
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

      // 4b. Process weekly columns (pivot into weekly_statuses)
      const weeklyResult = await this.processWeeklyColumns(
        sourceData,
        config,
        options
      )

      // 5. Apply changes (unless dry run)
      if (!options.dryRun) {
        await this.applyChanges(changes, syncRunId, config)

        // Update last_synced_at on tab mapping and data source
        const now = new Date().toISOString()
        await this.supabase
          .from('tab_mappings')
          .update({ last_synced_at: now })
          .eq('id', config.tabMapping.id)
        await this.supabase
          .from('data_sources')
          .update({ last_synced_at: now })
          .eq('id', config.dataSource.id)
      }

      // 6. Calculate stats and complete sync run
      const allErrors = [...errors, ...weeklyResult.errors]
      const stats = this.calculateStats(changes, allErrors)
      // Add weekly pivot stats to totals
      stats.rowsCreated += weeklyResult.created
      stats.rowsUpdated += weeklyResult.updated
      await this.completeSyncRun(syncRunId, stats)

      const durationMs = Date.now() - startTime

      // Log sync completion
      await audit.logSync(
        'sync_complete',
        syncRunId,
        `${config.dataSource.name} → ${config.tabMapping.tab_name}`,
        options.triggeredBy,
        undefined,
        {
          rows_affected: stats.rowsProcessed,
          rows_created: stats.rowsCreated,
          rows_updated: stats.rowsUpdated,
          rows_skipped: stats.rowsSkipped,
          dry_run: options.dryRun,
          duration_ms: durationMs,
        }
      )

      return {
        success: true,
        syncRunId,
        stats,
        changes: options.dryRun ? changes : [],
        durationMs,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      await this.failSyncRun(syncRunId, errorMessage)

      // Log sync failure
      await audit.logSync(
        'sync_fail',
        syncRunId,
        `${config.dataSource.name} → ${config.tabMapping.tab_name}`,
        options.triggeredBy,
        undefined,
        {
          error_message: errorMessage,
          dry_run: options.dryRun,
          duration_ms: Date.now() - startTime,
        }
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

    // Load column patterns (for weekly/computed pattern matching)
    const { data: columnPatterns } = await this.supabase
      .from('column_patterns')
      .select('*')
      .eq('tab_mapping_id', tabMappingId)
      .eq('is_active', true)
      .order('priority', { ascending: false })

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
      columnPatterns: columnPatterns || [],
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

        // Capture ALL raw column values for zero-data-loss storage
        const rawCapture = this.buildSourceData(
          row,
          sourceData.headers,
          config.tabMapping.tab_name
        )

        if (!keyValue) {
          changes.push({
            entity: config.tabMapping.primary_entity,
            keyField: keyMapping.target_field,
            keyValue: '',
            type: 'skip',
            fields: {},
            skipReason: 'Empty key value',
            sourceData: rawCapture,
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
            sourceData: rawCapture,
          })
        } else {
          changes.push({
            entity: config.tabMapping.primary_entity,
            keyField: keyMapping.target_field,
            keyValue,
            type: existing ? 'update' : 'create',
            fields: authorizedFields,
            existing: existing ?? undefined,
            sourceData: rawCapture,
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

  /**
   * Build source_data JSONB payload from ALL columns in a row.
   * Captures every column value with original headers, no transforms.
   * This is the "no data loss" insurance — everything from the source
   * is preserved even if it's not mapped to a predefined field.
   */
  private buildSourceData(
    row: string[],
    headers: string[],
    tabName: string,
    connectorType: string = 'gsheets'
  ): Record<string, Record<string, Record<string, string>>> {
    const tabData: Record<string, string> = {}

    for (let i = 0; i < headers.length; i++) {
      const header = headers[i]
      if (!header) continue
      tabData[header] = row[i] ?? ''
    }

    return {
      [connectorType]: {
        [tabName]: tabData,
      },
    }
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
      .ilike(keyField, keyValue)
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

    // Batch creates — with ID capture for lineage tracking
    if (creates.length > 0) {
      const createRecords = creates.map((c) => ({
        [c.keyField]: c.keyValue,
        ...c.fields,
        ...(c.sourceData ? { source_data: c.sourceData } : {}),
      }))

      const keyField = creates[0].keyField

      // Insert in batches of 50, capturing returned IDs
      for (let i = 0; i < createRecords.length; i += 50) {
        const batch = createRecords.slice(i, i + 50)
        const batchChanges = creates.slice(i, i + 50)

        const { data: inserted, error } = await this.supabase
          .from(config.tabMapping.primary_entity)
          .insert(batch)
          .select('*')

        if (error) {
          console.error('Batch insert error:', error)
          // Mark failed batch changes as skipped
          for (const change of batchChanges) {
            change.type = 'skip'
            change.skipReason = `Insert failed: ${error.message}`
          }
        } else if (inserted) {
          // Map returned IDs back to EntityChange objects for lineage
          for (const record of inserted as Record<string, unknown>[]) {
            const keyValue = String(record[keyField] || '')
            const change = batchChanges.find((c) => c.keyValue === keyValue)
            if (change) {
              change.existing = { id: record.id as string }
            }
          }
        }
      }

      // Record lineage for successful creates (skip failures)
      const successfulCreates = creates.filter((c) => c.type === 'create')
      if (successfulCreates.length > 0) {
        await this.recordLineage(successfulCreates, syncRunId, config, 'create')
      }
    }

    // Individual updates (to track lineage per field)
    for (const update of updates) {
      // Deep-merge source_data with existing record's source_data
      let updateFields = { ...update.fields }
      if (update.sourceData) {
        const existingSourceData = (update.existing?.source_data as Record<string, unknown>) || {}
        updateFields.source_data = deepMergeSourceData(existingSourceData, update.sourceData)
      }

      const { error } = await this.supabase
        .from(config.tabMapping.primary_entity)
        .update(updateFields)
        .ilike(update.keyField, update.keyValue)

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
  // Private: Weekly Status Pivot
  // ===========================================================================

  /**
   * Process weekly columns by pivoting them into the weekly_statuses table.
   * Each weekly column header is a date, and each cell value is a status string.
   * This creates one row per partner × week in weekly_statuses.
   */
  private async processWeeklyColumns(
    sourceData: { headers: string[]; rows: string[][] },
    config: SyncConfig,
    options: SyncOptions
  ): Promise<{ created: number; updated: number; errors: SyncError[] }> {
    const errors: SyncError[] = []
    let created = 0
    let updated = 0

    // Only process if we have weekly patterns
    const weeklyPatterns = config.columnPatterns.filter((p) => p.category === 'weekly')
    if (weeklyPatterns.length === 0) return { created, updated, errors }

    // Find the key column to identify which entity each row belongs to
    const keyMapping = config.columnMappings.find((m) => m.is_key)
    if (!keyMapping?.target_field) return { created, updated, errors }

    const keyColIdx = sourceData.headers.findIndex((h) => h === keyMapping.source_column)
    if (keyColIdx === -1) return { created, updated, errors }

    // Identify weekly columns by matching against patterns
    const weeklyColInfo: Array<{ colIdx: number; header: string; weekDate: Date }> = []

    for (let i = 0; i < sourceData.headers.length; i++) {
      const header = sourceData.headers[i]
      for (const pattern of weeklyPatterns) {
        const matchConfig = pattern.match_config as ColumnPatternMatchConfig
        if (matchesPattern(header, i, sourceData.headers, matchConfig)) {
          const weekDate = parseWeekDate(header)
          if (weekDate) {
            weeklyColInfo.push({ colIdx: i, header, weekDate })
          }
          break // Only match one pattern per column
        }
      }
    }

    if (weeklyColInfo.length === 0) return { created, updated, errors }

    // Process rows — cache entity lookups to avoid repeated DB queries
    const entityIdCache = new Map<string, string | null>()
    const rows = options.rowLimit
      ? sourceData.rows.slice(0, options.rowLimit)
      : sourceData.rows

    for (let r = 0; r < rows.length; r++) {
      const row = rows[r]
      const keyValue = row[keyColIdx]?.trim()
      if (!keyValue) continue

      // Look up entity ID (cached)
      let entityId = entityIdCache.get(keyValue)
      if (entityId === undefined) {
        const { data: entity } = await this.supabase
          .from(config.tabMapping.primary_entity)
          .select('id')
          .ilike(keyMapping.target_field, keyValue)
          .maybeSingle()

        const resolvedId: string | null = entity?.id ?? null
        entityId = resolvedId
        entityIdCache.set(keyValue, resolvedId)
      }

      if (!entityId) continue

      // Pivot each weekly column into a weekly_statuses row
      for (const wc of weeklyColInfo) {
        const value = row[wc.colIdx]?.trim()
        if (!value) continue

        const weekStartDate = wc.weekDate.toISOString().split('T')[0]
        const weekNumber = getISOWeekNumber(wc.weekDate)
        const year = wc.weekDate.getFullYear()

        if (!options.dryRun) {
          try {
            const { data: existing } = await this.supabase
              .from('weekly_statuses')
              .select('id')
              .eq('partner_id', entityId)
              .eq('week_start_date', weekStartDate)
              .maybeSingle()

            if (existing) {
              await this.supabase
                .from('weekly_statuses')
                .update({ status: value })
                .eq('id', existing.id)
              updated++
            } else {
              await this.supabase
                .from('weekly_statuses')
                .insert({
                  partner_id: entityId,
                  week_start_date: weekStartDate,
                  week_number: weekNumber,
                  year,
                  status: value,
                })
              created++
            }
          } catch (err) {
            errors.push({
              row: r + 2,
              column: wc.header,
              message: `Weekly upsert failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
              severity: 'warning',
            })
          }
        } else {
          // Dry-run: count what would happen
          const { data: existing } = await this.supabase
            .from('weekly_statuses')
            .select('id')
            .eq('partner_id', entityId)
            .eq('week_start_date', weekStartDate)
            .maybeSingle()

          if (existing) {
            updated++
          } else {
            created++
          }
        }
      }
    }

    return { created, updated, errors }
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
// Helper Functions
// =============================================================================

/**
 * Deep-merge source_data objects.
 * Merges at two levels: connector type (e.g., "gsheets") and tab name.
 * Individual tab data is fully replaced on re-sync (fresh snapshot per tab).
 */
function deepMergeSourceData(
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>
): Record<string, unknown> {
  const merged = { ...existing }

  for (const [connectorType, tabs] of Object.entries(incoming)) {
    const existingTabs = (merged[connectorType] as Record<string, unknown>) || {}
    merged[connectorType] = {
      ...existingTabs,
      ...(tabs as Record<string, unknown>),
    }
  }

  return merged
}

/**
 * Parse a week date from a column header string.
 * Handles: "1/6", "12/25", "2024-01-06", "01/06/2024"
 * Normalizes to the Monday of that week.
 */
function parseWeekDate(header: string): Date | null {
  const trimmed = header.trim()

  // Try ISO format: 2024-01-06
  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (isoMatch) {
    const date = new Date(
      parseInt(isoMatch[1]),
      parseInt(isoMatch[2]) - 1,
      parseInt(isoMatch[3])
    )
    if (!isNaN(date.getTime())) return normalizeToMonday(date)
  }

  // Try MM/DD/YYYY format: 01/06/2024
  const mdyMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (mdyMatch) {
    const date = new Date(
      parseInt(mdyMatch[3]),
      parseInt(mdyMatch[1]) - 1,
      parseInt(mdyMatch[2])
    )
    if (!isNaN(date.getTime())) return normalizeToMonday(date)
  }

  // Try M/D format: 1/6, 12/25 (assume current year)
  const mdMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})$/)
  if (mdMatch) {
    const year = new Date().getFullYear()
    const date = new Date(year, parseInt(mdMatch[1]) - 1, parseInt(mdMatch[2]))
    if (!isNaN(date.getTime())) return normalizeToMonday(date)
  }

  return null
}

/**
 * Normalize a date to the Monday of its week.
 */
function normalizeToMonday(date: Date): Date {
  const day = date.getDay()
  // Sunday = 0 → offset 6, Monday = 1 → offset 0, etc.
  const offset = day === 0 ? 6 : day - 1
  const monday = new Date(date)
  monday.setDate(date.getDate() - offset)
  monday.setHours(0, 0, 0, 0)
  return monday
}

/**
 * Get ISO week number for a date.
 */
function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  // Set to nearest Thursday: current date + 4 - current day number (Monday = 1)
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
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
