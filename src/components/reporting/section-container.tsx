'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Plus } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext,
  rectSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { Button } from '@/components/ui/button'
import { WidgetWrapper } from '@/components/reporting/widget-wrapper'
import { WidgetRenderer } from '@/components/reporting/widget-renderer'
import { easeInOut, duration } from '@/lib/animations'
import type { SectionWithWidgets, DashboardWidget, DateRange } from '@/types/modules'

interface SectionContainerProps {
  section: SectionWithWidgets
  dateRange: DateRange
  partnerId?: string
  isEditMode: boolean
  onAddWidget: (sectionId: string) => void
  onEditWidget: (widget: DashboardWidget) => void
  onDeleteWidget: (widgetId: string) => void
  onToggleCollapse: (sectionId: string, collapsed: boolean) => void
  onReorderWidgets: (sectionId: string, widgets: DashboardWidget[]) => void
  onResizeWidget: (widgetId: string, colSpan: number, rowSpan: number) => void
}

export function SectionContainer({
  section,
  dateRange,
  partnerId,
  isEditMode,
  onAddWidget,
  onEditWidget,
  onDeleteWidget,
  onToggleCollapse,
  onReorderWidgets,
  onResizeWidget,
}: SectionContainerProps) {
  const [isCollapsed, setIsCollapsed] = useState(section.collapsed)

  // Require some pointer movement before starting drag to avoid accidental drags
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  )

  const sortedWidgets = useMemo(
    () => [...section.widgets].sort((a, b) => a.sort_order - b.sort_order),
    [section.widgets]
  )

  const widgetIds = useMemo(
    () => sortedWidgets.map((w) => w.id),
    [sortedWidgets]
  )

  function handleToggle() {
    const newState = !isCollapsed
    setIsCollapsed(newState)
    onToggleCollapse(section.id, newState)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = sortedWidgets.findIndex((w) => w.id === active.id)
    const newIndex = sortedWidgets.findIndex((w) => w.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(sortedWidgets, oldIndex, newIndex)
    // Recalculate sort_order for all widgets
    const updated = reordered.map((w, i) => ({ ...w, sort_order: i }))
    onReorderWidgets(section.id, updated)
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
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={widgetIds}
                  strategy={rectSortingStrategy}
                >
                  <div
                    className="grid gap-4"
                    style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}
                  >
                    {sortedWidgets.map((widget) => (
                      <WidgetWrapper
                        key={widget.id}
                        widget={widget}
                        isEditMode={isEditMode}
                        onEdit={onEditWidget}
                        onDelete={onDeleteWidget}
                        onResize={onResizeWidget}
                      >
                        <WidgetRenderer
                          widget={widget}
                          dateRange={dateRange}
                          partnerId={partnerId}
                        />
                      </WidgetWrapper>
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
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
