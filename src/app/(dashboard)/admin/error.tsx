'use client'

import { useEffect } from 'react'

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[admin-error]', error)
  }, [error])

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <h2 className="text-xl font-semibold">Admin Page Error</h2>
      <p className="max-w-xl text-sm text-muted-foreground">
        An admin route crashed while loading. You can retry safely.
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
          onClick={() => window.location.href = '/admin'}
          className="rounded-md border px-4 py-2 text-sm hover:bg-muted"
        >
          Go to Admin Home
        </button>
      </div>
    </div>
  )
}
