/**
 * Audit Logging Service
 *
 * Provides a centralized way to log all data enrichment actions
 * for security, compliance, and debugging purposes.
 */

import { getAdminClient } from '@/lib/supabase/admin'
import { createLogger } from '@/lib/logger'
import { API } from '@/lib/constants'

const log = createLogger('audit')

// =============================================================================
// Types
// =============================================================================

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'sync_start'
  | 'sync_complete'
  | 'sync_fail'
  | 'mapping_save'
  | 'mapping_publish'
  | 'import'
  | 'export'

export type AuditResourceType =
  | 'data_source'
  | 'tab_mapping'
  | 'column_mapping'
  | 'column_pattern'
  | 'computed_field'
  | 'sync_run'
  | 'field_lineage'

export interface AuditChange {
  [field: string]: {
    old: unknown
    new: unknown
  }
}

export interface AuditMetadata {
  rows_affected?: number
  rows_created?: number
  rows_updated?: number
  rows_skipped?: number
  dry_run?: boolean
  duration_ms?: number
  error_message?: string
  sync_run_id?: string
  [key: string]: unknown
}

export interface AuditEntry {
  userId?: string
  userEmail?: string
  action: AuditAction
  resourceType: AuditResourceType
  resourceId?: string
  resourceName?: string
  changes?: AuditChange
  metadata?: AuditMetadata
  ipAddress?: string
  userAgent?: string
}

// =============================================================================
// Audit Service
// =============================================================================

class AuditService {
  private supabase = getAdminClient()

  /**
   * Log an audit entry
   */
  async log(entry: AuditEntry): Promise<string | null> {
    try {
      const { data, error } = await this.supabase
        .from('mapping_audit_log')
        .insert({
          user_id: entry.userId || null,
          user_email: entry.userEmail || null,
          action: entry.action,
          resource_type: entry.resourceType,
          resource_id: entry.resourceId || null,
          resource_name: entry.resourceName || null,
          changes: entry.changes || null,
          metadata: entry.metadata || null,
          ip_address: entry.ipAddress || null,
          user_agent: entry.userAgent || null,
        })
        .select('id')
        .single()

      if (error) {
        // Log to console but don't throw - audit failures shouldn't break operations
        log.error('Audit log error', error)
        return null
      }

      return data.id
    } catch (error) {
      log.error('Audit log exception', error)
      return null
    }
  }

  /**
   * Log a data source action
   */
  async logDataSource(
    action: 'create' | 'update' | 'delete',
    dataSourceId: string,
    dataSourceName: string,
    userId?: string,
    userEmail?: string,
    changes?: AuditChange
  ): Promise<string | null> {
    return this.log({
      userId,
      userEmail,
      action,
      resourceType: 'data_source',
      resourceId: dataSourceId,
      resourceName: dataSourceName,
      changes,
    })
  }

  /**
   * Log a sync operation
   */
  async logSync(
    action: 'sync_start' | 'sync_complete' | 'sync_fail',
    syncRunId: string,
    dataSourceName: string,
    userId?: string,
    userEmail?: string,
    metadata?: AuditMetadata
  ): Promise<string | null> {
    return this.log({
      userId,
      userEmail,
      action,
      resourceType: 'sync_run',
      resourceId: syncRunId,
      resourceName: dataSourceName,
      metadata,
    })
  }

  /**
   * Log a mapping save
   */
  async logMappingSave(
    tabMappingId: string,
    tabName: string,
    userId?: string,
    userEmail?: string,
    metadata?: AuditMetadata
  ): Promise<string | null> {
    return this.log({
      userId,
      userEmail,
      action: 'mapping_save',
      resourceType: 'tab_mapping',
      resourceId: tabMappingId,
      resourceName: tabName,
      metadata,
    })
  }

  /**
   * Get recent audit logs
   */
  async getRecent(
    limit: number = API.AUDIT_LOG_LIMIT,
    filters?: {
      action?: AuditAction
      resourceType?: AuditResourceType
      resourceId?: string
      userId?: string
    }
  ) {
    let query = this.supabase
      .from('mapping_audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (filters?.action) {
      query = query.eq('action', filters.action)
    }
    if (filters?.resourceType) {
      query = query.eq('resource_type', filters.resourceType)
    }
    if (filters?.resourceId) {
      query = query.eq('resource_id', filters.resourceId)
    }
    if (filters?.userId) {
      query = query.eq('user_id', filters.userId)
    }

    const { data, error } = await query

    if (error) {
      log.error('Error fetching audit logs', error)
      return []
    }

    return data
  }

  /**
   * Get audit logs for a specific resource
   */
  async getForResource(
    resourceType: AuditResourceType,
    resourceId: string,
    limit: number = API.RESOURCE_AUDIT_LIMIT
  ) {
    return this.getRecent(limit, { resourceType, resourceId })
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

let auditInstance: AuditService | null = null

export function getAuditService(): AuditService {
  if (!auditInstance) {
    auditInstance = new AuditService()
  }
  return auditInstance
}

// Convenience export for direct logging
export const audit = {
  log: (entry: AuditEntry) => getAuditService().log(entry),
  logDataSource: (...args: Parameters<AuditService['logDataSource']>) =>
    getAuditService().logDataSource(...args),
  logSync: (...args: Parameters<AuditService['logSync']>) =>
    getAuditService().logSync(...args),
  logMappingSave: (...args: Parameters<AuditService['logMappingSave']>) =>
    getAuditService().logMappingSave(...args),
  getRecent: (...args: Parameters<AuditService['getRecent']>) =>
    getAuditService().getRecent(...args),
  getForResource: (...args: Parameters<AuditService['getForResource']>) =>
    getAuditService().getForResource(...args),
}
