'use client'

import type { DashboardWidget, DateRange } from '@/types/modules'
import { MetricWidget } from '@/components/reporting/widgets/metric-widget'
import { ChartWidget } from '@/components/reporting/widgets/chart-widget'
import { TableWidget } from '@/components/reporting/widgets/table-widget'
import { TextWidget } from '@/components/reporting/widgets/text-widget'

interface WidgetRendererProps {
  widget: DashboardWidget
  dateRange: DateRange
  partnerId?: string
}

/**
 * Routes a widget to the correct renderer component based on widget_type.
 */
export function WidgetRenderer({ widget, dateRange, partnerId }: WidgetRendererProps) {
  if (!partnerId) {
    return (
      <div className="flex flex-col items-center justify-center p-4 md:p-6 h-full text-center">
        <p className="text-sm text-muted-foreground">Select a partner to view data</p>
      </div>
    )
  }

  switch (widget.widget_type) {
    case 'metric':
      return (
        <MetricWidget
          config={widget.config as any}
          dateRange={dateRange}
          partnerId={partnerId}
          title={widget.title}
        />
      )
    case 'chart':
      return (
        <ChartWidget
          config={widget.config as any}
          dateRange={dateRange}
          partnerId={partnerId}
          title={widget.title}
        />
      )
    case 'table':
      return (
        <TableWidget
          config={widget.config as any}
          dateRange={dateRange}
          partnerId={partnerId}
          title={widget.title}
        />
      )
    case 'text':
      return (
        <TextWidget
          config={widget.config as any}
          dateRange={dateRange}
          partnerId={partnerId}
          title={widget.title}
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
