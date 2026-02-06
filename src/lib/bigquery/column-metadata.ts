/**
 * BigQuery Column Metadata Registry
 *
 * Single source of truth for column labels, categories, and visibility.
 * Matches the entity-fields pattern from src/lib/entity-fields/.
 *
 * Used by:
 * - Widget config dropdowns (friendly labels)
 * - API route ALLOWED_COLUMNS (whitelist derivation)
 * - Table/chart headers (display labels)
 */

import type { DisplayFormat } from '@/types/modules'

// =============================================================================
// Types
// =============================================================================

export type ColumnCategory = 'metric' | 'dimension' | 'identifier' | 'temporal'

export interface ColumnMeta {
  /** Exact BigQuery column name */
  column: string
  /** Human-friendly label shown in UI */
  label: string
  /** Short description for tooltips */
  description: string
  /** Default display format */
  format: DisplayFormat
  /** Column category for grouping in selectors */
  category: ColumnCategory
  /** Where this column can appear in widget config */
  visibility: {
    /** Selectable as a metric (numeric, aggregatable) */
    metric: boolean
    /** Selectable as a dimension (group by / x-axis) */
    dimension: boolean
    /** Selectable as a table column */
    table: boolean
  }
}

export interface ViewMeta {
  columns: ColumnMeta[]
}

// =============================================================================
// Column Metadata per View (keyed by view alias)
// =============================================================================

export const COLUMN_METADATA: Record<string, ViewMeta> = {
  sales: {
    columns: [
      { column: 'client_id', label: 'Client ID', description: 'BigQuery client identifier', format: 'number', category: 'identifier', visibility: { metric: false, dimension: false, table: false } },
      { column: 'date', label: 'Date', description: 'Transaction date', format: 'number', category: 'temporal', visibility: { metric: false, dimension: true, table: true } },
      { column: 'request_time', label: 'Request Time', description: 'API request timestamp', format: 'number', category: 'temporal', visibility: { metric: false, dimension: false, table: false } },
      { column: 'asin_child', label: 'Child ASIN', description: 'Child product ASIN', format: 'number', category: 'dimension', visibility: { metric: false, dimension: true, table: true } },
      { column: 'asin_parent', label: 'Parent ASIN', description: 'Parent product ASIN', format: 'number', category: 'dimension', visibility: { metric: false, dimension: true, table: true } },
      { column: 'sessions', label: 'Sessions', description: 'Total page sessions', format: 'number', category: 'metric', visibility: { metric: true, dimension: false, table: true } },
      { column: 'sessions_b2b', label: 'B2B Sessions', description: 'Business-to-business sessions', format: 'number', category: 'metric', visibility: { metric: true, dimension: false, table: true } },
      { column: 'units_ordered', label: 'Units Ordered', description: 'Total units ordered', format: 'number', category: 'metric', visibility: { metric: true, dimension: false, table: true } },
      { column: 'units_ordered_b2b', label: 'B2B Units Ordered', description: 'Business-to-business units ordered', format: 'number', category: 'metric', visibility: { metric: true, dimension: false, table: true } },
      { column: 'ordered_product_sales_amount', label: 'Sales Revenue', description: 'Total ordered product sales', format: 'currency', category: 'metric', visibility: { metric: true, dimension: false, table: true } },
      { column: 'ordered_product_sales_b2b_amount', label: 'B2B Sales Revenue', description: 'Business-to-business sales', format: 'currency', category: 'metric', visibility: { metric: true, dimension: false, table: true } },
      { column: 'total_order_items', label: 'Order Items', description: 'Total order line items', format: 'number', category: 'metric', visibility: { metric: true, dimension: false, table: true } },
      { column: 'total_order_items_b2b', label: 'B2B Order Items', description: 'Business-to-business order items', format: 'number', category: 'metric', visibility: { metric: true, dimension: false, table: true } },
    ],
  },
  refunds: {
    columns: [
      { column: 'client_id', label: 'Client ID', description: 'BigQuery client identifier', format: 'number', category: 'identifier', visibility: { metric: false, dimension: false, table: false } },
      { column: 'date', label: 'Date', description: 'Refund date', format: 'number', category: 'temporal', visibility: { metric: false, dimension: true, table: true } },
      { column: 'request_time', label: 'Request Time', description: 'API request timestamp', format: 'number', category: 'temporal', visibility: { metric: false, dimension: false, table: false } },
      { column: 'units_refunded', label: 'Units Refunded', description: 'Number of units refunded', format: 'number', category: 'metric', visibility: { metric: true, dimension: false, table: true } },
      { column: 'refund_rate', label: 'Refund Rate', description: 'Percentage of units refunded', format: 'percent', category: 'metric', visibility: { metric: true, dimension: false, table: true } },
    ],
  },
  sp: {
    columns: [
      { column: 'client_name', label: 'Client Name', description: 'BigQuery client name', format: 'number', category: 'identifier', visibility: { metric: false, dimension: false, table: false } },
      { column: 'date', label: 'Date', description: 'Campaign date', format: 'number', category: 'temporal', visibility: { metric: false, dimension: true, table: true } },
      { column: 'request_time', label: 'Request Time', description: 'API request timestamp', format: 'number', category: 'temporal', visibility: { metric: false, dimension: false, table: false } },
      { column: 'campaign_id', label: 'Campaign ID', description: 'Campaign identifier', format: 'number', category: 'dimension', visibility: { metric: false, dimension: true, table: true } },
      { column: 'ad_id', label: 'Ad ID', description: 'Advertisement identifier', format: 'number', category: 'dimension', visibility: { metric: false, dimension: false, table: true } },
      { column: 'campaign_name', label: 'Campaign Name', description: 'Campaign display name', format: 'number', category: 'dimension', visibility: { metric: false, dimension: true, table: true } },
      { column: 'asin', label: 'ASIN', description: 'Product ASIN', format: 'number', category: 'dimension', visibility: { metric: false, dimension: true, table: true } },
      { column: 'impressions', label: 'Impressions', description: 'Number of ad impressions', format: 'number', category: 'metric', visibility: { metric: true, dimension: false, table: true } },
      { column: 'clicks', label: 'Clicks', description: 'Number of ad clicks', format: 'number', category: 'metric', visibility: { metric: true, dimension: false, table: true } },
      { column: 'ppc_spend', label: 'Ad Spend', description: 'Total advertising spend', format: 'currency', category: 'metric', visibility: { metric: true, dimension: false, table: true } },
      { column: 'ppc_sales', label: 'Ad Sales', description: 'Sales attributed to ads', format: 'currency', category: 'metric', visibility: { metric: true, dimension: false, table: true } },
      { column: 'ppc_orders', label: 'Ad Orders', description: 'Orders attributed to ads', format: 'number', category: 'metric', visibility: { metric: true, dimension: false, table: true } },
      { column: 'ppc_units', label: 'Ad Units', description: 'Units sold via ads', format: 'number', category: 'metric', visibility: { metric: true, dimension: false, table: true } },
    ],
  },
  sd: {
    columns: [
      { column: 'client_name', label: 'Client Name', description: 'BigQuery client name', format: 'number', category: 'identifier', visibility: { metric: false, dimension: false, table: false } },
      { column: 'date', label: 'Date', description: 'Campaign date', format: 'number', category: 'temporal', visibility: { metric: false, dimension: true, table: true } },
      { column: 'request_time', label: 'Request Time', description: 'API request timestamp', format: 'number', category: 'temporal', visibility: { metric: false, dimension: false, table: false } },
      { column: 'campaign_id', label: 'Campaign ID', description: 'Campaign identifier', format: 'number', category: 'dimension', visibility: { metric: false, dimension: true, table: true } },
      { column: 'ad_id', label: 'Ad ID', description: 'Advertisement identifier', format: 'number', category: 'dimension', visibility: { metric: false, dimension: false, table: true } },
      { column: 'campaign_name', label: 'Campaign Name', description: 'Campaign display name', format: 'number', category: 'dimension', visibility: { metric: false, dimension: true, table: true } },
      { column: 'asin', label: 'ASIN', description: 'Product ASIN', format: 'number', category: 'dimension', visibility: { metric: false, dimension: true, table: true } },
      { column: 'impressions', label: 'Impressions', description: 'Number of ad impressions', format: 'number', category: 'metric', visibility: { metric: true, dimension: false, table: true } },
      { column: 'clicks', label: 'Clicks', description: 'Number of ad clicks', format: 'number', category: 'metric', visibility: { metric: true, dimension: false, table: true } },
      { column: 'ppc_spend', label: 'Ad Spend', description: 'Total advertising spend', format: 'currency', category: 'metric', visibility: { metric: true, dimension: false, table: true } },
      { column: 'ppc_sales', label: 'Ad Sales', description: 'Sales attributed to ads', format: 'currency', category: 'metric', visibility: { metric: true, dimension: false, table: true } },
      { column: 'ppc_orders', label: 'Ad Orders', description: 'Orders attributed to ads', format: 'number', category: 'metric', visibility: { metric: true, dimension: false, table: true } },
      { column: 'ppc_units', label: 'Ad Units', description: 'Units sold via ads', format: 'number', category: 'metric', visibility: { metric: true, dimension: false, table: true } },
    ],
  },
  sb: {
    columns: [
      { column: 'client_id', label: 'Client ID', description: 'BigQuery client identifier', format: 'number', category: 'identifier', visibility: { metric: false, dimension: false, table: false } },
      { column: 'date', label: 'Date', description: 'Campaign date', format: 'number', category: 'temporal', visibility: { metric: false, dimension: true, table: true } },
      { column: 'request_time', label: 'Request Time', description: 'API request timestamp', format: 'number', category: 'temporal', visibility: { metric: false, dimension: false, table: false } },
      { column: 'campaign_id', label: 'Campaign ID', description: 'Campaign identifier', format: 'number', category: 'dimension', visibility: { metric: false, dimension: true, table: true } },
      { column: 'campaign_name', label: 'Campaign Name', description: 'Campaign display name', format: 'number', category: 'dimension', visibility: { metric: false, dimension: true, table: true } },
      { column: 'asin', label: 'ASIN', description: 'Product ASIN', format: 'number', category: 'dimension', visibility: { metric: false, dimension: true, table: true } },
      { column: 'impressions', label: 'Impressions', description: 'Number of ad impressions', format: 'number', category: 'metric', visibility: { metric: true, dimension: false, table: true } },
      { column: 'clicks', label: 'Clicks', description: 'Number of ad clicks', format: 'number', category: 'metric', visibility: { metric: true, dimension: false, table: true } },
      { column: 'ppc_spend', label: 'Ad Spend', description: 'Total advertising spend', format: 'currency', category: 'metric', visibility: { metric: true, dimension: false, table: true } },
      { column: 'ppc_sales', label: 'Ad Sales', description: 'Sales attributed to ads', format: 'currency', category: 'metric', visibility: { metric: true, dimension: false, table: true } },
      { column: 'ppc_orders', label: 'Ad Orders', description: 'Orders attributed to ads', format: 'number', category: 'metric', visibility: { metric: true, dimension: false, table: true } },
    ],
  },
  products: {
    columns: [
      { column: 'client_id', label: 'Client ID', description: 'BigQuery client identifier', format: 'number', category: 'identifier', visibility: { metric: false, dimension: false, table: false } },
      { column: 'asin', label: 'ASIN', description: 'Product ASIN', format: 'number', category: 'dimension', visibility: { metric: false, dimension: true, table: true } },
      { column: 'parent_asin', label: 'Parent ASIN', description: 'Parent product ASIN', format: 'number', category: 'dimension', visibility: { metric: false, dimension: true, table: true } },
      { column: 'product_name', label: 'Product Name', description: 'Product title', format: 'number', category: 'dimension', visibility: { metric: false, dimension: true, table: true } },
      { column: 'report_start_date', label: 'Report Start', description: 'Report period start date', format: 'number', category: 'temporal', visibility: { metric: false, dimension: true, table: true } },
    ],
  },
  match: {
    columns: [
      { column: 'client_name', label: 'Client Name', description: 'BigQuery client name', format: 'number', category: 'identifier', visibility: { metric: false, dimension: false, table: false } },
      { column: 'type', label: 'Report Type', description: 'Match report type', format: 'number', category: 'dimension', visibility: { metric: false, dimension: true, table: true } },
      { column: 'date', label: 'Date', description: 'Report date', format: 'number', category: 'temporal', visibility: { metric: false, dimension: true, table: true } },
      { column: 'request_time', label: 'Request Time', description: 'API request timestamp', format: 'number', category: 'temporal', visibility: { metric: false, dimension: false, table: false } },
      { column: 'campaign_id', label: 'Campaign ID', description: 'Campaign identifier', format: 'number', category: 'dimension', visibility: { metric: false, dimension: true, table: true } },
      { column: 'campaign_name', label: 'Campaign Name', description: 'Campaign display name', format: 'number', category: 'dimension', visibility: { metric: false, dimension: true, table: true } },
      { column: 'asin', label: 'ASIN', description: 'Product ASIN', format: 'number', category: 'dimension', visibility: { metric: false, dimension: true, table: true } },
      { column: 'match_type', label: 'Match Type', description: 'Keyword match type', format: 'number', category: 'dimension', visibility: { metric: false, dimension: true, table: true } },
      { column: 'ppc_revenue', label: 'PPC Revenue', description: 'Revenue from PPC', format: 'currency', category: 'metric', visibility: { metric: true, dimension: false, table: true } },
    ],
  },
}

// =============================================================================
// Helper Functions
// =============================================================================

/** Get columns selectable as metrics for a view alias */
export function getMetricColumns(viewAlias: string): ColumnMeta[] {
  return COLUMN_METADATA[viewAlias]?.columns.filter(c => c.visibility.metric) ?? []
}

/** Get columns selectable as dimensions (group by, x-axis) for a view alias */
export function getDimensionColumns(viewAlias: string): ColumnMeta[] {
  return COLUMN_METADATA[viewAlias]?.columns.filter(c => c.visibility.dimension) ?? []
}

/** Get columns selectable for table display for a view alias */
export function getTableColumns(viewAlias: string): ColumnMeta[] {
  return COLUMN_METADATA[viewAlias]?.columns.filter(c => c.visibility.table) ?? []
}

/** Get the friendly label for a column, with fallback to formatHeader-style */
export function getColumnLabel(viewAlias: string, column: string): string {
  const meta = COLUMN_METADATA[viewAlias]?.columns.find(c => c.column === column)
  if (meta) return meta.label
  // Fallback: title-case the column name
  return column.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

/** Get the default format for a column */
export function getColumnFormat(viewAlias: string, column: string): DisplayFormat {
  const meta = COLUMN_METADATA[viewAlias]?.columns.find(c => c.column === column)
  return meta?.format ?? 'number'
}

/** Get all allowed column names for a view alias (for API whitelist) */
export function getAllowedColumns(viewAlias: string): string[] {
  return COLUMN_METADATA[viewAlias]?.columns.map(c => c.column) ?? []
}
