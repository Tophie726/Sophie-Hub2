/**
 * Feature flag keys used in Sophie Hub
 * Define all feature flags here for type safety and documentation
 *
 * To add a new flag:
 * 1. Create it in PostHog dashboard
 * 2. Add the key here with documentation
 * 3. Use with useFeatureFlagEnabled(FEATURE_FLAGS.YOUR_FLAG)
 */
export const FEATURE_FLAGS = {
  /**
   * Change approval workflow v2 - improved UI and bulk actions
   */
  CHANGE_APPROVAL_V2: 'change-approval-v2',

  /**
   * Enhanced AI suggestions for data mapping
   */
  AI_SUGGESTIONS_ENHANCED: 'ai-suggestions-enhanced',

  /**
   * New weekly heatmap visualization
   */
  WEEKLY_HEATMAP_V2: 'weekly-heatmap-v2',

  /**
   * Real-time sync status updates
   */
  REALTIME_SYNC_STATUS: 'realtime-sync-status',

  /**
   * Dark mode support
   */
  DARK_MODE: 'dark-mode',

  /**
   * Advanced data filtering in tables
   */
  ADVANCED_FILTERS: 'advanced-filters',
} as const

export type FeatureFlag = (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS]
