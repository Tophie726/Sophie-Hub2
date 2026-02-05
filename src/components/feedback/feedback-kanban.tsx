'use client'

import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { SortableContext, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Bug,
  Lightbulb,
  HelpCircle,
  Loader2,
  Sparkles,
  Wand2,
  Wrench,
  ImageIcon,
  Eye,
  GripVertical,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Types
type FeedbackType = 'bug' | 'feature' | 'question'
type FeedbackStatus = 'new' | 'reviewed' | 'in_progress' | 'resolved' | 'wont_fix'

interface FeedbackItem {
  id: string
  type: FeedbackType
  status: FeedbackStatus
  title: string | null
  description: string
  page_url: string | null
  posthog_session_id: string | null
  screenshot_url: string | null
  browser_info: Record<string, unknown> | null
  submitted_by_email: string
  created_at: string
  ai_summary: string | null
  ai_summary_at: string | null
  ai_analysis: AIAnalysis | null
  ai_analysis_at: string | null
  content_updated_at: string | null
}

interface AISummary {
  summary: string
}

interface AIAnalysis {
  summary: string
  likelyCause: string
  suggestedFix: string
  affectedFiles: string[]
  confidence: 'low' | 'medium' | 'high'
}

const TYPE_CONFIG: Record<FeedbackType, { icon: typeof Bug; label: string; color: string }> = {
  bug: { icon: Bug, label: 'Bug', color: 'text-red-500 bg-red-500/10' },
  feature: { icon: Lightbulb, label: 'Feature', color: 'text-amber-500 bg-amber-500/10' },
  question: { icon: HelpCircle, label: 'Question', color: 'text-blue-500 bg-blue-500/10' },
}

// Column configuration
const KANBAN_COLUMNS: Array<{
  id: FeedbackStatus
  label: string
  color: string
  bgColor: string
}> = [
  { id: 'new', label: 'New', color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
  { id: 'reviewed', label: 'To Do', color: 'text-purple-500', bgColor: 'bg-purple-500/10' },
  { id: 'in_progress', label: 'Doing', color: 'text-amber-500', bgColor: 'bg-amber-500/10' },
  { id: 'resolved', label: 'Done', color: 'text-green-500', bgColor: 'bg-green-500/10' },
]

interface KanbanBoardProps {
  feedback: FeedbackItem[]
  onView: (item: FeedbackItem) => void
  onStatusChange: (id: string, newStatus: FeedbackStatus) => Promise<void>
  aiEnabled: boolean
  summaries: Record<string, AISummary>
  analyses: Record<string, AIAnalysis>
  summarizing: Record<string, boolean>
  analyzing: Record<string, boolean>
  onSummarize: (id: string) => void
  onAnalyze: (id: string, type: FeedbackType) => void
}

export function FeedbackKanban({
  feedback,
  onView,
  onStatusChange,
  aiEnabled,
  summaries,
  analyses,
  summarizing,
  analyzing,
  onSummarize,
  onAnalyze,
}: KanbanBoardProps) {
  const [activeItem, setActiveItem] = useState<FeedbackItem | null>(null)

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 10, // Require 10px movement before drag starts
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 5,
      },
    })
  )

  // Group feedback by status
  const feedbackByStatus = useMemo(() => {
    const grouped: Record<FeedbackStatus, FeedbackItem[]> = {
      new: [],
      reviewed: [],
      in_progress: [],
      resolved: [],
      wont_fix: [],
    }
    for (const item of feedback) {
      if (grouped[item.status]) {
        grouped[item.status].push(item)
      }
    }
    return grouped
  }, [feedback])

  function handleDragStart(event: DragStartEvent) {
    const { active } = event
    const item = feedback.find((f) => f.id === active.id)
    if (item) {
      setActiveItem(item)
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveItem(null)

    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    // Check if dropped on a column
    const isOverColumn = KANBAN_COLUMNS.some((col) => col.id === overId)

    if (isOverColumn) {
      const newStatus = overId as FeedbackStatus
      const item = feedback.find((f) => f.id === activeId)

      if (item && item.status !== newStatus) {
        onStatusChange(activeId, newStatus)
      }
    }
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event
    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    // Find what column the over item belongs to
    const overItem = feedback.find((f) => f.id === overId)
    if (overItem) {
      const item = feedback.find((f) => f.id === activeId)
      if (item && item.status !== overItem.status) {
        // Item is being dragged over another item in a different column
        // We'll handle the actual status change in dragEnd
      }
    }
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
    >
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {KANBAN_COLUMNS.map((column) => (
          <KanbanColumn
            key={column.id}
            column={column}
            items={feedbackByStatus[column.id] || []}
            onView={onView}
            aiEnabled={aiEnabled}
            summaries={summaries}
            analyses={analyses}
            summarizing={summarizing}
            analyzing={analyzing}
            onSummarize={onSummarize}
            onAnalyze={onAnalyze}
          />
        ))}
      </div>

      {typeof document !== 'undefined' &&
        createPortal(
          <DragOverlay>
            {activeItem && (
              <KanbanCard
                item={activeItem}
                onView={() => {}}
                aiEnabled={false}
                isOverlay
              />
            )}
          </DragOverlay>,
          document.body
        )}
    </DndContext>
  )
}

interface KanbanColumnProps {
  column: (typeof KANBAN_COLUMNS)[number]
  items: FeedbackItem[]
  onView: (item: FeedbackItem) => void
  aiEnabled: boolean
  summaries: Record<string, AISummary>
  analyses: Record<string, AIAnalysis>
  summarizing: Record<string, boolean>
  analyzing: Record<string, boolean>
  onSummarize: (id: string) => void
  onAnalyze: (id: string, type: FeedbackType) => void
}

function KanbanColumn({
  column,
  items,
  onView,
  aiEnabled,
  summaries,
  analyses,
  summarizing,
  analyzing,
  onSummarize,
  onAnalyze,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useSortable({
    id: column.id,
    data: {
      type: 'Column',
      column,
    },
  })

  const itemIds = useMemo(() => items.map((item) => item.id), [items])

  return (
    <div ref={setNodeRef} className="flex flex-col">
      {/* Column Header */}
      <div className={cn('flex items-center gap-2 px-3 py-2 rounded-t-lg', column.bgColor)}>
        <span className={cn('font-medium text-sm', column.color)}>{column.label}</span>
        <Badge variant="outline" className={cn('text-xs', column.color)}>
          {items.length}
        </Badge>
      </div>

      {/* Column Content */}
      <div
        className={cn(
          'flex-1 bg-muted/30 rounded-b-lg p-2 space-y-2 min-h-[200px] transition-colors',
          isOver && 'bg-muted/50 ring-2 ring-primary/20'
        )}
      >
        <SortableContext items={itemIds}>
          {items.length === 0 ? (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground py-8">
              Drop items here
            </div>
          ) : (
            items.map((item) => (
              <SortableKanbanCard
                key={item.id}
                item={item}
                onView={() => onView(item)}
                aiEnabled={aiEnabled}
                summary={summaries[item.id]}
                analysis={analyses[item.id]}
                isSummarizing={summarizing[item.id]}
                isAnalyzing={analyzing[item.id]}
                onSummarize={() => onSummarize(item.id)}
                onAnalyze={() => onAnalyze(item.id, item.type)}
              />
            ))
          )}
        </SortableContext>
      </div>
    </div>
  )
}

interface SortableKanbanCardProps {
  item: FeedbackItem
  onView: () => void
  aiEnabled: boolean
  summary?: AISummary
  analysis?: AIAnalysis
  isSummarizing?: boolean
  isAnalyzing?: boolean
  onSummarize?: () => void
  onAnalyze?: () => void
}

function SortableKanbanCard({
  item,
  onView,
  aiEnabled,
  summary,
  analysis,
  isSummarizing,
  isAnalyzing,
  onSummarize,
  onAnalyze,
}: SortableKanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
    data: {
      type: 'Task',
      item,
    },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(isDragging && 'opacity-50')}
    >
      <KanbanCard
        item={item}
        onView={onView}
        aiEnabled={aiEnabled}
        summary={summary}
        analysis={analysis}
        isSummarizing={isSummarizing}
        isAnalyzing={isAnalyzing}
        onSummarize={onSummarize}
        onAnalyze={onAnalyze}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  )
}

interface KanbanCardProps {
  item: FeedbackItem
  onView: () => void
  aiEnabled: boolean
  summary?: AISummary
  analysis?: AIAnalysis
  isSummarizing?: boolean
  isAnalyzing?: boolean
  onSummarize?: () => void
  onAnalyze?: () => void
  isOverlay?: boolean
  dragHandleProps?: Record<string, unknown>
}

function KanbanCard({
  item,
  onView,
  aiEnabled,
  summary,
  analysis,
  isSummarizing,
  isAnalyzing,
  onSummarize,
  onAnalyze,
  isOverlay,
  dragHandleProps,
}: KanbanCardProps) {
  const typeConfig = TYPE_CONFIG[item.type]
  const Icon = typeConfig.icon

  return (
    <Card
      className={cn(
        'transition-shadow',
        isOverlay ? 'ring-2 ring-primary shadow-lg' : 'hover:shadow-md'
      )}
    >
      <CardContent className="p-3">
        <div className="flex items-start gap-2">
          {/* Drag Handle */}
          <button
            className="p-1 -ml-1 text-muted-foreground/50 hover:text-muted-foreground cursor-grab active:cursor-grabbing"
            {...dragHandleProps}
          >
            <GripVertical className="h-4 w-4" />
          </button>

          <div className={cn('h-6 w-6 rounded flex items-center justify-center shrink-0', typeConfig.color)}>
            <Icon className="h-3.5 w-3.5" />
          </div>

          <div className="flex-1 min-w-0">
            <button
              onClick={onView}
              className="text-left w-full"
            >
              <h4 className="text-sm font-medium line-clamp-2 hover:text-primary transition-colors">
                {item.title || item.description.slice(0, 50)}
              </h4>
            </button>
            <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
              <span className="truncate">{item.submitted_by_email.split('@')[0]}</span>
              <span>·</span>
              <span>{new Date(item.created_at).toLocaleDateString()}</span>
            </div>

            {/* Indicators */}
            <div className="flex items-center gap-1.5 mt-2">
              {item.screenshot_url && (
                <ImageIcon className="h-3 w-3 text-green-500" />
              )}
              {item.posthog_session_id && (
                <Eye className="h-3 w-3 text-purple-500" />
              )}
              {summary && (
                <Sparkles className="h-3 w-3 text-purple-500" />
              )}
              {analysis && (
                <Wrench className="h-3 w-3 text-amber-500" />
              )}
            </div>

            {/* AI Controls (compact) */}
            {aiEnabled && onSummarize && onAnalyze && (
              <div className="flex items-center gap-1 mt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); onSummarize(); }}
                  disabled={isSummarizing || !!summary}
                  className="h-6 px-2 text-[10px]"
                >
                  {isSummarizing ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Wand2 className="h-3 w-3" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); onAnalyze(); }}
                  disabled={isAnalyzing || !!analysis}
                  className="h-6 px-2 text-[10px]"
                >
                  {isAnalyzing ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Wrench className="h-3 w-3" />
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
