import posthog from 'posthog-js'

/**
 * Typed analytics events for Sophie Hub
 * Use these instead of raw posthog.capture() for type safety
 */
export const analytics = {
  // ==================
  // Sync Events
  // ==================

  syncStarted: (tabMappingId: string, entityType: string) =>
    posthog.capture('sync_started', {
      tab_mapping_id: tabMappingId,
      entity_type: entityType,
    }),

  syncCompleted: (
    tabMappingId: string,
    rowsSynced: number,
    durationMs: number
  ) =>
    posthog.capture('sync_completed', {
      tab_mapping_id: tabMappingId,
      rows_synced: rowsSynced,
      duration_ms: durationMs,
    }),

  syncFailed: (tabMappingId: string, error: string) =>
    posthog.capture('sync_failed', {
      tab_mapping_id: tabMappingId,
      error,
    }),

  // ==================
  // Mapping Events
  // ==================

  mappingSaved: (tabMappingId: string, columnsMapped: number) =>
    posthog.capture('mapping_saved', {
      tab_mapping_id: tabMappingId,
      columns_mapped: columnsMapped,
    }),

  mappingDeleted: (tabMappingId: string) =>
    posthog.capture('mapping_deleted', {
      tab_mapping_id: tabMappingId,
    }),

  // ==================
  // Change Approval Events
  // ==================

  changeApproved: (changeId: string, entityType: string) =>
    posthog.capture('change_approved', {
      change_id: changeId,
      entity_type: entityType,
    }),

  changeRejected: (changeId: string, entityType: string) =>
    posthog.capture('change_rejected', {
      change_id: changeId,
      entity_type: entityType,
    }),

  changeBulkApproved: (count: number) =>
    posthog.capture('change_bulk_approved', {
      count,
    }),

  // ==================
  // Feedback Events
  // ==================

  feedbackSubmitted: (
    type: 'bug' | 'feature' | 'question',
    hasScreenshot: boolean
  ) =>
    posthog.capture('feedback_submitted', {
      type,
      has_screenshot: hasScreenshot,
    }),

  feedbackModalOpened: () => posthog.capture('feedback_modal_opened'),

  // ==================
  // Feature Usage Events
  // ==================

  featureUsed: (feature: string, metadata?: Record<string, unknown>) =>
    posthog.capture('feature_used', {
      feature,
      ...metadata,
    }),

  // ==================
  // Navigation Events
  // ==================

  pageViewed: (pageName: string, path: string) =>
    posthog.capture('$pageview', {
      page_name: pageName,
      $current_url: path,
    }),

  // ==================
  // Search Events
  // ==================

  searchPerformed: (query: string, resultCount: number, context: string) =>
    posthog.capture('search_performed', {
      query_length: query.length,
      result_count: resultCount,
      context,
    }),

  // ==================
  // Auth Events
  // ==================

  loginAttempted: (method: string) =>
    posthog.capture('login_attempted', { method }),

  loginSucceeded: (method: string) =>
    posthog.capture('login_succeeded', { method }),

  loginFailed: (method: string, reason?: string) =>
    posthog.capture('login_failed', { method, reason }),

  logoutClicked: () => posthog.capture('logout_clicked'),
}
