'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Loader2,
  Palette,
  Plus,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface StatusMapping {
  id: string
  status_pattern: string
  bucket: string
  priority: number
  is_system_default: boolean
  is_active: boolean
  created_at: string
}

interface BucketInfo {
  id: string
  label: string
  color: string
}

interface UnmappedStatus {
  status: string
  count: number
}

// Available colors for bucket customization
const COLOR_OPTIONS = [
  { id: 'green-500', label: 'Green', class: 'bg-green-500' },
  { id: 'emerald-500', label: 'Emerald', class: 'bg-emerald-500' },
  { id: 'teal-500', label: 'Teal', class: 'bg-teal-500' },
  { id: 'blue-500', label: 'Blue', class: 'bg-blue-500' },
  { id: 'indigo-500', label: 'Indigo', class: 'bg-indigo-500' },
  { id: 'purple-500', label: 'Purple', class: 'bg-purple-500' },
  { id: 'pink-500', label: 'Pink', class: 'bg-pink-500' },
  { id: 'rose-500', label: 'Rose', class: 'bg-rose-500' },
  { id: 'red-500', label: 'Red', class: 'bg-red-500' },
  { id: 'orange-500', label: 'Orange', class: 'bg-orange-500' },
  { id: 'amber-500', label: 'Amber', class: 'bg-amber-500' },
  { id: 'yellow-500', label: 'Yellow', class: 'bg-yellow-500' },
  { id: 'gray-400', label: 'Gray', class: 'bg-gray-400' },
  { id: 'gray-500', label: 'Dark Gray', class: 'bg-gray-500' },
]

// Default bucket colors
const DEFAULT_BUCKET_COLORS: Record<string, string> = {
  healthy: 'bg-green-500',
  onboarding: 'bg-blue-500',
  warning: 'bg-amber-500',
  paused: 'bg-gray-400',
  offboarding: 'bg-orange-500',
  churned: 'bg-red-500',
}

// Bucket display order and descriptions
const BUCKET_ORDER = [
  { id: 'healthy', label: 'Healthy', description: 'Partners doing well' },
  { id: 'onboarding', label: 'Onboarding', description: 'New partners being set up' },
  { id: 'warning', label: 'Needs Attention', description: 'Partners with issues' },
  { id: 'paused', label: 'Paused', description: 'Temporarily inactive' },
  { id: 'offboarding', label: 'Offboarding', description: 'Partners leaving' },
  { id: 'churned', label: 'Churned', description: 'Partners who have left' },
]

export function StatusMappingSettings() {
  const [mappings, setMappings] = useState<StatusMapping[]>([])
  const [buckets, setBuckets] = useState<BucketInfo[]>([])
  const [unmapped, setUnmapped] = useState<UnmappedStatus[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [bucketColors, setBucketColors] = useState<Record<string, string>>(DEFAULT_BUCKET_COLORS)
  const [expandedBuckets, setExpandedBuckets] = useState<Set<string>>(new Set(['healthy', 'churned']))

  // Add new pattern state
  const [addingToBucket, setAddingToBucket] = useState<string | null>(null)
  const [newPattern, setNewPattern] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const fetchMappings = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/status-mappings')
      if (response.ok) {
        const json = await response.json()
        const data = json.data || json
        setMappings(data.mappings || [])
        setBuckets(data.buckets || [])
        // Load custom colors if stored
        if (data.bucketColors) {
          setBucketColors(prev => ({ ...prev, ...data.bucketColors }))
        }
      }
    } catch (error) {
      console.error('Failed to fetch mappings:', error)
      toast.error('Failed to load status mappings')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const fetchUnmapped = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/status-mappings/unmapped')
      if (response.ok) {
        const json = await response.json()
        const data = json.data || json
        setUnmapped(data.unmapped || [])
      }
    } catch (error) {
      console.error('Failed to fetch unmapped:', error)
    }
  }, [])

  useEffect(() => {
    fetchMappings().then(() => {
      setTimeout(fetchUnmapped, 100)
    })
  }, [fetchMappings, fetchUnmapped])

  // Group mappings by bucket
  const mappingsByBucket = mappings.reduce((acc, m) => {
    if (!acc[m.bucket]) acc[m.bucket] = []
    acc[m.bucket].push(m)
    return acc
  }, {} as Record<string, StatusMapping[]>)

  const handleAddPattern = async (bucket: string) => {
    if (!newPattern.trim()) {
      toast.error('Please enter a pattern')
      return
    }

    setIsSaving(true)
    try {
      const response = await fetch('/api/admin/status-mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status_pattern: newPattern.toLowerCase().trim(),
          bucket,
          priority: 50,
        }),
      })

      if (response.ok) {
        toast.success('Pattern added')
        setAddingToBucket(null)
        setNewPattern('')
        await fetchMappings()
        await fetchUnmapped()
      } else {
        const json = await response.json()
        toast.error(json.error?.message || 'Failed to add pattern')
      }
    } catch {
      toast.error('Failed to add pattern')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteMapping = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/status-mappings/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast.success('Pattern removed')
        await fetchMappings()
        await fetchUnmapped()
      } else {
        const json = await response.json()
        toast.error(json.error?.message || 'Failed to delete')
      }
    } catch {
      toast.error('Failed to delete pattern')
    }
  }

  const handleQuickMap = async (status: string, bucket: string) => {
    setIsSaving(true)
    try {
      const response = await fetch('/api/admin/status-mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status_pattern: status.toLowerCase().trim(),
          bucket,
          priority: 50,
        }),
      })

      if (response.ok) {
        toast.success(`Mapped "${status}" to ${bucket}`)
        await fetchMappings()
        await fetchUnmapped()
      } else {
        const json = await response.json()
        toast.error(json.error?.message || 'Failed to map')
      }
    } catch {
      toast.error('Failed to map status')
    } finally {
      setIsSaving(false)
    }
  }

  const toggleBucket = (bucketId: string) => {
    setExpandedBuckets(prev => {
      const next = new Set(prev)
      if (next.has(bucketId)) {
        next.delete(bucketId)
      } else {
        next.add(bucketId)
      }
      return next
    })
  }

  const handleColorChange = (bucketId: string, colorClass: string) => {
    setBucketColors(prev => ({ ...prev, [bucketId]: colorClass }))
    // TODO: Save to database when backend supports it
    toast.success('Color updated (preview only - save coming soon)')
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Explanation */}
      <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
        <p className="font-medium text-foreground mb-1">How this works:</p>
        <p>When a partner&apos;s weekly status cell contains text like &quot;On Track - Happy&quot;, we look for matching patterns below to determine the color shown in the heatmap.</p>
      </div>

      {/* Unmapped Statuses Alert */}
      {unmapped.length > 0 && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium text-amber-800 dark:text-amber-300">
                {unmapped.length} unrecognized status{unmapped.length !== 1 ? 'es' : ''}
              </h4>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                These will show as purple. Click a bucket to assign them.
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {unmapped.slice(0, 5).map(({ status, count }) => (
                  <Popover key={status}>
                    <PopoverTrigger asChild>
                      <button className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 dark:bg-amber-900/50 rounded text-xs font-mono hover:bg-amber-200 dark:hover:bg-amber-800/50 transition-colors">
                        {status}
                        <span className="text-amber-500 text-[10px]">({count})</span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-48 p-1" align="start">
                      <div className="text-xs font-medium text-muted-foreground px-2 py-1">Assign to bucket:</div>
                      {BUCKET_ORDER.map(bucket => (
                        <button
                          key={bucket.id}
                          onClick={() => handleQuickMap(status, bucket.id)}
                          disabled={isSaving}
                          className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted transition-colors"
                        >
                          <div className={cn('w-3 h-3 rounded-sm', bucketColors[bucket.id])} />
                          {bucket.label}
                        </button>
                      ))}
                    </PopoverContent>
                  </Popover>
                ))}
                {unmapped.length > 5 && (
                  <span className="text-xs text-amber-600 dark:text-amber-500 py-1">
                    +{unmapped.length - 5} more
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Buckets */}
      <div className="space-y-2">
        {BUCKET_ORDER.map(bucket => {
          const patterns = mappingsByBucket[bucket.id] || []
          const isExpanded = expandedBuckets.has(bucket.id)
          const colorClass = bucketColors[bucket.id] || DEFAULT_BUCKET_COLORS[bucket.id]

          return (
            <Collapsible
              key={bucket.id}
              open={isExpanded}
              onOpenChange={() => toggleBucket(bucket.id)}
            >
              <div className="rounded-lg border border-border overflow-hidden">
                {/* Bucket Header */}
                <CollapsibleTrigger asChild>
                  <button className="w-full flex items-center gap-3 px-3 py-2.5 bg-muted/30 hover:bg-muted/50 transition-colors">
                    <div className={cn('w-4 h-4 rounded-sm shrink-0', colorClass)} />
                    <div className="flex-1 text-left">
                      <span className="font-medium text-sm">{bucket.label}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        {patterns.length} pattern{patterns.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          onClick={(e) => e.stopPropagation()}
                          className="p-1 rounded hover:bg-background transition-colors"
                          title="Change color"
                        >
                          <Palette className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-48 p-2" align="end">
                        <div className="text-xs font-medium text-muted-foreground mb-2">Choose color:</div>
                        <div className="grid grid-cols-7 gap-1">
                          {COLOR_OPTIONS.map(color => (
                            <button
                              key={color.id}
                              onClick={() => handleColorChange(bucket.id, color.class)}
                              className={cn(
                                'w-6 h-6 rounded-sm transition-all hover:scale-110',
                                color.class,
                                colorClass === color.class && 'ring-2 ring-primary ring-offset-1'
                              )}
                              title={color.label}
                            />
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                    <ChevronDown className={cn(
                      'h-4 w-4 text-muted-foreground transition-transform',
                      isExpanded && 'rotate-180'
                    )} />
                  </button>
                </CollapsibleTrigger>

                {/* Bucket Content */}
                <CollapsibleContent>
                  <div className="px-3 py-2 space-y-1.5 border-t border-border/50">
                    <p className="text-xs text-muted-foreground">{bucket.description}</p>

                    {/* Pattern list */}
                    <div className="flex flex-wrap gap-1.5">
                      {patterns.map(mapping => (
                        <div
                          key={mapping.id}
                          className={cn(
                            'inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-mono bg-muted group',
                            !mapping.is_active && 'opacity-50'
                          )}
                        >
                          <span>{mapping.status_pattern}</span>
                          {!mapping.is_system_default && (
                            <button
                              onClick={() => handleDeleteMapping(mapping.id)}
                              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      ))}

                      {/* Add pattern */}
                      {addingToBucket === bucket.id ? (
                        <div className="inline-flex items-center gap-1">
                          <Input
                            value={newPattern}
                            onChange={(e) => setNewPattern(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddPattern(bucket.id)}
                            placeholder="e.g., on track"
                            className="h-7 w-32 text-xs font-mono"
                            autoFocus
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleAddPattern(bucket.id)}
                            disabled={isSaving}
                            className="h-7 w-7 p-0"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => { setAddingToBucket(null); setNewPattern('') }}
                            className="h-7 w-7 p-0"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setAddingToBucket(bucket.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        >
                          <Plus className="h-3 w-3" />
                          Add
                        </button>
                      )}
                    </div>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          )
        })}
      </div>

      <p className="text-xs text-muted-foreground pt-2">
        Patterns are matched case-insensitively as partial text. For example, &quot;on track&quot; matches &quot;On Track - Happy&quot;.
      </p>
    </div>
  )
}
