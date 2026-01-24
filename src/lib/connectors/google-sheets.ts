/**
 * Google Sheets Connector
 *
 * Implementation of the connector interface for Google Sheets.
 * Wraps the existing functions in src/lib/google/sheets.ts to provide
 * a unified connector interface.
 */

import { BaseConnector } from './base'
import type {
  GoogleSheetConnectorConfig,
  ConnectorMetadata,
  SourceSearchResult,
  SourcePreview,
  SourceTab,
  SourceRawRows,
  SourceData,
  ConnectionTestResult,
} from './types'

// Import existing Google Sheets functions
import {
  searchSheets,
  getSheetPreview,
  getSheetData,
  getSheetRawRows,
  type SheetTab,
} from '@/lib/google/sheets'

/**
 * Google Sheets connector implementation
 *
 * This wraps the existing Google Sheets API functions to conform
 * to the connector interface, enabling pluggable data source architecture.
 */
export class GoogleSheetsConnector extends BaseConnector<GoogleSheetConnectorConfig> {
  readonly metadata: ConnectorMetadata = {
    id: 'google_sheet',
    name: 'Google Sheets',
    description: 'Connect to Google Spreadsheets for data mapping',
    icon: 'Sheet',
    authType: 'oauth',
    oauthScopes: [
      'https://www.googleapis.com/auth/spreadsheets.readonly',
      'https://www.googleapis.com/auth/drive.readonly',
    ],
    capabilities: {
      search: true,
      hasTabs: true,
      realTimeSync: false,
      incrementalSync: false,
      writeBack: false,
    },
    enabled: true,
  }

  /**
   * Validate Google Sheets configuration
   */
  validateConfig(config: GoogleSheetConnectorConfig): true | string {
    if (!config.spreadsheet_id) {
      return 'Spreadsheet ID is required'
    }
    if (typeof config.spreadsheet_id !== 'string') {
      return 'Spreadsheet ID must be a string'
    }
    if (config.spreadsheet_id.length < 10) {
      return 'Invalid spreadsheet ID format'
    }
    return true
  }

  /**
   * Search for spreadsheets in the user's Google Drive
   */
  async search(token: string, query?: string): Promise<SourceSearchResult[]> {
    const results = await searchSheets(token, query || '')
    return results.map((sheet) => ({
      id: sheet.id,
      name: sheet.name,
      url: sheet.url,
      modifiedTime: sheet.modifiedTime,
      owner: sheet.owner,
    }))
  }

  /**
   * Get preview of a spreadsheet including structure and sample data
   */
  async getPreview(
    token: string,
    config: GoogleSheetConnectorConfig
  ): Promise<SourcePreview> {
    const preview = await getSheetPreview(token, config.spreadsheet_id)
    return {
      sourceId: preview.spreadsheetId,
      title: preview.title,
      tabs: preview.tabs.map((tab) => this.convertTab(tab)),
      preview: {
        tabName: preview.preview.tabName,
        headers: preview.preview.headers,
        rows: preview.preview.rows,
      },
    }
  }

  /**
   * Get all tabs/sheets within a spreadsheet
   */
  async getTabs(
    token: string,
    config: GoogleSheetConnectorConfig
  ): Promise<SourceTab[]> {
    const preview = await getSheetPreview(token, config.spreadsheet_id)
    return preview.tabs.map((tab) => this.convertTab(tab))
  }

  /**
   * Get raw rows from a specific sheet tab
   */
  async getRawRows(
    token: string,
    config: GoogleSheetConnectorConfig,
    tabName: string,
    maxRows = 20
  ): Promise<SourceRawRows> {
    const result = await getSheetRawRows(
      token,
      config.spreadsheet_id,
      tabName,
      maxRows
    )
    return {
      rows: result.rows,
      totalRows: result.totalRows,
    }
  }

  /**
   * Get data from a specific sheet tab with headers
   */
  async getData(
    token: string,
    config: GoogleSheetConnectorConfig,
    tabName: string
  ): Promise<SourceData> {
    const result = await getSheetData(token, config.spreadsheet_id, tabName)
    return {
      headers: result.headers,
      rows: result.rows,
    }
  }

  /**
   * Test connection by fetching spreadsheet metadata
   */
  async testConnection(
    token: string,
    config: GoogleSheetConnectorConfig
  ): Promise<ConnectionTestResult> {
    try {
      const preview = await getSheetPreview(token, config.spreadsheet_id)
      return {
        success: true,
        details: {
          sourceName: preview.title,
          tabCount: preview.tabs.length,
        },
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'

      // Provide user-friendly error messages
      if (message.includes('404') || message.includes('not found')) {
        return {
          success: false,
          error: 'Spreadsheet not found. Check the ID or your access permissions.',
        }
      }
      if (message.includes('403') || message.includes('forbidden')) {
        return {
          success: false,
          error: 'Access denied. Make sure you have permission to view this spreadsheet.',
        }
      }
      if (message.includes('401') || message.includes('unauthorized')) {
        return {
          success: false,
          error: 'Authentication expired. Please sign in again.',
        }
      }

      return {
        success: false,
        error: `Connection failed: ${message}`,
      }
    }
  }

  /**
   * Convert SheetTab to SourceTab format
   */
  private convertTab(tab: SheetTab): SourceTab {
    return {
      id: tab.sheetId,
      title: tab.title,
      rowCount: tab.rowCount,
      columnCount: tab.columnCount,
    }
  }
}

/**
 * Singleton instance of the Google Sheets connector
 */
export const googleSheetsConnector = new GoogleSheetsConnector()
