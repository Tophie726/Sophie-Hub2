'use client'

import { Suspense, useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  GitPullRequest,
  Clock,
  CheckCircle2,
  XCircle,
  Database,
  ArrowRight,
  Loader2,
  RefreshCw,
  Users,
  Package,
  ChevronDown,
  AlertCircle,
  HelpCircle,
} from 'lucide-react'
import { WorkflowCard } from '@/components/help'
import { SyncButton } from '@/components/sync'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'

export default function ChangeApprovalPage() {
  return (
    <Suspense>
      <ChangeApprovalContent />
    </Suspense>
  )
}

interface ApprovalStats {
  pending: number
  approved: number
  rejected: number
  applied: number
}

interface EntitySource {
  tabMappingId: string
  sourceName: string
  tabName: string
  fieldCount: number
  lastSyncedAt: string | null
  lastSyncStatus: 'completed' | 'failed' | 'running' | null
}

interface SyncableEntity {
  entity: string
  label: string
  tabMappingIds: string[]
  sourceCount: number
  fieldCount: number
  lastSyncedAt: string | null
  hasFailedSync: boolean
  sources: EntitySource[]
}

const ENTITY_ICONS: Record<string, typeof Users> = {
  partners: Users,
  staff: Users,
  asins: Package,
}

const ENTITY_COLORS: Record<string, { bg: string; text: string }> = {
  partners: { bg: 'bg-blue-500/10', text: 'text-blue-500' },
  staff: { bg: 'bg-purple-500/10', text: 'text-purple-500' },
  asins: { bg: 'bg-green-500/10', text: 'text-green-500' },
}

const HELP_STORAGE_KEY = 'change-approval-show-help'

function ChangeApprovalContent() {
  const [stats, setStats] = useState<ApprovalStats | null>(null)
  const [entities, setEntities] = useState<SyncableEntity[]>([])
  const [loading, setLoading] = useState(true)
  const [entitiesLoading, setEntitiesLoading] = useState(true)
  const [syncingEntities, setSyncingEntities] = useState<Set<string>>(new Set())
  const [showHelp, setShowHelp] = useState(true)

  // Load help preference from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(HELP_STORAGE_KEY)
    if (stored !== null) {
      setShowHelp(stored === 'true')
    }
  }, [])

  const toggleHelp = useCallback((show: boolean) => {
    setShowHelp(show)
    localStorage.setItem(HELP_STORAGE_KEY, String(show))
  }, [])

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // TODO: Fetch actual stats from staged_changes API
        setStats({
          pending: 0,
          approved: 0,
          rejected: 0,
          applied: 0,
        })
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [])

  const fetchEntities = useCallback(async () => {
    setEntitiesLoading(true)
    try {
      const res = await fetch('/api/sync/sources')
      if (!res.ok) throw new Error('Failed to fetch sources')
      const json = await res.json()
      setEntities(json.data?.entities || [])
    } catch (error) {
      console.error('Failed to fetch sync sources:', error)
    } finally {
      setEntitiesLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEntities()
  }, [fetchEntities])

  const handleSyncEntity = async (entity: SyncableEntity) => {
    setSyncingEntities(prev => new Set(prev).add(entity.entity))

    let successCount = 0
    let errorCount = 0

    for (const tabMappingId of entity.tabMappingIds) {
      try {
        const res = await fetch(`/api/sync/tab/${tabMappingId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dry_run: false }),
        })
        if (!res.ok) errorCount++
        else successCount++
      } catch {
        errorCount++
      }
    }

    if (errorCount === 0) {
      toast.success(`Synced ${entity.label}`, {
        description: `${successCount} source${successCount !== 1 ? 's' : ''} synced`,
      })
    } else if (successCount > 0) {
      toast.warning(`Partially synced ${entity.label}`, {
        description: `${successCount} succeeded, ${errorCount} failed`,
      })
    } else {
      toast.error(`Failed to sync ${entity.label}`)
    }

    fetchEntities()
    setSyncingEntities(prev => {
      const next = new Set(prev)
      next.delete(entity.entity)
      return next
    })
  }

  const totalPending = stats ? stats.pending + stats.approved : 0

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Change Approval"
        description="Review and approve data changes before they're applied"
      >
        {!showHelp && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => toggleHelp(true)}
            className="text-muted-foreground hover:text-foreground"
          >
            <HelpCircle className="h-4 w-4 mr-1.5" />
            <span className="text-xs">How it works</span>
          </Button>
        )}
      </PageHeader>

      <div className="p-4 md:p-8 max-w-5xl">
        {loading || !stats ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : totalPending > 0 ? (
          <ApprovalBrowser stats={stats} />
        ) : (
          <ApprovalHub
            stats={stats}
            entities={entities}
            entitiesLoading={entitiesLoading}
            syncingEntities={syncingEntities}
            onSyncEntity={handleSyncEntity}
            onRefresh={fetchEntities}
            showHelp={showHelp}
            onCloseHelp={() => toggleHelp(false)}
          />
        )}
      </div>
    </div>
  )
}

interface ApprovalHubProps {
  stats: ApprovalStats
  entities: SyncableEntity[]
  entitiesLoading: boolean
  syncingEntities: Set<string>
  onSyncEntity: (entity: SyncableEntity) => void
  onRefresh: () => void
  showHelp: boolean
  onCloseHelp: () => void
}

function ApprovalHub({
  stats,
  entities,
  entitiesLoading,
  syncingEntities,
  onSyncEntity,
  onRefresh,
  showHelp,
  onCloseHelp,
}: ApprovalHubProps) {
  const [syncExpanded, setSyncExpanded] = useState(false)

  return (
    <div className="space-y-8">
      {/* How It Works - shown at top when visible */}
      {showHelp && (
        <WorkflowCard
          docId="change-approval"
          title="How Change Approval Works"
          steps={[
            { title: "Changes Detected", description: "When data syncs from your sources, any differences are staged here for review." },
            { title: "Review Changes", description: "See exactly what will change: new records, updates, and field-level diffs." },
            { title: "Approve & Apply", description: "Approve changes to apply them, or reject to discard. All changes are logged." },
          ]}
          onClose={onCloseHelp}
        />
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          icon={Clock}
          label="Pending Review"
          value={stats.pending}
          color="text-amber-500"
          bgColor="bg-amber-500/10"
        />
        <StatCard
          icon={CheckCircle2}
          label="Approved"
          value={stats.approved}
          color="text-green-500"
          bgColor="bg-green-500/10"
        />
        <StatCard
          icon={XCircle}
          label="Rejected"
          value={stats.rejected}
          color="text-red-500"
          bgColor="bg-red-500/10"
        />
        <StatCard
          icon={Database}
          label="Applied"
          value={stats.applied}
          color="text-blue-500"
          bgColor="bg-blue-500/10"
        />
      </div>

      {/* Main Content: No Changes Pending */}
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <GitPullRequest className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-2">No Changes Pending</h3>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            All synced data has been reviewed. When new changes are detected from
            your data sources, they'll appear here for approval.
          </p>
        </CardContent>
      </Card>

      {/* Optional: Manual Sync Section (Collapsible) */}
      {entities.length > 0 && (
        <Card>
          <CardHeader
            className="flex flex-row items-center justify-between space-y-0 cursor-pointer"
            onClick={() => setSyncExpanded(!syncExpanded)}
          >
            <div>
              <CardTitle className="text-sm font-medium">Manual Sync</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Data syncs automatically. Use this if you need fresh data now.
              </p>
            </div>
            <ChevronDown className={cn(
              'h-4 w-4 text-muted-foreground transition-transform',
              syncExpanded && 'rotate-180'
            )} />
          </CardHeader>

          <AnimatePresence initial={false}>
            {syncExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <CardContent className="pt-0">
                  {entitiesLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {entities.map((entity) => (
                        <EntitySyncRow
                          key={entity.entity}
                          entity={entity}
                          syncing={syncingEntities.has(entity.entity)}
                          onSync={() => onSyncEntity(entity)}
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      )}

    </div>
  )
}

function EntitySyncRow({
  entity,
  syncing,
  onSync,
}: {
  entity: SyncableEntity
  syncing: boolean
  onSync: () => void
}) {
  const Icon = ENTITY_ICONS[entity.entity] || Database
  const colors = ENTITY_COLORS[entity.entity] || { bg: 'bg-muted', text: 'text-muted-foreground' }

  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center shrink-0', colors.bg)}>
          <Icon className={cn('h-4 w-4', colors.text)} />
        </div>
        <div className="min-w-0">
          <span className="text-sm font-medium">{entity.label}</span>
          <p className="text-xs text-muted-foreground">
            {entity.fieldCount} fields · {entity.sourceCount} source{entity.sourceCount !== 1 ? 's' : ''}
          </p>
        </div>
      </div>
      <SyncButton
        syncing={syncing}
        lastSyncedAt={entity.lastSyncedAt}
        onClick={onSync}
        showLabel={false}
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0"
      />
    </div>
  )
}

function ApprovalBrowser({ stats }: { stats: ApprovalStats }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1 w-fit">
        <FilterTab label="Pending" count={stats.pending} active />
        <FilterTab label="Approved" count={stats.approved} />
        <FilterTab label="Rejected" count={stats.rejected} />
      </div>

      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">
            Change list will appear here
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  bgColor,
}: {
  icon: typeof Clock
  label: string
  value: number
  color: string
  bgColor: string
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center', bgColor)}>
            <Icon className={cn('h-5 w-5', color)} />
          </div>
          <div>
            <p className="text-2xl font-semibold tabular-nums">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function FilterTab({
  label,
  count,
  active = false,
}: {
  label: string
  count: number
  active?: boolean
}) {
  return (
    <button
      className={cn(
        'px-4 py-2 text-sm font-medium rounded-md transition-colors',
        active
          ? 'bg-background shadow-sm text-foreground'
          : 'text-muted-foreground hover:text-foreground'
      )}
    >
      {label}
      {count > 0 && (
        <span className="ml-1.5 text-xs bg-muted px-1.5 py-0.5 rounded-full">
          {count}
        </span>
      )}
    </button>
  )
}
