'use client'

import { useState } from 'react'
import { Bug, Lightbulb, HelpCircle, Clock, MessageCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { VoteButton } from './vote-button'
import { IdeaDetailModal } from './idea-detail-modal'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'

type FeedbackType = 'bug' | 'feature' | 'question'
type FeedbackStatus = 'new' | 'reviewed' | 'in_progress' | 'resolved' | 'wont_fix'

interface FeedbackItem {
  id: string
  type: FeedbackType
  status: FeedbackStatus
  title: string | null
  description: string
  vote_count: number
  has_voted: boolean
  submitted_by_email: string
  created_at: string
  screenshot_url?: string | null
}

interface IdeaCardProps {
  item: FeedbackItem
  onVoteChange?: (id: string, newCount: number, hasVoted: boolean) => void
  onStatusChange?: (id: string, newStatus: FeedbackStatus) => void
  showAuthor?: boolean
  isAdmin?: boolean
}

const TYPE_CONFIG: Record<FeedbackType, { icon: typeof Bug; label: string; color: string }> = {
  bug: { icon: Bug, label: 'Bug', color: 'text-red-500' },
  feature: { icon: Lightbulb, label: 'Feature', color: 'text-amber-500' },
  question: { icon: HelpCircle, label: 'Question', color: 'text-blue-500' },
}

const STATUS_CONFIG: Record<FeedbackStatus, { label: string; color: string }> = {
  new: { label: 'Under Review', color: 'bg-slate-500/10 text-slate-600 border-slate-500/20' },
  reviewed: { label: 'Planned', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  in_progress: { label: 'In Progress', color: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  resolved: { label: 'Shipped', color: 'bg-green-500/10 text-green-600 border-green-500/20' },
  wont_fix: { label: 'Not Planned', color: 'bg-muted text-muted-foreground border-muted' },
}

/**
 * Card component for displaying a feedback idea with voting.
 * Click to open detail modal with comments.
 */
export function IdeaCard({ item, onVoteChange, onStatusChange, showAuthor = true, isAdmin = false }: IdeaCardProps) {
  const [showDetail, setShowDetail] = useState(false)
  const typeConfig = TYPE_CONFIG[item.type]
  const statusConfig = STATUS_CONFIG[item.status]
  const TypeIcon = typeConfig.icon

  const handleVoteChange = (newCount: number, hasVoted: boolean) => {
    onVoteChange?.(item.id, newCount, hasVoted)
  }

  const timeAgo = formatDistanceToNow(new Date(item.created_at), { addSuffix: true })

  return (
    <>
      <div
        className="flex gap-3 p-4 rounded-xl border bg-card hover:shadow-md transition-shadow cursor-pointer"
        onClick={() => setShowDetail(true)}
      >
        {/* Vote Button - stop propagation so clicking doesn't open modal */}
        <div onClick={(e) => e.stopPropagation()}>
          <VoteButton
            feedbackId={item.id}
            voteCount={item.vote_count}
            hasVoted={item.has_voted}
            onVoteChange={handleVoteChange}
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title */}
          <h3 className="font-medium text-sm leading-tight mb-1 hover:text-primary transition-colors">
            {item.title || item.description.slice(0, 80)}
            {!item.title && item.description.length > 80 && '...'}
          </h3>

          {/* Description (if title exists, show truncated description) */}
          {item.title && (
            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
              {item.description}
            </p>
          )}

          {/* Meta row */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Type badge */}
            <span className={cn('flex items-center gap-1 text-xs', typeConfig.color)}>
              <TypeIcon className="h-3 w-3" />
              {typeConfig.label}
            </span>

            {/* Status badge */}
            <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', statusConfig.color)}>
              {statusConfig.label}
            </Badge>

            {/* Time */}
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {timeAgo}
            </span>

            {/* Comment indicator */}
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <MessageCircle className="h-3 w-3" />
            </span>

            {/* Author (optional) */}
            {showAuthor && (
              <span className="text-xs text-muted-foreground hidden sm:inline">
                by {item.submitted_by_email.split('@')[0]}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      <IdeaDetailModal
        idea={item}
        open={showDetail}
        onOpenChange={setShowDetail}
        onVoteChange={onVoteChange}
        onStatusChange={onStatusChange}
        isAdmin={isAdmin}
      />
    </>
  )
}
