'use client'

import { Loader2, ClipboardList, Hammer, CheckCircle2 } from 'lucide-react'
import { RoadmapCard } from './roadmap-card'
import { cn } from '@/lib/utils'
import { useRoadmapQuery } from '@/lib/hooks/use-feedback-query'
import { useQueryClient } from '@tanstack/react-query'

type FeedbackStatus = 'reviewed' | 'in_progress' | 'resolved'

interface RoadmapItem {
  id: string
  type: 'bug' | 'feature' | 'question'
  status: FeedbackStatus
  title: string | null
  description: string
  vote_count: number
  has_voted: boolean
  resolved_at: string | null
  created_at: string
}

interface RoadmapColumn {
  status: FeedbackStatus
  label: string
  icon: typeof ClipboardList
  color: string
  bgColor: string
}

const COLUMNS: RoadmapColumn[] = [
  {
    status: 'reviewed',
    label: 'Planned',
    icon: ClipboardList,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
  },
  {
    status: 'in_progress',
    label: 'In Progress',
    icon: Hammer,
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
  },
  {
    status: 'resolved',
    label: 'Shipped',
    icon: CheckCircle2,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
  },
]

/**
 * Kanban-style roadmap board showing planned, in-progress, and shipped items.
 */
export function RoadmapBoard() {
  const { data: rawItems = [], isLoading: loading } = useRoadmapQuery()
  const items = rawItems as RoadmapItem[]
  const queryClient = useQueryClient()

  const handleVoteChange = (id: string, newCount: number, hasVoted: boolean) => {
    queryClient.setQueryData(['feedback', 'roadmap'], (old: RoadmapItem[] | undefined) =>
      (old || []).map(item =>
        item.id === id
          ? { ...item, vote_count: newCount, has_voted: hasVoted }
          : item
      )
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {COLUMNS.map(column => {
        const columnItems = items.filter(item => item.status === column.status)
        const Icon = column.icon

        return (
          <div key={column.status} className="flex flex-col">
            {/* Column header */}
            <div className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-t-lg border-b',
              column.bgColor
            )}>
              <Icon className={cn('h-4 w-4', column.color)} />
              <span className="font-medium text-xs md:text-sm">{column.label}</span>
              <span className="ml-auto text-xs text-muted-foreground bg-background/50 px-1.5 py-0.5 rounded">
                {columnItems.length}
              </span>
            </div>

            {/* Column content */}
            <div className="flex-1 border border-t-0 rounded-b-lg p-2 space-y-2 min-h-[80px] md:min-h-[200px] bg-muted/20">
              {columnItems.length === 0 ? (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground py-4 md:py-8">
                  {column.status === 'reviewed' && 'No planned items'}
                  {column.status === 'in_progress' && 'Nothing in progress'}
                  {column.status === 'resolved' && 'No shipped items yet'}
                </div>
              ) : (
                columnItems.map(item => (
                  <RoadmapCard
                    key={item.id}
                    item={item}
                    onVoteChange={handleVoteChange}
                  />
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
