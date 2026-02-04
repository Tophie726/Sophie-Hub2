'use client'

import { useState } from 'react'
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
  Lightbulb,
  RefreshCw,
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

interface SourceAnalysis {
  primary_entity: 'partner' | 'staff' | 'asin' | 'mixed' | 'unknown'
  confidence: number
  reasoning: string
  key_column_candidates: string[]
  weekly_columns_detected: boolean
  suggested_strategy: string
  tab_summaries?: Array<{
    tab_name: string
    entity_type: string
    confidence: number
  }>
}

interface TabInfo {
  id: string
  tab_name: string
  spreadsheet_id?: string
}

interface AISourceAnalysisProps {
  sourceName: string
  sourceId: string
  spreadsheetId?: string
  tabs: TabInfo[]
  onAnalysisComplete?: (analysis: SourceAnalysis) => void
  className?: string
  /** Compact mode for rendering inside popovers — no outer border/card */
  compact?: boolean
}

// =============================================================================
// Helpers
// =============================================================================

const entityConfig = {
  partner: { icon: Building2, color: 'text-blue-500', bg: 'bg-blue-500/10', label: 'Partners' },
  staff: { icon: Users, color: 'text-green-500', bg: 'bg-green-500/10', label: 'Staff' },
  asin: { icon: Package, color: 'text-orange-500', bg: 'bg-orange-500/10', label: 'ASINs' },
  mixed: { icon: HelpCircle, color: 'text-purple-500', bg: 'bg-purple-500/10', label: 'Mixed' },
  unknown: { icon: HelpCircle, color: 'text-muted-foreground', bg: 'bg-muted', label: 'Unknown' },
}

const getConfidenceLabel = (confidence: number) => {
  if (confidence >= 0.8) return { label: 'High', color: 'text-green-600' }
  if (confidence >= 0.5) return { label: 'Medium', color: 'text-amber-600' }
  return { label: 'Low', color: 'text-red-600' }
}

// =============================================================================
// Component
// =============================================================================

export function AISourceAnalysis({
  sourceName,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  sourceId,
  spreadsheetId,
  tabs,
  onAnalysisComplete,
  className,
  compact,
}: AISourceAnalysisProps) {
  const [analysis, setAnalysis] = useState<SourceAnalysis | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isExpanded, setIsExpanded] = useState(compact ?? false)
  const [hasRun, setHasRun] = useState(false)

  const fetchAnalysis = async () => {
    if (tabs.length === 0 || !spreadsheetId) return

    setIsLoading(true)
    setError(null)

    try {
      // Fetch raw data for up to 5 tabs to analyze
      const tabsToAnalyze = tabs.slice(0, 5)
      const tabData = await Promise.all(
        tabsToAnalyze.map(async (tab) => {
          try {
            const response = await fetch(
              `/api/sheets/raw-rows?id=${spreadsheetId}&tab=${encodeURIComponent(tab.tab_name)}`
            )
            if (!response.ok) return null
            const data = await response.json()
            const rows = data.data?.rows || data.rows || []
            if (rows.length === 0) return null

            return {
              tab_name: tab.tab_name,
              column_names: rows[0] || [],
              sample_values: rows.slice(1, 4),
            }
          } catch {
            return null
          }
        })
      )

      // Filter out failed fetches
      const validTabs = tabData.filter((t): t is NonNullable<typeof t> => t !== null)

      if (validTabs.length === 0) {
        throw new Error('Could not fetch data from any tabs')
      }

      // Call the analysis API
      const response = await fetch('/api/ai/analyze-source', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_name: sourceName,
          tabs: validTabs,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error?.message || 'Failed to analyze source')
      }

      const data = await response.json()
      setAnalysis(data.data.analysis)
      setHasRun(true)
      onAnalysisComplete?.(data.data.analysis)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed')
    } finally {
      setIsLoading(false)
    }
  }

  // Don't auto-run, let user trigger it
  const config = analysis ? entityConfig[analysis.primary_entity] : null
  const confidenceInfo = analysis ? getConfidenceLabel(analysis.confidence) : null
  const EntityIcon = config?.icon || HelpCircle

  // Not yet analyzed state
  if (!hasRun && !isLoading) {
    return (
      <div className={cn(
        compact ? 'p-4' : 'rounded-lg border border-dashed border-purple-500/30 bg-purple-500/5 p-4',
        className
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-500/10">
              <Sparkles className="h-4 w-4 text-purple-500" />
            </div>
            <div>
              <h3 className="text-sm font-medium">AI Source Analysis</h3>
              <p className="text-xs text-muted-foreground">
                Detect primary entity type and mapping strategy
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={fetchAnalysis}
            className="bg-purple-500 hover:bg-purple-600 text-white"
          >
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            Analyze
          </Button>
        </div>
      </div>
    )
  }

  // Loading state
  if (isLoading) {
    return (
      <div className={cn(compact ? 'p-4' : 'rounded-lg border bg-card p-4', className)}>
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-purple-500" />
          <div>
            <p className="text-sm font-medium">Analyzing source structure...</p>
            <p className="text-xs text-muted-foreground">
              Claude is reviewing {tabs.length} tab{tabs.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className={cn(
        compact ? 'p-4' : 'rounded-lg border border-red-500/30 bg-red-500/5 p-4',
        className
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <HelpCircle className="h-5 w-5 text-red-500" />
            <div>
              <p className="text-sm font-medium text-red-600">Analysis failed</p>
              <p className="text-xs text-muted-foreground">{error}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchAnalysis}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Retry
          </Button>
        </div>
      </div>
    )
  }

  // Analysis complete
  if (!analysis) return null

  // Shared detail content (used in both compact and full modes)
  const detailContent = (
    <div className={cn(compact ? 'p-4 space-y-4' : 'px-4 pb-4 pt-0 space-y-4 border-t')}>
      {/* Summary (compact only — full mode shows it in the collapsible trigger) */}
      {compact && (
        <div className="flex items-center gap-3 pb-2">
          <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', config?.bg)}>
            <EntityIcon className={cn('h-4 w-4', config?.color)} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{config?.label} Data</span>
              <Badge variant="outline" className="text-[10px] h-5">
                <span className={confidenceInfo?.color}>
                  {Math.round(analysis.confidence * 100)}% {confidenceInfo?.label}
                </span>
              </Badge>
              {analysis.weekly_columns_detected && (
                <Badge variant="outline" className="text-[10px] h-5 bg-purple-500/10 text-purple-600 border-purple-500/30">
                  <Calendar className="h-3 w-3 mr-1" />
                  Weekly
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {analysis.reasoning}
            </p>
          </div>
        </div>
      )}

      {/* Key columns */}
      {analysis.key_column_candidates.length > 0 && (
        <div className={compact ? '' : 'pt-4'}>
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
            <Key className="h-3.5 w-3.5" />
            Key Column Candidates
          </div>
          <div className="flex flex-wrap gap-1.5">
            {analysis.key_column_candidates.map((col, i) => (
              <code key={i} className="text-xs bg-muted px-2 py-0.5 rounded">
                {col}
              </code>
            ))}
          </div>
        </div>
      )}

      {/* Strategy */}
      <div>
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
          <Lightbulb className="h-3.5 w-3.5" />
          Suggested Strategy
        </div>
        <p className="text-sm text-muted-foreground bg-muted/50 rounded p-3">
          {analysis.suggested_strategy}
        </p>
      </div>

      {/* Per-tab breakdown */}
      {analysis.tab_summaries && analysis.tab_summaries.length > 1 && (
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-2">
            Per-Tab Breakdown
          </div>
          <div className="space-y-1">
            {analysis.tab_summaries.map((tab, i) => {
              const tabConfig = entityConfig[tab.entity_type as keyof typeof entityConfig] || entityConfig.unknown
              const TabIcon = tabConfig.icon
              return (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <TabIcon className={cn('h-3.5 w-3.5', tabConfig.color)} />
                  <span className="truncate flex-1">{tab.tab_name}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {Math.round(tab.confidence * 100)}%
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Re-analyze button */}
      <div className={compact ? '' : 'pt-2'}>
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation()
            fetchAnalysis()
          }}
          className="text-xs text-muted-foreground"
        >
          <RefreshCw className="h-3 w-3 mr-1.5" />
          Re-analyze
        </Button>
      </div>
    </div>
  )

  // Compact mode: render content directly (popover provides container)
  if (compact) {
    return <div className={className}>{detailContent}</div>
  }

  // Full mode: collapsible card
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
                <span className="text-sm font-medium">{config?.label} Data</span>
                <Badge variant="outline" className="text-[10px] h-5">
                  <span className={confidenceInfo?.color}>
                    {Math.round(analysis.confidence * 100)}% {confidenceInfo?.label}
                  </span>
                </Badge>
                {analysis.weekly_columns_detected && (
                  <Badge variant="outline" className="text-[10px] h-5 bg-purple-500/10 text-purple-600 border-purple-500/30">
                    <Calendar className="h-3 w-3 mr-1" />
                    Weekly
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {analysis.reasoning}
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
          <motion.div initial={false}>
            {detailContent}
          </motion.div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}
