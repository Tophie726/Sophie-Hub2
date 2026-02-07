'use client'

/* eslint-disable @next/next/no-img-element */

import { useState, useRef, useEffect } from 'react'
import { Lightbulb, Loader2, Upload, X, Edit2 } from 'lucide-react'
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
import { toast } from 'sonner'
import { getPostHogSessionId } from '@/components/providers/posthog-provider'
import { ScreenshotEditor } from './screenshot-editor'
import { cn } from '@/lib/utils'

interface SubmitIdeaModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  initialTitle?: string
  initialDescription?: string
}

/**
 * Simplified modal for submitting feature ideas only.
 * Used in the Feedback Center (Ideas tab) - no bug/question options.
 * Supports optional image upload (no auto-screenshot since this is Ideas, not bugs).
 */
export function SubmitIdeaModal({
  open,
  onOpenChange,
  onSuccess,
  initialTitle,
  initialDescription,
}: SubmitIdeaModalProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [screenshot, setScreenshot] = useState<string | null>(null)
  const [showEditor, setShowEditor] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    if (initialTitle) setTitle(initialTitle)
    if (initialDescription) setDescription(initialDescription)
  }, [open, initialTitle, initialDescription])

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
      toast.success('Image uploaded')
    }
    reader.readAsDataURL(file)
  }

  const removeScreenshot = () => {
    setScreenshot(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleEditorSave = (editedImageUrl: string) => {
    setScreenshot(editedImageUrl)
    setShowEditor(false)
    toast.success('Image saved')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!description.trim()) {
      toast.error('Please describe your idea')
      return
    }

    setSubmitting(true)

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'feature', // Always feature for ideas
          title: title.trim() || null,
          description: description.trim(),
          page_url: window.location.href,
          posthog_session_id: getPostHogSessionId(),
          screenshot_data: screenshot,
          browser_info: {
            userAgent: navigator.userAgent,
            language: navigator.language,
            screenWidth: window.screen.width,
            screenHeight: window.screen.height,
          },
        }),
      })

      if (!res.ok) {
        throw new Error('Failed to submit idea')
      }

      toast.success('Idea submitted', {
        description: 'Thanks for sharing! Others can now vote on your idea.',
      })

      // Reset form
      setTitle('')
      setDescription('')
      setScreenshot(null)
      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      console.error('Failed to submit idea:', error)
      toast.error('Failed to submit idea', {
        description: 'Please try again.',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(
        'sm:max-w-[550px]',
        showEditor && 'sm:max-w-[95vw] md:max-w-[1200px] h-[90vh]'
      )}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Lightbulb className="h-4 w-4 text-amber-500" />
            </div>
            Submit an Idea
          </DialogTitle>
        </DialogHeader>

        {showEditor && screenshot ? (
          <ScreenshotEditor
            imageUrl={screenshot}
            onSave={handleEditorSave}
            onCancel={() => setShowEditor(false)}
          />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="idea-title">
                Title <span className="text-muted-foreground text-xs">(optional)</span>
              </Label>
              <Input
                id="idea-title"
                placeholder="Give your idea a catchy name"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="idea-description">
                Describe your idea <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="idea-description"
                placeholder="What would you like to see? How would it help you?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                required
              />
            </div>

            {/* Image Upload (optional) */}
            <div className="space-y-2">
              <Label>Image <span className="text-muted-foreground text-xs">(optional - mockup, example, etc.)</span></Label>

              {screenshot ? (
                <div className="relative rounded-lg border bg-muted/30 p-2">
                  <img
                    src={screenshot}
                    alt="Idea mockup"
                    className="w-full max-h-48 object-contain rounded"
                  />
                  <div className="absolute top-1 right-1 flex gap-1">
                    <button
                      type="button"
                      onClick={() => setShowEditor(true)}
                      className="p-1.5 rounded-full bg-background/80 hover:bg-background border shadow-sm"
                      title="Edit image"
                    >
                      <Edit2 className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={removeScreenshot}
                      className="p-1.5 rounded-full bg-background/80 hover:bg-background border shadow-sm"
                      title="Remove image"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Image
                </Button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            {/* Voting hint */}
            <p className="text-xs text-muted-foreground">
              Once submitted, your idea will be visible to all staff who can vote on it.
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
                Submit Idea
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
