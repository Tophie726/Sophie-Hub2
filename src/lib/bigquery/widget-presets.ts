/**
 * Widget Presets Library
 *
 * Pre-configured widget definitions organized by template.
 * Used by the widget config dialog to let admins quickly add common widgets.
 */

import type {
  WidgetConfig,
  MetricWidgetConfig,
  ChartWidgetConfig,
  TableWidgetConfig,
} from '@/types/modules'

export type PresetTemplate = 'executive' | 'ppc' | 'product'

export interface WidgetPreset {
  id: string
  title: string
  description: string
  template: PresetTemplate
  widget_type: 'metric' | 'chart' | 'table'
  col_span: number
  row_span: number
  config: WidgetConfig
}

// =============================================================================
// Template 1: Executive Overview
// =============================================================================

const executivePresets: WidgetPreset[] = [
  {
    id: 'exec-total-sales',
    title: 'Total Sales Revenue',
    description: 'Sum of all ordered product sales',
    template: 'executive',
    widget_type: 'metric',
    col_span: 1,
    row_span: 1,
    config: {
      view: 'sales',
      metric: 'ordered_product_sales_amount',
      aggregation: 'sum',
      format: 'currency',
    } as MetricWidgetConfig,
  },
  {
    id: 'exec-units',
    title: 'Total Units Ordered',
    description: 'Total number of units ordered',
    template: 'executive',
    widget_type: 'metric',
    col_span: 1,
    row_span: 1,
    config: {
      view: 'sales',
      metric: 'units_ordered',
      aggregation: 'sum',
      format: 'number',
    } as MetricWidgetConfig,
  },
  {
    id: 'exec-ad-spend',
    title: 'Total Ad Spend',
    description: 'Total Sponsored Products spend',
    template: 'executive',
    widget_type: 'metric',
    col_span: 1,
    row_span: 1,
    config: {
      view: 'sp',
      metric: 'ppc_spend',
      aggregation: 'sum',
      format: 'currency',
    } as MetricWidgetConfig,
  },
  {
    id: 'exec-roas',
    title: 'ROAS',
    description: 'Return on ad spend (sales / spend)',
    template: 'executive',
    widget_type: 'metric',
    col_span: 1,
    row_span: 1,
    config: {
      view: 'sp',
      metric: 'ppc_sales',
      aggregation: 'sum',
      format: 'number',
      computed: {
        formula: 'roas',
        numerator: 'ppc_sales',
        denominator: 'ppc_spend',
      },
    } as MetricWidgetConfig,
  },
  {
    id: 'exec-sales-trend',
    title: 'Sales Trend',
    description: 'Daily sales revenue over time',
    template: 'executive',
    widget_type: 'chart',
    col_span: 2,
    row_span: 1,
    config: {
      view: 'sales',
      chart_type: 'area',
      x_axis: 'date',
      y_axis: ['ordered_product_sales_amount'],
      aggregation: 'sum',
      format: 'currency',
    } as ChartWidgetConfig,
  },
  {
    id: 'exec-revenue-vs-spend',
    title: 'Revenue vs Ad Spend',
    description: 'Compare PPC revenue against spend',
    template: 'executive',
    widget_type: 'chart',
    col_span: 2,
    row_span: 1,
    config: {
      view: 'sp',
      chart_type: 'line',
      x_axis: 'date',
      y_axis: ['ppc_sales', 'ppc_spend'],
      aggregation: 'sum',
      format: 'currency',
    } as ChartWidgetConfig,
  },
]

// =============================================================================
// Template 2: PPC Performance
// =============================================================================

const ppcPresets: WidgetPreset[] = [
  {
    id: 'ppc-spend',
    title: 'SP Ad Spend',
    description: 'Total Sponsored Products ad spend',
    template: 'ppc',
    widget_type: 'metric',
    col_span: 1,
    row_span: 1,
    config: {
      view: 'sp',
      metric: 'ppc_spend',
      aggregation: 'sum',
      format: 'currency',
    } as MetricWidgetConfig,
  },
  {
    id: 'ppc-acos',
    title: 'SP ACOS',
    description: 'Advertising cost of sales percentage',
    template: 'ppc',
    widget_type: 'metric',
    col_span: 1,
    row_span: 1,
    config: {
      view: 'sp',
      metric: 'ppc_spend',
      aggregation: 'sum',
      format: 'percent',
      computed: {
        formula: 'acos',
        numerator: 'ppc_spend',
        denominator: 'ppc_sales',
        multiply: 100,
      },
    } as MetricWidgetConfig,
  },
  {
    id: 'ppc-impressions',
    title: 'SP Impressions',
    description: 'Total Sponsored Products impressions',
    template: 'ppc',
    widget_type: 'metric',
    col_span: 1,
    row_span: 1,
    config: {
      view: 'sp',
      metric: 'impressions',
      aggregation: 'sum',
      format: 'number',
    } as MetricWidgetConfig,
  },
  {
    id: 'ppc-clicks-orders',
    title: 'SP Clicks vs Orders',
    description: 'Compare click volume against orders',
    template: 'ppc',
    widget_type: 'chart',
    col_span: 2,
    row_span: 1,
    config: {
      view: 'sp',
      chart_type: 'line',
      x_axis: 'date',
      y_axis: ['clicks', 'ppc_orders'],
      aggregation: 'sum',
      format: 'number',
    } as ChartWidgetConfig,
  },
  {
    id: 'ppc-campaign-table',
    title: 'SP Campaign Breakdown',
    description: 'Campaign-level performance metrics',
    template: 'ppc',
    widget_type: 'table',
    col_span: 4,
    row_span: 2,
    config: {
      view: 'sp',
      columns: ['campaign_name', 'impressions', 'clicks', 'ppc_spend', 'ppc_sales', 'ppc_orders'],
      sort_by: 'ppc_spend',
      sort_direction: 'desc',
      limit: 20,
    } as TableWidgetConfig,
  },
  {
    id: 'ppc-sd-performance',
    title: 'SD Spend vs Sales',
    description: 'Sponsored Display spend against sales',
    template: 'ppc',
    widget_type: 'chart',
    col_span: 2,
    row_span: 1,
    config: {
      view: 'sd',
      chart_type: 'bar',
      x_axis: 'date',
      y_axis: ['ppc_spend', 'ppc_sales'],
      aggregation: 'sum',
      format: 'currency',
    } as ChartWidgetConfig,
  },
]

// =============================================================================
// Template 3: Product Analytics
// =============================================================================

const productPresets: WidgetPreset[] = [
  {
    id: 'prod-sessions',
    title: 'Sessions',
    description: 'Total product page sessions',
    template: 'product',
    widget_type: 'metric',
    col_span: 1,
    row_span: 1,
    config: {
      view: 'sales',
      metric: 'sessions',
      aggregation: 'sum',
      format: 'number',
    } as MetricWidgetConfig,
  },
  {
    id: 'prod-refund-rate',
    title: 'Refund Rate',
    description: 'Average refund rate percentage',
    template: 'product',
    widget_type: 'metric',
    col_span: 1,
    row_span: 1,
    config: {
      view: 'refunds',
      metric: 'refund_rate',
      aggregation: 'avg',
      format: 'percent',
    } as MetricWidgetConfig,
  },
  {
    id: 'prod-sessions-trend',
    title: 'Sessions Trend',
    description: 'Daily session count over time',
    template: 'product',
    widget_type: 'chart',
    col_span: 2,
    row_span: 1,
    config: {
      view: 'sales',
      chart_type: 'area',
      x_axis: 'date',
      y_axis: ['sessions'],
      aggregation: 'sum',
      format: 'number',
    } as ChartWidgetConfig,
  },
  {
    id: 'prod-refunds-chart',
    title: 'Refunds Over Time',
    description: 'Units refunded per day',
    template: 'product',
    widget_type: 'chart',
    col_span: 2,
    row_span: 1,
    config: {
      view: 'refunds',
      chart_type: 'bar',
      x_axis: 'date',
      y_axis: ['units_refunded'],
      aggregation: 'sum',
      format: 'number',
    } as ChartWidgetConfig,
  },
  {
    id: 'prod-asin-table',
    title: 'ASIN Performance',
    description: 'Per-ASIN sales and traffic breakdown',
    template: 'product',
    widget_type: 'table',
    col_span: 4,
    row_span: 2,
    config: {
      view: 'sales',
      columns: ['asin_child', 'ordered_product_sales_amount', 'units_ordered', 'sessions'],
      sort_by: 'ordered_product_sales_amount',
      sort_direction: 'desc',
      limit: 20,
    } as TableWidgetConfig,
  },
  {
    id: 'prod-match-revenue',
    title: 'Match Type Revenue',
    description: 'Revenue by keyword match type',
    template: 'product',
    widget_type: 'table',
    col_span: 4,
    row_span: 2,
    config: {
      view: 'match',
      columns: ['match_type', 'campaign_name', 'ppc_revenue'],
      sort_by: 'ppc_revenue',
      sort_direction: 'desc',
      limit: 20,
    } as TableWidgetConfig,
  },
]

// =============================================================================
// Exports
// =============================================================================

export const WIDGET_PRESETS: WidgetPreset[] = [
  ...executivePresets,
  ...ppcPresets,
  ...productPresets,
]

export const TEMPLATE_LABELS: Record<PresetTemplate, string> = {
  executive: 'Executive Overview',
  ppc: 'PPC Performance',
  product: 'Product Analytics',
}

export function getPresetsByTemplate(template: PresetTemplate): WidgetPreset[] {
  return WIDGET_PRESETS.filter((p) => p.template === template)
}

export function getPresetById(id: string): WidgetPreset | undefined {
  return WIDGET_PRESETS.find((p) => p.id === id)
}
