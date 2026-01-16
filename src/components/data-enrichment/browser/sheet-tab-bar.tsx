'use client'

import { useRef, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Table,
  Check,
  Flag,
  Eye,
  EyeOff,
  MoreHorizontal,
  BookOpen,
  ChevronDown,
  MessageSquare,
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'

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
}

interface SheetTabBarProps {
  tabs: SheetTab[]
  activeTabId: string | null
  onSelectTab: (tabId: string) => void
  onStatusChange?: (tabId: string, status: TabStatus, notes?: string) => void
}

const easeOut: [number, number, number, number] = [0.22, 1, 0.36, 1]

const entityColors = {
  partners: 'bg-blue-500',
  staff: 'bg-green-500',
  asins: 'bg-orange-500',
}

export function SheetTabBar({
  tabs,
  activeTabId,
  onSelectTab,
  onStatusChange,
}: SheetTabBarProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 })
  const [showHidden, setShowHidden] = useState(false)
  const [showFlagged, setShowFlagged] = useState(true)
  const [flagDialog, setFlagDialog] = useState<{
    open: boolean
    tabId: string | null
    tabName: string
    currentNotes: string
  }>({ open: false, tabId: null, tabName: '', currentNotes: '' })
  const [flagNotes, setFlagNotes] = useState('')

  // Split tabs into categories
  const mainTabs = tabs.filter(t => !t.status || t.status === 'active' || t.status === 'reference')
  const flaggedTabs = tabs.filter(t => t.status === 'flagged')
  const hiddenTabs = tabs.filter(t => t.status === 'hidden')

  // Visible main tabs (always show, unless showHidden adds hidden ones)
  const visibleMainTabs = showHidden
    ? [...mainTabs, ...hiddenTabs]
    : mainTabs

  // Update active indicator position
  useEffect(() => {
    if (!activeTabId || !containerRef.current) return

    const activeTab = containerRef.current.querySelector(
      `[data-tab-id="${activeTabId}"]`
    ) as HTMLElement

    if (activeTab) {
      setIndicatorStyle({
        left: activeTab.offsetLeft,
        width: activeTab.offsetWidth,
      })
    }
  }, [activeTabId, tabs, showHidden])

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

  // Tab button component to avoid duplication
  const TabButton = ({ tab, inFlaggedSection = false }: { tab: SheetTab; inFlaggedSection?: boolean }) => {
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
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          transition={{ duration: 0.15, ease: easeOut }}
          className={cn(
            'relative flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors',
            isActive
              ? inFlaggedSection
                ? 'bg-amber-500/10 border border-amber-500/30 text-foreground'
                : 'bg-background shadow-sm text-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-background/50',
            isReference && 'opacity-70',
            isHidden && 'opacity-40 border border-dashed'
          )}
        >
          {/* Flagged indicator */}
          {isFlagged && (
            <Flag className="h-3 w-3 flex-shrink-0 text-amber-500" />
          )}

          {/* Entity indicator dot */}
          {!isFlagged && tab.primaryEntity && (
            <div className={cn(
              'h-2 w-2 rounded-full flex-shrink-0',
              entityColors[tab.primaryEntity]
            )} />
          )}

          {/* Tab icon for non-entity tabs */}
          {!isFlagged && !tab.primaryEntity && (
            <Table className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
          )}

          {/* Tab name */}
          <span className="truncate max-w-[120px]">{tab.name}</span>

          {/* Mapped indicator */}
          {tab.isMapped && !isFlagged && (
            <Check className="h-3 w-3 flex-shrink-0 text-green-500" />
          )}

          {/* Reference badge */}
          {isReference && (
            <BookOpen className="h-3 w-3 flex-shrink-0 text-blue-500" />
          )}
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

  return (
    <>
      <div className="relative bg-muted/20 px-4">
        {/* Main Tab Container */}
        <div
          ref={containerRef}
          className="flex items-stretch gap-1 overflow-x-auto scrollbar-hide py-2"
        >
          {visibleMainTabs.map((tab) => (
            <TabButton key={tab.id} tab={tab} />
          ))}

          {/* Hidden tabs toggle */}
          {hiddenTabs.length > 0 && (
            <Button
              variant={showHidden ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setShowHidden(!showHidden)}
              className={cn(
                'ml-2 h-8 px-2.5 text-xs gap-1.5',
                showHidden
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground/60 hover:text-muted-foreground'
              )}
            >
              {showHidden ? (
                <Eye className="h-3.5 w-3.5" />
              ) : (
                <EyeOff className="h-3.5 w-3.5" />
              )}
              <span className="tabular-nums">{hiddenTabs.length}</span>
            </Button>
          )}

          {/* Flagged indicator in main bar (when collapsed) */}
          {flaggedTabs.length > 0 && !showFlagged && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFlagged(true)}
              className="ml-2 h-8 px-2.5 text-xs gap-1.5 text-amber-600/70 hover:text-amber-600"
            >
              <Flag className="h-3.5 w-3.5" />
              <span className="tabular-nums">{flaggedTabs.length}</span>
            </Button>
          )}
        </div>

        {/* Active Tab Indicator - subtle underline */}
        {activeTabId && visibleMainTabs.some(t => t.id === activeTabId) && (
          <motion.div
            initial={false}
            animate={{
              left: indicatorStyle.left,
              width: indicatorStyle.width,
              opacity: 1,
            }}
            transition={{ duration: 0.2, ease: easeOut }}
            className="absolute bottom-0 h-0.5 bg-primary/50 rounded-full"
          />
        )}
      </div>

      {/* Flagged Tabs Section - Collapsible */}
      {flaggedTabs.length > 0 && (
        <Collapsible open={showFlagged} onOpenChange={setShowFlagged}>
          <div className="border-t border-amber-500/20 bg-amber-500/5">
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center justify-between px-4 py-2 text-xs hover:bg-amber-500/10 transition-colors">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                  <Flag className="h-3.5 w-3.5" />
                  <span className="font-medium">Flagged for Review</span>
                  <span className="bg-amber-500/20 px-1.5 py-0.5 rounded text-[10px] font-medium tabular-nums">
                    {flaggedTabs.length}
                  </span>
                </div>
                <motion.div
                  animate={{ rotate: showFlagged ? 180 : 0 }}
                  transition={{ duration: 0.2, ease: easeOut }}
                >
                  <ChevronDown className="h-4 w-4 text-amber-600/50" />
                </motion.div>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="px-4 pb-2 flex flex-wrap gap-1"
              >
                {flaggedTabs.map((tab) => (
                  <TabButton key={tab.id} tab={tab} inFlaggedSection />
                ))}
              </motion.div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      )}

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
