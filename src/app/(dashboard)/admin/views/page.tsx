'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import {
  Plus,
  Trash2,
  ChevronRight,
  Loader2,
  Eye,
  Shield,
  Users,
  Building2,
  Star,
  X,
} from 'lucide-react'
import { easeOutStandard, duration } from '@/lib/animations'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ViewProfile {
  id: string
  slug: string
  name: string
  description: string | null
  is_default: boolean
  is_active: boolean
  created_at: string
  rule_count: number
}

interface AudienceRule {
  id: string
  view_id: string
  tier: number
  target_type: string
  target_id: string | null
  priority: number
  is_active: boolean
  created_at: string
}

interface ViewDetail extends ViewProfile {
  view_audience_rules: AudienceRule[]
  view_profile_modules: unknown[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const TIER_LABELS: Record<number, string> = {
  1: 'Staff',
  2: 'Role',
  3: 'Partner',
  4: 'Partner Type',
  5: 'Default',
}

const TARGET_TYPE_ICONS: Record<string, React.ReactNode> = {
  staff: <Users className="h-3.5 w-3.5" />,
  role: <Shield className="h-3.5 w-3.5" />,
  partner: <Building2 className="h-3.5 w-3.5" />,
  partner_type: <Building2 className="h-3.5 w-3.5" />,
  default: <Eye className="h-3.5 w-3.5" />,
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ViewsAdminPage() {
  const [views, setViews] = useState<ViewProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedViewId, setSelectedViewId] = useState<string | null>(null)
  const [selectedView, setSelectedView] = useState<ViewDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Create dialog state
  const [createOpen, setCreateOpen] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createSlug, setCreateSlug] = useState('')
  const [createDesc, setCreateDesc] = useState('')
  const [createSubmitting, setCreateSubmitting] = useState(false)

  // Delete dialog state
  const [deleteTarget, setDeleteTarget] = useState<ViewProfile | null>(null)
  const [deleteSubmitting, setDeleteSubmitting] = useState(false)

  // Add rule state
  const [addRuleType, setAddRuleType] = useState<string>('')
  const [addRuleTargetId, setAddRuleTargetId] = useState('')
  const [addRulePriority, setAddRulePriority] = useState('0')
  const [addRuleSubmitting, setAddRuleSubmitting] = useState(false)

  // Fetch views list
  const fetchViews = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/views')
      if (!res.ok) throw new Error('Failed to fetch views')
      const json = await res.json()
      setViews(json.data?.views || [])
    } catch {
      toast.error('Failed to load views')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchViews()
  }, [fetchViews])

  // Fetch view detail
  const fetchViewDetail = useCallback(async (viewId: string) => {
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/admin/views/${viewId}`)
      if (!res.ok) throw new Error('Failed to fetch view')
      const json = await res.json()
      setSelectedView(json.data?.view || null)
    } catch {
      toast.error('Failed to load view details')
    } finally {
      setDetailLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedViewId) {
      fetchViewDetail(selectedViewId)
    } else {
      setSelectedView(null)
    }
  }, [selectedViewId, fetchViewDetail])

  // Create view
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!createName.trim() || !createSlug.trim()) return

    setCreateSubmitting(true)
    try {
      const res = await fetch('/api/admin/views', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createName.trim(),
          slug: createSlug.trim(),
          description: createDesc.trim() || undefined,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error?.message || 'Failed to create view')
        return
      }

      toast.success('View created')
      setCreateOpen(false)
      setCreateName('')
      setCreateSlug('')
      setCreateDesc('')
      fetchViews()
    } catch {
      toast.error('Failed to create view')
    } finally {
      setCreateSubmitting(false)
    }
  }

  // Delete view
  async function handleDelete() {
    if (!deleteTarget) return

    setDeleteSubmitting(true)
    try {
      const res = await fetch(`/api/admin/views/${deleteTarget.id}`, {
        method: 'DELETE',
      })

      if (!res.ok && res.status !== 204) {
        toast.error('Failed to delete view')
        return
      }

      toast.success('View deleted')
      setDeleteTarget(null)
      if (selectedViewId === deleteTarget.id) {
        setSelectedViewId(null)
      }
      fetchViews()
    } catch {
      toast.error('Failed to delete view')
    } finally {
      setDeleteSubmitting(false)
    }
  }

  // Toggle view active/default
  async function handleToggleField(viewId: string, field: 'is_active' | 'is_default', value: boolean) {
    try {
      const res = await fetch(`/api/admin/views/${viewId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      })

      if (!res.ok) {
        toast.error(`Failed to update view`)
        return
      }

      fetchViews()
      if (selectedViewId === viewId) {
        fetchViewDetail(viewId)
      }
    } catch {
      toast.error('Failed to update view')
    }
  }

  // Add audience rule
  async function handleAddRule(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedViewId || !addRuleType) return

    setAddRuleSubmitting(true)
    try {
      const res = await fetch(`/api/admin/views/${selectedViewId}/rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_type: addRuleType,
          target_id: addRuleType === 'default' ? null : addRuleTargetId.trim() || null,
          priority: parseInt(addRulePriority) || 0,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error?.message || 'Failed to add rule')
        return
      }

      toast.success('Rule added')
      setAddRuleType('')
      setAddRuleTargetId('')
      setAddRulePriority('0')
      fetchViewDetail(selectedViewId)
      fetchViews() // Update rule count
    } catch {
      toast.error('Failed to add rule')
    } finally {
      setAddRuleSubmitting(false)
    }
  }

  // Delete audience rule
  async function handleDeleteRule(ruleId: string) {
    if (!selectedViewId) return

    try {
      const res = await fetch(`/api/admin/views/${selectedViewId}/rules/${ruleId}`, {
        method: 'DELETE',
      })

      if (!res.ok && res.status !== 204) {
        toast.error('Failed to remove rule')
        return
      }

      toast.success('Rule removed')
      fetchViewDetail(selectedViewId)
      fetchViews()
    } catch {
      toast.error('Failed to remove rule')
    }
  }

  return (
    <div className="min-h-screen">
      <PageHeader title="Views" description="Manage view profiles and audience rules">
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="h-10 md:h-9">
              <Plus className="h-4 w-4 md:mr-1.5" />
              <span className="hidden md:inline">New View</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[95vw] md:max-w-md">
            <DialogHeader>
              <DialogTitle>Create View</DialogTitle>
              <DialogDescription>
                Create a new view profile. Audience rules can be added after creation.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="view-name" className="text-sm font-medium">
                  Name
                </label>
                <Input
                  id="view-name"
                  value={createName}
                  onChange={(e) => {
                    setCreateName(e.target.value)
                    setCreateSlug(slugify(e.target.value))
                  }}
                  placeholder="e.g. Pod Leader Dashboard"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="view-slug" className="text-sm font-medium">
                  Slug
                </label>
                <Input
                  id="view-slug"
                  value={createSlug}
                  onChange={(e) => setCreateSlug(e.target.value)}
                  placeholder="pod-leader-dashboard"
                  pattern="^[a-z0-9-]+$"
                />
                <p className="text-xs text-muted-foreground">
                  Lowercase letters, numbers, and hyphens only.
                </p>
              </div>
              <div className="space-y-2">
                <label htmlFor="view-desc" className="text-sm font-medium">
                  Description <span className="text-muted-foreground">(optional)</span>
                </label>
                <Input
                  id="view-desc"
                  value={createDesc}
                  onChange={(e) => setCreateDesc(e.target.value)}
                  placeholder="What this view is for..."
                />
              </div>
              <DialogFooter>
                <Button
                  type="submit"
                  disabled={!createName.trim() || !createSlug.trim() || createSubmitting}
                >
                  {createSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                  Create View
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <div className="p-4 md:p-8">
        {loading ? (
          <ViewsListSkeleton />
        ) : views.length === 0 ? (
          <EmptyState onCreateClick={() => setCreateOpen(true)} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-6">
            {/* Views list */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground mb-3">
                {views.length} view{views.length !== 1 ? 's' : ''}
              </h3>
              <div className="space-y-1.5">
                {views.map((view) => (
                  <button
                    key={view.id}
                    type="button"
                    onClick={() => setSelectedViewId(view.id)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors',
                      'hover:bg-accent/50 active:scale-[0.99]',
                      selectedViewId === view.id
                        ? 'border-primary/30 bg-primary/5'
                        : 'border-border/40'
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{view.name}</span>
                        {view.is_default && (
                          <Star className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground font-mono">
                          {view.slug}
                        </span>
                        <Badge
                          variant={view.is_active ? 'default' : 'secondary'}
                          className="text-[10px] h-4 px-1.5"
                        >
                          {view.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                        {view.rule_count > 0 && (
                          <span className="text-[10px] text-muted-foreground">
                            {view.rule_count} rule{view.rule_count !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeleteTarget(view)
                        }}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        aria-label={`Delete ${view.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* View detail panel */}
            <AnimatePresence mode="wait">
              {selectedViewId && (
                <motion.div
                  key={selectedViewId}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: duration.ui, ease: easeOutStandard }}
                  className="border border-border/40 rounded-xl bg-card p-5"
                >
                  {detailLoading ? (
                    <DetailSkeleton />
                  ) : selectedView ? (
                    <ViewDetailPanel
                      view={selectedView}
                      onToggleField={handleToggleField}
                      onAddRule={handleAddRule}
                      onDeleteRule={handleDeleteRule}
                      addRuleType={addRuleType}
                      setAddRuleType={setAddRuleType}
                      addRuleTargetId={addRuleTargetId}
                      setAddRuleTargetId={setAddRuleTargetId}
                      addRulePriority={addRulePriority}
                      setAddRulePriority={setAddRulePriority}
                      addRuleSubmitting={addRuleSubmitting}
                      onClose={() => setSelectedViewId(null)}
                    />
                  ) : null}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete View</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This will also
              remove all audience rules and module assignments. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteSubmitting}
            >
              {deleteSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ---------------------------------------------------------------------------
// View Detail Panel
// ---------------------------------------------------------------------------

interface ViewDetailPanelProps {
  view: ViewDetail
  onToggleField: (viewId: string, field: 'is_active' | 'is_default', value: boolean) => void
  onAddRule: (e: React.FormEvent) => void
  onDeleteRule: (ruleId: string) => void
  addRuleType: string
  setAddRuleType: (v: string) => void
  addRuleTargetId: string
  setAddRuleTargetId: (v: string) => void
  addRulePriority: string
  setAddRulePriority: (v: string) => void
  addRuleSubmitting: boolean
  onClose: () => void
}

function ViewDetailPanel({
  view,
  onToggleField,
  onAddRule,
  onDeleteRule,
  addRuleType,
  setAddRuleType,
  addRuleTargetId,
  setAddRuleTargetId,
  addRulePriority,
  setAddRulePriority,
  addRuleSubmitting,
  onClose,
}: ViewDetailPanelProps) {
  const rules = view.view_audience_rules || []

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold">{view.name}</h3>
          <p className="text-sm text-muted-foreground font-mono">{view.slug}</p>
          {view.description && (
            <p className="text-sm text-muted-foreground mt-1">{view.description}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent transition-colors"
          aria-label="Close detail panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Metadata toggles */}
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Switch
            checked={view.is_active}
            onCheckedChange={(v) => onToggleField(view.id, 'is_active', v)}
          />
          <span>Active</span>
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Switch
            checked={view.is_default}
            onCheckedChange={(v) => onToggleField(view.id, 'is_default', v)}
          />
          <span>Default</span>
          {view.is_default && <Star className="h-3.5 w-3.5 text-amber-500" />}
        </label>
      </div>

      {/* Audience Rules */}
      <div>
        <h4 className="text-sm font-medium mb-3">
          Audience Rules ({rules.length})
        </h4>

        {rules.length === 0 ? (
          <p className="text-sm text-muted-foreground py-3">
            No rules yet. Add rules to define who sees this view.
          </p>
        ) : (
          <div className="space-y-1.5 mb-4">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className="flex items-center gap-2 rounded-md border border-border/40 px-3 py-2 text-sm"
              >
                <span className="shrink-0 text-muted-foreground">
                  {TARGET_TYPE_ICONS[rule.target_type] || <Eye className="h-3.5 w-3.5" />}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="font-medium">
                    {TIER_LABELS[rule.tier] || `Tier ${rule.tier}`}
                  </span>
                  {rule.target_id && (
                    <span className="text-muted-foreground ml-1.5 font-mono text-xs truncate">
                      {rule.target_id}
                    </span>
                  )}
                </span>
                <Badge variant="outline" className="text-[10px] h-4 px-1.5 shrink-0">
                  P{rule.priority}
                </Badge>
                <button
                  type="button"
                  onClick={() => onDeleteRule(rule.id)}
                  className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                  aria-label="Remove rule"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add rule form */}
        <form onSubmit={onAddRule} className="space-y-3 border-t border-border/40 pt-3">
          <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Add Rule
          </h5>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Select value={addRuleType} onValueChange={setAddRuleType}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Target type" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Target Type</SelectLabel>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="role">Role</SelectItem>
                  <SelectItem value="partner">Partner</SelectItem>
                  <SelectItem value="partner_type">Partner Type</SelectItem>
                  <SelectItem value="default">Default</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>

            {addRuleType && addRuleType !== 'default' && (
              <Input
                value={addRuleTargetId}
                onChange={(e) => setAddRuleTargetId(e.target.value)}
                placeholder={
                  addRuleType === 'role'
                    ? 'Role slug (e.g. pod_leader)'
                    : `${addRuleType} ID`
                }
                className="h-9 text-sm"
              />
            )}

            <div className="flex gap-2">
              <Input
                type="number"
                value={addRulePriority}
                onChange={(e) => setAddRulePriority(e.target.value)}
                placeholder="Priority"
                min={0}
                max={1000}
                className="h-9 text-sm w-20"
              />
              <Button
                type="submit"
                size="sm"
                className="h-9"
                disabled={!addRuleType || addRuleSubmitting}
              >
                {addRuleSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Empty State
// ---------------------------------------------------------------------------

function EmptyState({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 mb-4">
        <Eye className="h-6 w-6 text-primary" />
      </div>
      <h3 className="text-lg font-semibold mb-1">No views yet</h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-4">
        Views control what different users see on their dashboards. Create your first view to get
        started.
      </p>
      <Button onClick={onCreateClick}>
        <Plus className="h-4 w-4 mr-1.5" />
        Create First View
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Skeletons
// ---------------------------------------------------------------------------

function ViewsListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="rounded-lg border border-border/40 px-4 py-3 animate-pulse"
        >
          <div className="h-4 w-32 rounded bg-muted/40 mb-2" />
          <div className="h-3 w-24 rounded bg-muted/30" />
        </div>
      ))}
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-6 w-48 rounded bg-muted/40" />
      <div className="h-4 w-32 rounded bg-muted/30" />
      <div className="h-4 w-64 rounded bg-muted/30" />
      <div className="space-y-2 pt-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-10 rounded bg-muted/20" />
        ))}
      </div>
    </div>
  )
}
