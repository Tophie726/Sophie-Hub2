'use client'

import { useEffect } from 'react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[dashboard-error]', error)
  }, [error])

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <h2 className="text-xl font-semibold">Dashboard Error</h2>
      <p className="max-w-xl text-sm text-muted-foreground">
        Something failed while rendering this dashboard view.
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={reset}
          className="rounded-md border px-4 py-2 text-sm hover:bg-muted"
        >
          Try Again
        </button>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-md border px-4 py-2 text-sm hover:bg-muted"
        >
          Refresh Page
        </button>
      </div>
    </div>
  )
}
