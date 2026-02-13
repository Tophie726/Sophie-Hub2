'use client'

import type {
  DashboardWidget,
  DateRange,
  MetricWidgetConfig,
  ChartWidgetConfig,
  TableWidgetConfig,
  TextWidgetConfig,
  AiTextWidgetConfig,
  SmartTextWidgetConfig,
  WidgetDataMode,
} from '@/types/modules'
import { MetricWidget } from '@/components/reporting/widgets/metric-widget'
import { ChartWidget } from '@/components/reporting/widgets/chart-widget'
import { TableWidget } from '@/components/reporting/widgets/table-widget'
import { TextWidget } from '@/components/reporting/widgets/text-widget'
import { AiTextWidget } from '@/components/reporting/widgets/ai-text-widget'
import { SmartTextWidget } from '@/components/reporting/widgets/smart-text-widget'

interface WidgetRendererProps {
  widget: DashboardWidget
  dateRange: DateRange
  partnerId?: string
  dataMode: WidgetDataMode
  refreshTick: number
  forceRefreshToken: number
}

/**
 * Routes a widget to the correct renderer component based on widget_type.
 */
export function WidgetRenderer({ widget, dateRange, partnerId, dataMode, refreshTick, forceRefreshToken }: WidgetRendererProps) {
  if (dataMode === 'live' && !partnerId) {
    return (
      <div className="flex flex-col items-center justify-center p-4 md:p-6 h-full text-center">
        <p className="text-sm text-muted-foreground">Select a partner to view data</p>
      </div>
    )
  }

  const resolvedPartnerId = partnerId || 'snapshot-partner'

  switch (widget.widget_type) {
    case 'metric':
      return (
        <MetricWidget
          config={widget.config as MetricWidgetConfig}
          dateRange={dateRange}
          partnerId={resolvedPartnerId}
          dataMode={dataMode}
          refreshTick={refreshTick}
          forceRefreshToken={forceRefreshToken}
        />
      )
    case 'chart':
      return (
        <ChartWidget
          config={widget.config as ChartWidgetConfig}
          dateRange={dateRange}
          partnerId={resolvedPartnerId}
          dataMode={dataMode}
          refreshTick={refreshTick}
          forceRefreshToken={forceRefreshToken}
        />
      )
    case 'table':
      return (
        <TableWidget
          config={widget.config as TableWidgetConfig}
          dateRange={dateRange}
          partnerId={resolvedPartnerId}
          dataMode={dataMode}
          refreshTick={refreshTick}
          forceRefreshToken={forceRefreshToken}
        />
      )
    case 'text':
      return (
        <TextWidget
          config={widget.config as TextWidgetConfig}
          dateRange={dateRange}
          partnerId={resolvedPartnerId}
          dataMode={dataMode}
          refreshTick={refreshTick}
          forceRefreshToken={forceRefreshToken}
        />
      )
    case 'ai_text':
      return (
        <AiTextWidget
          config={widget.config as AiTextWidgetConfig}
          dateRange={dateRange}
          partnerId={resolvedPartnerId}
          dataMode={dataMode}
          refreshTick={refreshTick}
          forceRefreshToken={forceRefreshToken}
        />
      )
    case 'smart_text':
      return (
        <SmartTextWidget
          config={widget.config as SmartTextWidgetConfig}
          title={widget.title}
          dateRange={dateRange}
          partnerId={resolvedPartnerId}
          dataMode={dataMode}
          refreshTick={refreshTick}
          forceRefreshToken={forceRefreshToken}
        />
      )
    default:
      return (
        <div className="text-sm text-muted-foreground p-4">
          Unknown widget type: {widget.widget_type}
        </div>
      )
  }
}
