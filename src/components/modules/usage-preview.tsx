'use client'

import { useState, useEffect, useCallback } from 'react'
import { DollarSign, Activity, Database, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { formatCurrency, formatBytes, formatCompact } from '@/lib/reporting/formatters'
import type { UsageData } from '@/types/usage'

/** Colors for source breakdown */
const SOURCE_COLORS: Record<string, string> = {
  'Sophie Hub': 'bg-blue-500',
  'Daton (Sync)': 'bg-amber-500',
  'BI Tools': 'bg-purple-500',
  'Team Queries': 'bg-emerald-500',
  'Other': 'bg-gray-400',
}

interface UsagePreviewProps {
  moduleSlug: string
  onViewDetails: () => void
}

export function UsagePreview({ moduleSlug, onViewDetails }: UsagePreviewProps) {
  if (moduleSlug !== 'amazon-reporting') return null
  return <UsagePreviewInner onViewDetails={onViewDetails} />
}

function UsagePreviewInner({ onViewDetails }: { onViewDetails: () => void }) {
  const [data, setData] = useState<UsageData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchUsage = useCallback(async () => {
    try {
      const res = await fetch('/api/bigquery/usage?period=30d')
      if (!res.ok) return
      const json = await res.json()
      setData(json.data)
    } catch {
      // Silent fail for preview
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsage()
  }, [fetchUsage])

  if (isLoading) return null
  if (!data) return null

  const { overview, sourceBreakdown } = data
  const nonEmpty = sourceBreakdown.filter((s) => s.estimated_cost > 0)
  const totalPct = nonEmpty.reduce((sum, s) => sum + s.pct, 0)

  return (
    <TooltipProvider delayDuration={100}>
      <button
        onClick={onViewDetails}
        className={cn(
          'w-full rounded-xl p-4 text-left transition-all',
          'hover:bg-muted/40 active:scale-[0.995]',
          'group',
        )}
        style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.08)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              BigQuery Usage (30d)
            </span>
          </div>
          <span className="flex items-center gap-1 text-xs text-muted-foreground group-hover:text-primary transition-colors">
            View details
            <ArrowRight className="h-3 w-3" />
          </span>
        </div>

        {/* Key stats */}
        <div className="flex items-baseline gap-4 mb-3">
          <div>
            <span
              className="text-xl font-bold text-foreground"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {formatCurrency(overview.total_cost_usd)}
            </span>
            <span className="text-xs text-muted-foreground ml-1.5">cost</span>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Activity className="h-3 w-3" />
            <span className="text-xs" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {formatCompact(overview.total_queries)} queries
            </span>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Database className="h-3 w-3" />
            <span className="text-xs" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {formatBytes(overview.total_bytes_processed)}
            </span>
          </div>
        </div>

        {/* Source bar */}
        {nonEmpty.length > 0 && (
          <div className="flex items-center gap-3">
            <div className="h-2 flex-1 flex rounded-full overflow-hidden bg-muted/50">
              {nonEmpty.map((s) => (
                <Tooltip key={s.source}>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        'h-full',
                        SOURCE_COLORS[s.source] || 'bg-gray-400',
                      )}
                      style={{ width: `${Math.max((s.pct / (totalPct || 1)) * 100, 2)}%` }}
                    />
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    <span className="font-medium">{s.source}</span>: {formatCurrency(s.estimated_cost)} ({s.pct.toFixed(0)}%)
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
            {/* Mini legend — top 2 sources */}
            <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground flex-shrink-0">
              {nonEmpty.slice(0, 2).map((s) => (
                <span key={s.source} className="flex items-center gap-1">
                  <div className={cn('w-1.5 h-1.5 rounded-full', SOURCE_COLORS[s.source] || 'bg-gray-400')} />
                  {s.source}
                </span>
              ))}
            </div>
          </div>
        )}
      </button>
    </TooltipProvider>
  )
}
