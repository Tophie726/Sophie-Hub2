/**
 * Google Workspace Connector
 *
 * Implementation of the connector interface for Google Workspace Admin SDK.
 * Used for staff identity enrichment via the Directory API.
 *
 * Authentication: Service account with domain-wide delegation (env-only credentials).
 *
 * Key differences from tabular connectors (Sheets, CSV):
 * - Uses service account, not user OAuth
 * - No tabular data model (directory users, not tabs/rows)
 * - Custom methods for directory-specific operations
 * - Tabular interface methods (getPreview, getTabs, etc.) are stubbed
 * - Users served from local snapshot table, not live API
 */

/* eslint-disable @typescript-eslint/no-unused-vars */

import { BaseConnector } from './base'
import type {
  GoogleWorkspaceConnectorConfig,
  ConnectorMetadata,
  SourcePreview,
  SourceTab,
  SourceRawRows,
  SourceData,
  ConnectionTestResult,
} from './types'
import * as gwsClient from '@/lib/google-workspace/client'
import type { GoogleDirectoryUser, DirectorySnapshotRow } from '@/lib/google-workspace/types'
import {
  getCachedDirectoryUsers,
  setCachedDirectoryUsers,
  isDirectoryUsersCacheStale,
  getDirectoryUsersRefreshInProgress,
  setDirectoryUsersRefreshInProgress,
  invalidateDirectoryUsersCache,
} from './google-workspace-cache'

/**
 * Google Workspace connector implementation
 *
 * Extends BaseConnector for registry integration but uses custom methods
 * rather than the tabular IConnector interface. Directory users are not
 * tabs/rows data.
 */
export class GoogleWorkspaceConnector extends BaseConnector<GoogleWorkspaceConnectorConfig> {
  readonly metadata: ConnectorMetadata = {
    id: 'google_workspace',
    name: 'Google Workspace',
    description: 'Connect Google Workspace for staff identity enrichment via directory',
    icon: 'Building2',
    authType: 'api_key', // Service account (env-only)
    capabilities: {
      search: false,
      hasTabs: false,
      realTimeSync: false,
      incrementalSync: false, // Snapshot-based for Phase 1
      writeBack: false,
    },
    enabled: true,
  }

  /**
   * Validate Google Workspace configuration
   */
  validateConfig(_config: GoogleWorkspaceConnectorConfig): true | string {
    if (!process.env.GOOGLE_WORKSPACE_CLIENT_EMAIL) {
      return 'GOOGLE_WORKSPACE_CLIENT_EMAIL environment variable is required'
    }
    if (!process.env.GOOGLE_WORKSPACE_PRIVATE_KEY && !process.env.GOOGLE_WORKSPACE_PRIVATE_KEY_BASE64) {
      return 'GOOGLE_WORKSPACE_PRIVATE_KEY or GOOGLE_WORKSPACE_PRIVATE_KEY_BASE64 environment variable is required'
    }
    if (!process.env.GOOGLE_WORKSPACE_ADMIN_EMAIL) {
      return 'GOOGLE_WORKSPACE_ADMIN_EMAIL environment variable is required'
    }
    return true
  }

  /**
   * Stubbed — Directory doesn't have tabular previews
   */
  async getPreview(
    _token: string,
    _config: GoogleWorkspaceConnectorConfig
  ): Promise<SourcePreview> {
    return {
      sourceId: 'google_workspace',
      title: 'Google Workspace Directory',
      tabs: [],
      preview: { tabName: '', headers: [], rows: [] },
    }
  }

  /**
   * Stubbed — Directory doesn't have tabs
   */
  async getTabs(
    _token: string,
    _config: GoogleWorkspaceConnectorConfig
  ): Promise<SourceTab[]> {
    return []
  }

  /**
   * Stubbed — Directory doesn't have raw rows
   */
  async getRawRows(
    _token: string,
    _config: GoogleWorkspaceConnectorConfig,
    _tabName: string,
    _maxRows?: number
  ): Promise<SourceRawRows> {
    return { rows: [], totalRows: 0 }
  }

  /**
   * Stubbed — Directory doesn't have structured data
   */
  async getData(
    _token: string,
    _config: GoogleWorkspaceConnectorConfig,
    _tabName: string,
    _headerRow?: number
  ): Promise<SourceData> {
    return { headers: [], rows: [] }
  }

  /**
   * Test connection to Google Workspace
   */
  async testConnection(
    _token: string,
    config: GoogleWorkspaceConnectorConfig
  ): Promise<ConnectionTestResult> {
    try {
      const domain = config.domain || process.env.GOOGLE_WORKSPACE_DOMAIN || ''
      if (!domain) {
        return {
          success: false,
          error: 'No domain configured. Set GOOGLE_WORKSPACE_DOMAIN or provide domain in config.',
        }
      }

      const info = await gwsClient.testConnection(domain)
      return {
        success: true,
        details: {
          sourceName: `Google Workspace (${info.domain})`,
          tabCount: info.userCount,
        },
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Connection failed'
      // Provide specific guidance for common errors
      if (msg.includes('Not Authorized') || msg.includes('forbidden')) {
        return {
          success: false,
          error: `Domain-wide delegation not configured or insufficient scopes. Ensure the service account has admin.directory.user.readonly scope delegated in Google Workspace Admin Console. Original error: ${msg}`,
        }
      }
      return {
        success: false,
        error: msg,
      }
    }
  }

  // ===========================================================================
  // Custom Google Workspace Methods (not part of IConnector)
  // ===========================================================================

  /**
   * List directory users from the Google API (live fetch, not snapshot).
   * Use this for sync operations that update the local snapshot.
   */
  async listDirectoryUsers(
    domain: string,
    options?: {
      includeSuspended?: boolean
      includeDeleted?: boolean
    }
  ): Promise<GoogleDirectoryUser[]> {
    return gwsClient.listUsers(domain, options)
  }

  /**
   * Get a single user by email or user ID from the Google API.
   */
  async getUserByEmail(emailOrId: string): Promise<GoogleDirectoryUser | null> {
    return gwsClient.getUser(emailOrId)
  }

  /**
   * Invalidate the directory users cache (call after sync or mapping changes)
   */
  invalidateCache(): void {
    invalidateDirectoryUsersCache()
  }
}

// Singleton instance
export const googleWorkspaceConnector = new GoogleWorkspaceConnector()
