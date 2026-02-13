/**
 * SupTask Connector
 *
 * Implementation of the connector interface for SupTask ticket ingestion.
 * Uses env-based API token — no config secrets stored in DB.
 *
 * This connector follows the Slack pattern: non-tabular data model with
 * custom sync methods. The standard tabular interface methods (getPreview,
 * getTabs, getRawRows, getData) are stubbed since ticket data flows through
 * dedicated /api/suptask/* routes, not the generic enrichment pipeline.
 */

/* eslint-disable @typescript-eslint/no-unused-vars */

import { BaseConnector } from './base'
import type {
  SupTaskConnectorConfig,
  ConnectorMetadata,
  SourcePreview,
  SourceTab,
  SourceRawRows,
  SourceData,
  ConnectionTestResult,
} from './types'
import { testConnection as suptaskTestConnection } from '@/lib/suptask/client'

export class SupTaskConnector extends BaseConnector<SupTaskConnectorConfig> {
  readonly metadata: ConnectorMetadata = {
    id: 'suptask',
    name: 'SupTask',
    description: 'Ticket workload and support operations from SupTask',
    icon: 'CheckSquare',
    authType: 'api_key',
    capabilities: {
      search: false,
      hasTabs: false,
      realTimeSync: false,
      incrementalSync: false,
      writeBack: false,
    },
    enabled: true,
  }

  validateConfig(_config: SupTaskConnectorConfig): true | string {
    if (!process.env.SUPTASK_API_BASE_URL) {
      return 'SUPTASK_API_BASE_URL environment variable is required'
    }
    if (!process.env.SUPTASK_API_TOKEN) {
      return 'SUPTASK_API_TOKEN environment variable is required'
    }
    return true
  }

  /**
   * Test connection by pinging the SupTask API with the configured token.
   */
  async testConnection(
    _token: string,
    _config: SupTaskConnectorConfig
  ): Promise<ConnectionTestResult> {
    try {
      const info = await suptaskTestConnection()
      return {
        success: true,
        details: {
          sourceName: 'SupTask',
          tabCount: info.sampleTicketNumber,
        },
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Connection failed'
      if (message.includes('401') || message.includes('Invalid') || message.includes('expired')) {
        return { success: false, error: 'Invalid SupTask API token' }
      }
      if (message.includes('403')) {
        return { success: false, error: 'SupTask token lacks required permissions' }
      }
      return { success: false, error: message }
    }
  }

  // -----------------------------------------------------------------------
  // Stubbed tabular interface methods
  // SupTask uses dedicated /api/suptask/* routes, not the generic pipeline
  // -----------------------------------------------------------------------

  async getPreview(
    _token: string,
    _config: SupTaskConnectorConfig
  ): Promise<SourcePreview> {
    return {
      sourceId: 'suptask',
      title: 'SupTask Tickets',
      tabs: [],
      preview: { tabName: 'tickets', headers: [], rows: [] },
    }
  }

  async getTabs(
    _token: string,
    _config: SupTaskConnectorConfig
  ): Promise<SourceTab[]> {
    return [
      {
        id: 'tickets',
        title: 'Tickets',
        rowCount: 0,
        columnCount: 0,
      },
    ]
  }

  async getRawRows(
    _token: string,
    _config: SupTaskConnectorConfig,
    _tabName: string,
    _maxRows?: number
  ): Promise<SourceRawRows> {
    return { rows: [], totalRows: 0 }
  }

  async getData(
    _token: string,
    _config: SupTaskConnectorConfig,
    _tabName: string,
    _headerRow?: number
  ): Promise<SourceData> {
    return { headers: [], rows: [] }
  }
}

export const supTaskConnector = new SupTaskConnector()
