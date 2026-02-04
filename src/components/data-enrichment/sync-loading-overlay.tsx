'use client'

import { motion } from 'framer-motion'
import { easeInOut, easeOut, duration } from '@/lib/animations'

interface SyncLoadingOverlayProps {
  isVisible: boolean
  phase: 'dry-run' | 'syncing' | 'idle'
  currentTab?: string
  completedTabs: number
  totalTabs: number
}

/**
 * Sync Loading Overlay
 *
 * A smooth, monotone loading animation that covers the content area
 * during sync operations. Follows Emil Kowalski's animation guidelines.
 */
export function SyncLoadingOverlay({
  isVisible,
  phase: _phase,
  currentTab,
  completedTabs,
  totalTabs,
}: SyncLoadingOverlayProps) {
  void _phase // reserved for phase-specific styling
  if (!isVisible) return null

  const progress = totalTabs > 0 ? (completedTabs / totalTabs) * 100 : 0
  const statusText = 'Syncing to database'

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: duration.ui, ease: easeOut }}
      className="absolute inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm min-h-[400px]"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: duration.ui, ease: easeOut }}
        className="flex flex-col items-center gap-5"
      >
        {/* Animated dots loader */}
        <div className="flex items-center gap-2.5">
          {[0, 1, 2, 3, 4].map((i) => (
            <motion.div
              key={i}
              className="h-2.5 w-2.5 rounded-full bg-primary"
              animate={{
                y: [0, -10, 0],
                opacity: [0.5, 1, 0.5],
              }}
              transition={{
                duration: 0.9,
                ease: easeInOut,
                repeat: Infinity,
                delay: i * 0.12,
              }}
            />
          ))}
        </div>

        {/* Status text */}
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">
            {statusText}
            {totalTabs > 1 && (
              <span className="text-muted-foreground ml-1">
                ({completedTabs + 1} of {totalTabs})
              </span>
            )}
          </p>

          {currentTab && (
            <motion.p
              key={currentTab}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs text-muted-foreground mt-1 max-w-[200px] truncate"
            >
              {currentTab}
            </motion.p>
          )}
        </div>

        {/* Progress bar */}
        {totalTabs > 1 && (
          <div className="w-48 h-1 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary/60 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3, ease: easeOut }}
            />
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}
