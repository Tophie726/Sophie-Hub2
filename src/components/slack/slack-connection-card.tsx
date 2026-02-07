'use client'

import { useState } from 'react'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SlackIcon } from '@/components/icons/slack-icon'

interface SlackConnectionCardProps {
  onConnected?: () => void
}

export function SlackConnectionCard({ onConnected }: SlackConnectionCardProps) {
  const [isConnecting, setIsConnecting] = useState(false)
  const [status, setStatus] = useState<{
    connected: boolean
    workspace_name?: string
    error?: string
  } | null>(null)

  async function handleTestConnection() {
    setIsConnecting(true)
    setStatus(null)

    try {
      const res = await fetch('/api/slack/test-connection', { method: 'POST' })
      const json = await res.json()
      const result = json.data

      setStatus(result)
      if (result?.connected) {
        onConnected?.()
      }
    } catch {
      setStatus({ connected: false, error: 'Network error' })
    } finally {
      setIsConnecting(false)
    }
  }

  return (
    <div className="rounded-lg border p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-[#611f69]/10 flex items-center justify-center">
          <SlackIcon className="h-5 w-5 text-[#611f69]" />
        </div>
        <div>
          <h3 className="font-semibold">Slack Connection</h3>
          <p className="text-sm text-muted-foreground">
            Connect your Slack workspace via bot token
          </p>
        </div>
      </div>

      {status && (
        <div className={`flex items-center gap-2 p-3 rounded-md text-sm ${
          status.connected
            ? 'bg-green-500/10 text-green-700 dark:text-green-400'
            : 'bg-destructive/10 text-destructive'
        }`}>
          {status.connected ? (
            <>
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
              <span>Connected to <strong>{status.workspace_name}</strong></span>
            </>
          ) : (
            <>
              <XCircle className="h-4 w-4 flex-shrink-0" />
              <span>{status.error || 'Connection failed'}</span>
            </>
          )}
        </div>
      )}

      <Button
        onClick={handleTestConnection}
        disabled={isConnecting}
        variant={status?.connected ? 'outline' : 'default'}
        className="w-full"
      >
        {isConnecting ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Testing connection...
          </>
        ) : status?.connected ? (
          'Re-test Connection'
        ) : (
          'Test Connection'
        )}
      </Button>

      {!status?.connected && (
        <p className="text-xs text-muted-foreground">
          Set <code className="px-1 py-0.5 bg-muted rounded text-[11px]">SLACK_BOT_TOKEN</code> in
          your environment variables. See the Slack Connector docs for setup instructions.
        </p>
      )}
    </div>
  )
}
