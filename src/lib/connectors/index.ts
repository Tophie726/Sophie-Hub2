/**
 * Connectors Module
 *
 * This is the main entry point for the connector system.
 * Import from here to get access to all connector functionality.
 *
 * Usage:
 * ```typescript
 * import {
 *   getConnector,
 *   getConnectorRegistry,
 *   type ConnectorConfig,
 *   type GoogleSheetConnectorConfig,
 * } from '@/lib/connectors'
 *
 * // Get a connector
 * const sheets = getConnector('google_sheet')
 * const results = await sheets.search(token, 'query')
 *
 * // List all connectors
 * const all = getConnectorRegistry().getAll(true) // enabled only
 * ```
 */

// =============================================================================
// Re-export Types
// =============================================================================

export type {
  // Type identifiers
  ConnectorTypeId,
  ConnectorAuthType,
  // Configurations
  ConnectorConfig,
  GoogleSheetConnectorConfig,
  GoogleFormConnectorConfig,
  BigQueryConnectorConfig,
  SlackConnectorConfig,
  GoogleWorkspaceConnectorConfig,
  ApiConnectorConfig,
  CsvConnectorConfig,
  SupTaskConnectorConfig,
  // Metadata
  ConnectorMetadata,
  ConnectorCapabilities,
  // Data structures
  SourceSearchResult,
  SourcePreview,
  SourceTab,
  SourceRawRows,
  SourceData,
  ConnectionTestResult,
  // Helpers
  ConfigForConnector,
  DataSourceType,
} from './types'

export {
  // Type guards
  isGoogleSheetConfig,
  isGoogleFormConfig,
  isBigQueryConfig,
  isSlackConfig,
  isGoogleWorkspaceConfig,
  isApiConfig,
  isCsvConfig,
  isSupTaskConfig,
} from './types'

// =============================================================================
// Re-export Base Interface
// =============================================================================

export type { IConnector } from './base'
export { BaseConnector } from './base'

// =============================================================================
// Re-export Registry
// =============================================================================

export {
  ConnectorRegistry,
  getConnectorRegistry,
  getConnector,
  hasConnector,
  registerConnector,
} from './registry'

// =============================================================================
// Re-export Connector Implementations
// =============================================================================

export { GoogleSheetsConnector, googleSheetsConnector } from './google-sheets'
export { BigQueryConnector, bigQueryConnector, UNIFIED_VIEWS } from './bigquery'
export { SlackConnector, slackConnector } from './slack'
export { GoogleWorkspaceConnector, googleWorkspaceConnector } from './google-workspace'
export { SupTaskConnector, supTaskConnector } from './suptask'

// =============================================================================
// Auto-Register Connectors
// =============================================================================

import { registerConnector } from './registry'
import { googleSheetsConnector } from './google-sheets'
import { bigQueryConnector } from './bigquery'
import { slackConnector } from './slack'
import { googleWorkspaceConnector } from './google-workspace'
import { supTaskConnector } from './suptask'

// Register connectors on module load
// This ensures they're available immediately when the module is imported
try {
  registerConnector(googleSheetsConnector)
} catch {
  // Already registered (module was imported multiple times)
}

try {
  registerConnector(bigQueryConnector)
} catch {
  // Already registered (module was imported multiple times)
}

try {
  registerConnector(slackConnector)
} catch {
  // Already registered (module was imported multiple times)
}

try {
  registerConnector(googleWorkspaceConnector)
} catch {
  // Already registered (module was imported multiple times)
}

try {
  registerConnector(supTaskConnector)
} catch {
  // Already registered (module was imported multiple times)
}
