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
  ApiConnectorConfig,
  CsvConnectorConfig,
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
  isApiConfig,
  isCsvConfig,
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

// =============================================================================
// Auto-Register Connectors
// =============================================================================

import { registerConnector } from './registry'
import { googleSheetsConnector } from './google-sheets'

// Register the Google Sheets connector on module load
// This ensures it's available immediately when the module is imported
try {
  registerConnector(googleSheetsConnector)
} catch {
  // Already registered (module was imported multiple times)
}
