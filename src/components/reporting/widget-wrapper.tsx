'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Settings, Trash2, GripVertical } from 'lucide-react'
import { useDraggable } from '@dnd-kit/core'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { easeOut, duration } from '@/lib/animations'
import type { DashboardWidget } from '@/types/modules'

interface WidgetWrapperProps {
  widget: DashboardWidget
  isEditMode: boolean
  isBeingDragged?: boolean
  onEdit: (widget: DashboardWidget) => void
  onDelete: (widgetId: string) => void
  onResize: (widgetId: string, colSpan: number, rowSpan: number) => void
  gridCellWidth?: number
  gridRowHeight?: number
  previewMode?: 'desktop' | 'tablet' | 'mobile'
  children: React.ReactNode
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

export function WidgetWrapper({
  widget,
  isEditMode,
  isBeingDragged = false,
  onEdit,
  onDelete,
  onResize,
  gridCellWidth = 200,
  gridRowHeight = 200,
  previewMode = 'desktop',
  children,
}: WidgetWrapperProps) {
  const isMobilePreview = previewMode === 'mobile'
  const isDevicePreview = previewMode !== 'desktop'

  // Detect actual mobile viewport
  const [isActualMobile, setIsActualMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsActualMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

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
    setNodeRef: setDragRef,
    setActivatorNodeRef,
  } = useDraggable({
    id: widget.id,
    disabled: !isEditMode || isResizing || isDevicePreview || isActualMobile,
  })

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!resizeStartRef.current) return
      const { pointerX, pointerY, startWidth, startHeight } = resizeStartRef.current
      const deltaX = e.clientX - pointerX
      const deltaY = e.clientY - pointerY
      const gap = 12
      const newCols = clamp(Math.round((startWidth + deltaX) / (gridCellWidth + gap)), 1, 8)
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
    },
    [previewSize, widget.id, onResize]
  )

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

  // Lock cursor on body during drag or resize
  useEffect(() => {
    if (isBeingDragged) {
      document.body.style.cursor = 'grabbing'
      return () => { document.body.style.cursor = '' }
    }
    if (isResizing) {
      document.body.style.cursor = 'se-resize'
      return () => { document.body.style.cursor = '' }
    }
  }, [isBeingDragged, isResizing])

  useEffect(() => {
    return () => {
      resizeStartRef.current = null
    }
  }, [])

  const displayCols = previewSize ? previewSize.cols : widget.col_span
  const displayRows = previewSize ? previewSize.rows : widget.row_span

  const effectiveMobile = isMobilePreview || isActualMobile

  // Explicit grid placement
  const style: React.CSSProperties = effectiveMobile
    ? {
        // Mobile: 2-col grid. Small widgets (metric-sized) = 1 col, larger = span 2
        gridColumn: widget.col_span <= 4 ? 'span 1' : 'span 2',
        boxShadow: '0 0 0 1px rgba(0,0,0,0.08)',
      }
    : previewMode === 'tablet'
    ? {
        // Tablet: 4-col grid. Map 8-col spans to 4-col (halved, min 1)
        gridColumn: `span ${Math.max(1, Math.round(widget.col_span / 2))}`,
        boxShadow: '0 0 0 1px rgba(0,0,0,0.08)',
      }
    : {
        gridColumn: `${Math.max(1, widget.grid_column)} / span ${displayCols}`,
        gridRow: `${Math.max(1, widget.grid_row)} / span ${displayRows}`,
        boxShadow: isBeingDragged
          ? '0 8px 32px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.08)'
          : '0 0 0 1px rgba(0,0,0,0.08)',
        opacity: isBeingDragged ? 0.25 : 1,
        transition: isBeingDragged
          ? 'opacity 150ms ease-out'
          : isResizing
            ? 'box-shadow 150ms cubic-bezier(0.25, 0.46, 0.45, 0.94)'
            : 'opacity 150ms ease-out, box-shadow 150ms ease-out',
        zIndex: isResizing ? 40 : undefined,
      }

  const showControls = isEditMode && (isHovered || (isActualMobile && isHovered))

  // On mobile, tap toggles controls (since hover doesn't work on touch)
  const handleTap = useCallback(() => {
    if (isActualMobile && isEditMode) {
      setIsHovered(prev => !prev)
    }
  }, [isActualMobile, isEditMode])

  return (
    <div
      ref={(node) => {
        setDragRef(node)
        ;(widgetRef as React.MutableRefObject<HTMLDivElement | null>).current = node
      }}
      className={`relative group rounded-xl bg-card overflow-hidden ${
        isResizing ? 'ring-2 ring-primary/30' : ''
      }`}
      style={{
        ...style,
        borderTop: '2px solid hsl(var(--primary) / 0.2)',
      }}
      onMouseEnter={() => !isActualMobile && setIsHovered(true)}
      onMouseLeave={() => !isActualMobile && setIsHovered(false)}
      onClick={handleTap}
    >
      {/* Drag handle (edit mode only, hidden on actual mobile) */}
      <AnimatePresence>
        {isEditMode && !isBeingDragged && !isActualMobile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: duration.micro, ease: easeOut }}
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            className="absolute top-2 left-2 z-10 p-1.5 rounded-md bg-muted/60 backdrop-blur-sm cursor-grab active:cursor-grabbing hover:bg-muted transition-colors"
            style={{ touchAction: 'none' }}
            title="Drag to reposition"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit/delete controls (hover only in edit mode) */}
      <AnimatePresence>
        {showControls && !isBeingDragged && (
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

      {/* Resize corner handle (edit mode only, not during drag, hidden on actual mobile) */}
      <AnimatePresence>
        {isEditMode && !isBeingDragged && !isDevicePreview && !isActualMobile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: duration.micro, ease: easeOut }}
            className="absolute bottom-1 right-1 z-10"
          >
            <div
              onPointerDown={handlePointerDown}
              className="w-5 h-5 cursor-se-resize opacity-60 hover:opacity-100 transition-opacity flex items-end justify-end"
              title="Drag to resize"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" className="text-muted-foreground">
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

      {/* Title bar */}
      {widget.title && (
        <div className={cn("px-4 pt-3 pb-0", isEditMode && !isActualMobile && "pl-8 md:pl-8")}>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide" style={{ WebkitFontSmoothing: 'antialiased' }}>
            {widget.title}
          </p>
        </div>
      )}

      <div className="p-4 overflow-auto">
        {children}
      </div>
    </div>
  )
}
