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
} as const

// =============================================================================
// BigQuery
// =============================================================================

export const BIGQUERY = {
  /** GCP project ID */
  PROJECT_ID: 'sophie-society-reporting',
  /** Dataset containing unified views */
  DATASET: 'pbi',
  /** Default field used for partner identification */
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
