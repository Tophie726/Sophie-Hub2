/**
 * BigQuery Connector
 *
 * Implementation of the connector interface for Google BigQuery.
 * Used for querying Amazon advertising/sales data from unified views.
 *
 * Authentication: Uses Application Default Credentials (ADC) or
 * GOOGLE_APPLICATION_CREDENTIALS environment variable.
 *
 * Key differences from Google Sheets:
 * - Uses service account, not user OAuth
 * - Views are treated as "tabs"
 * - Data is queried at runtime, not synced
 * - Partner filtering via client_name field
 */

import { BigQuery } from '@google-cloud/bigquery'
import { BaseConnector } from './base'
import type {
  BigQueryConnectorConfig,
  ConnectorMetadata,
  SourcePreview,
  SourceTab,
  SourceRawRows,
  SourceData,
  ConnectionTestResult,
} from './types'

// Default BigQuery configuration
const DEFAULT_PROJECT = 'sophie-society-reporting'
const DEFAULT_PARTNER_FIELD = 'client_name'

// Unified views we expose (subset of all views)
const UNIFIED_VIEWS = [
  'pbi_sp_par_unified_latest',      // Sponsored Products
  'pbi_sd_par_unified_latest',      // Sponsored Display
  'pbi_sb_str_unified_latest',      // Sponsored Brands Search Terms
  'pbi_sellingpartner_sales_unified_latest',  // Sales
  'pbi_sellingpartner_refunds_unified_latest', // Refunds
  'pbi_dim_products_unified_latest', // Product dimensions
  'pbi_match_unified_latest',       // Match type analysis
]

/**
 * Get BigQuery client instance
 * Uses Application Default Credentials (ADC)
 */
function getBigQueryClient(projectId?: string): BigQuery {
  return new BigQuery({
    projectId: projectId || DEFAULT_PROJECT,
  })
}

/**
 * BigQuery connector implementation
 */
export class BigQueryConnector extends BaseConnector<BigQueryConnectorConfig> {
  readonly metadata: ConnectorMetadata = {
    id: 'bigquery',
    name: 'BigQuery',
    description: 'Connect to Google BigQuery for Amazon advertising and sales data',
    icon: 'Database',
    authType: 'oauth', // Actually uses service account, but this fits the interface
    oauthScopes: [
      'https://www.googleapis.com/auth/bigquery.readonly',
    ],
    capabilities: {
      search: false,        // No Drive-style search
      hasTabs: true,        // Views act as tabs
      realTimeSync: false,  // Query at runtime
      incrementalSync: true, // Can filter by date
      writeBack: false,     // Read-only
    },
    enabled: true,
  }

  /**
   * Validate BigQuery configuration
   */
  validateConfig(config: BigQueryConnectorConfig): true | string {
    if (!config.project_id) {
      return 'Project ID is required'
    }
    if (!config.dataset_id) {
      return 'Dataset ID is required'
    }
    return true
  }

  /**
   * Get preview of BigQuery dataset including views and sample data
   */
  async getPreview(
    _token: string, // Not used - service account auth
    config: BigQueryConnectorConfig
  ): Promise<SourcePreview> {
    const tabs = await this.getTabs(_token, config)

    // Get preview from first view if available
    let preview = {
      tabName: '',
      headers: [] as string[],
      rows: [] as string[][],
    }

    if (tabs.length > 0) {
      const firstView = config.view_name || tabs[0].title
      const rawRows = await this.getRawRows(_token, config, firstView, 6)
      if (rawRows.rows.length > 0) {
        preview = {
          tabName: firstView,
          headers: rawRows.rows[0] || [],
          rows: rawRows.rows.slice(1, 6),
        }
      }
    }

    return {
      sourceId: `${config.project_id}.${config.dataset_id}`,
      title: `BigQuery: ${config.dataset_id}`,
      tabs,
      preview,
    }
  }

  /**
   * Get all views in the dataset as "tabs"
   */
  async getTabs(
    _token: string,
    config: BigQueryConnectorConfig
  ): Promise<SourceTab[]> {
    const client = getBigQueryClient(config.project_id)
    const dataset = client.dataset(config.dataset_id)

    try {
      const [tables] = await dataset.getTables()

      // Filter to unified views only for cleaner UI
      const unifiedTables = tables.filter(
        (t) => UNIFIED_VIEWS.includes(t.id || '')
      )

      // Map to SourceTab format
      const tabs: SourceTab[] = await Promise.all(
        unifiedTables.map(async (table) => {
          // Get row count estimate from metadata
          const [metadata] = await table.getMetadata()
          const rowCount = parseInt(metadata.numRows || '0', 10)

          return {
            id: table.id || '',
            title: table.id || '',
            rowCount,
            columnCount: metadata.schema?.fields?.length || 0,
          }
        })
      )

      return tabs
    } catch (error) {
      console.error('BigQuery getTabs error:', error)
      throw new Error(
        `Failed to list BigQuery views: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Get raw rows from a view for preview
   * Note: For BigQuery, the first row IS data (not a header row)
   * We synthesize headers from the schema
   */
  async getRawRows(
    _token: string,
    config: BigQueryConnectorConfig,
    viewName: string,
    maxRows: number = 20
  ): Promise<SourceRawRows> {
    const client = getBigQueryClient(config.project_id)

    try {
      const query = `
        SELECT *
        FROM \`${config.project_id}.${config.dataset_id}.${viewName}\`
        LIMIT ${maxRows}
      `

      const [job] = await client.createQueryJob({ query })
      const [rows] = await job.getQueryResults()

      if (rows.length === 0) {
        return { rows: [], totalRows: 0 }
      }

      // Get column names from first row's keys
      const headers = Object.keys(rows[0])

      // Convert to 2D array with headers as first row
      const dataRows = rows.map((row) =>
        headers.map((h) => String(row[h] ?? ''))
      )

      // Get total row count
      const [countResult] = await client.query(`
        SELECT COUNT(*) as total
        FROM \`${config.project_id}.${config.dataset_id}.${viewName}\`
      `)
      const totalRows = parseInt(countResult[0]?.total || '0', 10)

      return {
        rows: [headers, ...dataRows], // Headers as first row
        totalRows,
      }
    } catch (error) {
      console.error('BigQuery getRawRows error:', error)
      throw new Error(
        `Failed to fetch BigQuery data: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Get data from a view with headers extracted
   */
  async getData(
    _token: string,
    config: BigQueryConnectorConfig,
    viewName: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    headerRow?: number // Ignored for BigQuery - schema defines headers
  ): Promise<SourceData> {
    const rawRows = await this.getRawRows(_token, config, viewName, 1000)

    if (rawRows.rows.length === 0) {
      return { headers: [], rows: [] }
    }

    return {
      headers: rawRows.rows[0],
      rows: rawRows.rows.slice(1),
    }
  }

  /**
   * Get data filtered by partner's client_name
   * This is the key method for partner-specific dashboards
   */
  async getPartnerData(
    config: BigQueryConnectorConfig,
    viewName: string,
    clientName: string,
    options?: {
      limit?: number
      startDate?: string
      endDate?: string
    }
  ): Promise<SourceData> {
    const client = getBigQueryClient(config.project_id)
    const partnerField = config.partner_field || DEFAULT_PARTNER_FIELD

    try {
      let query = `
        SELECT *
        FROM \`${config.project_id}.${config.dataset_id}.${viewName}\`
        WHERE ${partnerField} = @clientName
      `

      const params: Record<string, string | number> = { clientName }

      // Add date filters if provided
      if (options?.startDate) {
        query += ` AND date >= @startDate`
        params.startDate = options.startDate
      }
      if (options?.endDate) {
        query += ` AND date <= @endDate`
        params.endDate = options.endDate
      }

      // Add limit
      query += ` LIMIT ${options?.limit || 10000}`

      const [job] = await client.createQueryJob({
        query,
        params,
      })
      const [rows] = await job.getQueryResults()

      if (rows.length === 0) {
        return { headers: [], rows: [] }
      }

      const headers = Object.keys(rows[0])
      const dataRows = rows.map((row) =>
        headers.map((h) => String(row[h] ?? ''))
      )

      return { headers, rows: dataRows }
    } catch (error) {
      console.error('BigQuery getPartnerData error:', error)
      throw new Error(
        `Failed to fetch partner data: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Get all unique client names from a view
   * Useful for partner mapping UI
   */
  async getClientNames(
    config: BigQueryConnectorConfig,
    viewName?: string
  ): Promise<string[]> {
    const client = getBigQueryClient(config.project_id)
    const partnerField = config.partner_field || DEFAULT_PARTNER_FIELD
    const view = viewName || UNIFIED_VIEWS[0]

    try {
      const query = `
        SELECT DISTINCT ${partnerField}
        FROM \`${config.project_id}.${config.dataset_id}.${view}\`
        WHERE ${partnerField} IS NOT NULL
        ORDER BY ${partnerField}
      `

      const [rows] = await client.query(query)
      return rows.map((row) => String(row[partnerField]))
    } catch (error) {
      console.error('BigQuery getClientNames error:', error)
      throw new Error(
        `Failed to fetch client names: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Test connection to BigQuery
   */
  async testConnection(
    _token: string,
    config: BigQueryConnectorConfig
  ): Promise<ConnectionTestResult> {
    try {
      const client = getBigQueryClient(config.project_id)
      const [datasets] = await client.getDatasets()

      const targetDataset = datasets.find((d) => d.id === config.dataset_id)
      if (!targetDataset) {
        return {
          success: false,
          error: `Dataset '${config.dataset_id}' not found in project`,
        }
      }

      const tabs = await this.getTabs(_token, config)

      return {
        success: true,
        details: {
          sourceName: `${config.project_id}.${config.dataset_id}`,
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

// Singleton instance
export const bigQueryConnector = new BigQueryConnector()

// Export unified views list for UI
export { UNIFIED_VIEWS }
