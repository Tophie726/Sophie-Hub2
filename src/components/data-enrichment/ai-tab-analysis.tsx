'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Sparkles,
  Loader2,
  Building2,
  Users,
  Package,
  Calendar,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Key,
  AlertTriangle,
  Link2,
  Layers,
  XCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'

// =============================================================================
// Types
// =============================================================================

interface TabSummary {
  primary_entity: 'partner' | 'staff' | 'asin' | 'weekly' | 'mixed' | 'unknown'
  confidence: number
  summary: string
  purpose: string
  key_column: string
  column_categories: {
    core_fields?: string[]
    relationship_fields?: string[]
    weekly_date_fields?: string[]
    skip_candidates?: number
  }
  data_quality_notes?: string[]
}

interface AITabAnalysisProps {
  tabName: string
  sourceName?: string
  columnNames: string[]
  sampleRows: string[][]
  /** Data source ID for persistence (optional - if not provided, summary won't persist) */
  dataSourceId?: string
  /** Initial summary loaded from parent state */
  initialSummary?: TabSummary | null
  /** Called when summary is generated - updates parent state */
  onSummaryComplete?: (summary: TabSummary) => void
  className?: string
}

// =============================================================================
// Helpers
// =============================================================================

const entityConfig = {
  partner: { icon: Building2, color: 'text-blue-500', bg: 'bg-blue-500/10', label: 'Partners' },
  staff: { icon: Users, color: 'text-green-500', bg: 'bg-green-500/10', label: 'Staff' },
  asin: { icon: Package, color: 'text-orange-500', bg: 'bg-orange-500/10', label: 'ASINs' },
  weekly: { icon: Calendar, color: 'text-purple-500', bg: 'bg-purple-500/10', label: 'Weekly Data' },
  mixed: { icon: HelpCircle, color: 'text-amber-500', bg: 'bg-amber-500/10', label: 'Mixed' },
  unknown: { icon: HelpCircle, color: 'text-muted-foreground', bg: 'bg-muted', label: 'Unknown' },
}

const getConfidenceColor = (confidence: number) => {
  if (confidence >= 0.8) return 'text-green-600'
  if (confidence >= 0.5) return 'text-amber-600'
  return 'text-red-600'
}

// =============================================================================
// Component
// =============================================================================

export function AITabAnalysis({
  tabName,
  sourceName,
  columnNames,
  sampleRows,
  dataSourceId,
  initialSummary,
  onSummaryComplete,
  className,
}: AITabAnalysisProps) {
  const [summary, setSummary] = useState<TabSummary | null>(initialSummary || null)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingFromDb, setIsLoadingFromDb] = useState(!!dataSourceId && !initialSummary)
  const [error, setError] = useState<string | null>(null)
  const [isExpanded, setIsExpanded] = useState(false) // Start collapsed
  const hasRun = !!summary // If we have a summary (initial or fetched), we've "run"

  // Load existing summary from database on mount
  useEffect(() => {
    if (!dataSourceId || initialSummary) return

    const loadSummary = async () => {
      try {
        const response = await fetch(
          `/api/ai/save-summary?data_source_id=${dataSourceId}&tab_name=${encodeURIComponent(tabName)}`
        )
        if (response.ok) {
          const data = await response.json()
          if (data.data?.summary) {
            setSummary(data.data.summary)
            onSummaryComplete?.(data.data.summary)
          }
        }
      } catch (err) {
        console.warn('Failed to load AI summary:', err)
      } finally {
        setIsLoadingFromDb(false)
      }
    }

    loadSummary()
  }, [dataSourceId, tabName, initialSummary, onSummaryComplete])

  // Save summary to database when generated
  const saveSummaryToDb = async (newSummary: TabSummary) => {
    if (!dataSourceId) return

    try {
      await fetch('/api/ai/save-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data_source_id: dataSourceId,
          tab_name: tabName,
          summary: newSummary,
        }),
      })
    } catch (err) {
      console.warn('Failed to save AI summary:', err)
    }
  }

  const fetchSummary = async () => {
    if (columnNames.length === 0) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/ai/analyze-tab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tab_name: tabName,
          source_name: sourceName,
          column_names: columnNames,
          sample_rows: sampleRows,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error?.message || 'Failed to analyze tab')
      }

      const data = await response.json()
      const newSummary = data.data.summary
      setSummary(newSummary)
      onSummaryComplete?.(newSummary)
      // Persist to database
      saveSummaryToDb(newSummary)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed')
    } finally {
      setIsLoading(false)
    }
  }

  const config = summary ? entityConfig[summary.primary_entity] : null
  const EntityIcon = config?.icon || HelpCircle

  // Loading from database
  if (isLoadingFromDb) {
    return (
      <div className={cn('rounded-lg border bg-card p-4', className)}>
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">Loading saved analysis...</p>
          </div>
        </div>
      </div>
    )
  }

  // Not yet analyzed state
  if (!hasRun && !isLoading) {
    return (
      <div className={cn('rounded-lg border border-dashed border-purple-500/30 bg-purple-500/5 p-4', className)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-500/10">
              <Sparkles className="h-4 w-4 text-purple-500" />
            </div>
            <div>
              <h3 className="text-sm font-medium">AI Tab Summary</h3>
              <p className="text-xs text-muted-foreground">
                Understand what this tab is about before mapping
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={fetchSummary}
            className="bg-purple-500 hover:bg-purple-600 text-white"
          >
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            Summarize
          </Button>
        </div>
      </div>
    )
  }

  // Loading state
  if (isLoading) {
    return (
      <div className={cn('rounded-lg border bg-card p-4', className)}>
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-purple-500" />
          <div>
            <p className="text-sm font-medium">Analyzing tab structure...</p>
            <p className="text-xs text-muted-foreground">
              Understanding what "{tabName}" is about
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className={cn('rounded-lg border border-red-500/30 bg-red-500/5 p-4', className)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <div>
              <p className="text-sm font-medium text-red-600">Analysis failed</p>
              <p className="text-xs text-muted-foreground">{error}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchSummary}>
            Retry
          </Button>
        </div>
      </div>
    )
  }

  // Summary complete
  if (!summary) return null

  const { column_categories } = summary
  const totalCategorized =
    (column_categories.core_fields?.length || 0) +
    (column_categories.relationship_fields?.length || 0) +
    (column_categories.weekly_date_fields?.length || 0)

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <div className={cn('rounded-lg border bg-card overflow-hidden', className)}>
        {/* Summary row - always visible */}
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors text-left">
            {/* Entity icon */}
            <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', config?.bg)}>
              <EntityIcon className={cn('h-5 w-5', config?.color)} />
            </div>

            {/* Main info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{config?.label} Tab</span>
                <Badge variant="outline" className="text-[10px] h-5">
                  <span className={getConfidenceColor(summary.confidence)}>
                    {Math.round(summary.confidence * 100)}% confident
                  </span>
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {summary.summary}
              </p>
            </div>

            {/* Expand indicator */}
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-500" />
              {isExpanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </button>
        </CollapsibleTrigger>

        {/* Expanded details */}
        <CollapsibleContent>
          <motion.div
            initial={false}
            className="px-4 pb-4 pt-0 space-y-4 border-t"
          >
            {/* Purpose */}
            <div className="pt-4">
              <div className="text-xs font-medium text-muted-foreground mb-1">Purpose</div>
              <p className="text-sm">{summary.purpose}</p>
            </div>

            {/* Key column */}
            <div>
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
                <Key className="h-3.5 w-3.5" />
                Key Identifier
              </div>
              <code className="text-sm bg-muted px-2 py-1 rounded">
                {summary.key_column}
              </code>
            </div>

            {/* Column breakdown */}
            <div>
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
                <Layers className="h-3.5 w-3.5" />
                Column Breakdown
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {/* Core fields */}
                {column_categories.core_fields && column_categories.core_fields.length > 0 && (
                  <div className="p-2 rounded bg-blue-500/5 border border-blue-500/20">
                    <div className="flex items-center gap-1.5 text-blue-600 font-medium mb-1">
                      <Building2 className="h-3 w-3" />
                      Core Fields ({column_categories.core_fields.length})
                    </div>
                    <div className="text-muted-foreground">
                      {column_categories.core_fields.slice(0, 3).join(', ')}
                      {column_categories.core_fields.length > 3 && '...'}
                    </div>
                  </div>
                )}

                {/* Relationship fields */}
                {column_categories.relationship_fields && column_categories.relationship_fields.length > 0 && (
                  <div className="p-2 rounded bg-green-500/5 border border-green-500/20">
                    <div className="flex items-center gap-1.5 text-green-600 font-medium mb-1">
                      <Link2 className="h-3 w-3" />
                      Relationships ({column_categories.relationship_fields.length})
                    </div>
                    <div className="text-muted-foreground">
                      {column_categories.relationship_fields.slice(0, 3).join(', ')}
                      {column_categories.relationship_fields.length > 3 && '...'}
                    </div>
                  </div>
                )}

                {/* Weekly fields */}
                {column_categories.weekly_date_fields && column_categories.weekly_date_fields.length > 0 && (
                  <div className="p-2 rounded bg-purple-500/5 border border-purple-500/20">
                    <div className="flex items-center gap-1.5 text-purple-600 font-medium mb-1">
                      <Calendar className="h-3 w-3" />
                      Weekly/Date ({column_categories.weekly_date_fields.length})
                    </div>
                    <div className="text-muted-foreground">
                      {column_categories.weekly_date_fields.slice(0, 3).join(', ')}
                      {column_categories.weekly_date_fields.length > 3 && '...'}
                    </div>
                  </div>
                )}

                {/* Skip candidates */}
                {column_categories.skip_candidates && column_categories.skip_candidates > 0 && (
                  <div className="p-2 rounded bg-muted border border-border">
                    <div className="flex items-center gap-1.5 text-muted-foreground font-medium mb-1">
                      <XCircle className="h-3 w-3" />
                      Likely Skip (~{column_categories.skip_candidates})
                    </div>
                    <div className="text-muted-foreground">
                      Empty or irrelevant columns
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Data quality notes */}
            {summary.data_quality_notes && summary.data_quality_notes.length > 0 && (
              <div>
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Data Quality Notes
                </div>
                <ul className="text-xs text-muted-foreground space-y-1">
                  {summary.data_quality_notes.map((note, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-amber-500 mt-0.5">•</span>
                      {note}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Re-analyze button */}
            <div className="pt-2 flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  fetchSummary()
                }}
                className="text-xs text-muted-foreground"
              >
                <Sparkles className="h-3 w-3 mr-1.5" />
                Re-analyze
              </Button>
            </div>
          </motion.div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

// Export the TabSummary type for use in SmartMapper
export type { TabSummary }
