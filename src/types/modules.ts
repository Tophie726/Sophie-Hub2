/**
 * Module System Types
 *
 * Shared types for the modules/dashboards/widgets system.
 * All agents import from this file to ensure type consistency.
 *
 * DB tables: modules, dashboards, dashboard_sections, dashboard_widgets
 */

// =============================================================================
// Widget Types
// =============================================================================

/** The four widget types supported by the dashboard system */
export type WidgetType = 'metric' | 'chart' | 'table' | 'text'

/** Aggregation functions available for BigQuery widgets */
export type AggregationType = 'sum' | 'avg' | 'count' | 'min' | 'max'

/** Display format for numeric values */
export type DisplayFormat = 'number' | 'currency' | 'percent' | 'compact'

/** Chart types for chart widgets */
export type ChartType = 'bar' | 'line' | 'area' | 'pie' | 'donut'

/** Sort direction for table widgets */
export type SortDirection = 'asc' | 'desc'

// =============================================================================
// Widget Config Types (stored as JSONB in dashboard_widgets.config)
// =============================================================================

/** Computed metric formula definition */
export interface ComputedMetric {
  formula: 'acos' | 'roas' | 'tacos' | 'cpc' | 'ctr' | 'cvr'
  numerator: string
  denominator: string
  multiply?: number
}

/** Config for a single-metric widget (e.g., "Total Sales: $42,000") */
export interface MetricWidgetConfig {
  view: string
  metric: string
  aggregation: AggregationType
  format: DisplayFormat
  computed?: ComputedMetric
  ppc_views?: ('sp' | 'sd' | 'sb')[]
}

/** Config for a chart widget */
export interface ChartWidgetConfig {
  view: string
  chart_type: ChartType
  x_axis: string
  y_axis: string[]
  aggregation: AggregationType
  format: DisplayFormat
  ppc_views?: ('sp' | 'sd' | 'sb')[]
}

/** Config for a data table widget */
export interface TableWidgetConfig {
  view: string
  columns: string[]
  sort_by: string
  sort_direction: SortDirection
  limit: number
  ppc_views?: ('sp' | 'sd' | 'sb')[]
}

/** Config for a static text/markdown widget */
export interface TextWidgetConfig {
  content: string
  alignment: 'left' | 'center' | 'right'
}

/** Union of all widget config types */
export type WidgetConfig =
  | MetricWidgetConfig
  | ChartWidgetConfig
  | TableWidgetConfig
  | TextWidgetConfig

// =============================================================================
// Date Range
// =============================================================================

/** Preset date range options for dashboards */
export type DateRangePreset = '7d' | '30d' | '90d' | 'custom'

/** Date range for filtering widget data */
export interface DateRange {
  preset: DateRangePreset
  start?: string // YYYY-MM-DD
  end?: string   // YYYY-MM-DD
}

// =============================================================================
// Database Row Types (match Supabase table schemas)
// =============================================================================

/** A module is a top-level grouping (e.g., "Amazon Reporting") */
export interface Module {
  id: string
  slug: string
  name: string
  description: string | null
  icon: string | null
  color: string | null
  enabled: boolean
  sort_order: number
  config: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

/** A dashboard belongs to a module and optionally to a specific partner */
export interface Dashboard {
  id: string
  module_id: string
  partner_id: string | null
  title: string
  description: string | null
  is_template: boolean
  date_range_default: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

/** A section groups widgets within a dashboard */
export interface DashboardSection {
  id: string
  dashboard_id: string
  title: string
  sort_order: number
  collapsed: boolean
  created_at: string
}

/** A widget renders data within a section */
export interface DashboardWidget {
  id: string
  dashboard_id: string
  section_id: string
  widget_type: WidgetType
  title: string
  grid_column: number
  grid_row: number
  col_span: number
  row_span: number
  sort_order: number
  config: WidgetConfig
  created_at: string
  updated_at: string
}

// =============================================================================
// Composite / Nested Types (for API responses with joined data)
// =============================================================================

/** Dashboard with its sections and widgets loaded */
export interface DashboardWithChildren extends Dashboard {
  sections: SectionWithWidgets[]
}

/** Section with its widgets loaded */
export interface SectionWithWidgets extends DashboardSection {
  widgets: DashboardWidget[]
}

/** Module with its dashboards loaded */
export interface ModuleWithDashboards extends Module {
  dashboards: Dashboard[]
}

// =============================================================================
// API Request/Response Types
// =============================================================================

/** Request body for creating a new module */
export interface CreateModuleRequest {
  slug: string
  name: string
  description?: string
  icon?: string
  color?: string
  enabled?: boolean
  sort_order?: number
  config?: Record<string, unknown>
}

/** Request body for creating a new dashboard */
export interface CreateDashboardRequest {
  module_id: string
  partner_id?: string
  title: string
  description?: string
  is_template?: boolean
  date_range_default?: string
}

/** Request body for creating a new section */
export interface CreateSectionRequest {
  dashboard_id: string
  title: string
  sort_order?: number
}

/** Request body for creating a new widget */
export interface CreateWidgetRequest {
  dashboard_id: string
  section_id: string
  widget_type: WidgetType
  title: string
  grid_column?: number
  grid_row?: number
  col_span?: number
  row_span?: number
  sort_order?: number
  config: WidgetConfig
}

/** Request body for querying BigQuery widget data */
export interface WidgetQueryRequest {
  partner_id: string
  view: string
  date_range?: DateRange
}

/** Response for a widget query */
export interface WidgetQueryResponse {
  widget_type: WidgetType
  data: WidgetQueryData
}

/** Union of widget query result shapes */
export type WidgetQueryData =
  | MetricQueryResult
  | ChartQueryResult
  | TableQueryResult

/** Result for a metric widget query */
export interface MetricQueryResult {
  value: number
  formatted: string
  comparison?: {
    previous_value: number
    change_percent: number
  }
}

/** Result for a chart widget query */
export interface ChartQueryResult {
  labels: string[]
  datasets: {
    label: string
    data: number[]
  }[]
}

/** Result for a table widget query */
export interface TableQueryResult {
  headers: string[]
  rows: string[][]
  total_rows: number
}

// =============================================================================
// View Aliases (shared between frontend and backend)
// =============================================================================

/** Map short names to full BigQuery view names */
export const VIEW_ALIASES: Record<string, string> = {
  sales: 'pbi_sellingpartner_sales_unified_latest',
  refunds: 'pbi_sellingpartner_refunds_unified_latest',
  sp: 'pbi_sp_par_unified_latest',
  sd: 'pbi_sd_par_unified_latest',
  sb: 'pbi_sb_str_unified_latest',
  products: 'pbi_dim_products_unified_latest',
  match: 'pbi_match_unified_latest',
} as const

/** All valid view alias keys */
export type ViewAlias = keyof typeof VIEW_ALIASES

/** Human-readable labels for view aliases */
export const VIEW_LABELS: Record<string, string> = {
  sales: 'Sales',
  refunds: 'Refunds',
  sp: 'Sponsored Products',
  sd: 'Sponsored Display',
  sb: 'Sponsored Brands',
  products: 'Products',
  match: 'Match Analysis',
} as const
