'use client'

import { useState, useEffect, useRef } from 'react'
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

interface ColumnMapping {
  column_name: string
  category: string | null
  target_field: string | null
}

interface AITabAnalysisProps {
  tabName: string
  sourceName?: string
  columnNames: string[]
  sampleRows: string[][]
  /** Data source ID for persistence */
  dataSourceId?: string
  /** Initial summary loaded from parent state */
  initialSummary?: TabSummary | null
  /** Current column mappings - passed to AI for context */
  currentMappings?: ColumnMapping[]
  /** Whether all columns have been classified */
  allColumnsClassified?: boolean
  /** Called when summary is generated */
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
  currentMappings,
  allColumnsClassified = false,
  onSummaryComplete,
  className,
}: AITabAnalysisProps) {
  const [summary, setSummary] = useState<TabSummary | null>(initialSummary || null)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingFromDb, setIsLoadingFromDb] = useState(!!dataSourceId && !initialSummary)
  const [error, setError] = useState<string | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)
  const hasRun = !!summary
  const autoRanRef = useRef(false)

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataSourceId, tabName])

  // Auto-run when all columns are classified
  useEffect(() => {
    if (allColumnsClassified && !autoRanRef.current && !isLoading) {
      autoRanRef.current = true
      fetchSummary()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allColumnsClassified])

  // Save summary to database
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
          existing_mappings: currentMappings?.filter(m => m.category),
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
          <p className="text-sm text-muted-foreground">Loading saved analysis...</p>
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
                Understand what this tab is about
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
            <p className="text-sm font-medium">Analyzing tab...</p>
            <p className="text-xs text-muted-foreground">
              Understanding what &ldquo;{tabName}&rdquo; is about
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

  if (!summary) return null

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <div className={cn('rounded-lg border bg-card overflow-hidden', className)}>
        {/* Collapsed summary - always visible */}
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left">
            <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', config?.bg)}>
              <EntityIcon className={cn('h-4 w-4', config?.color)} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{config?.label} Tab</span>
                <Badge variant="outline" className="text-[10px] h-5">
                  <span className={getConfidenceColor(summary.confidence)}>
                    {Math.round(summary.confidence * 100)}%
                  </span>
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {summary.summary}
              </p>
            </div>

            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-purple-500" />
              {isExpanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </button>
        </CollapsibleTrigger>

        {/* Expanded: purpose, key, quality notes, re-analyze */}
        <CollapsibleContent>
          <div className="px-4 pb-3 pt-0 space-y-3 border-t">
            {/* Purpose */}
            <div className="pt-3">
              <p className="text-sm">{summary.purpose}</p>
            </div>

            {/* Key column */}
            <div className="flex items-center gap-2">
              <Key className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Key:</span>
              <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                {summary.key_column}
              </code>
            </div>

            {/* Data quality notes */}
            {summary.data_quality_notes && summary.data_quality_notes.length > 0 && (
              <div>
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-1.5">
                  <AlertTriangle className="h-3 w-3" />
                  Data Quality
                </div>
                <ul className="text-xs text-muted-foreground space-y-0.5">
                  {summary.data_quality_notes.map((note, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-amber-500 mt-0.5">•</span>
                      {note}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Re-analyze */}
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  fetchSummary()
                }}
                className="text-xs text-muted-foreground h-7"
              >
                <Sparkles className="h-3 w-3 mr-1" />
                Re-analyze
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

export type { TabSummary }
