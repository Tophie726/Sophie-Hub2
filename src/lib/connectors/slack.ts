/**
 * Slack Connector
 *
 * Implementation of the connector interface for Slack.
 * Used for staff mapping, channel-to-partner mapping, and response time analytics.
 *
 * Authentication: Uses bot token (SLACK_BOT_TOKEN env var).
 *
 * Key differences from tabular connectors (Sheets, CSV):
 * - Uses bot token, not user OAuth
 * - No tabular data model (users, channels, messages instead of tabs/rows)
 * - Custom methods for Slack-specific operations
 * - Tabular interface methods (getPreview, getTabs, etc.) are stubbed
 */

/* eslint-disable @typescript-eslint/no-unused-vars */

import { BaseConnector } from './base'
import type {
  SlackConnectorConfig,
  ConnectorMetadata,
  SourcePreview,
  SourceTab,
  SourceRawRows,
  SourceData,
  ConnectionTestResult,
} from './types'
import * as slackClient from '@/lib/slack/client'
import {
  getCachedUsers,
  setCachedUsers,
  getCachedChannels,
  setCachedChannels,
  isUsersCacheStale,
  getUsersRefreshInProgress,
  setUsersRefreshInProgress,
  isChannelsCacheStale,
  getChannelsRefreshInProgress,
  setChannelsRefreshInProgress,
} from './slack-cache'
import type { SlackUser, SlackChannel } from '@/lib/slack/types'

/**
 * Slack connector implementation
 *
 * Extends BaseConnector for registry integration but uses custom methods
 * rather than the tabular IConnector interface. This follows the BigQuery
 * precedent where the data model doesn't fit tabs/rows/headers.
 */
export class SlackConnector extends BaseConnector<SlackConnectorConfig> {
  readonly metadata: ConnectorMetadata = {
    id: 'slack',
    name: 'Slack',
    description: 'Connect Slack for staff mapping, channel-partner mapping, and response time analytics',
    icon: 'MessageSquare',
    authType: 'api_key', // Bot token
    capabilities: {
      search: false,
      hasTabs: false,
      realTimeSync: false,
      incrementalSync: true,
      writeBack: false,
    },
    enabled: true,
  }

  /**
   * Validate Slack configuration
   */
  validateConfig(_config: SlackConnectorConfig): true | string {
    if (!process.env.SLACK_BOT_TOKEN) {
      return 'SLACK_BOT_TOKEN environment variable is required'
    }
    return true
  }

  /**
   * Stubbed — Slack doesn't have tabular previews
   */
  async getPreview(
    _token: string,
    _config: SlackConnectorConfig
  ): Promise<SourcePreview> {
    return {
      sourceId: 'slack',
      title: 'Slack Workspace',
      tabs: [],
      preview: { tabName: '', headers: [], rows: [] },
    }
  }

  /**
   * Stubbed — Slack doesn't have tabs
   */
  async getTabs(
    _token: string,
    _config: SlackConnectorConfig
  ): Promise<SourceTab[]> {
    return []
  }

  /**
   * Stubbed — Slack doesn't have raw rows
   */
  async getRawRows(
    _token: string,
    _config: SlackConnectorConfig,
    _tabName: string,
    _maxRows?: number
  ): Promise<SourceRawRows> {
    return { rows: [], totalRows: 0 }
  }

  /**
   * Stubbed — Slack doesn't have structured data
   */
  async getData(
    _token: string,
    _config: SlackConnectorConfig,
    _tabName: string,
    _headerRow?: number
  ): Promise<SourceData> {
    return { headers: [], rows: [] }
  }

  /**
   * Test connection to Slack workspace
   */
  async testConnection(
    _token: string,
    _config: SlackConnectorConfig
  ): Promise<ConnectionTestResult> {
    try {
      const info = await slackClient.testConnection()
      return {
        success: true,
        details: {
          sourceName: info.workspace_name,
        },
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection failed',
      }
    }
  }

  // ===========================================================================
  // Custom Slack Methods (not part of IConnector)
  // ===========================================================================

  /**
   * List all workspace users (cached, stale-while-revalidate)
   *
   * @param options.include_bots - Include bot accounts (default: false)
   * @param options.include_deleted - Include deactivated accounts (default: false)
   */
  async listUsers(options?: {
    include_bots?: boolean
    include_deleted?: boolean
  }): Promise<SlackUser[]> {
    // When including bots/deleted, bypass cache (different result set)
    const includeAll = options?.include_bots || options?.include_deleted
    if (includeAll) {
      return slackClient.listUsers(options)
    }

    const cached = getCachedUsers()
    if (cached) {
      // If stale, trigger background refresh
      if (isUsersCacheStale() && !getUsersRefreshInProgress()) {
        setUsersRefreshInProgress(true)
        slackClient.listUsers()
          .then(users => setCachedUsers(users))
          .catch(err => console.error('Background users refresh failed:', err))
          .finally(() => setUsersRefreshInProgress(false))
      }
      return cached
    }

    const users = await slackClient.listUsers()
    setCachedUsers(users)
    return users
  }

  /**
   * List all workspace channels (cached, stale-while-revalidate)
   */
  async listChannels(): Promise<SlackChannel[]> {
    const cached = getCachedChannels()
    if (cached) {
      // If stale, trigger background refresh
      if (isChannelsCacheStale() && !getChannelsRefreshInProgress()) {
        setChannelsRefreshInProgress(true)
        slackClient.listChannels()
          .then(channels => setCachedChannels(channels))
          .catch(err => console.error('Background channels refresh failed:', err))
          .finally(() => setChannelsRefreshInProgress(false))
      }
      return cached
    }

    const channels = await slackClient.listChannels()
    setCachedChannels(channels)
    return channels
  }

  /**
   * Get channel message history (metadata only)
   */
  async getChannelHistory(
    channelId: string,
    oldest?: string,
    limit?: number
  ) {
    return slackClient.getChannelHistory(channelId, oldest, limit)
  }

  /**
   * Get members of a channel
   */
  async getChannelMembers(channelId: string) {
    return slackClient.getChannelMembers(channelId)
  }

  /**
   * Join a public channel
   */
  async joinChannel(channelId: string) {
    return slackClient.joinChannel(channelId)
  }
}

// Singleton instance
export const slackConnector = new SlackConnector()
