/**
 * Base Connector Interface
 *
 * All data source connectors must implement this interface to be registered
 * in the connector registry. This provides a unified API for:
 * - Searching/discovering sources
 * - Getting source structure and previews
 * - Fetching raw data for mapping
 * - Testing connections
 */

import type {
  ConnectorConfig,
  ConnectorMetadata,
  SourceSearchResult,
  SourcePreview,
  SourceTab,
  SourceRawRows,
  SourceData,
  ConnectionTestResult,
} from './types'

/**
 * Base interface that all connectors must implement
 *
 * @template TConfig - The specific configuration type for this connector
 */
export interface IConnector<TConfig extends ConnectorConfig = ConnectorConfig> {
  /**
   * Static metadata about this connector type
   * Used for UI display and feature detection
   */
  readonly metadata: ConnectorMetadata

  /**
   * Validate a configuration object
   *
   * @param config - The configuration to validate
   * @returns true if valid, or an error message string if invalid
   */
  validateConfig(config: TConfig): true | string

  /**
   * Search for available sources
   * Only available if metadata.capabilities.search is true
   *
   * @param token - OAuth token or API key
   * @param query - Optional search query
   * @returns Array of matching sources
   */
  search?(token: string, query?: string): Promise<SourceSearchResult[]>

  /**
   * Get a preview of a source including its structure and sample data
   *
   * @param token - OAuth token or API key
   * @param config - Connector configuration with source identifier
   * @returns Source preview with tabs and sample data
   */
  getPreview(token: string, config: TConfig): Promise<SourcePreview>

  /**
   * Get all tabs/scopes within a source
   *
   * @param token - OAuth token or API key
   * @param config - Connector configuration with source identifier
   * @returns Array of tabs in the source
   */
  getTabs(token: string, config: TConfig): Promise<SourceTab[]>

  /**
   * Get raw rows from a specific tab for header detection
   * Does not assume a header row - returns raw data
   *
   * @param token - OAuth token or API key
   * @param config - Connector configuration with source identifier
   * @param tabName - Name/identifier of the tab to fetch
   * @param maxRows - Maximum number of rows to fetch (default: 20)
   * @returns Raw row data and total row count
   */
  getRawRows(
    token: string,
    config: TConfig,
    tabName: string,
    maxRows?: number
  ): Promise<SourceRawRows>

  /**
   * Get data from a specific tab with headers extracted
   * Call this after header row has been confirmed
   *
   * @param token - OAuth token or API key
   * @param config - Connector configuration with source identifier
   * @param tabName - Name/identifier of the tab to fetch
   * @returns Headers and data rows
   */
  getData(
    token: string,
    config: TConfig,
    tabName: string
  ): Promise<SourceData>

  /**
   * Test the connection to verify credentials and access
   *
   * @param token - OAuth token or API key
   * @param config - Connector configuration with source identifier
   * @returns Connection test result with success status
   */
  testConnection(
    token: string,
    config: TConfig
  ): Promise<ConnectionTestResult>
}

/**
 * Abstract base class with default implementations
 * Connectors can extend this for convenience
 */
export abstract class BaseConnector<TConfig extends ConnectorConfig>
  implements IConnector<TConfig>
{
  abstract readonly metadata: ConnectorMetadata

  abstract validateConfig(config: TConfig): true | string

  abstract getPreview(token: string, config: TConfig): Promise<SourcePreview>

  abstract getTabs(token: string, config: TConfig): Promise<SourceTab[]>

  abstract getRawRows(
    token: string,
    config: TConfig,
    tabName: string,
    maxRows?: number
  ): Promise<SourceRawRows>

  abstract getData(
    token: string,
    config: TConfig,
    tabName: string
  ): Promise<SourceData>

  /**
   * Default implementation tests connection by attempting to get tabs
   * Connectors can override for more specific testing
   */
  async testConnection(
    token: string,
    config: TConfig
  ): Promise<ConnectionTestResult> {
    try {
      const tabs = await this.getTabs(token, config)
      return {
        success: true,
        details: {
          tabCount: tabs.length,
        },
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection failed',
      }
    }
  }
}
