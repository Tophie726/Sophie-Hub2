'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { X, Eye, EyeOff, Loader2 } from 'lucide-react'
import { easeOutStandard, duration } from '@/lib/animations'
import type { ViewerContext } from '@/lib/auth/viewer-context'
import type { Role } from '@/lib/auth/roles'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ViewerContextBadgeProps {
  userRole: Role | undefined
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ViewerContextBadge({ userRole }: ViewerContextBadgeProps) {
  const [viewerContext, setViewerContext] = useState<ViewerContext | null>(null)
  const [loading, setLoading] = useState(false)
  const isAdmin = userRole === 'admin'

  useEffect(() => {
    if (!isAdmin) return

    fetchContext()

    // Listen for custom event from admin-mode-control when context changes
    function handleContextChange() {
      fetchContext()
    }
    window.addEventListener('viewer-context-changed', handleContextChange)
    return () => window.removeEventListener('viewer-context-changed', handleContextChange)
  }, [isAdmin])

  async function fetchContext() {
    try {
      const res = await fetch('/api/viewer-context')
      if (!res.ok) return
      const json = await res.json()
      const ctx = json.data?.viewerContext as ViewerContext | undefined
      setViewerContext(ctx ?? null)
    } catch {
      // Silently fail
    }
  }

  async function resetContext() {
    setLoading(true)
    try {
      const res = await fetch('/api/viewer-context', { method: 'DELETE' })
      if (!res.ok && res.status !== 204) {
        toast.error('Failed to reset viewer context')
        return
      }
      setViewerContext(null)
      toast.success('Viewer context reset')
      // Notify sidebar to refresh
      window.dispatchEvent(new CustomEvent('viewer-context-changed'))
    } catch {
      toast.error('Failed to reset viewer context')
    } finally {
      setLoading(false)
    }
  }

  // Only relevant for admin users
  if (!isAdmin) return null

  // Determine visibility and content
  const isImpersonating = viewerContext?.isImpersonating ?? false
  const adminModeOff = viewerContext !== null && !viewerContext.adminModeOn && !isImpersonating

  // Hidden when in normal admin state (admin mode on, no impersonation)
  if (!isImpersonating && !adminModeOff) return null

  return (
    <AnimatePresence mode="wait">
      {isImpersonating ? (
        <motion.div
          key="impersonating"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: duration.ui, ease: easeOutStandard }}
          className={cn(
            'flex items-center gap-2 rounded-lg px-3 py-1.5',
            'bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/20 dark:border-amber-500/25',
            'text-amber-700 dark:text-amber-400',
            // Compact on mobile
            'text-xs md:text-sm'
          )}
        >
          <Eye className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            <span className="hidden md:inline">Viewing as: </span>
            <span className="font-medium">{viewerContext?.subject.targetLabel}</span>
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={resetContext}
            disabled={loading}
            className="h-6 w-6 p-0 ml-1 shrink-0 text-amber-700 dark:text-amber-400 hover:bg-amber-500/15 hover:text-amber-800 dark:hover:text-amber-300"
            aria-label="Reset viewer context"
          >
            {loading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <X className="h-3 w-3" />
            )}
          </Button>
        </motion.div>
      ) : adminModeOff ? (
        <motion.div
          key="admin-off"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: duration.ui, ease: easeOutStandard }}
          className={cn(
            'flex items-center gap-2 rounded-lg px-3 py-1.5',
            'bg-muted/50 border border-border/40',
            'text-muted-foreground',
            'text-xs md:text-sm'
          )}
        >
          <EyeOff className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            <span className="hidden md:inline">Admin Mode: </span>
            <span className="font-medium">Off</span>
          </span>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
