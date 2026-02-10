/**
 * Admin Audit Logging Service
 *
 * Lightweight audit trail for admin operations: view context switches,
 * view CRUD, audience rule assignments.
 *
 * REDACTION POLICY: Entries must NEVER contain session tokens, cookies,
 * OAuth tokens, passwords, NEXTAUTH_SECRET, or full request bodies.
 * Only log: actor_id, actor_email, action type, specific relevant fields, timestamps.
 */

import { getAdminClient } from '@/lib/supabase/admin'
import { createLogger } from '@/lib/logger'

const log = createLogger('admin-audit')

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AdminAuditAction =
  // Context switches
  | 'context.switch'
  | 'context.clear'
  // View profile CRUD
  | 'view.create'
  | 'view.update'
  | 'view.delete'
  // Audience rule management
  | 'rule.create'
  | 'rule.update'
  | 'rule.delete'

export interface AdminAuditEntry {
  action: AdminAuditAction
  actorId: string
  actorEmail: string
  details: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Write an admin audit log entry.
 * Fire-and-forget: audit failures never break the parent operation.
 */
export async function logAdminAudit(entry: AdminAuditEntry): Promise<void> {
  try {
    const supabase = getAdminClient()

    const { error } = await supabase
      .from('admin_audit_log')
      .insert({
        action: entry.action,
        actor_id: entry.actorId,
        actor_email: entry.actorEmail,
        details: entry.details,
      })

    if (error) {
      log.error('Failed to write admin audit log', { action: entry.action, error: error.message })
    }
  } catch (err) {
    log.error('Admin audit log exception', { action: entry.action, error: String(err) })
  }
}

// ---------------------------------------------------------------------------
// Convenience helpers
// ---------------------------------------------------------------------------

export function logContextSwitch(
  actorId: string,
  actorEmail: string,
  subjectType: string,
  targetId: string | null,
  targetLabel: string,
): Promise<void> {
  return logAdminAudit({
    action: 'context.switch',
    actorId,
    actorEmail,
    details: {
      subject_type: subjectType,
      target_id: targetId,
      target_label: targetLabel,
    },
  })
}

export function logContextClear(
  actorId: string,
  actorEmail: string,
): Promise<void> {
  return logAdminAudit({
    action: 'context.clear',
    actorId,
    actorEmail,
    details: {},
  })
}

export function logViewChange(
  action: 'view.create' | 'view.update' | 'view.delete',
  actorId: string,
  actorEmail: string,
  viewId: string,
  viewSlug: string,
  extra?: Record<string, unknown>,
): Promise<void> {
  return logAdminAudit({
    action,
    actorId,
    actorEmail,
    details: {
      view_id: viewId,
      view_slug: viewSlug,
      ...extra,
    },
  })
}

export function logRuleChange(
  action: 'rule.create' | 'rule.update' | 'rule.delete',
  actorId: string,
  actorEmail: string,
  ruleId: string,
  viewId: string,
  extra?: Record<string, unknown>,
): Promise<void> {
  return logAdminAudit({
    action,
    actorId,
    actorEmail,
    details: {
      rule_id: ruleId,
      view_id: viewId,
      ...extra,
    },
  })
}
