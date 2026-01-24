'use client'

import { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Check,
  Flag,
  EyeOff,
  MoreHorizontal,
  BookOpen,
  MessageSquare,
  LayoutDashboard,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'

type TabStatus = 'active' | 'reference' | 'hidden' | 'flagged'

interface SheetTab {
  id: string
  name: string
  rowCount?: number
  columnCount?: number
  isMapped?: boolean
  primaryEntity?: 'partners' | 'staff' | 'asins' | null
  status?: TabStatus
  notes?: string | null
  headerConfirmed?: boolean
  hasHeaders?: boolean  // Auto-detected but not yet confirmed
  mappingProgress?: number  // 0-100 percentage for progress ring
}

interface SheetTabBarProps {
  tabs: SheetTab[]
  activeTabId: string | null
  onSelectTab: (tabId: string) => void
  onStatusChange?: (tabId: string, status: TabStatus, notes?: string) => void
}

const easeOut: [number, number, number, number] = [0.22, 1, 0.36, 1]

// Special tab ID for the Overview dashboard
export const OVERVIEW_TAB_ID = '__overview__'

export function SheetTabBar({
  tabs,
  activeTabId,
  onSelectTab,
  onStatusChange,
}: SheetTabBarProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [flagDialog, setFlagDialog] = useState<{
    open: boolean
    tabId: string | null
    tabName: string
    currentNotes: string
  }>({ open: false, tabId: null, tabName: '', currentNotes: '' })
  const [flagNotes, setFlagNotes] = useState('')

  // Only show active and reference tabs in the tab bar
  // Flagged and hidden tabs are only accessible from Overview dashboard
  const visibleTabs = tabs.filter(t => !t.status || t.status === 'active' || t.status === 'reference')

  const handleStatusChange = (tabId: string, status: TabStatus, tab: SheetTab) => {
    if (status === 'flagged') {
      // Open dialog to add notes
      setFlagDialog({
        open: true,
        tabId,
        tabName: tab.name,
        currentNotes: tab.notes || '',
      })
      setFlagNotes(tab.notes || '')
    } else {
      onStatusChange?.(tabId, status)
    }
  }

  const handleFlagConfirm = () => {
    if (flagDialog.tabId) {
      onStatusChange?.(flagDialog.tabId, 'flagged', flagNotes)
    }
    setFlagDialog({ open: false, tabId: null, tabName: '', currentNotes: '' })
    setFlagNotes('')
  }

  // Header status indicator component with progress ring
  // Grey = no headers, Orange = auto-detected, Green = confirmed with ring, ✓ = 100% mapped
  const HeaderStatusIndicator = ({ tab }: { tab: SheetTab }) => {
    const progress = tab.mappingProgress || 0
    const isConfirmed = tab.headerConfirmed
    const hasAutoHeaders = tab.hasHeaders && !isConfirmed
    const isComplete = progress === 100

    // Ring dimensions - visible size
    const size = 18
    const strokeWidth = 2.5
    const radius = (size - strokeWidth) / 2
    const circumference = 2 * Math.PI * radius
    const strokeDashoffset = circumference - (progress / 100) * circumference

    // Determine state for animation key
    const state = !isConfirmed && !hasAutoHeaders ? 'none' :
                  !isConfirmed ? 'auto' :
                  isComplete ? 'complete' : 'confirmed'

    return (
      <div className="relative flex items-center justify-center flex-shrink-0" style={{ width: size, height: size }}>
        <AnimatePresence mode="wait">
          {/* No headers detected - grey dot (no ring) */}
          {state === 'none' && (
            <motion.div
              key="none"
              initial={false}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.15, ease: easeOut }}
              className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30"
            />
          )}

          {/* Auto-detected but not confirmed - orange dot only (no ring) */}
          {state === 'auto' && (
            <motion.div
              key="auto"
              initial={false}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.15, ease: easeOut }}
              className="h-2.5 w-2.5 rounded-full bg-orange-500"
            />
          )}

          {/* Confirmed - green dot with progress ring */}
          {state === 'confirmed' && (
            <motion.div
              key="confirmed"
              initial={false}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.2, ease: easeOut }}
              className="relative flex items-center justify-center"
              style={{ width: size, height: size }}
            >
              {/* Progress ring - always shows background for confirmed tabs */}
              <svg
                className="absolute"
                width={size}
                height={size}
                style={{ transform: 'rotate(-90deg)' }}
              >
                {/* Background ring (full circle, always visible) */}
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={strokeWidth}
                  className="text-green-200"
                />
                {/* Progress ring (partial, animated) - only animates on change */}
                {progress > 0 && (
                  <motion.circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    className="text-green-500"
                    initial={false}
                    animate={{ strokeDashoffset }}
                    transition={{ duration: 0.4, ease: easeOut }}
                    style={{
                      strokeDasharray: circumference,
                    }}
                  />
                )}
              </svg>
              {/* Green center dot */}
              <div className="absolute h-2 w-2 rounded-full bg-green-500" />
            </motion.div>
          )}

          {/* 100% complete - show checkmark */}
          {state === 'complete' && (
            <motion.div
              key="complete"
              initial={false}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.15, ease: easeOut }}
            >
              <Check className="h-4 w-4 text-green-500" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  // Tab button component to avoid duplication
  const TabButton = ({ tab }: { tab: SheetTab }) => {
    const isActive = tab.id === activeTabId
    const status = tab.status || 'active'
    const isFlagged = status === 'flagged'
    const isReference = status === 'reference'
    const isHidden = status === 'hidden'

    return (
      <div className="relative group flex items-center">
        <motion.button
          data-tab-id={tab.id}
          onClick={() => onSelectTab(tab.id)}
          initial={false}
          whileTap={{ scale: 0.98 }}
          transition={{ duration: 0.15, ease: easeOut }}
          className={cn(
            'relative flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium',
            isActive
              ? 'text-foreground'
              : 'text-muted-foreground hover:text-foreground',
            isReference && 'opacity-70',
            isHidden && 'opacity-40'
          )}
        >
          {/* Active background - simple, no layout animation to avoid flicker */}
          {isActive && (
            <div className="absolute inset-0 bg-background shadow-sm rounded-lg border border-border/60" />
          )}
          {/* Tab content - above sliding background */}
          <span className="relative z-10 flex items-center gap-2">
            {/* Flagged indicator */}
            {isFlagged && (
              <Flag className="h-3 w-3 flex-shrink-0 text-amber-500" />
            )}

            {/* Header status indicator - orange=auto, green=confirmed with progress ring */}
            {!isFlagged && (
              <HeaderStatusIndicator tab={tab} />
            )}

            {/* Tab name */}
            <span className="truncate max-w-[80px] md:max-w-[120px]">{tab.name}</span>

            {/* Reference badge */}
            {isReference && (
              <BookOpen className="h-3 w-3 flex-shrink-0 text-blue-500" />
            )}

            {/* Hidden indicator */}
            {isHidden && (
              <EyeOff className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
            )}
          </span>
        </motion.button>

        {/* Status dropdown - shows on hover */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                'h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity ml-0.5',
                'hover:bg-muted'
              )}
            >
              <MoreHorizontal className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
              Tab Status
            </div>
            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={() => handleStatusChange(tab.id, 'active', tab)}
              className="gap-2"
            >
              <Check className={cn('h-4 w-4', status === 'active' && 'text-green-600')} />
              <span>Active</span>
              {status === 'active' && (
                <Check className="h-3 w-3 ml-auto text-green-600" />
              )}
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => handleStatusChange(tab.id, 'reference', tab)}
              className="gap-2"
            >
              <BookOpen className={cn('h-4 w-4', status === 'reference' && 'text-blue-600')} />
              <span>Reference Only</span>
              {status === 'reference' && (
                <Check className="h-3 w-3 ml-auto text-blue-600" />
              )}
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => handleStatusChange(tab.id, 'flagged', tab)}
              className="gap-2"
            >
              <Flag className={cn('h-4 w-4', status === 'flagged' && 'text-amber-600')} />
              <span>Flag for Review</span>
              {status === 'flagged' && (
                <Check className="h-3 w-3 ml-auto text-amber-600" />
              )}
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={() => handleStatusChange(tab.id, 'hidden', tab)}
              className="gap-2 text-muted-foreground"
            >
              <EyeOff className="h-4 w-4" />
              <span>Hide Tab</span>
              {status === 'hidden' && (
                <Check className="h-3 w-3 ml-auto" />
              )}
            </DropdownMenuItem>

            {/* Show notes if flagged */}
            {isFlagged && tab.notes && (
              <>
                <DropdownMenuSeparator />
                <div className="px-2 py-2 text-xs">
                  <div className="flex items-center gap-1 text-muted-foreground mb-1">
                    <MessageSquare className="h-3 w-3" />
                    Note:
                  </div>
                  <p className="text-foreground line-clamp-3">{tab.notes}</p>
                </div>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    )
  }

  // Check if Overview is the active tab
  const isOverviewActive = activeTabId === OVERVIEW_TAB_ID

  return (
    <>
      <div className="bg-muted/20 px-4">
        {/* Main Tab Container - scrolls horizontally on overflow */}
        <div
          ref={containerRef}
          className="flex items-stretch gap-1 overflow-x-auto scrollbar-hide py-2"
        >
          <div className="flex items-center gap-1 min-w-max">
          {/* Overview tab - always first */}
          <motion.button
            data-tab-id={OVERVIEW_TAB_ID}
            onClick={() => onSelectTab(OVERVIEW_TAB_ID)}
            initial={false}
            whileTap={{ scale: 0.98 }}
            transition={{ duration: 0.15, ease: easeOut }}
            className={cn(
              'relative flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium',
              isOverviewActive
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {/* Active background - simple, no layout animation to avoid flicker */}
            {isOverviewActive && (
              <div className="absolute inset-0 bg-background shadow-sm rounded-lg border border-border/60" />
            )}
            <span className="relative z-10 flex items-center gap-2">
              <LayoutDashboard className="h-3.5 w-3.5" />
              <span>Overview</span>
            </span>
          </motion.button>

          {/* Divider */}
          <div className="w-px bg-border/50 mx-1 my-1.5" />

          {visibleTabs.map((tab) => (
            <TabButton key={tab.id} tab={tab} />
          ))}
          </div>
        </div>
      </div>

      {/* Flag Dialog */}
      <Dialog open={flagDialog.open} onOpenChange={(open) => {
        if (!open) {
          setFlagDialog({ open: false, tabId: null, tabName: '', currentNotes: '' })
          setFlagNotes('')
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Flag className="h-5 w-5 text-amber-500" />
              Flag &quot;{flagDialog.tabName}&quot;
            </DialogTitle>
            <DialogDescription>
              Add a note explaining why this tab is flagged or what action is needed.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="e.g., 'Use this data to create tooltips for weekly status dropdown'"
              value={flagNotes}
              onChange={(e) => setFlagNotes(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setFlagDialog({ open: false, tabId: null, tabName: '', currentNotes: '' })}
            >
              Cancel
            </Button>
            <Button onClick={handleFlagConfirm} className="gap-2">
              <Flag className="h-4 w-4" />
              Flag Tab
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
