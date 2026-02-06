'use client'

import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Plus } from 'lucide-react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragStartEvent, DragMoveEvent } from '@dnd-kit/core'
import { Button } from '@/components/ui/button'
import { WidgetWrapper } from '@/components/reporting/widget-wrapper'
import { WidgetRenderer } from '@/components/reporting/widget-renderer'
import { GridCell } from '@/components/reporting/grid-cell'
import type { CellHighlight } from '@/components/reporting/grid-cell'
import {
  useOccupancyMap,
  pointerToCell,
  findDropPosition,
  getCellsForPlacement,
  getMaxRow,
  GRID_COLS,
} from '@/hooks/use-grid-occupancy'
import { easeInOut, duration } from '@/lib/animations'
import type { SectionWithWidgets, DashboardWidget, DateRange } from '@/types/modules'

interface SectionContainerProps {
  section: SectionWithWidgets
  dateRange: DateRange
  partnerId?: string
  isEditMode: boolean
  previewMode?: 'desktop' | 'mobile'
  onAddWidget: (sectionId: string) => void
  onEditWidget: (widget: DashboardWidget) => void
  onDeleteWidget: (widgetId: string) => void
  onToggleCollapse: (sectionId: string, collapsed: boolean) => void
  onMoveWidget: (widgetId: string, gridColumn: number, gridRow: number) => void
  onResizeWidget: (widgetId: string, colSpan: number, rowSpan: number) => void
}

export function SectionContainer({
  section,
  dateRange,
  partnerId,
  isEditMode,
  previewMode = 'desktop',
  onAddWidget,
  onEditWidget,
  onDeleteWidget,
  onToggleCollapse,
  onMoveWidget,
  onResizeWidget,
}: SectionContainerProps) {
  const [isCollapsed, setIsCollapsed] = useState(section.collapsed)
  const [gridDimensions, setGridDimensions] = useState({ cellWidth: 200, rowHeight: 200 })
  const gridRef = useRef<HTMLDivElement>(null)
  const gridRectRef = useRef<DOMRect | null>(null)

  // Drag state
  const [activeWidget, setActiveWidget] = useState<DashboardWidget | null>(null)
  const [dropTarget, setDropTarget] = useState<{ col: number; row: number } | null>(null)
  const [dropValid, setDropValid] = useState(false)

  const isMobilePreview = previewMode === 'mobile'
  const occupancyMap = useOccupancyMap(section.widgets)
  const maxRow = useMemo(() => Math.max(getMaxRow(section.widgets), 1), [section.widgets])
  // Show extra row during drag for expansion
  const totalRows = activeWidget ? maxRow + 1 : maxRow

  useEffect(() => {
    const el = gridRef.current
    if (!el) return
    const measure = () => {
      const gap = 12
      const cols = isMobilePreview ? 1 : GRID_COLS
      const cellWidth = (el.offsetWidth - gap * (cols - 1)) / cols
      const rowHeight = 180
      setGridDimensions({ cellWidth, rowHeight })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [isMobilePreview])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const widget = section.widgets.find((w) => w.id === event.active.id)
    if (!widget) return
    setActiveWidget(widget)
    // Cache grid rect for pointer-to-cell calculations
    if (gridRef.current) {
      gridRectRef.current = gridRef.current.getBoundingClientRect()
    }
  }, [section.widgets])

  const handleDragMove = useCallback((event: DragMoveEvent) => {
    if (!activeWidget || !gridRectRef.current) return

    const pointerX = (event.activatorEvent as PointerEvent).clientX + (event.delta?.x ?? 0)
    const pointerY = (event.activatorEvent as PointerEvent).clientY + (event.delta?.y ?? 0)

    const cell = pointerToCell(
      pointerX,
      pointerY,
      gridRectRef.current,
      gridDimensions.cellWidth,
      gridDimensions.rowHeight,
      12 // gap
    )

    if (!cell) {
      setDropTarget(null)
      setDropValid(false)
      return
    }

    const pos = findDropPosition(
      occupancyMap,
      cell.col,
      cell.row,
      activeWidget.col_span,
      activeWidget.row_span,
      activeWidget.id
    )

    if (pos) {
      setDropTarget(pos)
      setDropValid(true)
    } else {
      setDropTarget({ col: cell.col, row: cell.row })
      setDropValid(false)
    }
  }, [activeWidget, gridDimensions, occupancyMap])

  const handleDragEnd = useCallback(() => {
    if (activeWidget && dropTarget && dropValid) {
      onMoveWidget(activeWidget.id, dropTarget.col, dropTarget.row)
    }
    setActiveWidget(null)
    setDropTarget(null)
    setDropValid(false)
    gridRectRef.current = null
  }, [activeWidget, dropTarget, dropValid, onMoveWidget])

  const handleDragCancel = useCallback(() => {
    setActiveWidget(null)
    setDropTarget(null)
    setDropValid(false)
    gridRectRef.current = null
  }, [])

  function handleToggle() {
    const newState = !isCollapsed
    setIsCollapsed(newState)
    onToggleCollapse(section.id, newState)
  }

  // Build highlighted cells for the drop target
  const highlightedCells = useMemo(() => {
    if (!activeWidget || !dropTarget) return new Map<string, CellHighlight>()
    const cells = getCellsForPlacement(
      dropTarget.col,
      dropTarget.row,
      activeWidget.col_span,
      activeWidget.row_span
    )
    const highlight: CellHighlight = dropValid ? 'valid' : 'invalid'
    const map = new Map<string, CellHighlight>()
    for (const key of cells) {
      map.set(key, highlight)
    }
    return map
  }, [activeWidget, dropTarget, dropValid])

  // Generate grid cells to render during drag
  const gridCells = useMemo(() => {
    if (!activeWidget) return []
    const cells: { col: number; row: number; highlight: CellHighlight }[] = []
    const cols = isMobilePreview ? 1 : GRID_COLS
    for (let row = 1; row <= totalRows; row++) {
      for (let col = 1; col <= cols; col++) {
        const key = `${col},${row}`
        cells.push({
          col,
          row,
          highlight: highlightedCells.get(key) || 'none',
        })
      }
    }
    return cells
  }, [activeWidget, totalRows, highlightedCells, isMobilePreview])

  const gridStyle: React.CSSProperties = isMobilePreview
    ? {
        gridTemplateColumns: '1fr',
        gridAutoRows: 'minmax(180px, auto)',
      }
    : {
        gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
        gridTemplateRows: `repeat(${totalRows}, minmax(180px, auto))`,
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
                onDragStart={handleDragStart}
                onDragMove={handleDragMove}
                onDragEnd={handleDragEnd}
                onDragCancel={handleDragCancel}
              >
                <div
                  ref={gridRef}
                  className="grid gap-3 relative"
                  style={gridStyle}
                >
                  {/* Drop target cells (only visible during drag) */}
                  {gridCells.map((cell) => (
                    <GridCell
                      key={`cell-${cell.col}-${cell.row}`}
                      col={cell.col}
                      row={cell.row}
                      highlight={cell.highlight}
                    />
                  ))}

                  {/* Widgets */}
                  {section.widgets.map((widget) => (
                    <WidgetWrapper
                      key={widget.id}
                      widget={widget}
                      isEditMode={isEditMode && !isMobilePreview}
                      isBeingDragged={activeWidget?.id === widget.id}
                      onEdit={onEditWidget}
                      onDelete={onDeleteWidget}
                      onResize={onResizeWidget}
                      gridCellWidth={gridDimensions.cellWidth}
                      gridRowHeight={gridDimensions.rowHeight}
                      isMobilePreview={isMobilePreview}
                    >
                      <WidgetRenderer
                        widget={widget}
                        dateRange={dateRange}
                        partnerId={partnerId}
                      />
                    </WidgetWrapper>
                  ))}
                </div>

                {/* DragOverlay — floating copy that follows pointer */}
                {typeof document !== 'undefined' &&
                  createPortal(
                    <DragOverlay dropAnimation={{
                      duration: 250,
                      easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
                    }}>
                      {activeWidget ? (
                        <div
                          className="rounded-xl bg-card p-4 opacity-90"
                          style={{
                            width: gridDimensions.cellWidth * activeWidget.col_span + 16 * (activeWidget.col_span - 1),
                            boxShadow: '0 12px 40px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.08)',
                          }}
                        >
                          <WidgetRenderer
                            widget={activeWidget}
                            dateRange={dateRange}
                            partnerId={partnerId}
                          />
                        </div>
                      ) : null}
                    </DragOverlay>,
                    document.body
                  )}
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
