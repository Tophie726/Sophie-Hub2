'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  AlertTriangle,
  Check,
  Loader2,
  Trash2,
  ArrowRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface CategorizedStatus {
  status: string
  count: number
  bucket: string
  mappingId: string
}

interface UncategorizedStatus {
  status: string
  count: number
}

// Lifecycle stages in order (kanban columns)
const LIFECYCLE_STAGES = [
  {
    id: 'onboarding',
    label: 'Onboarding',
    color: 'bg-blue-500',
    borderColor: 'border-blue-200 dark:border-blue-900/50',
    bgColor: 'bg-blue-50/50 dark:bg-blue-950/20',
    description: 'New partners being set up',
  },
  {
    id: 'healthy',
    label: 'Active',
    color: 'bg-green-500',
    borderColor: 'border-green-200 dark:border-green-900/50',
    bgColor: 'bg-green-50/50 dark:bg-green-950/20',
    description: 'Healthy, on track',
  },
  {
    id: 'warning',
    label: 'At Risk',
    color: 'bg-amber-500',
    borderColor: 'border-amber-200 dark:border-amber-900/50',
    bgColor: 'bg-amber-50/50 dark:bg-amber-950/20',
    description: 'Needs attention',
  },
  {
    id: 'paused',
    label: 'Paused',
    color: 'bg-gray-400',
    borderColor: 'border-gray-200 dark:border-gray-700',
    bgColor: 'bg-gray-50/50 dark:bg-gray-900/20',
    description: 'Temporarily inactive',
  },
  {
    id: 'offboarding',
    label: 'Offboarding',
    color: 'bg-orange-500',
    borderColor: 'border-orange-200 dark:border-orange-900/50',
    bgColor: 'bg-orange-50/50 dark:bg-orange-950/20',
    description: 'Leaving soon',
  },
  {
    id: 'churned',
    label: 'Churned',
    color: 'bg-red-500',
    borderColor: 'border-red-200 dark:border-red-900/50',
    bgColor: 'bg-red-50/50 dark:bg-red-950/20',
    description: 'Left/cancelled',
  },
]

// Bucket colors used by status chips
const _BUCKET_COLORS: Record<string, string> = {
  healthy: 'bg-green-500',
  onboarding: 'bg-blue-500',
  warning: 'bg-amber-500',
  paused: 'bg-gray-400',
  offboarding: 'bg-orange-500',
  churned: 'bg-red-500',
  unknown: 'bg-purple-500',
}
void _BUCKET_COLORS // Suppress unused warning - may be used in future

export function StatusMappingSettings() {
  const [categorized, setCategorized] = useState<CategorizedStatus[]>([])
  const [uncategorized, setUncategorized] = useState<UncategorizedStatus[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const fetchStatuses = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/status-mappings/all-statuses')
      if (response.ok) {
        const json = await response.json()
        const data = json.data || json
        setCategorized(data.categorized || [])
        setUncategorized(data.uncategorized || [])
      }
    } catch (error) {
      console.error('Failed to fetch statuses:', error)
      toast.error('Failed to load statuses')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStatuses()
  }, [fetchStatuses])

  const handleAssignColor = async (status: string, bucket: string) => {
    setIsSaving(true)
    try {
      const response = await fetch('/api/admin/status-mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status_pattern: status,
          bucket,
          priority: 100,
        }),
      })

      if (response.ok) {
        toast.success(`Assigned "${status}" → ${bucket}`)
        await fetchStatuses()
      } else {
        const json = await response.json()
        toast.error(json.error?.message || 'Failed to assign')
      }
    } catch {
      toast.error('Failed to assign color')
    } finally {
      setIsSaving(false)
    }
  }

  const handleRemoveMapping = async (mappingId: string, status: string) => {
    try {
      const response = await fetch(`/api/admin/status-mappings/${mappingId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast.success(`Removed color from "${status}"`)
        await fetchStatuses()
      } else {
        const json = await response.json()
        toast.error(json.error?.message || 'Failed to remove')
      }
    } catch {
      toast.error('Failed to remove')
    }
  }

  const handleChangeColor = async (mappingId: string, status: string, newBucket: string, currentBucket: string) => {
    if (newBucket === currentBucket) return

    setIsSaving(true)
    try {
      const response = await fetch(`/api/admin/status-mappings/${mappingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bucket: newBucket }),
      })

      if (response.ok) {
        toast.success(`Moved "${status}" → ${newBucket}`)
        await fetchStatuses()
      } else {
        const json = await response.json()
        toast.error(json.error?.message || 'Failed to change')
      }
    } catch {
      toast.error('Failed to change color')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Group categorized statuses by bucket
  const statusesByBucket: Record<string, CategorizedStatus[]> = {}
  for (const stage of LIFECYCLE_STAGES) {
    statusesByBucket[stage.id] = categorized.filter(s => s.bucket === stage.id)
  }

  const totalStatuses = categorized.length + uncategorized.length

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="flex flex-wrap items-center gap-2 md:gap-4 text-xs md:text-sm">
        <span className="text-muted-foreground">
          {totalStatuses} unique statuses
        </span>
        <span className="text-green-600 dark:text-green-400">
          {categorized.length} categorized
        </span>
        {uncategorized.length > 0 && (
          <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5" />
            {uncategorized.length} need colors
          </span>
        )}
      </div>

      {/* Uncategorized Section */}
      {uncategorized.length > 0 && (
        <div className="rounded-lg border-2 border-dashed border-purple-300 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20 p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 rounded-sm bg-purple-500" />
            <span className="text-sm font-medium">Needs Assignment</span>
            <span className="text-xs text-muted-foreground">→ Click to assign a stage</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {uncategorized.map(({ status, count }) => (
              <Popover key={status}>
                <PopoverTrigger asChild>
                  <button
                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-purple-100 dark:bg-purple-900/40 border border-purple-200 dark:border-purple-800 text-xs hover:bg-purple-200 dark:hover:bg-purple-900/60 transition-colors"
                    disabled={isSaving}
                  >
                    <span className="font-medium truncate max-w-[150px]">{status}</span>
                    <span className="text-muted-foreground shrink-0">({count})</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-1.5" align="start">
                  <div className="text-xs text-muted-foreground px-2 py-1 mb-1">
                    Move to:
                  </div>
                  {LIFECYCLE_STAGES.map(stage => (
                    <button
                      key={stage.id}
                      onClick={() => handleAssignColor(status, stage.id)}
                      disabled={isSaving}
                      className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-muted transition-colors text-left"
                    >
                      <div className={cn('w-3 h-3 rounded-sm shrink-0', stage.color)} />
                      <span className="font-medium">{stage.label}</span>
                    </button>
                  ))}
                </PopoverContent>
              </Popover>
            ))}
          </div>
        </div>
      )}

      {/* Kanban Columns */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-2 px-2">
        {LIFECYCLE_STAGES.map((stage, idx) => {
          const statuses = statusesByBucket[stage.id] || []
          const isLast = idx === LIFECYCLE_STAGES.length - 1

          return (
            <div key={stage.id} className="flex items-stretch gap-2">
              {/* Column */}
              <div
                className={cn(
                  'flex-shrink-0 w-[140px] rounded-lg border p-2',
                  stage.borderColor,
                  stage.bgColor
                )}
              >
                {/* Column Header */}
                <div className="flex items-center gap-1.5 mb-2">
                  <div className={cn('w-2.5 h-2.5 rounded-sm', stage.color)} />
                  <span className="text-xs font-semibold">{stage.label}</span>
                  {statuses.length > 0 && (
                    <span className="text-[10px] text-muted-foreground ml-auto">
                      {statuses.length}
                    </span>
                  )}
                </div>

                {/* Status List */}
                <div className="space-y-1 min-h-[60px]">
                  {statuses.length === 0 ? (
                    <div className="text-[10px] text-muted-foreground/60 text-center py-4">
                      No statuses
                    </div>
                  ) : (
                    statuses.map(({ status, count, mappingId, bucket }) => (
                      <Popover key={status}>
                        <PopoverTrigger asChild>
                          <button
                            className="w-full text-left px-1.5 py-1 rounded bg-background/80 border border-border/50 text-[11px] hover:bg-background transition-colors group"
                            disabled={isSaving}
                          >
                            <div className="font-medium truncate">{status}</div>
                            <div className="text-muted-foreground text-[10px]">{count} uses</div>
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-48 p-1.5" align="start">
                          <div className="text-xs text-muted-foreground px-2 py-1 mb-1">
                            Move to:
                          </div>
                          {LIFECYCLE_STAGES.map(targetStage => (
                            <button
                              key={targetStage.id}
                              onClick={() => handleChangeColor(mappingId, status, targetStage.id, bucket)}
                              disabled={isSaving}
                              className={cn(
                                'w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-muted transition-colors text-left',
                                bucket === targetStage.id && 'bg-muted'
                              )}
                            >
                              <div className={cn('w-3 h-3 rounded-sm shrink-0', targetStage.color)} />
                              <span className="font-medium">{targetStage.label}</span>
                              {bucket === targetStage.id && (
                                <Check className="h-3 w-3 ml-auto text-green-500" />
                              )}
                            </button>
                          ))}
                          <div className="border-t border-border mt-1 pt-1">
                            <button
                              onClick={() => handleRemoveMapping(mappingId, status)}
                              className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded text-destructive hover:bg-destructive/10 transition-colors text-left"
                            >
                              <Trash2 className="h-3 w-3" />
                              Remove
                            </button>
                          </div>
                        </PopoverContent>
                      </Popover>
                    ))
                  )}
                </div>
              </div>

              {/* Arrow between columns */}
              {!isLast && (
                <div className="flex items-center">
                  <ArrowRight className="h-3 w-3 text-muted-foreground/30" />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Empty state */}
      {totalStatuses === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <p>No weekly status data found.</p>
          <p className="text-sm mt-1">Sync some partners to see their statuses here.</p>
        </div>
      )}

      <p className="text-[10px] text-muted-foreground">
        Statuses flow through lifecycle: Onboarding → Active → At Risk → Paused → Offboarding → Churned
      </p>
    </div>
  )
}
