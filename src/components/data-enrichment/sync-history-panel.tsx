'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  ChevronDown,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'

interface SyncError {
  row: number
  column?: string
  message: string
  severity: 'warning' | 'error'
}

interface SyncRun {
  id: string
  data_source_id: string
  tab_mapping_id: string | null
  status: 'running' | 'completed' | 'failed'
  started_at: string
  completed_at: string | null
  rows_processed: number
  rows_created: number
  rows_updated: number
  rows_skipped: number
  errors: SyncError[] | null
  triggered_by: string | null
  data_sources?: {
    id: string
    name: string
  }
  tab_mappings?: {
    id: string
    tab_name: string
  }
}

interface SyncHistoryPanelProps {
  dataSourceId?: string
  tabMappingId?: string
  limit?: number
  className?: string
  onRefresh?: () => void
}

const easeOut: [number, number, number, number] = [0.22, 1, 0.36, 1]

function formatTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday = date.toDateString() === yesterday.toDateString()

  const timeStr = date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })

  if (isToday) return `Today, ${timeStr}`
  if (isYesterday) return `Yesterday, ${timeStr}`

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function SyncRunItem({ run }: { run: SyncRun }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const hasErrors = run.errors && run.errors.length > 0

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <div
        className={cn(
          'rounded-lg border bg-card transition-colors',
          run.status === 'failed' && 'border-red-200 dark:border-red-900/50',
          hasErrors && run.status === 'completed' && 'border-amber-200 dark:border-amber-900/50'
        )}
      >
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-start gap-3 p-3 text-left hover:bg-muted/50 transition-colors rounded-lg">
            {/* Status icon */}
            <div className="mt-0.5">
              {run.status === 'running' ? (
                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
              ) : run.status === 'completed' ? (
                hasErrors ? (
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                )
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  {formatTime(run.started_at)}
                </span>
                {run.tab_mappings?.tab_name && (
                  <span className="text-xs text-muted-foreground truncate">
                    {run.tab_mappings.tab_name}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 mt-0.5">
                {run.status === 'running' ? (
                  <span className="text-xs text-muted-foreground">Syncing...</span>
                ) : run.status === 'completed' ? (
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {run.rows_processed} rows · {run.rows_created} created · {run.rows_updated} updated
                    {run.rows_skipped > 0 && ` · ${run.rows_skipped} skipped`}
                  </span>
                ) : (
                  <span className="text-xs text-red-600 dark:text-red-400">
                    Sync failed
                  </span>
                )}
              </div>

              {hasErrors && (
                <div className="flex items-center gap-1 mt-1">
                  <AlertTriangle className="h-3 w-3 text-amber-500" />
                  <span className="text-xs text-amber-600 dark:text-amber-400">
                    {run.errors!.length} {run.errors!.length === 1 ? 'error' : 'errors'}
                  </span>
                </div>
              )}
            </div>

            {/* Expand icon */}
            {(hasErrors || run.status === 'failed') && (
              <motion.div
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ duration: 0.2, ease: easeOut }}
                className="mt-0.5"
              >
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </motion.div>
            )}
          </button>
        </CollapsibleTrigger>

        {(hasErrors || run.status === 'failed') && (
          <CollapsibleContent>
            <div className="px-3 pb-3 pt-0">
              <div className="border-t pt-2 space-y-1.5">
                {run.errors?.map((error, i) => (
                  <div
                    key={i}
                    className={cn(
                      'flex items-start gap-2 text-xs p-2 rounded',
                      error.severity === 'error'
                        ? 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300'
                        : 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300'
                    )}
                  >
                    <span className="font-mono text-[10px] bg-black/10 dark:bg-white/10 px-1 rounded">
                      Row {error.row}
                      {error.column && `:${error.column}`}
                    </span>
                    <span>{error.message}</span>
                  </div>
                ))}
                {run.status === 'failed' && !hasErrors && (
                  <div className="text-xs text-red-600 dark:text-red-400 p-2 bg-red-50 dark:bg-red-950/30 rounded">
                    Sync failed unexpectedly. Check server logs for details.
                  </div>
                )}
              </div>
            </div>
          </CollapsibleContent>
        )}
      </div>
    </Collapsible>
  )
}

export function SyncHistoryPanel({
  dataSourceId,
  tabMappingId,
  limit = 10,
  className,
  onRefresh,
}: SyncHistoryPanelProps) {
  const [runs, setRuns] = useState<SyncRun[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchRuns = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (dataSourceId) params.set('data_source_id', dataSourceId)
      if (tabMappingId) params.set('tab_mapping_id', tabMappingId)
      params.set('limit', limit.toString())

      const response = await fetch(`/api/sync/runs?${params}`)
      if (!response.ok) {
        throw new Error('Failed to fetch sync history')
      }

      const json = await response.json()
      setRuns(json.data?.runs || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }, [dataSourceId, tabMappingId, limit])

  useEffect(() => {
    fetchRuns()
  }, [fetchRuns])

  const handleRefresh = () => {
    fetchRuns()
    onRefresh?.()
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">Sync History</h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={isLoading}
          className="h-7 px-2"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
        </Button>
      </div>

      {/* Content */}
      {isLoading && runs.length === 0 ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="text-sm text-red-600 dark:text-red-400 text-center py-4">
          {error}
        </div>
      ) : runs.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-8">
          No sync history yet
        </div>
      ) : (
        <AnimatePresence mode="popLayout">
          <motion.div className="space-y-2">
            {runs.map((run, index) => (
              <motion.div
                key={run.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2, ease: easeOut, delay: index * 0.03 }}
              >
                <SyncRunItem run={run} />
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  )
}
