'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Settings, Trash2, GripVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { easeOut, duration } from '@/lib/animations'
import type { DashboardWidget } from '@/types/modules'

interface WidgetWrapperProps {
  widget: DashboardWidget
  onEdit: (widget: DashboardWidget) => void
  onDelete: (widgetId: string) => void
  children: React.ReactNode
}

export function WidgetWrapper({ widget, onEdit, onDelete, children }: WidgetWrapperProps) {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <div
      className="relative group rounded-xl bg-card"
      style={{
        gridColumn: `span ${widget.col_span}`,
        gridRow: `span ${widget.row_span}`,
        boxShadow: '0 0 0 1px rgba(0,0,0,0.08)',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <AnimatePresence>
        {isHovered && (
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

      <div className="p-4">
        {children}
      </div>
    </div>
  )
}
