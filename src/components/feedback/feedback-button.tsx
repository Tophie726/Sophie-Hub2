'use client'

import { useState } from 'react'
import { MessageSquarePlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FeedbackModal } from './feedback-modal'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface FeedbackButtonProps {
  /** Compact mode for sidebar */
  compact?: boolean
  /** Custom class name */
  className?: string
}

/**
 * Feedback button that opens the feedback modal.
 * Can be used in sidebar (compact) or as standalone button.
 */
export function FeedbackButton({ compact = false, className }: FeedbackButtonProps) {
  const [open, setOpen] = useState(false)

  if (compact) {
    return (
      <>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setOpen(true)}
                className={className}
              >
                <MessageSquarePlus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>Send Feedback</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <FeedbackModal open={open} onOpenChange={setOpen} />
      </>
    )
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className={className}
      >
        <MessageSquarePlus className="h-4 w-4 mr-2" />
        Feedback
      </Button>
      <FeedbackModal open={open} onOpenChange={setOpen} />
    </>
  )
}
