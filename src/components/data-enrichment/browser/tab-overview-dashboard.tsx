'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutGrid,
  List,
  Flag,
  ChevronDown,
  EyeOff,
  Eye,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { TabCard } from './tab-card'
import { TabListRow } from './tab-list-row'

type TabStatus = 'active' | 'reference' | 'hidden' | 'flagged'
type EntityType = 'partners' | 'staff' | 'asins' | null
type ViewMode = 'grid' | 'list'

interface CategoryStats {
  partner: number
  staff: number
  asin: number
  weekly: number
  computed: number
  skip: number
  unmapped: number
}

interface Tab {
  id: string
  tab_name: string
  primary_entity: EntityType
  header_row: number
  header_confirmed: boolean
  columnCount: number
  categoryStats: CategoryStats
  status: TabStatus
  notes: string | null
  updated_at: string | null
}

interface TabOverviewDashboardProps {
  sourceName: string
  tabs: Tab[]
  onSelectTab: (tabId: string) => void
  onTabStatusChange?: (tabId: string, status: 'active' | 'reference' | 'hidden' | 'flagged', notes?: string) => void
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
}

const easeOut: [number, number, number, number] = [0.22, 1, 0.36, 1]

function calculateOverallProgress(tabs: Tab[]): number {
  let totalMapped = 0
  let totalColumns = 0

  tabs.forEach(tab => {
    const stats = tab.categoryStats
    const mapped = stats.partner + stats.staff + stats.asin + stats.weekly + stats.computed + stats.skip
    const total = mapped + stats.unmapped
    totalMapped += mapped
    totalColumns += total
  })

  if (totalColumns === 0) return 0
  return Math.round((totalMapped / totalColumns) * 100)
}

function calculateTotalColumns(tabs: Tab[]): number {
  return tabs.reduce((sum, tab) => sum + tab.columnCount, 0)
}

export function TabOverviewDashboard({
  sourceName,
  tabs,
  onSelectTab,
  onTabStatusChange,
  viewMode,
  onViewModeChange,
}: TabOverviewDashboardProps) {
  const [showHidden, setShowHidden] = useState(false)
  const [showFlagged, setShowFlagged] = useState(true)

  // Split tabs into categories
  const mainTabs = tabs.filter(t => !t.status || t.status === 'active' || t.status === 'reference')
  const flaggedTabs = tabs.filter(t => t.status === 'flagged')
  const hiddenTabs = tabs.filter(t => t.status === 'hidden')

  // Visible tabs
  const visibleMainTabs = showHidden ? [...mainTabs, ...hiddenTabs] : mainTabs

  const overallProgress = calculateOverallProgress(tabs.filter(t => t.status !== 'hidden'))
  const totalColumns = calculateTotalColumns(tabs.filter(t => t.status !== 'hidden'))

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: easeOut }}
      className="space-y-4 md:space-y-6 p-4 md:p-6"
    >
      {/* Header */}
      <div className="flex items-start md:items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-base md:text-lg font-semibold truncate">{sourceName} Overview</h2>
          <p className="text-xs md:text-sm text-muted-foreground">
            {tabs.length} tab{tabs.length !== 1 ? 's' : ''} · {totalColumns} cols · {overallProgress}%
          </p>
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1 flex-shrink-0">
          <Button
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => onViewModeChange('grid')}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => onViewModeChange('list')}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Overall progress bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Overall mapping progress</span>
          <span className="font-medium">{overallProgress}%</span>
        </div>
        <Progress value={overallProgress} className="h-2" />
      </div>

      {/* Main tabs section */}
      <AnimatePresence mode="wait">
        {viewMode === 'grid' ? (
          <motion.div
            key="grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: easeOut }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
          >
            {visibleMainTabs.map((tab, index) => (
              <motion.div
                key={tab.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: easeOut, delay: index * 0.05 }}
              >
                <TabCard
                  id={tab.id}
                  name={tab.tab_name}
                  primaryEntity={tab.primary_entity}
                  status={tab.status}
                  columnCount={tab.columnCount}
                  categoryStats={tab.categoryStats}
                  hasHeaders={tab.header_row >= 0}
                  headerConfirmed={tab.header_confirmed}
                  updatedAt={tab.updated_at}
                  onClick={() => onSelectTab(tab.id)}
                  onStatusChange={(status, notes) => onTabStatusChange?.(tab.id, status, notes)}
                />
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: easeOut }}
            className="rounded-lg border bg-card overflow-hidden"
          >
            {/* List header - hidden on mobile */}
            <div className="hidden md:grid grid-cols-[1fr,80px,120px,200px,80px] gap-4 px-4 py-2 border-b bg-muted/50 text-xs font-medium text-muted-foreground">
              <span>Tab Name</span>
              <span className="text-center">Headers</span>
              <span>Progress</span>
              <span>Breakdown</span>
              <span className="text-right">Last Edit</span>
            </div>

            {/* List rows */}
            {visibleMainTabs.map((tab, index) => (
              <TabListRow
                key={tab.id}
                id={tab.id}
                name={tab.tab_name}
                primaryEntity={tab.primary_entity}
                status={tab.status}
                columnCount={tab.columnCount}
                categoryStats={tab.categoryStats}
                hasHeaders={tab.header_row >= 0}
                headerConfirmed={tab.header_confirmed}
                updatedAt={tab.updated_at}
                onClick={() => onSelectTab(tab.id)}
                onStatusChange={(status, notes) => onTabStatusChange?.(tab.id, status, notes)}
                index={index}
              />
            ))}

            {visibleMainTabs.length === 0 && (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                No tabs to display
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hidden tabs toggle */}
      {hiddenTabs.length > 0 && (
        <div className="flex items-center gap-2">
          <Button
            variant={showHidden ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setShowHidden(!showHidden)}
            className={cn(
              'gap-1.5 text-xs',
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
            {showHidden ? 'Hide' : 'Show'} {hiddenTabs.length} hidden tab{hiddenTabs.length !== 1 ? 's' : ''}
          </Button>
        </div>
      )}

      {/* Flagged tabs section - uses same TabCard for consistent UX */}
      {flaggedTabs.length > 0 && (
        <Collapsible open={showFlagged} onOpenChange={setShowFlagged}>
          <div className="rounded-lg border bg-muted/30 overflow-hidden">
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Flag className="h-3.5 w-3.5 text-amber-500/70" />
                  <span className="text-xs font-medium">Flagged for Review</span>
                  <span className="text-xs text-muted-foreground/60 tabular-nums">
                    {flaggedTabs.length}
                  </span>
                </div>
                <motion.div
                  animate={{ rotate: showFlagged ? 180 : 0 }}
                  transition={{ duration: 0.2, ease: easeOut }}
                >
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/50" />
                </motion.div>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {flaggedTabs.map((tab) => (
                  <TabCard
                    key={tab.id}
                    id={tab.id}
                    name={tab.tab_name}
                    primaryEntity={tab.primary_entity}
                    status={tab.status}
                    columnCount={tab.columnCount}
                    categoryStats={tab.categoryStats}
                    hasHeaders={tab.header_row >= 0}
                    headerConfirmed={tab.header_confirmed}
                    updatedAt={tab.updated_at}
                    onClick={() => onSelectTab(tab.id)}
                    onStatusChange={(status, notes) => onTabStatusChange?.(tab.id, status, notes)}
                  />
                ))}
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      )}

      {/* Empty state */}
      {tabs.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <LayoutGrid className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="font-medium mb-1">No tabs in this sheet</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Connect a Google Sheet with tabs to start mapping columns.
          </p>
        </div>
      )}
    </motion.div>
  )
}

// Export the constant for use elsewhere
export const OVERVIEW_TAB_ID = '__overview__'
