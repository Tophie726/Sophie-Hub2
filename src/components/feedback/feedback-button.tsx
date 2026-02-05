'use client'

import { useState, useCallback } from 'react'
import { MessageSquarePlus, Loader2 } from 'lucide-react'
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
 * Feedback button that captures a screenshot of the current page state
 * BEFORE opening the modal, preserving any open dropdowns/menus.
 */
export function FeedbackButton({ compact = false, className }: FeedbackButtonProps) {
  const [open, setOpen] = useState(false)
  const [preScreenshot, setPreScreenshot] = useState<string | null>(null)
  const [capturing, setCapturing] = useState(false)

  // Capture screenshot before opening modal to preserve current page state
  const handleClick = useCallback(async () => {
    setCapturing(true)
    try {
      // Dynamically import html2canvas
      const html2canvas = (await import('html2canvas')).default

      // Capture the page AS-IS (including open dropdowns, popovers, etc.)
      // Using scale 1.0 for better quality when annotating
      const canvas = await html2canvas(document.body, {
        useCORS: true,
        allowTaint: true,
        scale: 1, // Full resolution for annotation
        logging: false,
      })

      const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
      setPreScreenshot(dataUrl)
    } catch (error) {
      console.error('Failed to capture screenshot:', error)
      // Still open modal even if screenshot fails
      setPreScreenshot(null)
    } finally {
      setCapturing(false)
      setOpen(true)
    }
  }, [])

  // Clear screenshot when modal closes
  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    if (!newOpen) {
      // Clear screenshot after a delay to allow for smooth close animation
      setTimeout(() => setPreScreenshot(null), 300)
    }
  }

  if (compact) {
    return (
      <>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClick}
                disabled={capturing}
                className={className}
              >
                {capturing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MessageSquarePlus className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>{capturing ? 'Capturing...' : 'Send Feedback'}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <FeedbackModal
          open={open}
          onOpenChange={handleOpenChange}
          preScreenshot={preScreenshot}
        />
      </>
    )
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleClick}
        disabled={capturing}
        className={className}
      >
        {capturing ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <MessageSquarePlus className="h-4 w-4 mr-2" />
        )}
        {capturing ? 'Capturing...' : 'Feedback'}
      </Button>
      <FeedbackModal
        open={open}
        onOpenChange={handleOpenChange}
        preScreenshot={preScreenshot}
      />
    </>
  )
}
