'use client'

import { useState, useRef, useCallback, memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { EyeOff, Flag, Building2, Users, Package, Eye, ExternalLink, ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { easeOut, duration, springPop } from '@/lib/animations'

// Haptic feedback helper (works on Android, not iOS Safari)
function haptic(intensity: 'light' | 'medium' | 'heavy' = 'medium') {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    const patterns = { light: 10, medium: 50, heavy: 100 }
    navigator.vibrate(patterns[intensity])
  }
}

type TabStatus = 'active' | 'reference' | 'hidden' | 'flagged'
type EntityType = 'partners' | 'staff' | 'asins' | null
type FeedbackType = 'flag' | 'unflag' | 'hide' | 'unhide' | null

interface CategoryStats {
  partner: number
  staff: number
  asin: number
  weekly: number
  computed: number
  skip: number
  unmapped: number
}

interface TabListRowProps {
  id: string
  name: string
  primaryEntity: EntityType
  status: TabStatus
  columnCount: number
  categoryStats: CategoryStats
  hasHeaders: boolean
  headerConfirmed: boolean
  updatedAt: string | null
  onClick: () => void
  onStatusChange?: (status: TabStatus, notes?: string) => void
  isSelected?: boolean
  index: number
}

const entityConfig = {
  partners: {
    color: 'bg-blue-500',
    label: 'Partners',
    icon: Building2,
  },
  staff: {
    color: 'bg-green-500',
    label: 'Staff',
    icon: Users,
  },
  asins: {
    color: 'bg-orange-500',
    label: 'ASINs',
    icon: Package,
  },
}

function formatRelativeTime(dateString: string | null): string {
  if (!dateString) return '–'

  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  return `${Math.floor(diffDays / 30)}mo ago`
}

function calculateProgress(stats: CategoryStats): number {
  const mapped = stats.partner + stats.staff + stats.asin + stats.weekly + stats.computed + stats.skip
  const total = mapped + stats.unmapped
  if (total === 0) return 0
  return Math.round((mapped / total) * 100)
}

export const TabListRow = memo(function TabListRow({
  name,
  primaryEntity,
  status,
  columnCount,
  categoryStats,
  hasHeaders,
  headerConfirmed,
  updatedAt,
  onClick,
  onStatusChange,
  isSelected = false,
  index,
}: TabListRowProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [showFlagInput, setShowFlagInput] = useState(false)
  const [flagNotes, setFlagNotes] = useState('')
  const [feedback, setFeedback] = useState<FeedbackType>(null)
  const longPressTimer = useRef<NodeJS.Timeout | null>(null)
  const isLongPress = useRef(false)
  const touchMoved = useRef(false)

  const isFlagged = status === 'flagged'
  const isHidden = status === 'hidden'
  const progress = calculateProgress(categoryStats)
  const entity = primaryEntity ? entityConfig[primaryEntity] : null

  const clearLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }, [])

  const handleTouchStart = useCallback(() => {
    touchMoved.current = false
    isLongPress.current = false

    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true
      setMenuOpen(true)
      haptic('medium')
    }, 500)
  }, [])

  const handleTouchMove = useCallback(() => {
    touchMoved.current = true
    clearLongPress()
  }, [clearLongPress])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    clearLongPress()

    if (isLongPress.current || touchMoved.current || menuOpen) {
      e.preventDefault()
      return
    }

    onClick()
  }, [onClick, menuOpen, clearLongPress])

  const handleTouchCancel = useCallback(() => {
    clearLongPress()
  }, [clearLongPress])

  const handleClick = useCallback(() => {
    if ('ontouchstart' in window) return
    onClick()
  }, [onClick])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setMenuOpen(true)
  }, [])

  // Menu action with visual feedback
  const handleMenuAction = useCallback((action: () => void, feedbackType?: FeedbackType) => {
    haptic('light')
    setMenuOpen(false)

    if (feedbackType) {
      setFeedback(feedbackType)
      setTimeout(() => setFeedback(null), 800)
    }

    setTimeout(action, 50)
  }, [])

  // Get feedback icon and color
  const getFeedbackIcon = () => {
    switch (feedback) {
      case 'flag':
        return { Icon: Flag, color: 'text-amber-500', bg: 'bg-amber-500/20' }
      case 'unflag':
        return { Icon: Flag, color: 'text-muted-foreground', bg: 'bg-muted' }
      case 'hide':
        return { Icon: EyeOff, color: 'text-muted-foreground', bg: 'bg-muted' }
      case 'unhide':
        return { Icon: Eye, color: 'text-green-500', bg: 'bg-green-500/20' }
      default:
        return null
    }
  }

  const feedbackIcon = getFeedbackIcon()

  return (
    <>
      <motion.div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: duration.ui, ease: easeOut, delay: index * 0.02 }}
        className={cn(
          'relative w-full text-left px-4 py-3 border-b transition-colors cursor-pointer',
          'hover:bg-muted/50 focus:outline-none focus-visible:bg-muted/50',
          'select-none touch-manipulation',
          '[&_*]:select-none',
          isSelected && 'bg-primary/5',
          isHidden && 'opacity-60',
          isFlagged && 'bg-amber-500/5',
          'md:grid md:grid-cols-[1fr,80px,120px,200px,80px] md:gap-4 md:items-center'
        )}
        style={{
          WebkitTouchCallout: 'none',
          WebkitUserSelect: 'none',
        }}
      >
        {/* Feedback overlay animation */}
        <AnimatePresence>
          {feedback && feedbackIcon && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ ...springPop, duration: 0.4 }}
              className="absolute inset-0 flex items-center justify-center z-10 bg-background/80 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                transition={{ ...springPop }}
                className={cn('p-3 rounded-full', feedbackIcon.bg)}
              >
                <feedbackIcon.Icon className={cn('h-6 w-6', feedbackIcon.color)} />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mobile Layout */}
        <div className="md:hidden space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {/* Header status dot - matches tab bar: grey=none, orange=auto, green=confirmed */}
              {headerConfirmed ? (
                <div className="h-2.5 w-2.5 rounded-full bg-green-500 flex-shrink-0" />
              ) : hasHeaders ? (
                <div className="h-2.5 w-2.5 rounded-full bg-orange-500 flex-shrink-0" />
              ) : (
                <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30 flex-shrink-0" />
              )}
              <span className="font-medium text-sm truncate">{name}</span>
              {isFlagged && <Flag className="h-3 w-3 text-amber-500 flex-shrink-0" />}
              {isHidden && <EyeOff className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
            </div>
            {/* Entity badge if mapped */}
            {entity && (
              <span className={cn(
                'text-[10px] font-medium px-1.5 py-0.5 rounded flex-shrink-0',
                primaryEntity === 'partners' && 'bg-blue-500/10 text-blue-600',
                primaryEntity === 'staff' && 'bg-green-500/10 text-green-600',
                primaryEntity === 'asins' && 'bg-orange-500/10 text-orange-600'
              )}>
                {entity.label}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Progress value={progress} className="h-1.5 flex-1" />
            <span className="text-xs text-muted-foreground tabular-nums">{progress}%</span>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1">
              {categoryStats.partner > 0 && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-blue-500/10 text-blue-600">
                  <Building2 className="h-2.5 w-2.5" />
                  {categoryStats.partner}
                </span>
              )}
              {categoryStats.staff > 0 && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-green-500/10 text-green-600">
                  <Users className="h-2.5 w-2.5" />
                  {categoryStats.staff}
                </span>
              )}
              {categoryStats.asin > 0 && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-orange-500/10 text-orange-600">
                  <Package className="h-2.5 w-2.5" />
                  {categoryStats.asin}
                </span>
              )}
            </div>
            <span className="text-[10px] text-muted-foreground">{columnCount} cols</span>
          </div>
        </div>

        {/* Desktop Layout */}
        <div className="hidden md:flex items-center gap-2 min-w-0">
          {/* Header status dot - matches tab bar: grey=none, orange=auto, green=confirmed */}
          {headerConfirmed ? (
            <div className="h-2.5 w-2.5 rounded-full bg-green-500 flex-shrink-0" />
          ) : hasHeaders ? (
            <div className="h-2.5 w-2.5 rounded-full bg-orange-500 flex-shrink-0" />
          ) : (
            <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30 flex-shrink-0" />
          )}
          <span className="font-medium text-sm truncate">{name}</span>
          {isFlagged && <Flag className="h-3 w-3 text-amber-500 flex-shrink-0" />}
          {isHidden && <EyeOff className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
        </div>

        <div className="hidden md:flex items-center justify-center">
          {headerConfirmed ? (
            <span className="text-xs text-green-600 font-medium">Confirmed</span>
          ) : hasHeaders ? (
            <span className="text-xs text-orange-600 font-medium">Auto</span>
          ) : (
            <span className="text-muted-foreground/50">–</span>
          )}
        </div>

        <div className="hidden md:flex items-center gap-2">
          <Progress value={progress} className="h-1.5 flex-1" />
          <span className="text-xs text-muted-foreground tabular-nums w-8">{progress}%</span>
        </div>

        <div className="hidden md:flex flex-wrap gap-1">
          {categoryStats.partner > 0 && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-blue-500/10 text-blue-600">
              <Building2 className="h-2.5 w-2.5" />
              {categoryStats.partner}
            </span>
          )}
          {categoryStats.staff > 0 && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-green-500/10 text-green-600">
              <Users className="h-2.5 w-2.5" />
              {categoryStats.staff}
            </span>
          )}
          {categoryStats.asin > 0 && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-orange-500/10 text-orange-600">
              <Package className="h-2.5 w-2.5" />
              {categoryStats.asin}
            </span>
          )}
          {categoryStats.skip > 0 && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-muted text-muted-foreground">
              Skip {categoryStats.skip}
            </span>
          )}
          {progress === 0 && (
            <span className="text-xs text-muted-foreground">{columnCount} cols</span>
          )}
        </div>

        <div className="hidden md:block text-xs text-muted-foreground text-right">
          {formatRelativeTime(updatedAt)}
        </div>
      </motion.div>

      {/* Mobile-friendly Action Sheet */}
      <AnimatePresence>
        {menuOpen && (
          <>
            {/* Backdrop - dims the rest of the UI */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: duration.ui }}
              className="fixed inset-0 bg-black/60 z-50 backdrop-blur-[2px]"
              onClick={() => {
                setMenuOpen(false)
                setShowFlagInput(false)
                setFlagNotes('')
              }}
            />

            {/* Action Sheet */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ duration: duration.page, ease: easeOut }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-2xl shadow-xl safe-area-bottom"
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
              </div>

              <AnimatePresence mode="wait">
                {showFlagInput ? (
                  /* Flag Notes Input View */
                  <motion.div
                    key="flag-input"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2, ease: easeOut }}
                  >
                    {/* Header with back button */}
                    <div className="px-4 pb-3 border-b">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            haptic('light')
                            setShowFlagInput(false)
                          }}
                          className="p-1 -ml-1 rounded-lg hover:bg-muted transition-colors"
                        >
                          <ChevronLeft className="h-5 w-5 text-muted-foreground" />
                        </button>
                        <Flag className="h-4 w-4 text-amber-500" />
                        <span className="font-medium">Flag for Review</span>
                      </div>
                    </div>

                    {/* Notes input */}
                    <div className="p-4 space-y-3">
                      <div>
                        <label className="text-sm text-muted-foreground mb-2 block">
                          Why does this tab need review?
                        </label>
                        <Textarea
                          value={flagNotes}
                          onChange={(e) => setFlagNotes(e.target.value)}
                          placeholder="e.g., Need to verify column mappings with finance team"
                          className="min-h-[100px] resize-none text-base"
                          autoFocus
                        />
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          className="flex-1 h-11"
                          onClick={() => {
                            haptic('light')
                            setShowFlagInput(false)
                            setFlagNotes('')
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          className="flex-1 h-11 bg-amber-500 hover:bg-amber-600 text-white"
                          onClick={() => {
                            haptic('medium')
                            setShowFlagInput(false)
                            setMenuOpen(false)
                            setFeedback('flag')
                            setTimeout(() => setFeedback(null), 800)
                            setTimeout(() => {
                              onStatusChange?.('flagged', flagNotes || undefined)
                              setFlagNotes('')
                            }, 50)
                          }}
                        >
                          <Flag className="h-4 w-4 mr-2" />
                          Flag Tab
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  /* Main Actions View */
                  <motion.div
                    key="main-actions"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.2, ease: easeOut }}
                  >
                    {/* Header */}
                    <div className="px-4 pb-3 border-b">
                      <div className="flex items-center gap-2">
                        {entity ? (
                          <div className={cn('h-3 w-3 rounded-full', entity.color)} />
                        ) : (
                          <div className="h-3 w-3 rounded-full bg-muted-foreground/30" />
                        )}
                        <span className="font-medium truncate">{name}</span>
                      </div>
                    </div>

                    {/* Actions - 44px minimum touch targets with press feedback */}
                    <div className="p-2">
                      <motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleMenuAction(onClick)}
                        className="w-full flex items-center gap-3 px-4 py-3 min-h-[44px] rounded-xl active:bg-muted transition-colors"
                      >
                        <ExternalLink className="h-5 w-5 text-muted-foreground" />
                        <span className="font-medium">Open</span>
                      </motion.button>

                      <div className="h-px bg-border my-1 mx-4" />

                      {isFlagged ? (
                        <motion.button
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleMenuAction(() => onStatusChange?.('active'), 'unflag')}
                          className="w-full flex items-center gap-3 px-4 py-3 min-h-[44px] rounded-xl active:bg-muted transition-colors"
                        >
                          <Flag className="h-5 w-5 text-muted-foreground" />
                          <span className="font-medium">Remove Flag</span>
                        </motion.button>
                      ) : (
                        <motion.button
                          whileTap={{ scale: 0.98 }}
                          onClick={() => {
                            haptic('light')
                            setShowFlagInput(true)
                          }}
                          className="w-full flex items-center gap-3 px-4 py-3 min-h-[44px] rounded-xl active:bg-muted transition-colors"
                        >
                          <Flag className="h-5 w-5 text-amber-500" />
                          <span className="font-medium">Flag for Review</span>
                        </motion.button>
                      )}

                      {isHidden ? (
                        <motion.button
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleMenuAction(() => onStatusChange?.('active'), 'unhide')}
                          className="w-full flex items-center gap-3 px-4 py-3 min-h-[44px] rounded-xl active:bg-muted transition-colors"
                        >
                          <Eye className="h-5 w-5 text-muted-foreground" />
                          <span className="font-medium">Unhide</span>
                        </motion.button>
                      ) : (
                        <motion.button
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleMenuAction(() => onStatusChange?.('hidden'), 'hide')}
                          className="w-full flex items-center gap-3 px-4 py-3 min-h-[44px] rounded-xl active:bg-muted transition-colors"
                        >
                          <EyeOff className="h-5 w-5 text-muted-foreground" />
                          <span className="font-medium">Hide Tab</span>
                        </motion.button>
                      )}
                    </div>

                    {/* Cancel button */}
                    <div className="p-2 pt-0">
                      <motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={() => { haptic('light'); setMenuOpen(false) }}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] rounded-xl bg-muted active:bg-muted/60 transition-colors"
                      >
                        <span className="font-medium">Cancel</span>
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Safe area padding for devices with home indicator */}
              <div className="h-safe-area-inset-bottom" />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
})
