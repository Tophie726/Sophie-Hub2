'use client'

import { Link2, FileSpreadsheet, Layers, Columns3, Clock } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { FieldLineageInfo } from '@/types/lineage'

interface LineageIndicatorProps {
  lineage: FieldLineageInfo | null | undefined
  className?: string
}

/**
 * Format timestamp as relative time (e.g., "2 days ago")
 */
function formatRelativeTime(dateStr: string): string {
  try {
    const date = new Date(dateStr)
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
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch {
    return dateStr
  }
}

/**
 * Format a value for display in tooltip
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) return 'empty'
  if (typeof value === 'string') return value.length > 50 ? value.slice(0, 50) + '...' : value
  if (typeof value === 'number') return value.toLocaleString()
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (Array.isArray(value)) return value.join(', ')
  return String(value)
}

function LineageTooltipContent({ lineage }: { lineage: FieldLineageInfo }) {
  return (
    <div className="space-y-1.5 text-xs">
      {lineage.sheetName && (
        <div className="flex items-center gap-1.5">
          <FileSpreadsheet className="h-3 w-3 text-green-500 shrink-0" />
          <span className="text-muted-foreground">Source:</span>
          <span className="font-medium truncate max-w-[180px]">{lineage.sheetName}</span>
        </div>
      )}
      {lineage.tabName && (
        <div className="flex items-center gap-1.5">
          <Layers className="h-3 w-3 text-blue-500 shrink-0" />
          <span className="text-muted-foreground">Tab:</span>
          <span className="font-medium truncate max-w-[180px]">{lineage.tabName}</span>
        </div>
      )}
      {lineage.columnName && (
        <div className="flex items-center gap-1.5">
          <Columns3 className="h-3 w-3 text-purple-500 shrink-0" />
          <span className="text-muted-foreground">Column:</span>
          <span className="font-medium truncate max-w-[180px]">{lineage.columnName}</span>
        </div>
      )}
      <div className="flex items-center gap-1.5 pt-1 border-t border-border/50">
        <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
        <span className="text-muted-foreground">
          Synced {formatRelativeTime(lineage.changedAt)}
        </span>
      </div>
      {lineage.previousValue !== null && lineage.previousValue !== undefined && (
        <div className="pt-1 text-muted-foreground/80 italic text-[11px]">
          Previous: {formatValue(lineage.previousValue)}
        </div>
      )}
    </div>
  )
}

export function LineageIndicator({ lineage, className }: LineageIndicatorProps) {
  if (!lineage) return null

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'inline-flex items-center ml-1.5 text-muted-foreground/40 hover:text-muted-foreground/70 cursor-help transition-colors',
              className
            )}
          >
            <Link2 className="h-3 w-3" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" align="start" className="max-w-xs">
          <LineageTooltipContent lineage={lineage} />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
