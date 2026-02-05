'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertTriangle,
  Check,
  Edit2,
  Loader2,
  Lock,
  Plus,
  Trash2,
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

const BUCKET_BG_COLORS: Record<string, string> = {
  healthy: 'bg-green-500',
  onboarding: 'bg-blue-500',
  warning: 'bg-amber-500',
  paused: 'bg-gray-400',
  offboarding: 'bg-orange-500',
  churned: 'bg-red-500',
}

export function StatusMappingSettings() {
  const [mappings, setMappings] = useState<StatusMapping[]>([])
  const [buckets, setBuckets] = useState<BucketInfo[]>([])
  const [unmapped, setUnmapped] = useState<UnmappedStatus[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [_isLoadingUnmapped, setIsLoadingUnmapped] = useState(true)
  void _isLoadingUnmapped // reserved for loading UI

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editPattern, setEditPattern] = useState('')
  const [editBucket, setEditBucket] = useState('')
  const [editPriority, setEditPriority] = useState(50)

  // Add new state
  const [isAdding, setIsAdding] = useState(false)
  const [newPattern, setNewPattern] = useState('')
  const [newBucket, setNewBucket] = useState('healthy')
  const [newPriority, setNewPriority] = useState(50)

  // Operation state
  const [isSaving, setIsSaving] = useState(false)

  const fetchMappings = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/status-mappings')
      if (response.ok) {
        const json = await response.json()
        const data = json.data || json
        setMappings(data.mappings || [])
        setBuckets(data.buckets || [])
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
    } finally {
      setIsLoadingUnmapped(false)
    }
  }, [])

  useEffect(() => {
    // Fetch mappings immediately, unmapped lazy-loaded after
    fetchMappings().then(() => {
      // Defer unmapped fetch so UI is responsive first
      setTimeout(fetchUnmapped, 100)
    })
  }, [fetchMappings, fetchUnmapped])

  const handleCreate = async () => {
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
          status_pattern: newPattern,
          bucket: newBucket,
          priority: newPriority,
        }),
      })

      if (response.ok) {
        toast.success('Mapping created')
        setIsAdding(false)
        setNewPattern('')
        setNewBucket('healthy')
        setNewPriority(50)
        await fetchMappings()
        await fetchUnmapped()
      } else {
        const json = await response.json()
        toast.error(json.error?.message || 'Failed to create mapping')
      }
    } catch {
      toast.error('Failed to create mapping')
    } finally {
      setIsSaving(false)
    }
  }

  const handleUpdate = async (id: string) => {
    setIsSaving(true)
    try {
      const response = await fetch(`/api/admin/status-mappings/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status_pattern: editPattern,
          bucket: editBucket,
          priority: editPriority,
        }),
      })

      if (response.ok) {
        toast.success('Mapping updated')
        setEditingId(null)
        await fetchMappings()
        await fetchUnmapped()
      } else {
        const json = await response.json()
        toast.error(json.error?.message || 'Failed to update mapping')
      }
    } catch {
      toast.error('Failed to update mapping')
    } finally {
      setIsSaving(false)
    }
  }

  const handleToggleActive = async (mapping: StatusMapping) => {
    try {
      const response = await fetch(`/api/admin/status-mappings/${mapping.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !mapping.is_active }),
      })

      if (response.ok) {
        toast.success(mapping.is_active ? 'Mapping deactivated' : 'Mapping activated')
        await fetchMappings()
        await fetchUnmapped()
      }
    } catch {
      toast.error('Failed to toggle mapping')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this mapping?')) return

    try {
      const response = await fetch(`/api/admin/status-mappings/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast.success('Mapping deleted')
        await fetchMappings()
        await fetchUnmapped()
      } else {
        const json = await response.json()
        toast.error(json.error?.message || 'Failed to delete mapping')
      }
    } catch {
      toast.error('Failed to delete mapping')
    }
  }

  const handleQuickMap = (status: string, bucket: string) => {
    setNewPattern(status.toLowerCase().trim())
    setNewBucket(bucket)
    setNewPriority(50)
    setIsAdding(true)
  }

  const startEdit = (mapping: StatusMapping) => {
    setEditingId(mapping.id)
    setEditPattern(mapping.status_pattern)
    setEditBucket(mapping.bucket)
    setEditPriority(mapping.priority)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Unmapped Statuses Alert */}
      {unmapped.length > 0 && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium text-amber-800 dark:text-amber-300">
                {unmapped.length} unmapped status{unmapped.length !== 1 ? 'es' : ''} found
              </h4>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                These statuses appear in partner data but don&apos;t match any mapping. They will show as purple (unknown).
              </p>
              <div className="mt-3 space-y-2">
                {unmapped.slice(0, 5).map(({ status, count }) => (
                  <div key={status} className="flex items-center gap-2 text-sm">
                    <code className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/50 rounded text-xs font-mono truncate max-w-[200px]">
                      {status}
                    </code>
                    <span className="text-amber-600 dark:text-amber-500 text-xs">
                      ({count} partner{count !== 1 ? 's' : ''})
                    </span>
                    <Select onValueChange={(bucket) => handleQuickMap(status, bucket)}>
                      <SelectTrigger className="h-6 text-xs w-[100px]">
                        <SelectValue placeholder="Map to..." />
                      </SelectTrigger>
                      <SelectContent>
                        {buckets.map((bucket) => (
                          <SelectItem key={bucket.id} value={bucket.id}>
                            <div className="flex items-center gap-2">
                              <div className={cn('w-2 h-2 rounded-full', BUCKET_BG_COLORS[bucket.id])} />
                              {bucket.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
                {unmapped.length > 5 && (
                  <p className="text-xs text-amber-600 dark:text-amber-500">
                    +{unmapped.length - 5} more unmapped statuses
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add New Mapping */}
      {isAdding ? (
        <div className="rounded-lg border border-border p-4 space-y-3">
          <h4 className="text-sm font-medium">Add New Mapping</h4>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Pattern (lowercase)</label>
              <Input
                value={newPattern}
                onChange={(e) => setNewPattern(e.target.value)}
                placeholder="e.g., at risk"
                className="h-8 text-sm"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Bucket</label>
              <Select value={newBucket} onValueChange={setNewBucket}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {buckets.map((bucket) => (
                    <SelectItem key={bucket.id} value={bucket.id}>
                      <div className="flex items-center gap-2">
                        <div className={cn('w-2 h-2 rounded-full', BUCKET_BG_COLORS[bucket.id])} />
                        {bucket.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Priority (0-200)</label>
              <Input
                type="number"
                value={newPriority}
                onChange={(e) => setNewPriority(parseInt(e.target.value) || 50)}
                min={0}
                max={200}
                className="h-8 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate} disabled={isSaving} className="h-7">
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Check className="h-3.5 w-3.5 mr-1" />}
              Create
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setIsAdding(false)} className="h-7">
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setIsAdding(true)} className="h-8">
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Add Mapping
        </Button>
      )}

      {/* Mappings List */}
      <div className="rounded-lg border border-border overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[1fr_120px_80px_80px_80px] gap-2 px-4 py-2 bg-muted/50 text-xs font-medium text-muted-foreground">
          <div>Pattern</div>
          <div>Bucket</div>
          <div className="text-center">Priority</div>
          <div className="text-center">Status</div>
          <div className="text-right">Actions</div>
        </div>

        {/* Rows */}
        <div className="divide-y divide-border">
          {mappings.map((mapping) => (
            <div
              key={mapping.id}
              className={cn(
                'grid grid-cols-[1fr_120px_80px_80px_80px] gap-2 px-4 py-2.5 items-center',
                !mapping.is_active && 'opacity-50'
              )}
            >
              {editingId === mapping.id ? (
                <>
                  <Input
                    value={editPattern}
                    onChange={(e) => setEditPattern(e.target.value)}
                    className="h-7 text-sm font-mono"
                    disabled={mapping.is_system_default}
                  />
                  <Select value={editBucket} onValueChange={setEditBucket} disabled={mapping.is_system_default}>
                    <SelectTrigger className="h-7 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {buckets.map((bucket) => (
                        <SelectItem key={bucket.id} value={bucket.id}>
                          <div className="flex items-center gap-2">
                            <div className={cn('w-2 h-2 rounded-full', BUCKET_BG_COLORS[bucket.id])} />
                            {bucket.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    value={editPriority}
                    onChange={(e) => setEditPriority(parseInt(e.target.value) || 50)}
                    min={0}
                    max={200}
                    className="h-7 text-sm text-center"
                    disabled={mapping.is_system_default}
                  />
                  <div />
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleUpdate(mapping.id)}
                      disabled={isSaving}
                      className="h-6 w-6 p-0"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingId(null)}
                      className="h-6 w-6 p-0"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
                      {mapping.status_pattern}
                    </code>
                    {mapping.is_system_default && (
                      <Lock className="h-3 w-3 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={cn('w-2.5 h-2.5 rounded-full', BUCKET_BG_COLORS[mapping.bucket])} />
                    <span className="text-sm">
                      {buckets.find(b => b.id === mapping.bucket)?.label || mapping.bucket}
                    </span>
                  </div>
                  <div className="text-center text-sm text-muted-foreground">
                    {mapping.priority}
                  </div>
                  <div className="text-center">
                    <button
                      onClick={() => handleToggleActive(mapping)}
                      className={cn(
                        'text-xs px-2 py-0.5 rounded-full',
                        mapping.is_active
                          ? 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                      )}
                    >
                      {mapping.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </div>
                  <div className="flex items-center justify-end gap-1">
                    {!mapping.is_system_default && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => startEdit(mapping)}
                          className="h-6 w-6 p-0"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(mapping.id)}
                          className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Status patterns are matched case-insensitively as partial text. Higher priority patterns are checked first.
        System defaults (with lock icon) cannot be deleted but can be deactivated.
      </p>
    </div>
  )
}
