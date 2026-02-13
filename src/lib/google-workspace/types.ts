/**
 * Google Workspace Directory Types
 *
 * Types for the Admin SDK Directory API responses and internal models.
 */

// =============================================================================
// Directory API User
// =============================================================================

/**
 * Google Workspace directory user (from Admin SDK Directory API)
 */
export interface GoogleDirectoryUser {
  /** Immutable Google user ID */
  id: string
  /** Primary email address */
  primaryEmail: string
  /** Full name object */
  name: {
    givenName: string
    familyName: string
    fullName: string
  }
  /** Org unit path (e.g., "/Staff/Engineering") */
  orgUnitPath?: string
  /** Whether account is suspended */
  suspended: boolean
  /** Whether the user has been deleted */
  isAdmin: boolean
  /** User's job title (from directory) */
  title?: string
  /** User's phone numbers */
  phones?: Array<{
    value: string
    type: string
    primary?: boolean
  }>
  /** User's email aliases */
  aliases?: string[]
  /** Non-editable aliases (auto-generated) */
  nonEditableAliases?: string[]
  /** Photo URL (thumbnail, ~96px) */
  thumbnailPhotoUrl?: string
  /** Account creation time (ISO string) */
  creationTime?: string
  /** Last login time (ISO string) */
  lastLoginTime?: string
  /** Whether this is a delegated admin */
  isDelegatedAdmin?: boolean
  /** Department from directory organization block */
  department?: string
  /** Cost center from directory organization block */
  costCenter?: string
  /** Office/location from directory organization block */
  location?: string
  /** Manager email if present in relations */
  managerEmail?: string
  /** Raw API payload for no-data-loss capture */
  rawProfile?: Record<string, unknown>
}

// =============================================================================
// Local Snapshot (DB-backed)
// =============================================================================

/**
 * Row from google_workspace_directory_snapshot table
 */
export interface DirectorySnapshotRow {
  id: string
  google_user_id: string
  primary_email: string
  full_name: string | null
  given_name: string | null
  family_name: string | null
  org_unit_path: string | null
  is_suspended: boolean
  is_deleted: boolean
  is_admin: boolean
  is_delegated_admin: boolean
  title: string | null
  phone: string | null
  thumbnail_photo_url: string | null
  aliases: string[]
  non_editable_aliases: string[]
  creation_time: string | null
  last_login_time: string | null
  department: string | null
  cost_center: string | null
  location: string | null
  manager_email: string | null
  account_type_override: 'person' | 'shared_account' | null
  raw_profile: Record<string, unknown> | null
  last_seen_at: string
  first_seen_at: string
  created_at: string
  updated_at: string
}

// =============================================================================
// Auto-Match Types
// =============================================================================

/**
 * Summary of auto-match results for staff <-> Google Workspace users
 */
export interface GWSStaffAutoMatchSummary {
  /** Total staff records in DB */
  total_staff: number
  /** Total Google directory users considered */
  total_google_users: number
  /** Number of auto-created mappings (primary email match) */
  matched: number
  /** Suggested alias matches requiring admin confirmation */
  suggested_alias_matches: Array<{
    google_user_id: string
    google_email: string
    alias_email: string
    staff_id: string
    staff_name: string
    staff_email: string
  }>
  /** Staff without any match */
  unmatched_staff: Array<{ id: string; name: string; email: string }>
  /** Google users without any match */
  unmatched_google_users: Array<{ id: string; email: string; name: string }>
}

// =============================================================================
// Enrichment Types
// =============================================================================

/**
 * Summary of staff enrichment from Google Workspace directory
 */
export interface GWSEnrichmentSummary {
  /** Number of staff records enriched */
  enriched: number
  /** Number of mapped staff skipped (e.g., suspended, no data) */
  skipped: number
  /** Total staff-Google mappings evaluated */
  total_mappings: number
  /** Per-field update counts */
  fields_updated: {
    title: number
    phone: number
    avatar_url: number
  }
  /** Number of staff rows where directory snapshot metadata was refreshed */
  source_snapshot_updates: number
  /** Fields selected for this enrichment run */
  selected_fields: Array<'avatar_url' | 'title' | 'phone' | 'directory_snapshot'>
  /** Avatar source strategy used during this enrichment run */
  avatar_source?: 'slack_then_google' | 'google_workspace'
}

// =============================================================================
// Sync / Drift Types
// =============================================================================

/**
 * Drift event detected during directory sync
 */
export interface DirectoryDriftEvent {
  type: 'new_user' | 'user_deleted' | 'user_suspended' | 'user_reinstated' | 'email_changed'
  google_user_id: string
  email: string
  name: string
  details?: string
}

/**
 * Result of a directory sync run
 */
export interface DirectorySyncResult {
  /** Whether the sync completed successfully */
  success: boolean
  /** Number of users in the directory pull */
  total_pulled: number
  /** Number of snapshot rows upserted */
  upserted: number
  /** Number of users tombstoned (is_deleted = true) */
  tombstoned: number
  /** Drift events detected */
  drift_events: DirectoryDriftEvent[]
  /** Error message if sync failed */
  error?: string
  /** Timestamp of sync completion */
  completed_at: string
}
