'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

/**
 * Next.js App Router error boundary.
 * Catches errors in route segments and their children.
 * Shows a friendly error UI instead of crashing the whole app.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log error to console (and external service in production)
    console.error('Route error:', error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-8 text-center">
      <div className="mb-4 rounded-full bg-destructive/10 p-4">
        <AlertTriangle className="h-8 w-8 text-destructive" />
      </div>
      <h2 className="mb-2 text-xl font-semibold">Something went wrong</h2>
      <p className="mb-6 max-w-md text-sm text-muted-foreground">
        An unexpected error occurred. You can try again or return to the dashboard.
      </p>

      {process.env.NODE_ENV === 'development' && (
        <div className="mb-6 max-w-lg rounded-md bg-muted p-4 text-left">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            Error Details (dev only):
          </p>
          <code className="text-xs text-destructive break-all">
            {error.message}
          </code>
          {error.digest && (
            <p className="mt-2 text-xs text-muted-foreground">
              Digest: {error.digest}
            </p>
          )}
        </div>
      )}

      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={reset}
          className="gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Try Again
        </Button>
        <Button asChild>
          <Link href="/" className="gap-2">
            <Home className="h-4 w-4" />
            Dashboard
          </Link>
        </Button>
      </div>
    </div>
  )
}
