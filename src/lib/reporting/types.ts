/**
 * Widget-specific types for the reporting renderer components.
 *
 * These extend the shared types in src/types/modules.ts with
 * props and internal state used only by the widget renderers.
 */

import type {
  DateRange,
  MetricWidgetConfig,
  ChartWidgetConfig,
  TableWidgetConfig,
  TextWidgetConfig,
  AiTextWidgetConfig,
} from '@/types/modules'

// =============================================================================
// Widget Props (passed to each renderer)
// =============================================================================

/** Common props shared by all widget renderers */
export interface BaseWidgetProps {
  dateRange: DateRange
  partnerId: string
  title?: string
}

export interface MetricWidgetProps extends BaseWidgetProps {
  config: MetricWidgetConfig
}

export interface ChartWidgetProps extends BaseWidgetProps {
  config: ChartWidgetConfig
  /** Height in pixels, calculated from row_span */
  height?: number
}

export interface TableWidgetProps extends BaseWidgetProps {
  config: TableWidgetConfig
}

export interface TextWidgetProps extends BaseWidgetProps {
  config: TextWidgetConfig
}

export interface AiTextWidgetProps extends BaseWidgetProps {
  config: AiTextWidgetConfig
}

// =============================================================================
// Chart internals
// =============================================================================

/** Chart color palette, CSS-variable-aware for dark mode */
export const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(210, 100%, 56%)',
  'hsl(152, 69%, 41%)',
  'hsl(38, 92%, 50%)',
  'hsl(280, 67%, 54%)',
] as const

/** Trend direction for metric widgets */
export type TrendDirection = 'up' | 'down' | 'flat'
