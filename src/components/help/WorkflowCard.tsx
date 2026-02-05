'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Loader2, AlertCircle, X } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface WorkflowStep {
  title: string
  description: string
}

export interface WorkflowCardProps {
  /** Fetch content from database by doc_id */
  docId?: string
  /** Or provide content directly */
  title?: string
  steps?: WorkflowStep[]
  /** Make the card collapsible */
  collapsible?: boolean
  /** Start collapsed (only if collapsible=true) */
  defaultCollapsed?: boolean
  /** Show close button and call this when closed */
  onClose?: () => void
  /** Additional CSS classes */
  className?: string
}

interface HelpDocContent {
  overview?: string
  steps?: WorkflowStep[]
  tips?: string[]
}

interface HelpDoc {
  id: string
  doc_id: string
  title: string
  content: HelpDocContent
  ai_generated?: boolean
  ai_confidence?: number
  updated_at?: string
}

const easeOut: [number, number, number, number] = [0.22, 1, 0.36, 1]

/**
 * WorkflowCard - Displays numbered workflow steps explaining how a feature works.
 *
 * Can either:
 * 1. Fetch content from the database using `docId`
 * 2. Display inline content using `title` and `steps` props
 *
 * Falls back to inline content if database fetch fails.
 */
export function WorkflowCard({
  docId,
  title: inlineTitle,
  steps: inlineSteps,
  collapsible = false,
  defaultCollapsed = false,
  onClose,
  className,
}: WorkflowCardProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed)
  const [loading, setLoading] = useState(!!docId)
  const [error, setError] = useState<string | null>(null)
  const [doc, setDoc] = useState<HelpDoc | null>(null)

  // Fetch from database if docId provided
  useEffect(() => {
    if (!docId) {
      setLoading(false)
      return
    }

    const fetchDoc = async () => {
      try {
        const res = await fetch(`/api/help/${docId}`)
        if (!res.ok) {
          // Use inline content as fallback
          setError('Failed to load help content')
          return
        }
        const json = await res.json()
        if (json.data?.doc) {
          setDoc(json.data.doc)
        }
      } catch (err) {
        console.error('Failed to fetch help doc:', err)
        setError('Failed to load help content')
      } finally {
        setLoading(false)
      }
    }

    fetchDoc()
  }, [docId])

  // Determine what to display
  const displayTitle = doc?.title || inlineTitle || 'How It Works'
  const displaySteps = doc?.content?.steps || inlineSteps || []

  // Loading state
  if (loading) {
    return (
      <Card className={cn('animate-pulse', className)}>
        <CardHeader className="pb-3">
          <div className="h-5 w-48 bg-muted rounded" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    )
  }

  // Error state with fallback
  if (error && displaySteps.length === 0) {
    return (
      <Card className={cn('border-amber-500/20', className)}>
        <CardContent className="flex items-center gap-2 py-4 text-amber-600">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">{error}</span>
        </CardContent>
      </Card>
    )
  }

  // No content to display
  if (displaySteps.length === 0) {
    return null
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle
            className={cn(
              'text-sm font-medium flex items-center gap-2',
              collapsible && 'cursor-pointer select-none'
            )}
            onClick={collapsible ? () => setIsCollapsed(!isCollapsed) : undefined}
          >
            {displayTitle}
            {collapsible && (
              <motion.div
                initial={false}
                animate={{ rotate: isCollapsed ? -90 : 0 }}
                transition={{ duration: 0.2, ease: easeOut }}
              >
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </motion.div>
            )}
          </CardTitle>
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close help</span>
            </Button>
          )}
        </div>
      </CardHeader>

      <AnimatePresence initial={false}>
        {(!collapsible || !isCollapsed) && (
          <motion.div
            initial={collapsible ? { height: 0, opacity: 0 } : false}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: easeOut }}
            style={{ overflow: 'hidden' }}
          >
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                {displaySteps.map((step, index) => (
                  <WorkflowStep
                    key={index}
                    step={index + 1}
                    title={step.title}
                    description={step.description}
                  />
                ))}
              </div>
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  )
}

interface WorkflowStepProps {
  step: number
  title: string
  description: string
}

function WorkflowStep({ step, title, description }: WorkflowStepProps) {
  return (
    <div className="flex gap-3">
      <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-sm font-medium">
        {step}
      </div>
      <div>
        <h4 className="font-medium text-sm mb-1">{title}</h4>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

export default WorkflowCard
