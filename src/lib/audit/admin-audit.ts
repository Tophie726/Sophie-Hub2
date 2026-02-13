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
  // Preview session (VB21)
  | 'preview.create'
  // Module composition (VB21)
  | 'module.assign'
  | 'module.remove'
  | 'module.reorder'
  // Dashboard composition (VB30 — Wave 4)
  | 'dashboard.fork'
  | 'section.create'
  | 'section.delete'
  | 'section.reorder'
  | 'widget.create'
  | 'widget.update'
  | 'widget.delete'
  // Staff lifecycle operations
  | 'staff.bulk_update'

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

export function logStaffBulkUpdate(
  actorId: string,
  actorEmail: string,
  details: Record<string, unknown>,
): Promise<void> {
  return logAdminAudit({
    action: 'staff.bulk_update',
    actorId,
    actorEmail,
    details,
  })
}

// ---------------------------------------------------------------------------
// Preview + Module composition helpers (VB21)
// ---------------------------------------------------------------------------

export function logPreviewCreate(
  actorId: string,
  actorEmail: string,
  viewId: string,
  sessionId: string,
  subjectType: string,
  subjectTargetId: string | null,
  dataMode: string,
): Promise<void> {
  return logAdminAudit({
    action: 'preview.create',
    actorId,
    actorEmail,
    details: {
      view_id: viewId,
      session_id: sessionId,
      subject_type: subjectType,
      target_id: subjectTargetId,
      data_mode: dataMode,
    },
  })
}

export function logModuleAssign(
  actorId: string,
  actorEmail: string,
  viewId: string,
  viewSlug: string,
  moduleId: string,
): Promise<void> {
  return logAdminAudit({
    action: 'module.assign',
    actorId,
    actorEmail,
    details: {
      view_id: viewId,
      view_slug: viewSlug,
      module_id: moduleId,
    },
  })
}

export function logModuleRemove(
  actorId: string,
  actorEmail: string,
  viewId: string,
  viewSlug: string,
  moduleId: string,
): Promise<void> {
  return logAdminAudit({
    action: 'module.remove',
    actorId,
    actorEmail,
    details: {
      view_id: viewId,
      view_slug: viewSlug,
      module_id: moduleId,
    },
  })
}

export function logModuleReorder(
  actorId: string,
  actorEmail: string,
  viewId: string,
  viewSlug: string,
  order: Array<{ module_id: string; sort_order: number }>,
): Promise<void> {
  return logAdminAudit({
    action: 'module.reorder',
    actorId,
    actorEmail,
    details: {
      view_id: viewId,
      view_slug: viewSlug,
      module_reorder: order,
    },
  })
}

// ---------------------------------------------------------------------------
// Dashboard composition helpers (VB30 — Wave 4)
// ---------------------------------------------------------------------------

export function logDashboardFork(
  actorId: string,
  actorEmail: string,
  viewId: string,
  forkedDashboardId: string,
  templateDashboardId: string,
): Promise<void> {
  return logAdminAudit({
    action: 'dashboard.fork',
    actorId,
    actorEmail,
    details: {
      view_id: viewId,
      forked_dashboard_id: forkedDashboardId,
      template_dashboard_id: templateDashboardId,
    },
  })
}

export function logSectionCreate(
  actorId: string,
  actorEmail: string,
  viewId: string,
  dashboardId: string,
  sectionId: string,
): Promise<void> {
  return logAdminAudit({
    action: 'section.create',
    actorId,
    actorEmail,
    details: { view_id: viewId, dashboard_id: dashboardId, section_id: sectionId },
  })
}

export function logSectionDelete(
  actorId: string,
  actorEmail: string,
  viewId: string,
  dashboardId: string,
  sectionId: string,
): Promise<void> {
  return logAdminAudit({
    action: 'section.delete',
    actorId,
    actorEmail,
    details: { view_id: viewId, dashboard_id: dashboardId, section_id: sectionId },
  })
}

export function logSectionReorder(
  actorId: string,
  actorEmail: string,
  viewId: string,
  dashboardId: string,
  order: Array<{ id: string; sort_order: number }>,
): Promise<void> {
  return logAdminAudit({
    action: 'section.reorder',
    actorId,
    actorEmail,
    details: { view_id: viewId, dashboard_id: dashboardId, section_reorder: order },
  })
}

export function logWidgetCreate(
  actorId: string,
  actorEmail: string,
  viewId: string,
  dashboardId: string,
  widgetId: string,
): Promise<void> {
  return logAdminAudit({
    action: 'widget.create',
    actorId,
    actorEmail,
    details: { view_id: viewId, dashboard_id: dashboardId, widget_id: widgetId },
  })
}

export function logWidgetUpdate(
  actorId: string,
  actorEmail: string,
  viewId: string,
  dashboardId: string,
  widgetId: string,
): Promise<void> {
  return logAdminAudit({
    action: 'widget.update',
    actorId,
    actorEmail,
    details: { view_id: viewId, dashboard_id: dashboardId, widget_id: widgetId },
  })
}

export function logWidgetDelete(
  actorId: string,
  actorEmail: string,
  viewId: string,
  dashboardId: string,
  widgetId: string,
): Promise<void> {
  return logAdminAudit({
    action: 'widget.delete',
    actorId,
    actorEmail,
    details: { view_id: viewId, dashboard_id: dashboardId, widget_id: widgetId },
  })
}
