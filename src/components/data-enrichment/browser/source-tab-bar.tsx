'use client'

import { useRef, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, FileSpreadsheet, X, GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface DataSource {
  id: string
  name: string
  tabCount: number
}

interface SourceTabBarProps {
  sources: DataSource[]
  activeSourceId: string | null
  onSelectSource: (sourceId: string) => void
  onAddSource: () => void
  onCloseSource?: (sourceId: string) => void
  onReorder?: (sources: DataSource[]) => void
}

const easeOut: [number, number, number, number] = [0.22, 1, 0.36, 1]

interface SortableTabProps {
  source: DataSource
  isActive: boolean
  onSelect: () => void
  onClose?: () => void
}

function SortableTab({ source, isActive, onSelect, onClose }: SortableTabProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: source.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.9 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-source-id={source.id}
      className={cn(
        'relative flex items-center gap-1 md:gap-1.5 px-2 md:px-3 py-2.5 md:py-3 text-sm font-medium transition-colors',
        'border-r border-border/50 min-w-[100px] md:min-w-[140px] max-w-[150px] md:max-w-[200px]',
        'select-none',
        isActive
          ? 'text-foreground bg-background'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted/30',
        isDragging && 'shadow-lg bg-background rounded-lg border'
      )}
    >
      {/* Drag handle */}
      <button
        className="flex-shrink-0 p-0.5 rounded hover:bg-muted cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-muted-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3 w-3" />
      </button>

      {/* Clickable content area */}
      <button
        onClick={onSelect}
        className="flex items-center gap-2 flex-1 min-w-0"
      >
        <FileSpreadsheet className={cn(
          'h-4 w-4 flex-shrink-0',
          isActive ? 'text-green-600' : 'text-muted-foreground'
        )} />
        <span className="truncate flex-1 text-left">{source.name}</span>
      </button>

      {/* Tab count badge */}
      <span className={cn(
        'flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded-full',
        isActive
          ? 'bg-green-500/10 text-green-600'
          : 'bg-muted text-muted-foreground'
      )}>
        {source.tabCount}
      </span>

      {/* Close button */}
      {onClose && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onClose()
          }}
          className="flex-shrink-0 p-0.5 rounded hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}

export function SourceTabBar({
  sources,
  activeSourceId,
  onSelectSource,
  onAddSource,
  onCloseSource,
  onReorder,
}: SourceTabBarProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 })

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Update active indicator position
  useEffect(() => {
    if (!activeSourceId || !containerRef.current) return

    const activeTab = containerRef.current.querySelector(
      `[data-source-id="${activeSourceId}"]`
    ) as HTMLElement

    if (activeTab) {
      setIndicatorStyle({
        left: activeTab.offsetLeft,
        width: activeTab.offsetWidth,
      })
    }
  }, [activeSourceId, sources])

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = sources.findIndex((s) => s.id === active.id)
      const newIndex = sources.findIndex((s) => s.id === over.id)
      const newOrder = arrayMove(sources, oldIndex, newIndex)
      onReorder?.(newOrder)
    }
  }

  return (
    <div className="relative border-b bg-muted/30">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={sources.map(s => s.id)}
          strategy={horizontalListSortingStrategy}
        >
          {/* Tab Container */}
          <div
            ref={containerRef}
            className="flex items-stretch overflow-x-auto scrollbar-hide"
          >
            {sources.map((source) => (
              <SortableTab
                key={source.id}
                source={source}
                isActive={source.id === activeSourceId}
                onSelect={() => onSelectSource(source.id)}
                onClose={onCloseSource ? () => onCloseSource(source.id) : undefined}
              />
            ))}

            {/* Add Source Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={onAddSource}
              className="h-auto px-4 py-3 rounded-none border-r border-border/50 text-muted-foreground hover:text-foreground"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </SortableContext>
      </DndContext>

      {/* Active Tab Indicator */}
      {activeSourceId && (
        <motion.div
          layoutId="activeSourceIndicator"
          initial={false}
          animate={{
            left: indicatorStyle.left,
            width: indicatorStyle.width,
          }}
          transition={{ duration: 0.2, ease: easeOut }}
          className="absolute bottom-0 h-0.5 bg-green-500"
        />
      )}
    </div>
  )
}
