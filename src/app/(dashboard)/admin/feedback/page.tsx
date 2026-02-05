'use client'

import { useState, useEffect, useCallback } from 'react'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Bug,
  Lightbulb,
  HelpCircle,
  Loader2,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertCircle,
  Eye,
  X,
  ExternalLink,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type FeedbackType = 'bug' | 'feature' | 'question'
type FeedbackStatus = 'new' | 'reviewed' | 'in_progress' | 'resolved' | 'wont_fix'

interface FeedbackItem {
  id: string
  type: FeedbackType
  status: FeedbackStatus
  title: string | null
  description: string
  page_url: string | null
  posthog_session_id: string | null
  browser_info: Record<string, unknown> | null
  submitted_by_email: string
  created_at: string
}

const TYPE_CONFIG: Record<FeedbackType, { icon: typeof Bug; label: string; color: string }> = {
  bug: { icon: Bug, label: 'Bug', color: 'text-red-500 bg-red-500/10' },
  feature: { icon: Lightbulb, label: 'Feature', color: 'text-amber-500 bg-amber-500/10' },
  question: { icon: HelpCircle, label: 'Question', color: 'text-blue-500 bg-blue-500/10' },
}

const STATUS_CONFIG: Record<FeedbackStatus, { label: string; color: string }> = {
  new: { label: 'New', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  reviewed: { label: 'Reviewed', color: 'bg-purple-500/10 text-purple-500 border-purple-500/20' },
  in_progress: { label: 'In Progress', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
  resolved: { label: 'Resolved', color: 'bg-green-500/10 text-green-500 border-green-500/20' },
  wont_fix: { label: "Won't Fix", color: 'bg-muted text-muted-foreground border-muted' },
}

export default function FeedbackAdminPage() {
  const [feedback, setFeedback] = useState<FeedbackItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FeedbackType | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | 'all'>('all')
  const [selectedItem, setSelectedItem] = useState<FeedbackItem | null>(null)

  const fetchFeedback = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filter !== 'all') params.set('type', filter)
      if (statusFilter !== 'all') params.set('status', statusFilter)

      const res = await fetch(`/api/feedback?${params}`)
      if (!res.ok) throw new Error('Failed to fetch feedback')
      const json = await res.json()
      setFeedback(json.data?.feedback || [])
    } catch (error) {
      console.error('Failed to fetch feedback:', error)
      toast.error('Failed to load feedback')
    } finally {
      setLoading(false)
    }
  }, [filter, statusFilter])

  useEffect(() => {
    fetchFeedback()
  }, [fetchFeedback])

  const counts = {
    total: feedback.length,
    new: feedback.filter(f => f.status === 'new').length,
    bugs: feedback.filter(f => f.type === 'bug').length,
    features: feedback.filter(f => f.type === 'feature').length,
  }

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Feedback"
        description="Review bug reports, feature requests, and questions from users"
      >
        <Button
          variant="outline"
          size="sm"
          onClick={fetchFeedback}
          disabled={loading}
        >
          <RefreshCw className={cn('h-4 w-4 mr-1.5', loading && 'animate-spin')} />
          Refresh
        </Button>
      </PageHeader>

      <div className="p-4 md:p-8 max-w-6xl">
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4 mb-8">
          <StatCard
            icon={AlertCircle}
            label="New"
            value={counts.new}
            color="text-blue-500"
            bgColor="bg-blue-500/10"
          />
          <StatCard
            icon={Bug}
            label="Bugs"
            value={counts.bugs}
            color="text-red-500"
            bgColor="bg-red-500/10"
          />
          <StatCard
            icon={Lightbulb}
            label="Features"
            value={counts.features}
            color="text-amber-500"
            bgColor="bg-amber-500/10"
          />
          <StatCard
            icon={CheckCircle2}
            label="Total"
            value={counts.total}
            color="text-green-500"
            bgColor="bg-green-500/10"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
            <FilterTab
              label="All"
              active={filter === 'all'}
              onClick={() => setFilter('all')}
            />
            <FilterTab
              label="Bugs"
              active={filter === 'bug'}
              onClick={() => setFilter('bug')}
              icon={Bug}
            />
            <FilterTab
              label="Features"
              active={filter === 'feature'}
              onClick={() => setFilter('feature')}
              icon={Lightbulb}
            />
            <FilterTab
              label="Questions"
              active={filter === 'question'}
              onClick={() => setFilter('question')}
              icon={HelpCircle}
            />
          </div>

          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as FeedbackStatus | 'all')}
          >
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="reviewed">Reviewed</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="wont_fix">Won&apos;t Fix</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Feedback List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : feedback.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Bug className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-2">No Feedback Yet</h3>
              <p className="text-sm text-muted-foreground text-center max-w-md">
                When users submit feedback, it will appear here for review.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {feedback.map((item) => (
              <FeedbackCard
                key={item.id}
                item={item}
                onView={() => setSelectedItem(item)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Detail Dialog */}
      <FeedbackDetailDialog
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onRefresh={fetchFeedback}
      />
    </div>
  )
}

function FeedbackCard({
  item,
  onView,
}: {
  item: FeedbackItem
  onView: () => void
}) {
  const typeConfig = TYPE_CONFIG[item.type]
  const statusConfig = STATUS_CONFIG[item.status]
  const Icon = typeConfig.icon

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center shrink-0', typeConfig.color)}>
            <Icon className="h-5 w-5" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h4 className="font-medium truncate">
                  {item.title || item.description.slice(0, 60)}
                </h4>
                <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                  {item.description}
                </p>
              </div>

              <Badge variant="outline" className={cn('shrink-0', statusConfig.color)}>
                {statusConfig.label}
              </Badge>
            </div>

            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
              <span>{item.submitted_by_email}</span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(item.created_at).toLocaleDateString()}
              </span>
              {item.posthog_session_id && (
                <span className="text-purple-500">Has session replay</span>
              )}
            </div>
          </div>

          <Button variant="ghost" size="sm" onClick={onView}>
            <Eye className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function FeedbackDetailDialog({
  item,
  onClose,
  onRefresh,
}: {
  item: FeedbackItem | null
  onClose: () => void
  onRefresh: () => void
}) {
  const [status, setStatus] = useState<FeedbackStatus | ''>('')
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    if (item) setStatus(item.status)
  }, [item])

  const handleStatusUpdate = async () => {
    if (!item || !status) return

    setUpdating(true)
    try {
      const res = await fetch(`/api/feedback/${item.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })

      if (!res.ok) throw new Error('Failed to update status')

      toast.success('Status updated')
      onRefresh()
      onClose()
    } catch (error) {
      console.error('Failed to update status:', error)
      toast.error('Failed to update status')
    } finally {
      setUpdating(false)
    }
  }

  if (!item) return null

  const typeConfig = TYPE_CONFIG[item.type]
  const Icon = typeConfig.icon

  // Build PostHog session replay URL if we have a session ID
  const posthogUrl = item.posthog_session_id
    ? `https://us.posthog.com/replay/${item.posthog_session_id}`
    : null

  return (
    <Dialog open={!!item} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center', typeConfig.color)}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>{item.title || `${typeConfig.label} Report`}</DialogTitle>
              <DialogDescription>
                From {item.submitted_by_email} on {new Date(item.created_at).toLocaleString()}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          {/* Description */}
          <div>
            <h4 className="text-sm font-medium mb-1">Description</h4>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {item.description}
            </p>
          </div>

          {/* Page URL */}
          {item.page_url && (
            <div>
              <h4 className="text-sm font-medium mb-1">Page URL</h4>
              <p className="text-sm text-muted-foreground truncate">
                {item.page_url}
              </p>
            </div>
          )}

          {/* Session Replay */}
          {posthogUrl && (
            <div>
              <h4 className="text-sm font-medium mb-1">Session Replay</h4>
              <a
                href={posthogUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-purple-500 hover:text-purple-600"
              >
                View in PostHog
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}

          {/* Browser Info */}
          {item.browser_info && (
            <div>
              <h4 className="text-sm font-medium mb-1">Browser Info</h4>
              <div className="text-xs text-muted-foreground font-mono bg-muted/50 rounded p-2">
                {Object.entries(item.browser_info).map(([key, value]) => (
                  <div key={key}>
                    <span className="text-muted-foreground">{key}:</span>{' '}
                    {String(value)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Status Update */}
          <div className="flex items-center gap-3 pt-4 border-t">
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as FeedbackStatus)}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Update status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="reviewed">Reviewed</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="wont_fix">Won&apos;t Fix</SelectItem>
              </SelectContent>
            </Select>

            <Button
              onClick={handleStatusUpdate}
              disabled={updating || status === item.status}
            >
              {updating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Update Status
            </Button>

            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
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
  active,
  onClick,
  icon: Icon,
}: {
  label: string
  active: boolean
  onClick: () => void
  icon?: typeof Bug
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md transition-colors',
        active
          ? 'bg-background shadow-sm text-foreground'
          : 'text-muted-foreground hover:text-foreground'
      )}
    >
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {label}
    </button>
  )
}
