'use client'

/* eslint-disable @next/next/no-img-element */

import { useState, useRef, useEffect } from 'react'
import { Loader2, Camera, Upload, X, Edit2 } from 'lucide-react'
import { AnimatedBugIcon, AnimatedLightbulbIcon, AnimatedQuestionIcon } from './animated-icons'
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
import { analytics } from '@/lib/posthog'
import { ScreenshotEditor } from './screenshot-editor'

type FeedbackType = 'bug' | 'feature' | 'question'

interface FeedbackModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Pre-captured screenshot URL (captured before modal opens) */
  preScreenshot?: string | null
}

const FEEDBACK_TYPES = [
  { value: 'bug' as const, label: 'Bug Report', AnimatedIcon: AnimatedBugIcon, color: 'text-red-500' },
  { value: 'feature' as const, label: 'Feature Request', AnimatedIcon: AnimatedLightbulbIcon, color: 'text-amber-500' },
  { value: 'question' as const, label: 'Question', AnimatedIcon: AnimatedQuestionIcon, color: 'text-blue-500' },
]

export function FeedbackModal({ open, onOpenChange, preScreenshot }: FeedbackModalProps) {
  const [type, setType] = useState<FeedbackType>('bug')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [screenshot, setScreenshot] = useState<string | null>(null)
  const [capturingScreenshot, setCapturingScreenshot] = useState(false)
  const [showEditor, setShowEditor] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Set pre-captured screenshot when modal opens
  useEffect(() => {
    if (open && preScreenshot) {
      setScreenshot(preScreenshot)
    }
    // Track modal open
    if (open) {
      analytics.feedbackModalOpened()
    }
  }, [open, preScreenshot])

  const captureScreenshot = async () => {
    setCapturingScreenshot(true)
    try {
      // Dynamically import html2canvas to avoid SSR issues
      const html2canvas = (await import('html2canvas')).default

      // Hide ONLY the feedback modal and its overlay
      const feedbackModal = document.querySelector('[data-feedback-modal="true"]') as HTMLElement
      const feedbackOverlay = feedbackModal?.previousElementSibling as HTMLElement

      if (feedbackModal) feedbackModal.style.visibility = 'hidden'
      if (feedbackOverlay && feedbackOverlay.getAttribute('data-state') === 'open') {
        feedbackOverlay.style.visibility = 'hidden'
      }

      // Small delay to ensure modal is hidden
      await new Promise(resolve => setTimeout(resolve, 100))

      // Get the actual viewport dimensions
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight

      // Find the main content element or use documentElement
      const targetElement = document.documentElement

      // Capture at exact viewport dimensions
      const canvas = await html2canvas(targetElement, {
        useCORS: true,
        allowTaint: true,
        scale: window.devicePixelRatio || 2, // Use device pixel ratio for crisp capture
        logging: false,
        width: viewportWidth,
        height: viewportHeight,
        windowWidth: viewportWidth,
        windowHeight: viewportHeight,
        x: window.scrollX,
        y: window.scrollY,
        scrollX: -window.scrollX,
        scrollY: -window.scrollY,
        ignoreElements: (element) => {
          // Ignore the feedback modal and overlay
          return element.getAttribute('data-feedback-modal') === 'true' ||
                 element.getAttribute('data-feedback-overlay') === 'true'
        },
      })

      // Show modal again
      if (feedbackModal) feedbackModal.style.visibility = ''
      if (feedbackOverlay) feedbackOverlay.style.visibility = ''

      // Convert to base64 with high quality
      const dataUrl = canvas.toDataURL('image/png')
      setScreenshot(dataUrl)
      toast.success('Screenshot captured')
    } catch (error) {
      console.error('Failed to capture screenshot:', error)
      toast.error('Failed to capture screenshot')
    } finally {
      setCapturingScreenshot(false)
    }
  }

  const handleEditorSave = (editedImageUrl: string) => {
    setScreenshot(editedImageUrl)
    setShowEditor(false)
    toast.success('Screenshot saved')
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      setScreenshot(event.target?.result as string)
      toast.success('Screenshot uploaded')
    }
    reader.readAsDataURL(file)
  }

  const removeScreenshot = () => {
    setScreenshot(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

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
          screenshot_data: screenshot, // base64 image data
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

      const json = await res.json()
      const feedbackId = json.data?.feedback?.id

      // Track successful submission
      analytics.feedbackSubmitted(type, !!screenshot)

      toast.success('Feedback submitted', {
        description: 'Thank you! We\'ll review your feedback soon.',
        action: feedbackId ? {
          label: 'View',
          onClick: () => window.location.href = `/feedback?id=${feedbackId}`,
        } : undefined,
      })

      // Reset form
      setType('bug')
      setTitle('')
      setDescription('')
      setScreenshot(null)
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
      <DialogContent
        className={cn(
          'sm:max-w-[500px]',
          showEditor && 'sm:max-w-[95vw] md:max-w-[1200px] h-[90vh]'
        )}
        data-feedback-modal="true"
      >
        <DialogHeader>
          <DialogTitle>Send Feedback</DialogTitle>
        </DialogHeader>

        {showEditor && screenshot ? (
          <ScreenshotEditor
            imageUrl={screenshot}
            onSave={handleEditorSave}
            onCancel={() => setShowEditor(false)}
          />
        ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type Selection */}
          <div className="space-y-2">
            <Label>What type of feedback?</Label>
            <div className="grid grid-cols-3 gap-2">
              {FEEDBACK_TYPES.map((ft) => {
                const AnimatedIcon = ft.AnimatedIcon
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
                    <AnimatedIcon
                      className={cn(isSelected ? ft.color : 'text-muted-foreground')}
                      animate={isSelected}
                    />
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

          {/* Screenshot */}
          <div className="space-y-2">
            <Label>Screenshot <span className="text-muted-foreground text-xs">(optional - helps us understand the issue)</span></Label>

            {screenshot ? (
              <div className="relative rounded-lg border bg-muted/30 p-2 group">
                {/* Larger preview with scroll */}
                <div className="overflow-auto max-h-64 rounded">
                  <img
                    src={screenshot}
                    alt="Screenshot preview"
                    className="w-full object-contain rounded cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => setShowEditor(true)}
                    title="Click to annotate"
                  />
                </div>
                {/* Action buttons */}
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => setShowEditor(true)}
                    className="p-1.5 rounded-full bg-background/90 hover:bg-background border shadow-sm"
                    title="Annotate screenshot"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={removeScreenshot}
                    className="p-1.5 rounded-full bg-background/90 hover:bg-background border shadow-sm"
                    title="Remove screenshot"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Click image to annotate with highlights, circles, or text
                </p>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={captureScreenshot}
                  disabled={capturingScreenshot}
                  className="flex-1"
                >
                  {capturingScreenshot ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Camera className="h-4 w-4 mr-2" />
                  )}
                  Snapshot Page
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Image
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            )}
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
        )}
      </DialogContent>
    </Dialog>
  )
}
