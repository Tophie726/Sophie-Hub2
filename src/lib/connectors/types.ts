/**
 * Connector Type Definitions
 *
 * This module defines the type system for the pluggable connector architecture.
 * All data source connectors (Google Sheets, Close.io, Typeform, etc.) implement
 * these types to provide a unified interface for data ingestion.
 */

// =============================================================================
// Connector Type Identifiers
// =============================================================================

/**
 * Supported connector types
 * Add new connector types here as they are implemented
 */
export type ConnectorTypeId =
  | 'google_sheet'
  | 'google_form'
  | 'api'
  | 'csv'
  // Future connectors:
  // | 'close_io'
  // | 'typeform'
  // | 'clickup'
  // | 'asana'
  // | 'airtable'

/**
 * Authentication types supported by connectors
 */
export type ConnectorAuthType = 'oauth' | 'api_key' | 'none'

// =============================================================================
// Connector Configuration (Discriminated Union)
// =============================================================================

/**
 * Configuration for Google Sheets connector
 */
export interface GoogleSheetConnectorConfig {
  type: 'google_sheet'
  spreadsheet_id: string
  spreadsheet_url?: string | null
}

/**
 * Configuration for Google Forms connector
 */
export interface GoogleFormConnectorConfig {
  type: 'google_form'
  form_id: string
  form_url?: string | null
}

/**
 * Configuration for generic API connector
 */
export interface ApiConnectorConfig {
  type: 'api'
  endpoint_url: string
  auth_type: 'bearer' | 'api_key' | 'basic' | 'none'
  headers?: Record<string, string>
}

/**
 * Configuration for CSV file connector
 */
export interface CsvConnectorConfig {
  type: 'csv'
  file_name: string
  file_url?: string | null
  delimiter?: string
  encoding?: string
}

/**
 * Discriminated union of all connector configurations
 * Use this when storing/retrieving connector config from the database
 */
export type ConnectorConfig =
  | GoogleSheetConnectorConfig
  | GoogleFormConnectorConfig
  | ApiConnectorConfig
  | CsvConnectorConfig

// =============================================================================
// Connector Metadata
// =============================================================================

/**
 * Capabilities that a connector may support
 */
export interface ConnectorCapabilities {
  /** Can search for sources (e.g., search Drive for sheets) */
  search: boolean
  /** Has multiple tabs/scopes within a source */
  hasTabs: boolean
  /** Supports real-time sync via webhooks */
  realTimeSync: boolean
  /** Supports incremental sync (only changed rows) */
  incrementalSync: boolean
  /** Can write back to the source */
  writeBack: boolean
}

/**
 * Metadata describing a connector type
 * Used for UI display and feature detection
 */
export interface ConnectorMetadata {
  /** Unique identifier for this connector type */
  id: ConnectorTypeId
  /** Human-readable display name */
  name: string
  /** Short description of the connector */
  description: string
  /** Icon name (from Lucide icons) */
  icon: string
  /** Authentication type required */
  authType: ConnectorAuthType
  /** OAuth scopes required (if authType is 'oauth') */
  oauthScopes?: string[]
  /** Connector capabilities */
  capabilities: ConnectorCapabilities
  /** Whether the connector is currently available */
  enabled: boolean
}

// =============================================================================
// Source Search & Discovery
// =============================================================================

/**
 * Result from searching for sources (e.g., searching Drive for spreadsheets)
 */
export interface SourceSearchResult {
  /** Unique identifier for the source */
  id: string
  /** Display name */
  name: string
  /** URL to the source (for reference) */
  url?: string
  /** Last modified timestamp (ISO string) */
  modifiedTime?: string
  /** Owner/creator name */
  owner?: string
  /** Optional thumbnail URL */
  thumbnail?: string
}

// =============================================================================
// Source Structure & Tabs
// =============================================================================

/**
 * A tab/scope within a source (e.g., a sheet within a spreadsheet)
 */
export interface SourceTab {
  /** Tab identifier (e.g., sheet ID) */
  id: string | number
  /** Tab display name */
  title: string
  /** Number of rows in the tab */
  rowCount: number
  /** Number of columns in the tab */
  columnCount: number
}

/**
 * Preview data for a source
 * Used when first connecting a source to show structure
 */
export interface SourcePreview {
  /** Source identifier */
  sourceId: string
  /** Source title/name */
  title: string
  /** Available tabs/scopes */
  tabs: SourceTab[]
  /** Preview of the first tab */
  preview: {
    tabName: string
    /** First row (potential headers) */
    headers: string[]
    /** Sample data rows */
    rows: string[][]
  }
}

// =============================================================================
// Source Data
// =============================================================================

/**
 * Raw row data from a source tab
 * Used for header detection before mapping
 */
export interface SourceRawRows {
  /** Raw row data (2D array of strings) */
  rows: string[][]
  /** Total number of rows in the source */
  totalRows: number
}

/**
 * Processed data from a source tab
 * Used after header row has been confirmed
 */
export interface SourceData {
  /** Column headers (from the confirmed header row) */
  headers: string[]
  /** Data rows (everything after the header row) */
  rows: string[][]
}

// =============================================================================
// Connection Status
// =============================================================================

/**
 * Status of a connector test
 */
export interface ConnectionTestResult {
  /** Whether the connection succeeded */
  success: boolean
  /** Error message if failed */
  error?: string
  /** Additional details about the connection */
  details?: {
    /** Source name if available */
    sourceName?: string
    /** Number of tabs/scopes found */
    tabCount?: number
    /** Last sync time if applicable */
    lastSync?: string
  }
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Type guard to check if a config is for Google Sheets
 */
export function isGoogleSheetConfig(
  config: ConnectorConfig
): config is GoogleSheetConnectorConfig {
  return config.type === 'google_sheet'
}

/**
 * Type guard to check if a config is for Google Forms
 */
export function isGoogleFormConfig(
  config: ConnectorConfig
): config is GoogleFormConnectorConfig {
  return config.type === 'google_form'
}

/**
 * Type guard to check if a config is for API
 */
export function isApiConfig(
  config: ConnectorConfig
): config is ApiConnectorConfig {
  return config.type === 'api'
}

/**
 * Type guard to check if a config is for CSV
 */
export function isCsvConfig(
  config: ConnectorConfig
): config is CsvConnectorConfig {
  return config.type === 'csv'
}

// =============================================================================
// Helper Types
// =============================================================================

/**
 * Extract the config type for a specific connector
 */
export type ConfigForConnector<T extends ConnectorTypeId> = Extract<
  ConnectorConfig,
  { type: T }
>

/**
 * Legacy type alias for backward compatibility with existing code
 */
export type DataSourceType = ConnectorTypeId
