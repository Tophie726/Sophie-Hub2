'use client'

import { Bug, Lightbulb, HelpCircle, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { VoteButton } from './vote-button'

type FeedbackType = 'bug' | 'feature' | 'question'

interface RoadmapItem {
  id: string
  type: FeedbackType
  status: string
  title: string | null
  description: string
  vote_count: number
  has_voted: boolean
  resolved_at: string | null
  created_at: string
}

interface RoadmapCardProps {
  item: RoadmapItem
  onVoteChange?: (id: string, newCount: number, hasVoted: boolean) => void
}

const TYPE_CONFIG: Record<FeedbackType, { icon: typeof Bug; color: string }> = {
  bug: { icon: Bug, color: 'text-red-500' },
  feature: { icon: Lightbulb, color: 'text-amber-500' },
  question: { icon: HelpCircle, color: 'text-blue-500' },
}

/**
 * Compact card for roadmap items showing title and vote count.
 */
export function RoadmapCard({ item, onVoteChange }: RoadmapCardProps) {
  const typeConfig = TYPE_CONFIG[item.type]
  const TypeIcon = typeConfig.icon
  const isShipped = item.status === 'resolved'

  const handleVoteChange = (newCount: number, hasVoted: boolean) => {
    onVoteChange?.(item.id, newCount, hasVoted)
  }

  return (
    <div className="flex items-start gap-2 p-2.5 rounded-lg border bg-card hover:shadow-sm transition-shadow">
      {/* Vote button (smaller for roadmap) */}
      <VoteButton
        feedbackId={item.id}
        voteCount={item.vote_count}
        hasVoted={item.has_voted}
        onVoteChange={handleVoteChange}
        size="sm"
      />

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Type icon + title */}
        <div className="flex items-start gap-1.5">
          <TypeIcon className={cn('h-3.5 w-3.5 mt-0.5 shrink-0', typeConfig.color)} />
          <span className="text-sm font-medium leading-tight line-clamp-2">
            {item.title || item.description.slice(0, 60)}
          </span>
        </div>

        {/* Shipped date (for resolved items) */}
        {isShipped && item.resolved_at && (
          <div className="flex items-center gap-1 mt-1.5 text-xs text-green-600">
            <Calendar className="h-3 w-3" />
            {format(new Date(item.resolved_at), 'MMM d, yyyy')}
          </div>
        )}
      </div>
    </div>
  )
}
