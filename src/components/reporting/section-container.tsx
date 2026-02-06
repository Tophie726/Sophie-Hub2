'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { WidgetWrapper } from '@/components/reporting/widget-wrapper'
import { WidgetRenderer } from '@/components/reporting/widget-renderer'
import { easeInOut, duration } from '@/lib/animations'
import type { SectionWithWidgets, DashboardWidget, DateRange } from '@/types/modules'

interface SectionContainerProps {
  section: SectionWithWidgets
  dateRange: DateRange
  partnerId?: string
  onAddWidget: (sectionId: string) => void
  onEditWidget: (widget: DashboardWidget) => void
  onDeleteWidget: (widgetId: string) => void
  onToggleCollapse: (sectionId: string, collapsed: boolean) => void
}

export function SectionContainer({
  section,
  dateRange,
  partnerId,
  onAddWidget,
  onEditWidget,
  onDeleteWidget,
  onToggleCollapse,
}: SectionContainerProps) {
  const [isCollapsed, setIsCollapsed] = useState(section.collapsed)

  function handleToggle() {
    const newState = !isCollapsed
    setIsCollapsed(newState)
    onToggleCollapse(section.id, newState)
  }

  return (
    <div className="space-y-3">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <button
          onClick={handleToggle}
          className="flex items-center gap-2 group"
        >
          <motion.div
            initial={false}
            animate={{ rotate: isCollapsed ? -90 : 0 }}
            transition={{ duration: duration.ui, ease: easeInOut }}
          >
            <ChevronDown className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          </motion.div>
          <h3 className="text-sm font-semibold tracking-tight group-hover:text-foreground/80 transition-colors">
            {section.title}
          </h3>
          <span className="text-xs text-muted-foreground">
            {section.widgets.length} widget{section.widgets.length !== 1 ? 's' : ''}
          </span>
        </button>

        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => onAddWidget(section.id)}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add Widget
        </Button>
      </div>

      {/* Collapsible content */}
      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: duration.ui + 0.1, ease: easeInOut }}
            style={{ overflow: 'hidden' }}
          >
            {section.widgets.length > 0 ? (
              <div
                className="grid gap-4"
                style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}
              >
                {section.widgets
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((widget) => (
                    <WidgetWrapper
                      key={widget.id}
                      widget={widget}
                      onEdit={onEditWidget}
                      onDelete={onDeleteWidget}
                    >
                      <WidgetRenderer
                        widget={widget}
                        dateRange={dateRange}
                        partnerId={partnerId}
                      />
                    </WidgetWrapper>
                  ))}
              </div>
            ) : (
              <button
                onClick={() => onAddWidget(section.id)}
                className="w-full py-8 border-2 border-dashed border-border/40 rounded-xl text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors flex flex-col items-center gap-2"
              >
                <Plus className="h-5 w-5" />
                <span className="text-sm">Add your first widget to this section</span>
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
