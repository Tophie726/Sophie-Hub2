'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, CheckCircle2, XCircle, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface GWSConnectionCardProps {
  onConnected?: () => void
}

export function GWSConnectionCard({ onConnected }: GWSConnectionCardProps) {
  const [isConnecting, setIsConnecting] = useState(false)
  const [status, setStatus] = useState<{
    connected: boolean
    domain?: string
    user_count?: number
    error?: string
  } | null>(null)
  const hasAutoTestedRef = useRef(false)

  const handleTestConnection = useCallback(async () => {
    setIsConnecting(true)

    try {
      const res = await fetch('/api/google-workspace/test-connection', { method: 'POST' })
      const json = await res.json()
      const result = json.data

      if (result?.connected) {
        setStatus({
          connected: true,
          domain: result.domain,
          user_count: result.user_count,
        })
        onConnected?.()
      } else {
        setStatus({
          connected: false,
          error: result?.error || 'Connection failed',
        })
      }
    } catch {
      setStatus({ connected: false, error: 'Network error' })
    } finally {
      setIsConnecting(false)
    }
  }, [onConnected])

  useEffect(() => {
    if (hasAutoTestedRef.current) return
    hasAutoTestedRef.current = true
    handleTestConnection()
  }, [handleTestConnection])

  return (
    <div className="rounded-lg border p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-indigo-500/10 flex items-center justify-center">
          <Building2 className="h-5 w-5 text-indigo-600" />
        </div>
        <div>
          <h3 className="font-semibold">Google Workspace Connection</h3>
          <p className="text-sm text-muted-foreground">
            Connect via service account with domain-wide delegation
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
              <span>
                Connected to <strong>{status.domain}</strong>
                {status.user_count != null && (
                  <> &middot; {status.user_count} users found</>
                )}
              </span>
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
          'Refresh Connection'
        ) : (
          'Retry Connection'
        )}
      </Button>
    </div>
  )
}
