'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Settings, Trash2, GripVertical } from 'lucide-react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@/components/ui/button'
import { easeOut, duration } from '@/lib/animations'
import type { DashboardWidget } from '@/types/modules'

interface WidgetWrapperProps {
  widget: DashboardWidget
  isEditMode: boolean
  onEdit: (widget: DashboardWidget) => void
  onDelete: (widgetId: string) => void
  onResize: (widgetId: string, colSpan: number, rowSpan: number) => void
  gridCellWidth?: number
  gridRowHeight?: number
  children: React.ReactNode
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

export function WidgetWrapper({
  widget,
  isEditMode,
  onEdit,
  onDelete,
  onResize,
  gridCellWidth = 200,
  gridRowHeight = 200,
  children,
}: WidgetWrapperProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [previewSize, setPreviewSize] = useState<{ cols: number; rows: number } | null>(null)

  const resizeStartRef = useRef<{
    pointerX: number
    pointerY: number
    startWidth: number
    startHeight: number
  } | null>(null)
  const widgetRef = useRef<HTMLDivElement>(null)

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: widget.id,
    disabled: !isEditMode || isResizing,
  })

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!resizeStartRef.current) return
      const { pointerX, pointerY, startWidth, startHeight } = resizeStartRef.current
      const deltaX = e.clientX - pointerX
      const deltaY = e.clientY - pointerY
      const gap = 16 // gap-4 = 16px
      const newCols = clamp(Math.round((startWidth + deltaX) / (gridCellWidth + gap)), 1, 4)
      const newRows = clamp(Math.round((startHeight + deltaY) / (gridRowHeight + gap)), 1, 3)
      setPreviewSize({ cols: newCols, rows: newRows })
    },
    [gridCellWidth, gridRowHeight]
  )

  const handlePointerUp = useCallback(
    () => {
      if (previewSize) {
        onResize(widget.id, previewSize.cols, previewSize.rows)
      }
      setIsResizing(false)
      setPreviewSize(null)
      resizeStartRef.current = null
      document.removeEventListener('pointermove', handlePointerMove)
      document.removeEventListener('pointerup', handlePointerUp)
    },
    [previewSize, widget.id, onResize, handlePointerMove]
  )

  // Store latest handlePointerUp in a ref so pointermove always sees current previewSize
  const pointerUpRef = useRef(handlePointerUp)
  pointerUpRef.current = handlePointerUp

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      e.stopPropagation()

      const el = widgetRef.current
      if (!el) return

      resizeStartRef.current = {
        pointerX: e.clientX,
        pointerY: e.clientY,
        startWidth: el.offsetWidth,
        startHeight: el.offsetHeight,
      }

      setIsResizing(true)
      setPreviewSize({ cols: widget.col_span, rows: widget.row_span })

      const onMove = (ev: PointerEvent) => handlePointerMove(ev)
      const onUp = () => {
        pointerUpRef.current()
        document.removeEventListener('pointermove', onMove)
        document.removeEventListener('pointerup', onUp)
      }

      document.addEventListener('pointermove', onMove)
      document.addEventListener('pointerup', onUp)
    },
    [handlePointerMove, widget.col_span, widget.row_span]
  )

  // Clean up listeners on unmount
  useEffect(() => {
    return () => {
      resizeStartRef.current = null
    }
  }, [])

  const displayCols = previewSize ? previewSize.cols : widget.col_span
  const displayRows = previewSize ? previewSize.rows : widget.row_span

  const style: React.CSSProperties = {
    gridColumn: `span ${displayCols}`,
    gridRow: `span ${displayRows}`,
    boxShadow: isDragging
      ? '0 8px 32px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.08)'
      : '0 0 0 1px rgba(0,0,0,0.08)',
    transform: CSS.Transform.toString(transform),
    transition: isResizing
      ? 'box-shadow 150ms cubic-bezier(0.25, 0.46, 0.45, 0.94)'
      : transition,
    zIndex: isDragging ? 50 : isResizing ? 40 : undefined,
    opacity: isDragging ? 0.9 : 1,
  }

  const showControls = isEditMode || isHovered

  return (
    <div
      ref={(node) => {
        setNodeRef(node)
        ;(widgetRef as React.MutableRefObject<HTMLDivElement | null>).current = node
      }}
      className={`relative group rounded-xl bg-card ${
        isEditMode && !isResizing ? 'ring-2 ring-primary/20 ring-dashed' : ''
      } ${isResizing ? 'ring-2 ring-primary/30' : ''} ${isDragging ? 'scale-[1.02]' : ''}`}
      style={style}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Drag handle (edit mode only) */}
      <AnimatePresence>
        {isEditMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: duration.micro, ease: easeOut }}
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            className="absolute top-2 left-2 z-10 p-1 rounded-md bg-muted/60 backdrop-blur-sm cursor-grab active:cursor-grabbing hover:bg-muted transition-colors"
            title="Drag to reorder"
          >
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit/delete controls */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: duration.micro, ease: easeOut }}
            className="absolute top-2 right-2 z-10 flex items-center gap-1"
          >
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 bg-background/80 backdrop-blur-sm hover:bg-background shadow-sm"
              onClick={() => onEdit(widget)}
              title="Edit widget"
            >
              <Settings className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 bg-background/80 backdrop-blur-sm hover:bg-destructive/10 hover:text-destructive shadow-sm"
              onClick={() => onDelete(widget.id)}
              title="Delete widget"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Resize corner handle (edit mode only) */}
      <AnimatePresence>
        {isEditMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: duration.micro, ease: easeOut }}
            className="absolute bottom-1 right-1 z-10"
          >
            <div
              onPointerDown={handlePointerDown}
              className="w-4 h-4 cursor-se-resize opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-end"
              title="Drag to resize"
            >
              {/* Three diagonal lines forming a grip pattern */}
              <svg width="10" height="10" viewBox="0 0 10 10" className="text-muted-foreground/60">
                <line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
                <line x1="9" y1="4" x2="4" y2="9" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
                <line x1="9" y1="7" x2="7" y2="9" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
              </svg>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Resize preview label */}
      <AnimatePresence>
        {isResizing && previewSize && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: duration.micro, ease: easeOut }}
            className="absolute bottom-2 right-2 z-20"
          >
            <span
              className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/90 text-primary-foreground backdrop-blur-sm"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {previewSize.cols}{'\u00D7'}{previewSize.rows}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-4">
        {children}
      </div>
    </div>
  )
}
