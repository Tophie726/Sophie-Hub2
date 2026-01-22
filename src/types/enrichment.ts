// Data Enrichment Types
// Corresponds to Supabase tables in migrations/20260115_data_enrichment_mappings.sql

export type DataSourceType = 'google_sheet' | 'google_form' | 'api'
export type DataSourceStatus = 'active' | 'paused' | 'error'
export type EntityType = 'partners' | 'staff' | 'asins'
export type ColumnCategory = 'partner' | 'staff' | 'asin' | 'weekly' | 'computed' | 'skip'
export type SourceAuthority = 'source_of_truth' | 'reference'
export type SyncStatus = 'running' | 'completed' | 'failed'

// ============================================
// DATABASE TYPES (match Supabase schema)
// ============================================

export interface DataSource {
  id: string
  name: string
  type: DataSourceType
  spreadsheet_id: string | null
  spreadsheet_url: string | null
  status: DataSourceStatus
  last_synced_at: string | null
  sync_error: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface TabMapping {
  id: string
  data_source_id: string
  tab_name: string
  header_row: number
  primary_entity: EntityType
  is_active: boolean
  last_synced_at: string | null
  last_sync_row_count: number | null
  created_at: string
  updated_at: string
}

export interface ColumnMapping {
  id: string
  tab_mapping_id: string
  source_column: string
  source_column_index: number | null
  category: ColumnCategory
  target_field: string | null
  authority: SourceAuthority
  is_key: boolean
  transform_type: string
  transform_config: Record<string, unknown> | null
  created_at: string
  tags?: FieldTag[]  // Populated via join
}

// Field tags for cross-cutting domain classification
export interface FieldTag {
  id: string
  name: string
  color: string
  description?: string | null
}

export interface ColumnPatternMatchConfig {
  contains?: string[]           // Column name contains any of these (case-insensitive)
  starts_with?: string[]        // Column name starts with any of these
  matches_regex?: string        // Column name matches this regex
  matches_date?: boolean        // Column name looks like a date (e.g., 1/6, 2024-01-06)
  after_column?: string         // Only match columns after this one
}

export interface ColumnPattern {
  id: string
  tab_mapping_id: string
  pattern_name: string
  category: ColumnCategory
  match_config: ColumnPatternMatchConfig
  target_table: string | null
  target_field: string | null
  priority: number
  is_active: boolean
  created_at: string
}

export interface SyncRun {
  id: string
  data_source_id: string
  tab_mapping_id: string | null
  status: SyncStatus
  started_at: string
  completed_at: string | null
  rows_processed: number
  rows_created: number
  rows_updated: number
  rows_skipped: number
  errors: Array<{ row: number; message: string }> | null
  triggered_by: string | null
  created_at: string
}

// ============================================
// COMPUTED FIELDS TYPES
// ============================================

export type ComputationType = 'formula' | 'aggregation' | 'lookup' | 'custom'

// Config for formula-based computations (depends on other fields)
export interface FormulaConfig {
  depends_on: string[]              // Field names this depends on
  formula: string                   // Named formula to apply (e.g., 'timezone_to_current_time')
  params?: Record<string, unknown>  // Additional parameters
}

// Config for aggregation-based computations (from time-series data)
export interface AggregationConfig {
  source_table: string              // e.g., 'weekly_statuses'
  aggregation: 'latest' | 'earliest' | 'count' | 'count_distinct' | 'sum' | 'avg' | 'min' | 'max'
  field: string                     // Field to aggregate
  order_by?: string                 // For latest/earliest
  date_part?: 'day' | 'week' | 'month' | 'year'  // For count_distinct on dates
  filter?: Record<string, unknown>  // Filter conditions
}

// Config for external system lookups
export interface LookupConfig {
  source: 'zoho' | 'xero' | 'slack' | 'close' | 'amazon' | 'other'
  source_name?: string              // For 'other', human-readable name
  match_field: string               // Field to match on (e.g., 'email', 'partner_id')
  lookup_field: string              // Field to retrieve
  fallback?: unknown                // Default value if lookup fails
}

// Config for custom computations (needs manual implementation)
export interface CustomConfig {
  description: string               // Human description of the logic
  implementation_notes?: string     // Developer notes
  example_values?: string[]         // Example expected outputs
}

// Union type for computation configs
export type ComputationConfig =
  | { type: 'formula'; formula: FormulaConfig }
  | { type: 'aggregation'; aggregation: AggregationConfig }
  | { type: 'lookup'; lookup: LookupConfig }
  | { type: 'custom'; custom: CustomConfig }

// Source priority entry for hot-swapping
export interface SourcePriorityEntry {
  source: 'sheet' | 'slack' | 'zoho' | 'xero' | 'close' | 'amazon' | 'app' | 'api'
  source_ref: string                // Human-readable reference (e.g., 'Master Client Sheet → Time Zone')
  priority: number                  // Lower = higher priority
}

// Full computed field database record
export interface ComputedField {
  id: string
  target_table: EntityType
  target_field: string
  display_name: string
  computation_type: ComputationType
  config: Record<string, unknown>   // Type-specific config (FormulaConfig | AggregationConfig | etc.)
  discovered_in_source_id: string | null
  discovered_in_tab: string | null
  discovered_in_column: string | null
  source_priority: SourcePriorityEntry[]
  description: string | null
  implementation_notes: string | null
  is_implemented: boolean
  implemented_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

// ============================================
// BUILT-IN FORMULAS REGISTRY
// ============================================

export const BUILT_IN_FORMULAS = {
  timezone_to_current_time: {
    name: 'Timezone → Current Time',
    description: 'Converts a timezone string to the current local time',
    depends_on: ['timezone'],
    output_type: 'time',
  },
  days_since: {
    name: 'Days Since Date',
    description: 'Calculates days between a date field and today',
    depends_on: ['date'],
    output_type: 'number',
  },
  months_between: {
    name: 'Months Between Dates',
    description: 'Calculates months between two date fields',
    depends_on: ['start_date', 'end_date'],
    output_type: 'number',
  },
} as const

export type BuiltInFormulaKey = keyof typeof BUILT_IN_FORMULAS

// ============================================
// API REQUEST/RESPONSE TYPES
// ============================================

// Used when saving a mapping from the UI
export interface SaveMappingRequest {
  dataSource: {
    name: string
    spreadsheet_id: string
    spreadsheet_url?: string
  }
  tabMapping: {
    tab_name: string
    header_row: number
    primary_entity: EntityType
  }
  columnMappings: Array<{
    source_column: string
    source_column_index: number
    category: ColumnCategory
    target_field: string | null
    authority: SourceAuthority
    is_key: boolean
    tag_ids?: string[]  // Array of field_tag IDs
  }>
  // Pattern for weekly columns (instead of individual mappings)
  weeklyPattern?: {
    pattern_name: string
    match_config: ColumnPatternMatchConfig
  }
  // Computed fields discovered in this tab
  computedFields?: Array<{
    source_column: string
    source_column_index: number
    target_table: EntityType
    target_field: string
    display_name: string
    computation_type: ComputationType
    config: Record<string, unknown>
    description?: string
  }>
}

export interface SaveMappingResponse {
  success: boolean
  data_source_id: string
  tab_mapping_id: string
  column_mappings_count: number
  patterns_count: number
  computed_fields_count: number
}

// Used when loading existing mappings
export interface LoadMappingResponse {
  dataSource: DataSource
  tabMappings: Array<TabMapping & {
    columnMappings: ColumnMapping[]
    patterns: ColumnPattern[]
  }>
}

// ============================================
// UI TYPES (used in SmartMapper component)
// ============================================

// This matches what the SmartMapper component uses internally
export interface UIColumnClassification {
  sourceIndex: number
  sourceColumn: string
  category: ColumnCategory | null
  targetField: string | null
  authority: SourceAuthority
  isKey: boolean
  tagIds?: string[]  // Array of field_tag IDs for cross-cutting domain tags
  // For computed fields
  computedConfig?: {
    computationType: ComputationType
    targetTable: EntityType
    targetField: string
    displayName: string
    config: Record<string, unknown>
    description?: string
  }
}

// Convert UI classification to API request format
export function uiToApiMapping(
  ui: UIColumnClassification
): SaveMappingRequest['columnMappings'][0] {
  return {
    source_column: ui.sourceColumn,
    source_column_index: ui.sourceIndex,
    category: ui.category || 'skip',
    target_field: ui.targetField,
    authority: ui.authority,
    is_key: ui.isKey,
    tag_ids: ui.tagIds,
  }
}

// ============================================
// PATTERN MATCHING UTILITIES
// ============================================

/**
 * Check if a column name matches a pattern configuration
 */
export function matchesPattern(
  columnName: string,
  columnIndex: number,
  allColumns: string[],
  config: ColumnPatternMatchConfig
): boolean {
  const name = columnName.toLowerCase()

  // Check "contains" condition
  if (config.contains?.length) {
    const hasMatch = config.contains.some(term =>
      name.includes(term.toLowerCase())
    )
    if (!hasMatch) return false
  }

  // Check "starts_with" condition
  if (config.starts_with?.length) {
    const hasMatch = config.starts_with.some(prefix =>
      name.startsWith(prefix.toLowerCase())
    )
    if (!hasMatch) return false
  }

  // Check "matches_regex" condition
  if (config.matches_regex) {
    try {
      const regex = new RegExp(config.matches_regex, 'i')
      if (!regex.test(columnName)) return false
    } catch {
      // Invalid regex, skip this check
    }
  }

  // Check "matches_date" condition
  if (config.matches_date) {
    const datePatterns = [
      /^\d{1,2}\/\d{1,2}/,         // 1/6, 12/25
      /^\d{4}-\d{2}-\d{2}/,        // 2024-01-06
      /^w\d+\s/i,                   // W1 , W2
      /^week\s+\d+/i,              // Week 1, Week 2
    ]
    const isDate = datePatterns.some(p => p.test(columnName))
    if (!isDate) return false
  }

  // Check "after_column" condition
  if (config.after_column) {
    const afterIndex = allColumns.findIndex(
      c => c.toLowerCase() === config.after_column!.toLowerCase()
    )
    if (afterIndex === -1 || columnIndex <= afterIndex) return false
  }

  return true
}

/**
 * Default pattern for detecting weekly columns
 */
export const DEFAULT_WEEKLY_PATTERN: ColumnPatternMatchConfig = {
  contains: ['weekly'],
  matches_date: true,
}
