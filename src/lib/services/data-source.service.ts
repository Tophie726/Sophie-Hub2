/**
 * Data Source Service
 *
 * Business logic for data source operations.
 * Orchestrates repository calls, validation, and connector integration.
 */

import { getConnectorRegistry } from '@/lib/connectors'
import { audit } from '@/lib/audit'
import type { DataSourceWithStats } from '@/types/entities'
import type { ConnectorConfig } from '@/lib/connectors/types'
import * as dataSourceRepo from '@/lib/repositories/data-source.repository'

export interface CreateDataSourceParams {
  name: string
  spreadsheet_id?: string
  spreadsheet_url?: string | null
  type?: string
  connection_config?: ConnectorConfig
  userId?: string
  userEmail?: string
}

export interface CreateDataSourceResult {
  source: dataSourceRepo.DataSourceRecord
  isConflict: boolean
  conflictId?: string
}

/**
 * Create a new data source with validation and conflict checking
 */
export async function createDataSource(
  params: CreateDataSourceParams
): Promise<CreateDataSourceResult> {
  const {
    name,
    spreadsheet_id,
    spreadsheet_url,
    type,
    connection_config,
    userId,
    userEmail,
  } = params

  // Determine the connector type and config
  let connectorType: string
  let connectionConfigObj: Record<string, unknown>
  let legacySpreadsheetId: string | null = null
  let legacySpreadsheetUrl: string | null = null

  if (connection_config) {
    // New format: use provided connection_config
    connectorType = connection_config.type
    connectionConfigObj = connection_config as unknown as Record<string, unknown>

    // Extract legacy fields for backward compatibility (dual-write)
    if (connection_config.type === 'google_sheet') {
      legacySpreadsheetId = connection_config.spreadsheet_id
      legacySpreadsheetUrl = connection_config.spreadsheet_url ?? null
    }

    // Validate config using the connector registry
    const connector = getConnectorRegistry().get(connection_config.type)
    if (connector) {
      const configValidation = connector.validateConfig(connection_config)
      if (configValidation !== true) {
        throw new Error(configValidation)
      }
    }
  } else if (spreadsheet_id) {
    // Legacy format: construct connection_config from spreadsheet_id
    connectorType = type || 'google_sheet'
    legacySpreadsheetId = spreadsheet_id
    legacySpreadsheetUrl = spreadsheet_url || null
    connectionConfigObj = {
      type: 'google_sheet',
      spreadsheet_id,
      spreadsheet_url: spreadsheet_url || null,
    }
  } else {
    throw new Error('Either spreadsheet_id or connection_config is required')
  }

  // Check if this source is already connected (by spreadsheet_id for sheets)
  if (legacySpreadsheetId) {
    const existing = await dataSourceRepo.findDataSourceBySpreadsheetId(
      legacySpreadsheetId
    )

    if (existing) {
      return {
        source: existing as dataSourceRepo.DataSourceRecord,
        isConflict: true,
        conflictId: existing.id,
      }
    }
  }

  // Create the data source with both legacy and new fields (dual-write)
  const source = await dataSourceRepo.createDataSource({
    name,
    type: connectorType,
    spreadsheet_id: legacySpreadsheetId,
    spreadsheet_url: legacySpreadsheetUrl,
    connection_config: connectionConfigObj,
    status: 'active',
  })

  // Audit log the data source creation
  await audit.logDataSource(
    'create',
    source.id,
    name,
    userId,
    userEmail
  )

  return {
    source,
    isConflict: false,
  }
}

/**
 * Fetch all data sources with statistics
 * Optimized: Uses 3 queries total instead of N+1 pattern
 */
export async function getAllDataSourcesWithStats(): Promise<DataSourceWithStats[]> {
  // Query 1: Fetch all data sources
  const sources = await dataSourceRepo.getAllDataSources()

  if (sources.length === 0) {
    return []
  }

  const sourceIds = sources.map(s => s.id)

  // Query 2: Fetch ALL tab mappings for all sources in one query
  const allTabs = await dataSourceRepo.getTabMappingsBySourceIds(sourceIds)

  const tabIds = allTabs.map(t => t.id)

  // Query 3: Fetch ALL column mappings for all tabs in one query
  const allColumns = tabIds.length > 0
    ? await dataSourceRepo.getColumnMappingsByTabIds(tabIds)
    : []

  // Assemble the response with stats (all in-memory, no more queries)
  return dataSourceRepo.assembleDataSourcesWithStats(sources, allTabs, allColumns)
}
