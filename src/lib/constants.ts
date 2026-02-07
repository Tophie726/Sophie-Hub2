/**
 * Centralized Constants
 *
 * All magic values used across Sophie Hub, grouped by domain.
 * Import from here instead of using inline literals.
 */

// =============================================================================
// Cache TTLs (milliseconds)
// =============================================================================

export const CACHE = {
  /** General navigation/data cache (5 min) */
  DEFAULT_TTL: 5 * 60 * 1000,
  /** BigQuery client names cache (10 min) - BQ queries are expensive */
  BIGQUERY_TTL: 10 * 60 * 1000,
  /** Status color mappings cache (5 min) */
  STATUS_COLORS_TTL: 5 * 60 * 1000,
  /** Rate limiter stale entry cleanup (10 min) */
  RATE_LIMIT_CLEANUP: 10 * 60 * 1000,
  /** Usage dashboard cache (1 hour) - aggregated stats change slowly */
  USAGE_TTL: 60 * 60 * 1000,
  /** Slack users/channels cache (5 min) */
  SLACK_TTL: 5 * 60 * 1000,
  /** Google Workspace directory cache (10 min) - directory changes infrequently */
  GOOGLE_WORKSPACE_TTL: 10 * 60 * 1000,
} as const

// =============================================================================
// BigQuery
// =============================================================================

export const BIGQUERY = {
  /** GCP project ID */
  PROJECT_ID: 'sophie-society-reporting',
  /** Dataset containing unified views */
  DATASET: 'pbi',
  /** Default field used for partner identification (varies by view: client_id or client_name) */
  PARTNER_FIELD: 'client_name',
  /** Unified view names exposed to the app */
  VIEWS: {
    SPONSORED_PRODUCTS: 'pbi_sp_par_unified_latest',
    SPONSORED_DISPLAY: 'pbi_sd_par_unified_latest',
    SPONSORED_BRANDS: 'pbi_sb_str_unified_latest',
    SALES: 'pbi_sellingpartner_sales_unified_latest',
    REFUNDS: 'pbi_sellingpartner_refunds_unified_latest',
    PRODUCTS: 'pbi_dim_products_unified_latest',
    MATCH: 'pbi_match_unified_latest',
  },
} as const

/** Ordered list of all BigQuery unified views */
export const BIGQUERY_UNIFIED_VIEWS = Object.values(BIGQUERY.VIEWS)

// =============================================================================
// Slack
// =============================================================================

export const SLACK = {
  /** Minimum delay between Slack API calls (ms) */
  RATE_LIMIT_DELAY: 1200,
  /** Messages per page for conversations.history */
  PAGE_SIZE: 200,
  /** Channel prefixes to skip during auto-match (internal channels) */
  INTERNAL_PREFIXES: ['team-', 'ops-', 'admin-', 'int-', 'internal-', 'eng-', 'hr-', 'general'],
} as const

// =============================================================================
// Sync Engine
// =============================================================================

export const SYNC = {
  /** Number of records per Supabase batch lookup */
  LOOKUP_CHUNK_SIZE: 500,
  /** Number of records per upsert batch */
  UPSERT_BATCH_SIZE: 50,
  /** Log progress every N rows during sync */
  PROGRESS_LOG_INTERVAL: 500,
} as const

// =============================================================================
// API Defaults
// =============================================================================

export const API = {
  /** Default audit log query limit */
  AUDIT_LOG_LIMIT: 50,
  /** Default resource audit log limit */
  RESOURCE_AUDIT_LIMIT: 20,
} as const

// =============================================================================
// AI / Codebase Context
// =============================================================================

export const AI = {
  /** Max file size to include in AI context (50KB) */
  MAX_FILE_SIZE: 50_000,
  /** Max total context payload size (100KB) */
  MAX_TOTAL_CONTEXT: 100_000,
  /** Max files returned from a search */
  SEARCH_FILE_LIMIT: 5,
} as const
