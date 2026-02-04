'use client'

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Plus,
  Pencil,
  SkipForward,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ArrowRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import type { EntityType } from '@/types/entities'

// =============================================================================
// Types
// =============================================================================

interface EntityChange {
  entity: EntityType
  keyField: string
  keyValue: string
  type: 'create' | 'update' | 'skip'
  fields: Record<string, unknown>
  existing?: Record<string, unknown>
  skipReason?: string
}

interface SyncError {
  row: number
  column?: string
  message: string
  severity: 'warning' | 'error'
}

export interface TabPreviewResult {
  tabId: string
  tabName: string
  changes: EntityChange[]
  stats: {
    rows_processed: number
    rows_created: number
    rows_updated: number
    rows_skipped: number
    errors: SyncError[]
  }
  error?: string
}

interface SyncPreviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Dry run results per tab */
  previewResults: TabPreviewResult[]
  /** Total number of tabs being analyzed */
  totalTabs?: number
  /** Whether the dry run is still loading */
  isLoadingPreview: boolean
  /** Whether the actual sync is in progress */
  isSyncing: boolean
  /** Callback when user confirms sync */
  onConfirm: () => void
  sourceName: string
}

// =============================================================================
// Constants
// =============================================================================

const easeOut: [number, number, number, number] = [0.22, 1, 0.36, 1]

const ENTITY_COLORS: Record<string, string> = {
  partners: 'text-blue-600 dark:text-blue-400',
  staff: 'text-green-600 dark:text-green-400',
  asins: 'text-orange-600 dark:text-orange-400',
}

const ENTITY_BG: Record<string, string> = {
  partners: 'bg-blue-50 dark:bg-blue-950/30',
  staff: 'bg-green-50 dark:bg-green-950/30',
  asins: 'bg-orange-50 dark:bg-orange-950/30',
}

const ENTITY_LABELS: Record<string, string> = {
  partners: 'Partners',
  staff: 'Staff',
  asins: 'ASINs',
}

// =============================================================================
// Sub-components
// =============================================================================

function StatCard({
  icon: Icon,
  label,
  count,
  color,
}: {
  icon: React.ElementType
  label: string
  count: number
  color: string
}) {
  return (
    <div className={cn('flex items-center gap-2 rounded-lg border px-3 py-2', color)}>
      <Icon className="h-4 w-4" />
      <div>
        <div className="text-lg font-semibold tabular-nums leading-tight">{count}</div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
      </div>
    </div>
  )
}

function ChangeRow({ change }: { change: EntityChange }) {
  const fieldEntries = Object.entries(change.fields)

  return (
    <div className="flex items-start gap-2 py-1.5 px-2 text-xs">
      {/* Type badge */}
      {change.type === 'create' ? (
        <Badge variant="outline" className="text-green-600 border-green-200 dark:border-green-900 text-[10px] px-1.5 py-0 shrink-0">
          NEW
        </Badge>
      ) : change.type === 'update' ? (
        <Badge variant="outline" className="text-blue-600 border-blue-200 dark:border-blue-900 text-[10px] px-1.5 py-0 shrink-0">
          UPD
        </Badge>
      ) : (
        <Badge variant="outline" className="text-muted-foreground border-muted text-[10px] px-1.5 py-0 shrink-0">
          SKIP
        </Badge>
      )}

      {/* Key value */}
      <span className="font-medium truncate max-w-[140px]" title={change.keyValue}>
        {change.keyValue || '(empty)'}
      </span>

      {/* Field info */}
      {change.type !== 'skip' ? (
        <span className="text-muted-foreground ml-auto shrink-0">
          {fieldEntries.length} {fieldEntries.length === 1 ? 'field' : 'fields'}
        </span>
      ) : (
        <span className="text-muted-foreground/70 ml-auto truncate max-w-[140px]" title={change.skipReason}>
          {change.skipReason}
        </span>
      )}
    </div>
  )
}

function UpdateDetailRow({ change }: { change: EntityChange }) {
  const fieldEntries = Object.entries(change.fields)
  const [expanded, setExpanded] = useState(false)

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <CollapsibleTrigger className="w-full">
        <div className="flex items-start gap-2 py-1.5 px-2 text-xs hover:bg-muted/50 rounded transition-colors cursor-pointer">
          <Badge variant="outline" className="text-blue-600 border-blue-200 dark:border-blue-900 text-[10px] px-1.5 py-0 shrink-0">
            UPD
          </Badge>
          <span className="font-medium truncate max-w-[140px]" title={change.keyValue}>
            {change.keyValue}
          </span>
          <span className="text-muted-foreground ml-auto shrink-0 flex items-center gap-1">
            {fieldEntries.length} {fieldEntries.length === 1 ? 'field' : 'fields'}
            <motion.div
              animate={{ rotate: expanded ? 180 : 0 }}
              transition={{ duration: 0.15, ease: easeOut }}
            >
              <ChevronDown className="h-3 w-3" />
            </motion.div>
          </span>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-10 mb-1 space-y-0.5">
          {fieldEntries.map(([field, newValue]) => {
            const oldValue = change.existing?.[field]
            return (
              <div key={field} className="flex items-center gap-1.5 text-[11px] py-0.5 px-2">
                <span className="text-muted-foreground font-mono">{field}</span>
                {oldValue !== undefined && oldValue !== null && (
                  <>
                    <span className="text-muted-foreground/50 line-through truncate max-w-[80px]" title={String(oldValue)}>
                      {String(oldValue)}
                    </span>
                    <ArrowRight className="h-2.5 w-2.5 text-muted-foreground/50 shrink-0" />
                  </>
                )}
                <span className="text-foreground truncate max-w-[100px]" title={String(newValue)}>
                  {String(newValue)}
                </span>
              </div>
            )
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

function EntitySection({
  entity,
  changes,
}: {
  entity: string
  changes: EntityChange[]
}) {
  const [expanded, setExpanded] = useState(true)
  const creates = changes.filter((c) => c.type === 'create')
  const updates = changes.filter((c) => c.type === 'update')
  const skips = changes.filter((c) => c.type === 'skip')

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <CollapsibleTrigger className="w-full">
        <div
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-lg transition-colors hover:bg-muted/50',
            ENTITY_BG[entity]
          )}
        >
          <span className={cn('font-medium text-sm', ENTITY_COLORS[entity])}>
            {ENTITY_LABELS[entity] || entity}
          </span>
          <div className="flex items-center gap-1.5 ml-auto">
            {creates.length > 0 && (
              <span className="text-xs text-green-600 dark:text-green-400 tabular-nums">
                +{creates.length}
              </span>
            )}
            {updates.length > 0 && (
              <span className="text-xs text-blue-600 dark:text-blue-400 tabular-nums">
                ~{updates.length}
              </span>
            )}
            {skips.length > 0 && (
              <span className="text-xs text-muted-foreground tabular-nums">
                /{skips.length}
              </span>
            )}
            <motion.div
              animate={{ rotate: expanded ? 180 : 0 }}
              transition={{ duration: 0.15, ease: easeOut }}
            >
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </motion.div>
          </div>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-1 space-y-px">
          {/* Creates */}
          {creates.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 px-2 pt-1.5 pb-0.5 font-medium">
                New Records
              </div>
              {creates.map((c, i) => (
                <ChangeRow key={`create-${i}`} change={c} />
              ))}
            </div>
          )}

          {/* Updates */}
          {updates.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 px-2 pt-1.5 pb-0.5 font-medium">
                Updates
              </div>
              {updates.map((c, i) => (
                <UpdateDetailRow key={`update-${i}`} change={c} />
              ))}
            </div>
          )}

          {/* Skips (collapsed by default if many) */}
          {skips.length > 0 && (
            <SkipSection skips={skips} />
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

function SkipSection({ skips }: { skips: EntityChange[] }) {
  const [showSkips, setShowSkips] = useState(false)

  if (skips.length <= 3) {
    return (
      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 px-2 pt-1.5 pb-0.5 font-medium">
          Skipped
        </div>
        {skips.map((c, i) => (
          <ChangeRow key={`skip-${i}`} change={c} />
        ))}
      </div>
    )
  }

  return (
    <Collapsible open={showSkips} onOpenChange={setShowSkips}>
      <CollapsibleTrigger className="w-full">
        <div className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground hover:bg-muted/50 rounded transition-colors">
          <SkipForward className="h-3 w-3" />
          <span>{skips.length} rows skipped</span>
          <motion.div
            animate={{ rotate: showSkips ? 180 : 0 }}
            transition={{ duration: 0.15, ease: easeOut }}
            className="ml-auto"
          >
            <ChevronDown className="h-3 w-3" />
          </motion.div>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {skips.map((c, i) => (
          <ChangeRow key={`skip-${i}`} change={c} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  )
}

function TabSection({ result }: { result: TabPreviewResult }) {
  const [expanded, setExpanded] = useState(true)

  // Group changes by entity
  const changesByEntity = useMemo(() => {
    const groups: Record<string, EntityChange[]> = {}
    for (const change of result.changes) {
      const entity = change.entity
      if (!groups[entity]) groups[entity] = []
      groups[entity].push(change)
    }
    return groups
  }, [result.changes])

  const entityKeys = Object.keys(changesByEntity)
  const hasChanges = result.stats.rows_created > 0 || result.stats.rows_updated > 0

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <CollapsibleTrigger className="w-full">
        <div className="flex items-center gap-2 px-3 py-2 border rounded-lg hover:bg-muted/30 transition-colors">
          <span className="text-sm font-medium truncate">{result.tabName}</span>
          <div className="flex items-center gap-2 ml-auto">
            {result.error ? (
              <span className="text-xs text-red-500">Error</span>
            ) : !hasChanges ? (
              <span className="text-xs text-muted-foreground">No changes</span>
            ) : (
              <>
                {result.stats.rows_created > 0 && (
                  <span className="text-xs text-green-600 dark:text-green-400 tabular-nums">
                    +{result.stats.rows_created}
                  </span>
                )}
                {result.stats.rows_updated > 0 && (
                  <span className="text-xs text-blue-600 dark:text-blue-400 tabular-nums">
                    ~{result.stats.rows_updated}
                  </span>
                )}
              </>
            )}
            <motion.div
              animate={{ rotate: expanded ? 180 : 0 }}
              transition={{ duration: 0.15, ease: easeOut }}
            >
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </motion.div>
          </div>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-1 ml-2 space-y-1">
          {result.error ? (
            <div className="text-xs text-red-600 dark:text-red-400 p-2 bg-red-50 dark:bg-red-950/30 rounded">
              {result.error}
            </div>
          ) : entityKeys.length === 0 ? (
            <div className="text-xs text-muted-foreground px-2 py-1">
              No mappings configured for this tab
            </div>
          ) : (
            entityKeys.map((entity) => (
              <EntitySection
                key={entity}
                entity={entity}
                changes={changesByEntity[entity]}
              />
            ))
          )}
          {result.stats.errors.length > 0 && (
            <div className="mt-1">
              <div className="text-[10px] uppercase tracking-wider text-amber-600 dark:text-amber-400 px-2 pt-1 pb-0.5 font-medium flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {result.stats.errors.length} {result.stats.errors.length === 1 ? 'warning' : 'warnings'}
              </div>
              {result.stats.errors.slice(0, 5).map((err, i) => (
                <div
                  key={i}
                  className="text-[11px] text-amber-700 dark:text-amber-300 px-2 py-0.5"
                >
                  Row {err.row}{err.column && `:${err.column}`}: {err.message}
                </div>
              ))}
              {result.stats.errors.length > 5 && (
                <div className="text-[11px] text-muted-foreground px-2 py-0.5">
                  +{result.stats.errors.length - 5} more
                </div>
              )}
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

// =============================================================================
// Main Dialog
// =============================================================================

export function SyncPreviewDialog({
  open,
  onOpenChange,
  previewResults,
  totalTabs,
  isLoadingPreview,
  isSyncing,
  onConfirm,
  sourceName,
}: SyncPreviewDialogProps) {
  // Aggregate stats across all tabs
  const totals = useMemo(() => {
    let creates = 0
    let updates = 0
    let skips = 0
    let errors = 0

    for (const result of previewResults) {
      creates += result.stats.rows_created
      updates += result.stats.rows_updated
      skips += result.stats.rows_skipped
      errors += result.stats.errors.length
      if (result.error) errors++
    }

    return { creates, updates, skips, errors }
  }, [previewResults])

  const hasChanges = totals.creates > 0 || totals.updates > 0
  const _tabsWithChanges = previewResults.filter(
    (r) => r.stats.rows_created > 0 || r.stats.rows_updated > 0
  )
  void _tabsWithChanges // reserved for filtering UI
  const tabsWithErrors = previewResults.filter((r) => r.error)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {isSyncing ? 'Syncing...' : isLoadingPreview ? 'Previewing Changes...' : 'Sync Preview'}
          </DialogTitle>
          <DialogDescription>
            {isSyncing
              ? `Applying changes to ${sourceName}`
              : isLoadingPreview
                ? `Running dry run for ${sourceName}`
                : `Review what will change before syncing ${sourceName}`}
          </DialogDescription>
        </DialogHeader>

        {/* Loading state */}
        {isLoadingPreview && (
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <div className="relative">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              {totalTabs && totalTabs > 0 && (
                <div className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground text-[10px] font-medium rounded-full h-4 w-4 flex items-center justify-center">
                  {previewResults.length}
                </div>
              )}
            </div>
            <div className="text-center">
              <p className="text-sm font-medium">
                {totalTabs && totalTabs > 0
                  ? `Analyzing tab ${previewResults.length + 1} of ${totalTabs}...`
                  : 'Analyzing tabs...'}
              </p>
              {previewResults.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {previewResults[previewResults.length - 1]?.tabName}
                </p>
              )}
            </div>
            {/* Progress bar */}
            {totalTabs && totalTabs > 0 && (
              <div className="w-48 h-1.5 bg-muted rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-primary rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${(previewResults.length / totalTabs) * 100}%` }}
                  transition={{ duration: 0.3, ease: easeOut }}
                />
              </div>
            )}
          </div>
        )}

        {/* Syncing state */}
        {isSyncing && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <p className="text-sm text-muted-foreground">
              Writing changes to database...
            </p>
          </div>
        )}

        {/* Preview results */}
        {!isLoadingPreview && !isSyncing && previewResults.length > 0 && (
          <>
            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-2">
              <StatCard
                icon={Plus}
                label="Create"
                count={totals.creates}
                color={totals.creates > 0 ? 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300' : ''}
              />
              <StatCard
                icon={Pencil}
                label="Update"
                count={totals.updates}
                color={totals.updates > 0 ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300' : ''}
              />
              <StatCard
                icon={SkipForward}
                label="Skip"
                count={totals.skips}
                color=""
              />
            </div>

            {/* Error summary */}
            {tabsWithErrors.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-950/30 rounded-lg text-sm text-red-700 dark:text-red-300">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {tabsWithErrors.length} {tabsWithErrors.length === 1 ? 'tab' : 'tabs'} had errors
              </div>
            )}

            {/* Per-tab details */}
            <ScrollArea className="flex-1 min-h-0 max-h-[40vh]">
              <div className="space-y-2 pr-3">
                {previewResults.map((result) => (
                  <TabSection key={result.tabId} result={result} />
                ))}
              </div>
            </ScrollArea>
          </>
        )}

        {/* No changes state */}
        {!isLoadingPreview && !isSyncing && previewResults.length > 0 && !hasChanges && tabsWithErrors.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
            <p className="text-sm font-medium">Everything is up to date</p>
            <p className="text-xs text-muted-foreground">
              No new records to create or update
            </p>
          </div>
        )}

        {/* Footer */}
        {!isLoadingPreview && !isSyncing && (
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            {hasChanges && (
              <Button onClick={onConfirm} className="gap-1.5">
                <CheckCircle2 className="h-4 w-4" />
                Confirm Sync
                <span className="tabular-nums">
                  ({totals.creates + totals.updates} {totals.creates + totals.updates === 1 ? 'change' : 'changes'})
                </span>
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
