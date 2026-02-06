'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronUp, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { springPop } from '@/lib/animations'

interface VoteButtonProps {
  feedbackId: string
  voteCount: number
  hasVoted: boolean
  onVoteChange?: (newCount: number, hasVoted: boolean) => void
  size?: 'sm' | 'md'
}

/**
 * Upvote button for feedback items.
 * Shows vote count and toggles vote on click.
 */
export function VoteButton({
  feedbackId,
  voteCount,
  hasVoted,
  onVoteChange,
  size = 'md',
}: VoteButtonProps) {
  const [isVoted, setIsVoted] = useState(hasVoted)
  const [count, setCount] = useState(voteCount)
  const [loading, setLoading] = useState(false)

  const handleVote = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (loading) return

    setLoading(true)
    const wasVoted = isVoted

    // Optimistic update
    setIsVoted(!wasVoted)
    setCount(prev => wasVoted ? prev - 1 : prev + 1)

    try {
      const res = await fetch(`/api/feedback/${feedbackId}/vote`, {
        method: wasVoted ? 'DELETE' : 'POST',
      })

      if (!res.ok) {
        // Revert on error
        setIsVoted(wasVoted)
        setCount(prev => wasVoted ? prev + 1 : prev - 1)

        const json = await res.json()
        if (json.error?.message) {
          toast.error(json.error.message)
        } else {
          toast.error('Failed to update vote')
        }
        return
      }

      const json = await res.json()
      const newCount = json.data?.vote_count ?? count
      setCount(newCount)
      onVoteChange?.(newCount, !wasVoted)
    } catch {
      // Revert on error
      setIsVoted(wasVoted)
      setCount(prev => wasVoted ? prev + 1 : prev - 1)
      toast.error('Failed to update vote')
    } finally {
      setLoading(false)
    }
  }

  const sizeClasses = size === 'sm'
    ? 'w-12 h-14 text-xs'
    : 'w-12 md:w-14 h-16 text-sm'

  const iconSize = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'

  return (
    <button
      onClick={handleVote}
      disabled={loading}
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border transition-all',
        'hover:border-primary/50 active:scale-95',
        sizeClasses,
        isVoted
          ? 'bg-primary/10 border-primary/30 text-primary'
          : 'bg-muted/30 border-border text-muted-foreground hover:text-foreground'
      )}
      aria-label={isVoted ? 'Remove vote' : 'Vote for this idea'}
    >
      {loading ? (
        <Loader2 className={cn(iconSize, 'animate-spin')} />
      ) : (
        <ChevronUp className={cn(iconSize, isVoted && 'text-primary')} />
      )}
      <motion.span
        key={count}
        initial={{ scale: 1.3, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={springPop}
        className="font-semibold tabular-nums"
      >
        {count}
      </motion.span>
    </button>
  )
}
