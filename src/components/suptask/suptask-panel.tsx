'use client'

import { useState } from 'react'
import { ArrowLeft, Plug, RefreshCw, BarChart3, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface SupTaskPanelProps {
  onBack?: () => void
}

interface SyncStatus {
  runs: Array<{
    id: string
    status: string
    started_at: string
    finished_at: string | null
    tickets_fetched: number | null
    tickets_upserted: number | null
    tickets_failed: number | null
    ticket_range_start: number | null
    ticket_range_end: number | null
  }>
  stats: {
    totalTickets: number
    resolvedRequesters: number
    resolvedAssignees: number
  }
}

export function SupTaskPanel({ onBack }: SupTaskPanelProps) {
  const [isTestingConnection, setIsTestingConnection] = useState(false)
  const [connectionResult, setConnectionResult] = useState<{ success: boolean; message?: string } | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null)
  const [isLoadingStatus, setIsLoadingStatus] = useState(false)

  const handleTestConnection = async () => {
    setIsTestingConnection(true)
    setConnectionResult(null)
    try {
      const res = await fetch('/api/suptask/test-connection', { method: 'POST' })
      const json = await res.json()
      if (json.success) {
        setConnectionResult({ success: true })
        toast.success('SupTask connection successful')
      } else {
        setConnectionResult({ success: false, message: json.error?.message || 'Connection failed' })
        toast.error('SupTask connection failed')
      }
    } catch {
      setConnectionResult({ success: false, message: 'Network error' })
      toast.error('Network error testing connection')
    } finally {
      setIsTestingConnection(false)
    }
  }

  const handleSync = async () => {
    setIsSyncing(true)
    try {
      const res = await fetch('/api/suptask/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start: 1, end: 2100 }),
      })
      const json = await res.json()
      if (json.success) {
        const data = json.data
        toast.success(`Sync complete: ${data.ticketsUpserted} tickets upserted, ${data.ticketsFailed} failed`)
        // Refresh status after sync
        handleLoadStatus()
      } else {
        toast.error(json.error?.message || 'Sync failed')
      }
    } catch {
      toast.error('Network error during sync')
    } finally {
      setIsSyncing(false)
    }
  }

  const handleLoadStatus = async () => {
    setIsLoadingStatus(true)
    try {
      const res = await fetch('/api/suptask/sync/status')
      const json = await res.json()
      if (json.success) {
        setSyncStatus(json.data)
      }
    } catch {
      toast.error('Failed to load sync status')
    } finally {
      setIsLoadingStatus(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        {onBack && (
          <Button variant="ghost" size="sm" onClick={onBack} className="h-9 md:h-8">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        )}
        <div>
          <h2 className="text-xl font-semibold">SupTask Integration</h2>
          <p className="text-sm text-muted-foreground">
            Sync ticket data from SupTask for workload and operations analytics
          </p>
        </div>
      </div>

      {/* Connection Test */}
      <div className="rounded-lg border bg-card p-6 shadow-sm dark:border-border/60 dark:ring-1 dark:ring-white/[0.06]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Plug className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-medium">Connection</h3>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleTestConnection}
            disabled={isTestingConnection}
            className="h-9 md:h-8 gap-1.5"
          >
            {isTestingConnection ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plug className="h-3.5 w-3.5" />
            )}
            Test Connection
          </Button>
        </div>
        {connectionResult && (
          <div className={`flex items-center gap-2 text-sm ${connectionResult.success ? 'text-green-600' : 'text-red-600'}`}>
            {connectionResult.success ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            {connectionResult.success ? 'Connected successfully' : connectionResult.message}
          </div>
        )}
      </div>

      {/* Sync Controls */}
      <div className="rounded-lg border bg-card p-6 shadow-sm dark:border-border/60 dark:ring-1 dark:ring-white/[0.06]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-medium">Ticket Sync</h3>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleLoadStatus}
              disabled={isLoadingStatus}
              className="h-9 md:h-8 gap-1.5"
            >
              {isLoadingStatus ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <BarChart3 className="h-3.5 w-3.5" />
              )}
              Status
            </Button>
            <Button
              size="sm"
              onClick={handleSync}
              disabled={isSyncing}
              className="h-9 md:h-8 gap-1.5"
            >
              {isSyncing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              {isSyncing ? 'Syncing...' : 'Run Sync'}
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Fetches tickets #1–2100 from SupTask API and upserts them to the database.
          Per-ticket failures are isolated and logged.
        </p>
      </div>

      {/* Sync Status */}
      {syncStatus && (
        <div className="rounded-lg border bg-card p-6 shadow-sm dark:border-border/60 dark:ring-1 dark:ring-white/[0.06]">
          <h3 className="font-medium mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
            Sync Status
          </h3>

          {/* Ticket Stats */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center">
              <div className="text-2xl font-bold tabular-nums">{syncStatus.stats.totalTickets}</div>
              <div className="text-xs text-muted-foreground">Total Tickets</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold tabular-nums">{syncStatus.stats.resolvedRequesters}</div>
              <div className="text-xs text-muted-foreground">Resolved Requesters</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold tabular-nums">{syncStatus.stats.resolvedAssignees}</div>
              <div className="text-xs text-muted-foreground">Resolved Assignees</div>
            </div>
          </div>

          {/* Recent Runs */}
          {syncStatus.runs.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Recent Runs</h4>
              <div className="space-y-2">
                {syncStatus.runs.slice(0, 5).map((run) => (
                  <div
                    key={run.id}
                    className="flex items-center justify-between text-sm py-2 px-3 rounded-md bg-muted/30"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`inline-block h-2 w-2 rounded-full ${
                        run.status === 'completed' ? 'bg-green-500' :
                        run.status === 'running' ? 'bg-yellow-500 animate-pulse' :
                        'bg-red-500'
                      }`} />
                      <span className="capitalize">{run.status}</span>
                      {run.ticket_range_start != null && run.ticket_range_end != null && (
                        <span className="text-muted-foreground">
                          #{run.ticket_range_start}–{run.ticket_range_end}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-muted-foreground">
                      {run.tickets_upserted != null && (
                        <span>{run.tickets_upserted} upserted</span>
                      )}
                      {run.tickets_failed != null && run.tickets_failed > 0 && (
                        <span className="text-red-500">{run.tickets_failed} failed</span>
                      )}
                      <span className="tabular-nums">
                        {new Date(run.started_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
