'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Bug,
  Lightbulb,
  HelpCircle,
  Loader2,
  Send,
  Clock,
  User,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { VoteButton } from './vote-button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
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

interface Comment {
  id: string
  user_email: string
  content: string
  is_from_submitter: boolean
  created_at: string
}

interface IdeaDetailModalProps {
  idea: FeedbackItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onVoteChange?: (id: string, newCount: number, hasVoted: boolean) => void
  onStatusChange?: (id: string, newStatus: FeedbackStatus) => void
  isAdmin?: boolean
}

const TYPE_CONFIG: Record<FeedbackType, { icon: typeof Bug; label: string; color: string }> = {
  bug: { icon: Bug, label: 'Bug', color: 'text-red-500 bg-red-500/10' },
  feature: { icon: Lightbulb, label: 'Feature', color: 'text-amber-500 bg-amber-500/10' },
  question: { icon: HelpCircle, label: 'Question', color: 'text-blue-500 bg-blue-500/10' },
}

const STATUS_CONFIG: Record<FeedbackStatus, { label: string; color: string }> = {
  new: { label: 'Under Review', color: 'bg-slate-500/10 text-slate-600 border-slate-500/20' },
  reviewed: { label: 'Planned', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  in_progress: { label: 'In Progress', color: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  resolved: { label: 'Shipped', color: 'bg-green-500/10 text-green-600 border-green-500/20' },
  wont_fix: { label: 'Not Planned', color: 'bg-muted text-muted-foreground border-muted' },
}

const ADMIN_STATUS_OPTIONS: FeedbackStatus[] = ['new', 'reviewed', 'in_progress', 'resolved', 'wont_fix']

export function IdeaDetailModal({
  idea,
  open,
  onOpenChange,
  onVoteChange,
  onStatusChange,
  isAdmin = false,
}: IdeaDetailModalProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loadingComments, setLoadingComments] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const commentsEndRef = useRef<HTMLDivElement>(null)

  // Fetch comments when modal opens
  useEffect(() => {
    if (open && idea) {
      fetchComments()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, idea?.id])

  // Scroll to bottom when new comments are added
  useEffect(() => {
    if (comments.length > 0) {
      commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [comments.length])

  const fetchComments = async () => {
    if (!idea) return
    setLoadingComments(true)
    try {
      const res = await fetch(`/api/feedback/${idea.id}/comments`)
      if (!res.ok) throw new Error('Failed to fetch comments')
      const json = await res.json()
      setComments(json.data?.comments || [])
    } catch (error) {
      console.error('Failed to fetch comments:', error)
      toast.error('Failed to load comments')
    } finally {
      setLoadingComments(false)
    }
  }

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!idea || !newComment.trim()) return

    setSubmittingComment(true)
    try {
      const res = await fetch(`/api/feedback/${idea.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newComment.trim() }),
      })

      if (!res.ok) throw new Error('Failed to add comment')

      const json = await res.json()
      setComments(prev => [...prev, json.data.comment])
      setNewComment('')
      toast.success('Comment added')
    } catch (error) {
      console.error('Failed to add comment:', error)
      toast.error('Failed to add comment')
    } finally {
      setSubmittingComment(false)
    }
  }

  const handleStatusChange = async (newStatus: FeedbackStatus) => {
    if (!idea || !onStatusChange) return

    setUpdatingStatus(true)
    try {
      const res = await fetch(`/api/feedback/${idea.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!res.ok) throw new Error('Failed to update status')

      onStatusChange(idea.id, newStatus)
      toast.success(`Status changed to ${STATUS_CONFIG[newStatus].label}`)
    } catch (error) {
      console.error('Failed to update status:', error)
      toast.error('Failed to update status')
    } finally {
      setUpdatingStatus(false)
    }
  }

  const handleVoteChange = (newCount: number, hasVoted: boolean) => {
    if (idea && onVoteChange) {
      onVoteChange(idea.id, newCount, hasVoted)
    }
  }

  if (!idea) return null

  const typeConfig = TYPE_CONFIG[idea.type]
  const statusConfig = STATUS_CONFIG[idea.status]
  const TypeIcon = typeConfig.icon
  const timeAgo = formatDistanceToNow(new Date(idea.created_at), { addSuffix: true })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
        <DialogHeader className="space-y-3 pb-4 border-b">
          {/* Type badge and vote */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center', typeConfig.color)}>
                <TypeIcon className="h-5 w-5" />
              </div>
              <VoteButton
                feedbackId={idea.id}
                voteCount={idea.vote_count}
                hasVoted={idea.has_voted}
                onVoteChange={handleVoteChange}
              />
            </div>
            <Badge variant="outline" className={cn('text-xs', statusConfig.color)}>
              {statusConfig.label}
            </Badge>
          </div>

          {/* Title */}
          <DialogTitle className="text-lg">
            {idea.title || idea.description.slice(0, 60)}
          </DialogTitle>

          {/* Meta */}
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <User className="h-3.5 w-3.5" />
              {idea.submitted_by_email.split('@')[0]}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {timeAgo}
            </span>
          </div>

          {/* Admin status controls */}
          {isAdmin && (
            <div className="flex items-center gap-2 pt-2">
              <span className="text-xs text-muted-foreground mr-1">Set status:</span>
              {ADMIN_STATUS_OPTIONS.map(status => (
                <button
                  key={status}
                  onClick={() => handleStatusChange(status)}
                  disabled={updatingStatus || idea.status === status}
                  className={cn(
                    'text-xs px-2 py-1 rounded-md border transition-colors',
                    idea.status === status
                      ? STATUS_CONFIG[status].color
                      : 'bg-muted/50 hover:bg-muted text-muted-foreground'
                  )}
                >
                  {STATUS_CONFIG[status].label}
                </button>
              ))}
            </div>
          )}
        </DialogHeader>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {/* Description */}
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <p className="whitespace-pre-wrap">{idea.description}</p>
          </div>

          {/* Screenshot */}
          {idea.screenshot_url && (
            <div className="rounded-lg border overflow-hidden">
              <img
                src={idea.screenshot_url}
                alt="Screenshot"
                className="w-full max-h-64 object-contain bg-muted/30"
              />
            </div>
          )}

          {/* Comments section */}
          <div className="space-y-3 pt-4 border-t">
            <h4 className="text-sm font-medium flex items-center gap-2">
              Discussion
              <Badge variant="secondary" className="text-xs">
                {comments.length}
              </Badge>
            </h4>

            {loadingComments ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : comments.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No comments yet. Be the first to add context or feedback!
              </p>
            ) : (
              <div className="space-y-3">
                {comments.map(comment => (
                  <div
                    key={comment.id}
                    className={cn(
                      'p-3 rounded-lg text-sm',
                      comment.is_from_submitter
                        ? 'bg-primary/5 border border-primary/20'
                        : 'bg-muted/50'
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="font-medium text-xs">
                        {comment.user_email.split('@')[0]}
                      </span>
                      {comment.is_from_submitter && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          Author
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground ml-auto">
                        {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap">{comment.content}</p>
                  </div>
                ))}
                <div ref={commentsEndRef} />
              </div>
            )}
          </div>
        </div>

        {/* Add comment form */}
        <form onSubmit={handleSubmitComment} className="flex gap-2 pt-4 border-t">
          <Textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add context, feedback, or questions..."
            rows={2}
            className="flex-1 min-h-0 resize-none"
          />
          <Button
            type="submit"
            size="sm"
            disabled={submittingComment || !newComment.trim()}
            className="self-end"
          >
            {submittingComment ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
