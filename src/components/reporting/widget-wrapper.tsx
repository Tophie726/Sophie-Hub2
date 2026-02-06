'use client'

import { useState, useRef, useEffect } from 'react'
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
  children: React.ReactNode
}

function ResizePopover({
  colSpan,
  rowSpan,
  onResize,
  onClose,
}: {
  colSpan: number
  rowSpan: number
  onResize: (col: number, row: number) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: duration.micro, ease: easeOut }}
      className="absolute bottom-full right-0 mb-1 bg-popover border border-border rounded-lg shadow-lg p-2 z-20"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-3 text-xs">
        <label className="flex items-center gap-1.5">
          <span className="text-muted-foreground">W</span>
          <select
            value={colSpan}
            onChange={(e) => onResize(Number(e.target.value), rowSpan)}
            className="bg-muted/50 border border-border/60 rounded px-1.5 py-0.5 text-xs outline-none focus:ring-1 focus:ring-primary/40"
          >
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
        <span className="text-muted-foreground">x</span>
        <label className="flex items-center gap-1.5">
          <span className="text-muted-foreground">H</span>
          <select
            value={rowSpan}
            onChange={(e) => onResize(colSpan, Number(e.target.value))}
            className="bg-muted/50 border border-border/60 rounded px-1.5 py-0.5 text-xs outline-none focus:ring-1 focus:ring-primary/40"
          >
            {[1, 2, 3].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
      </div>
    </motion.div>
  )
}

export function WidgetWrapper({
  widget,
  isEditMode,
  onEdit,
  onDelete,
  onResize,
  children,
}: WidgetWrapperProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [showResizePopover, setShowResizePopover] = useState(false)

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
    disabled: !isEditMode,
  })

  const style: React.CSSProperties = {
    gridColumn: `span ${widget.col_span}`,
    gridRow: `span ${widget.row_span}`,
    boxShadow: isDragging
      ? '0 8px 32px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.08)'
      : '0 0 0 1px rgba(0,0,0,0.08)',
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.9 : 1,
  }

  const showControls = isEditMode || isHovered

  return (
    <div
      ref={setNodeRef}
      className={`relative group rounded-xl bg-card ${
        isEditMode ? 'ring-2 ring-primary/20 ring-dashed' : ''
      } ${isDragging ? 'scale-[1.02]' : ''}`}
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

      {/* Resize badge (edit mode only) */}
      <AnimatePresence>
        {isEditMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: duration.micro, ease: easeOut }}
            className="absolute bottom-2 right-2 z-10"
          >
            <button
              onClick={() => setShowResizePopover((prev) => !prev)}
              className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted/80 backdrop-blur-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title="Resize widget"
            >
              {widget.col_span}x{widget.row_span}
            </button>
            <AnimatePresence>
              {showResizePopover && (
                <ResizePopover
                  colSpan={widget.col_span}
                  rowSpan={widget.row_span}
                  onResize={(col, row) => {
                    onResize(widget.id, col, row)
                    setShowResizePopover(false)
                  }}
                  onClose={() => setShowResizePopover(false)}
                />
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-4">
        {children}
      </div>
    </div>
  )
}
