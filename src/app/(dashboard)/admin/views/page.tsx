'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
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
  Loader2,
  Eye,
  Shield,
  Package,
  Star,
  ChevronRight,
} from 'lucide-react'
import { duration, easeOutStandard } from '@/lib/animations'

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

type ViewGroup = 'role' | 'partner_type' | 'other'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const ROLE_VIEW_SLUGS = new Set([
  'admin-view',
  'ppc-strategist-view',
  'staff-view',
])

const PARTNER_TYPE_VIEW_SLUGS = new Set([
  'ppc-basic-view',
  'sophie-ppc-view',
  'cc-view',
  'fam-view',
  'pli-view',
  'tts-view',
])

function categorizeView(view: ViewProfile): ViewGroup {
  if (ROLE_VIEW_SLUGS.has(view.slug)) return 'role'
  if (PARTNER_TYPE_VIEW_SLUGS.has(view.slug)) return 'partner_type'
  return 'other'
}

const GROUP_CONFIG: Record<ViewGroup, { icon: React.ComponentType<{ className?: string }>; iconClass: string; bgClass: string }> = {
  role: {
    icon: Shield,
    iconClass: 'text-blue-600 dark:text-blue-400',
    bgClass: 'bg-blue-500/10',
  },
  partner_type: {
    icon: Package,
    iconClass: 'text-orange-600 dark:text-orange-400',
    bgClass: 'bg-orange-500/10',
  },
  other: {
    icon: Eye,
    iconClass: 'text-violet-600 dark:text-violet-400',
    bgClass: 'bg-violet-500/10',
  },
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ViewsAdminPage() {
  const router = useRouter()
  const [views, setViews] = useState<ViewProfile[]>([])
  const [loading, setLoading] = useState(true)

  const [createOpen, setCreateOpen] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createSlug, setCreateSlug] = useState('')
  const [createDesc, setCreateDesc] = useState('')
  const [createSubmitting, setCreateSubmitting] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<ViewProfile | null>(null)
  const [deleteSubmitting, setDeleteSubmitting] = useState(false)

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
        const err = await res.json().catch(() => ({}))
        toast.error(err.error?.message || 'Failed to create view')
        return
      }

      toast.success('View created')
      setCreateOpen(false)
      setCreateName('')
      setCreateSlug('')
      setCreateDesc('')
      await fetchViews()
    } catch {
      toast.error('Failed to create view')
    } finally {
      setCreateSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return

    setDeleteSubmitting(true)
    try {
      const res = await fetch(`/api/admin/views/${deleteTarget.id}`, { method: 'DELETE' })
      if (!res.ok && res.status !== 204) {
        toast.error('Failed to delete view')
        return
      }

      toast.success('View deleted')
      setDeleteTarget(null)
      await fetchViews()
    } catch {
      toast.error('Failed to delete view')
    } finally {
      setDeleteSubmitting(false)
    }
  }

  const roleViews = views.filter((view) => categorizeView(view) === 'role')
  const partnerTypeViews = views.filter((view) => categorizeView(view) === 'partner_type')
  const customViews = views.filter((view) => categorizeView(view) === 'other')

  return (
    <div className="min-h-screen">
      <PageHeader title="Views" description="Manage role and partner-type dashboard experiences">
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="h-10 md:h-9">
              <Plus className="h-4 w-4 md:mr-1.5" />
              <span className="hidden md:inline">Create View</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[95vw] md:max-w-md">
            <DialogHeader>
              <DialogTitle>Create View</DialogTitle>
              <DialogDescription>
                Create a new view profile. You can configure modules, rules, and preview behavior next.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="view-name" className="text-sm font-medium">Name</label>
                <Input
                  id="view-name"
                  value={createName}
                  onChange={(event) => {
                    setCreateName(event.target.value)
                    setCreateSlug(slugify(event.target.value))
                  }}
                  placeholder="e.g. PPC Strategist View"
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="view-slug" className="text-sm font-medium">Slug</label>
                <Input
                  id="view-slug"
                  value={createSlug}
                  onChange={(event) => setCreateSlug(event.target.value)}
                  placeholder="ppc-strategist-view"
                  pattern="^[a-z0-9-]+$"
                />
                <p className="text-xs text-muted-foreground">Lowercase letters, numbers, and hyphens only.</p>
              </div>

              <div className="space-y-2">
                <label htmlFor="view-desc" className="text-sm font-medium">
                  Description <span className="text-muted-foreground">(optional)</span>
                </label>
                <Input
                  id="view-desc"
                  value={createDesc}
                  onChange={(event) => setCreateDesc(event.target.value)}
                  placeholder="What this view is for..."
                />
              </div>

              <DialogFooter>
                <Button type="submit" disabled={!createName.trim() || !createSlug.trim() || createSubmitting}>
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
          <ViewsSkeleton />
        ) : views.length === 0 ? (
          <EmptyState onCreateClick={() => setCreateOpen(true)} />
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl">
              <ViewSection
                title="Staff Roles"
                subtitle="Admin, PPC Strategist, Staff"
                group="role"
                views={roleViews}
                onOpen={(viewId) => router.push(`/admin/views/${viewId}`)}
                onDelete={setDeleteTarget}
              />

              <ViewSection
                title="Partner Types"
                subtitle="PPC Basic, Sophie PPC, CC, FAM, PLI, TTS"
                group="partner_type"
                views={partnerTypeViews}
                onOpen={(viewId) => router.push(`/admin/views/${viewId}`)}
                onDelete={setDeleteTarget}
              />
            </div>

            <div className="max-w-6xl mt-8">
              <ViewSection
                title="Custom Views"
                subtitle="Additional views outside predefined role/type buckets"
                group="other"
                views={customViews}
                onOpen={(viewId) => router.push(`/admin/views/${viewId}`)}
                onDelete={setDeleteTarget}
                emptyLabel="No custom views yet"
              />
            </div>
          </>
        )}
      </div>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete View</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This also removes
              audience rules and module assignments for this view.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteSubmitting}>
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
// Sections
// ---------------------------------------------------------------------------

interface ViewSectionProps {
  title: string
  subtitle: string
  group: ViewGroup
  views: ViewProfile[]
  onOpen: (viewId: string) => void
  onDelete: (view: ViewProfile) => void
  emptyLabel?: string
}

function ViewSection({ title, subtitle, group, views, onOpen, onDelete, emptyLabel }: ViewSectionProps) {
  const config = GROUP_CONFIG[group]
  const Icon = config.icon

  return (
    <section>
      <div className="flex items-center gap-2.5 mb-3">
        <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', config.bgClass)}>
          <Icon className={cn('h-4 w-4', config.iconClass)} />
        </div>
        <div>
          <h2 className="text-sm font-semibold leading-tight">{title}</h2>
          <p className="text-xs text-muted-foreground leading-tight">{subtitle}</p>
        </div>
      </div>

      {views.length === 0 ? (
        <div className="rounded-xl border border-border/50 bg-card/40 px-4 py-3 text-sm text-muted-foreground">
          {emptyLabel || 'No views in this section yet'}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {views.map((view) => (
            <ViewCard
              key={view.id}
              view={view}
              group={group}
              onOpen={() => onOpen(view.id)}
              onDelete={() => onDelete(view)}
            />
          ))}
        </div>
      )}
    </section>
  )
}

interface ViewCardProps {
  view: ViewProfile
  group: ViewGroup
  onOpen: () => void
  onDelete: () => void
}

function ViewCard({ view, group, onOpen, onDelete }: ViewCardProps) {
  const config = GROUP_CONFIG[group]
  const Icon = config.icon

  return (
    <motion.button
      type="button"
      onClick={onOpen}
      whileHover={{ y: -2 }}
      transition={{ duration: duration.ui, ease: easeOutStandard }}
      className={cn(
        'group w-full rounded-xl border border-border/50 bg-card px-4 py-3 text-left',
        'transition-colors hover:bg-accent/30 active:scale-[0.997]'
      )}
      style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.04)' }}
    >
      <div className="flex items-start gap-3">
        <div className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', config.bgClass)}>
          <Icon className={cn('h-4 w-4', config.iconClass)} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold">{view.name}</p>
            {view.is_default && (
              <Star className="h-3.5 w-3.5 shrink-0 text-amber-500 fill-amber-500" />
            )}
          </div>

          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {view.description || view.slug}
          </p>

          <div className="mt-2 flex items-center gap-2">
            <span className={cn(
              'inline-flex h-1.5 w-1.5 rounded-full',
              view.is_active ? 'bg-green-500' : 'bg-muted-foreground/30'
            )} />
            <span className="text-[11px] text-muted-foreground">
              {view.is_active ? 'Active' : 'Inactive'}
            </span>
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-normal tabular-nums">
              {view.rule_count} rule{view.rule_count !== 1 ? 's' : ''}
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onDelete()
            }}
            className="rounded-md p-1.5 text-muted-foreground/40 transition-colors hover:bg-destructive/10 hover:text-destructive"
            aria-label={`Delete ${view.name}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <ChevronRight className="h-4 w-4 text-muted-foreground/40 transition-colors group-hover:text-foreground/70" />
        </div>
      </div>
    </motion.button>
  )
}

function EmptyState({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
        <Eye className="h-6 w-6 text-primary" />
      </div>
      <h3 className="mb-1 text-lg font-semibold">No views yet</h3>
      <p className="mb-4 max-w-sm text-sm text-muted-foreground">
        Views control what users see. Create your first view to start building role and partner-type experiences.
      </p>
      <Button onClick={onCreateClick}>
        <Plus className="h-4 w-4 mr-1.5" />
        Create First View
      </Button>
    </div>
  )
}

function ViewsSkeleton() {
  return (
    <div className="max-w-6xl space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Array.from({ length: 2 }).map((_, sectionIndex) => (
          <div key={sectionIndex}>
            <div className="mb-3 flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-muted/40 animate-pulse" />
              <div className="space-y-1">
                <div className="h-3.5 w-28 rounded bg-muted/40 animate-pulse" />
                <div className="h-2.5 w-40 rounded bg-muted/30 animate-pulse" />
              </div>
            </div>
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-border/40 px-4 py-3 animate-pulse">
                  <div className="h-4 w-36 rounded bg-muted/40 mb-1.5" />
                  <div className="h-3 w-44 rounded bg-muted/25" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div>
        <div className="mb-3 h-4 w-36 rounded bg-muted/35 animate-pulse" />
        <div className="rounded-xl border border-border/40 px-4 py-3 animate-pulse">
          <div className="h-4 w-40 rounded bg-muted/40 mb-1.5" />
          <div className="h-3 w-52 rounded bg-muted/25" />
        </div>
      </div>
    </div>
  )
}
