'use client'

import { useState } from 'react'
import { Bug, Lightbulb, HelpCircle, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { getPostHogSessionId } from '@/components/providers/posthog-provider'

type FeedbackType = 'bug' | 'feature' | 'question'

interface FeedbackModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const FEEDBACK_TYPES = [
  { value: 'bug' as const, label: 'Bug Report', icon: Bug, color: 'text-red-500' },
  { value: 'feature' as const, label: 'Feature Request', icon: Lightbulb, color: 'text-amber-500' },
  { value: 'question' as const, label: 'Question', icon: HelpCircle, color: 'text-blue-500' },
]

export function FeedbackModal({ open, onOpenChange }: FeedbackModalProps) {
  const [type, setType] = useState<FeedbackType>('bug')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!description.trim()) {
      toast.error('Please provide a description')
      return
    }

    setSubmitting(true)

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          title: title.trim() || null,
          description: description.trim(),
          page_url: window.location.href,
          posthog_session_id: getPostHogSessionId(),
          browser_info: {
            userAgent: navigator.userAgent,
            language: navigator.language,
            screenWidth: window.screen.width,
            screenHeight: window.screen.height,
          },
        }),
      })

      if (!res.ok) {
        throw new Error('Failed to submit feedback')
      }

      toast.success('Feedback submitted', {
        description: 'Thank you! We\'ll review your feedback soon.',
      })

      // Reset form
      setType('bug')
      setTitle('')
      setDescription('')
      onOpenChange(false)
    } catch (error) {
      console.error('Failed to submit feedback:', error)
      toast.error('Failed to submit feedback', {
        description: 'Please try again or contact support.',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Send Feedback</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type Selection */}
          <div className="space-y-2">
            <Label>What type of feedback?</Label>
            <div className="grid grid-cols-3 gap-2">
              {FEEDBACK_TYPES.map((ft) => {
                const Icon = ft.icon
                const isSelected = type === ft.value
                return (
                  <button
                    key={ft.value}
                    type="button"
                    onClick={() => setType(ft.value)}
                    className={cn(
                      'flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all',
                      'hover:bg-muted/50',
                      isSelected
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'border-border'
                    )}
                  >
                    <Icon className={cn('h-5 w-5', isSelected ? ft.color : 'text-muted-foreground')} />
                    <span className={cn(
                      'text-xs font-medium',
                      isSelected ? 'text-foreground' : 'text-muted-foreground'
                    )}>
                      {ft.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Title (optional) */}
          <div className="space-y-2">
            <Label htmlFor="title">
              Title <span className="text-muted-foreground text-xs">(optional)</span>
            </Label>
            <Input
              id="title"
              placeholder={
                type === 'bug' ? 'Brief description of the issue' :
                type === 'feature' ? 'Feature name or summary' :
                'Your question in brief'
              }
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">
              Description <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="description"
              placeholder={
                type === 'bug' ? 'What happened? What did you expect to happen? Steps to reproduce...' :
                type === 'feature' ? 'Describe the feature and why it would be useful...' :
                'What would you like to know?'
              }
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              required
            />
          </div>

          {/* Context info */}
          <p className="text-xs text-muted-foreground">
            We&apos;ll automatically include the current page URL and session data to help us investigate.
          </p>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Submit Feedback
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
