'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  RefreshCw,
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Hash,
  MessageSquare,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { ShimmerGrid } from '@/components/ui/shimmer-grid'
import { easeOut, duration } from '@/lib/animations'

interface SyncRun {
  id: string
  status: string
  triggered_by: string | null
  total_channels: number
  synced_channels: number
  failed_channels: number
  total_messages_synced: number
  next_channel_offset: number
  started_at: string | null
  completed_at: string | null
  error: string | null
  created_at: string
}

interface ChannelSyncState {
  channel_id: string
  channel_name: string
  partner_id: string | null
  partner_name: string | null
  latest_ts: string | null
  oldest_ts: string | null
  is_backfill_complete: boolean | null
  message_count: number | null
  last_synced_at: string | null
  error: string | null
  bot_is_member: boolean | null
}

interface SyncStatusData {
  latest_run: SyncRun | null
  channels: ChannelSyncState[]
  total_mapped_channels: number
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

function formatDuration(startStr: string | null, endStr: string | null): string {
  if (!startStr) return '--'
  const start = new Date(startStr)
  const end = endStr ? new Date(endStr) : new Date()
  const diffMs = end.getTime() - start.getTime()
  const secs = Math.floor(diffMs / 1000)
  if (secs < 60) return `${secs}s`
  const mins = Math.floor(secs / 60)
  const remSecs = secs % 60
  return `${mins}m ${remSecs}s`
}

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle2; color: string; label: string }> = {
  completed: { icon: CheckCircle2, color: 'text-green-600', label: 'Completed' },
  running: { icon: Loader2, color: 'text-blue-600', label: 'Running' },
  pending: { icon: Clock, color: 'text-amber-600', label: 'Pending' },
  failed: { icon: XCircle, color: 'text-red-600', label: 'Failed' },
  cancelled: { icon: XCircle, color: 'text-muted-foreground', label: 'Cancelled' },
}

export function SlackSyncStatus() {
  const [isSyncingChannel, setSyncingChannel] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const { data, isLoading, error } = useQuery<SyncStatusData>({
    queryKey: ['slack-sync-status'],
    queryFn: async () => {
      const res = await fetch('/api/slack/sync/status')
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message || 'Failed to fetch sync status')
      return json.data
    },
    refetchInterval: (query) => {
      const run = query.state.data?.latest_run
      return run?.status === 'running' || run?.status === 'pending' ? 5000 : false
    },
  })

  const isRunning = data?.latest_run?.status === 'running' || data?.latest_run?.status === 'pending'
  const run = data?.latest_run
  const channels = data?.channels || []

  async function handleStartSync() {
    try {
      const res = await fetch('/api/slack/sync/start', { method: 'POST' })
      const json = await res.json()
      if (!json.success) {
        if (res.status === 409) {
          toast.error('A sync is already running')
        } else {
          throw new Error(json.error?.message || 'Failed to start sync')
        }
        return
      }
      toast.success('Sync started')
      queryClient.invalidateQueries({ queryKey: ['slack-sync-status'] })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to start sync')
    }
  }

  async function handleSyncChannel(channelId: string) {
    setSyncingChannel(channelId)
    try {
      const res = await fetch(`/api/slack/sync/channel/${channelId}`, { method: 'POST' })
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message || 'Failed to sync channel')
      toast.success(`Channel synced: ${json.data?.messages_synced ?? 0} messages`)
      queryClient.invalidateQueries({ queryKey: ['slack-sync-status'] })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to sync channel')
    } finally {
      setSyncingChannel(null)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <ShimmerGrid variant="table" rows={6} columns={5} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center py-12 text-center">
        <AlertTriangle className="h-8 w-8 text-destructive mb-2" />
        <p className="text-muted-foreground">{error instanceof Error ? error.message : 'Failed to load sync status'}</p>
      </div>
    )
  }

  const progressPercent = run && run.total_channels > 0
    ? Math.round(((run.synced_channels + run.failed_channels) / run.total_channels) * 100)
    : 0

  const channelsWithErrors = channels.filter(c => c.error)
  const channelsSynced = channels.filter(c => c.last_synced_at)
  const totalMessages = channels.reduce((sum, c) => sum + (c.message_count || 0), 0)

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-6">
        {/* Sync run status card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h3 className="font-semibold text-lg">Message Sync</h3>
                {run && (() => {
                  const config = STATUS_CONFIG[run.status] || STATUS_CONFIG.pending
                  const Icon = config.icon
                  return (
                    <Badge
                      variant="secondary"
                      className={`${config.color} gap-1`}
                    >
                      <Icon className={`h-3 w-3 ${run.status === 'running' ? 'animate-spin' : ''}`} />
                      {config.label}
                    </Badge>
                  )
                })()}
              </div>
              <Button
                onClick={handleStartSync}
                disabled={isRunning}
                className="active:scale-[0.97]"
              >
                {isRunning ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Syncing...</>
                ) : (
                  <><Play className="h-4 w-4 mr-2" />Start Sync</>
                )}
              </Button>
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-md bg-blue-500/10">
                  <Hash className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium tabular-nums">{data?.total_mapped_channels || 0}</p>
                  <p className="text-xs text-muted-foreground">Mapped channels</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-md bg-green-500/10">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium tabular-nums">{channelsSynced.length}</p>
                  <p className="text-xs text-muted-foreground">Synced</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-md bg-purple-500/10">
                  <MessageSquare className="h-4 w-4 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm font-medium tabular-nums">{totalMessages.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Messages</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-md bg-red-500/10">
                  <XCircle className="h-4 w-4 text-red-600" />
                </div>
                <div>
                  <p className="text-sm font-medium tabular-nums">{channelsWithErrors.length}</p>
                  <p className="text-xs text-muted-foreground">Errors</p>
                </div>
              </div>
            </div>

            {/* Progress bar during active sync */}
            {run && isRunning && (
              <motion.div
                initial={false}
                animate={{ opacity: 1 }}
                transition={{ duration: duration.ui, ease: easeOut }}
                className="space-y-2"
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {run.synced_channels} / {run.total_channels} channels
                  </span>
                  <span className="tabular-nums font-medium">{progressPercent}%</span>
                </div>
                <Progress value={progressPercent} className="h-2" />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{run.total_messages_synced.toLocaleString()} messages synced</span>
                  <span>Elapsed: {formatDuration(run.started_at, null)}</span>
                </div>
              </motion.div>
            )}

            {/* Last run summary */}
            {run && !isRunning && (
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>Last run: {formatRelativeTime(run.completed_at || run.created_at)}</span>
                {run.started_at && run.completed_at && (
                  <span>Duration: {formatDuration(run.started_at, run.completed_at)}</span>
                )}
                <span className="tabular-nums">{run.total_messages_synced.toLocaleString()} messages</span>
                {run.failed_channels > 0 && (
                  <span className="text-red-600">{run.failed_channels} failed</span>
                )}
              </div>
            )}

            {!run && (
              <p className="text-sm text-muted-foreground">
                No sync runs yet. Click &ldquo;Start Sync&rdquo; to begin syncing message metadata from mapped channels.
              </p>
            )}

            {run?.error && (
              <div className="mt-3 p-3 bg-red-500/10 rounded-md text-sm text-red-600">
                {run.error}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Per-channel status table */}
        {channels.length > 0 && (
          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[180px]">Channel</TableHead>
                    <TableHead className="min-w-[140px]">Partner</TableHead>
                    <TableHead className="text-right min-w-[80px]">Messages</TableHead>
                    <TableHead className="min-w-[100px]">Last Synced</TableHead>
                    <TableHead className="min-w-[90px]">Backfill</TableHead>
                    <TableHead className="min-w-[60px]">Status</TableHead>
                    <TableHead className="text-right min-w-[90px]">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {channels.map((channel) => {
                    const isSyncing = isSyncingChannel === channel.channel_id
                    const hasError = !!channel.error
                    return (
                      <TableRow
                        key={channel.channel_id}
                        className={hasError ? 'bg-red-500/5' : ''}
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-1.5">
                            <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="truncate max-w-[160px]">{channel.channel_name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="truncate max-w-[120px] text-muted-foreground">
                            {channel.partner_name || '--'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {(channel.message_count || 0).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-muted-foreground cursor-default">
                                {formatRelativeTime(channel.last_synced_at)}
                              </span>
                            </TooltipTrigger>
                            {channel.last_synced_at && (
                              <TooltipContent>
                                {new Date(channel.last_synced_at).toLocaleString()}
                              </TooltipContent>
                            )}
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          {channel.is_backfill_complete === true ? (
                            <Badge variant="secondary" className="text-green-600 bg-green-500/10 text-xs">
                              Complete
                            </Badge>
                          ) : channel.is_backfill_complete === false ? (
                            <Badge variant="secondary" className="text-amber-600 bg-amber-500/10 text-xs">
                              In progress
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">--</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {hasError ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-1 text-red-600 cursor-default">
                                  <AlertTriangle className="h-3.5 w-3.5" />
                                  <span className="text-xs">Error</span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="left" className="max-w-xs">
                                {channel.error}
                              </TooltipContent>
                            </Tooltip>
                          ) : channel.bot_is_member === false ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-1 text-amber-600 cursor-default">
                                  <AlertTriangle className="h-3.5 w-3.5" />
                                  <span className="text-xs">No bot</span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="left">
                                Bot is not a member of this channel. Invite the bot to enable syncing.
                              </TooltipContent>
                            </Tooltip>
                          ) : channel.last_synced_at ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          ) : (
                            <Clock className="h-4 w-4 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            disabled={isSyncing || isRunning}
                            onClick={() => handleSyncChannel(channel.channel_id)}
                          >
                            {isSyncing ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <><RefreshCw className="h-3.5 w-3.5 mr-1" />Sync</>
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {channels.length === 0 && !isLoading && (
          <div className="text-center py-8 text-muted-foreground">
            <Hash className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No mapped channels found</p>
            <p className="text-xs mt-1">Map channels to partners in the Channels tab first</p>
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}
