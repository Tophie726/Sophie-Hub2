'use client'

import { useEffect } from 'react'

/**
 * Global error boundary for Next.js App Router.
 * Catches errors in the root layout and provides a minimal fallback.
 * Must include its own <html> and <body> tags since the root layout may have errored.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Global error:', error)
  }, [error])

  return (
    <html lang="en">
      <body className="bg-background text-foreground">
        <div className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
          <div className="mb-4 text-6xl">⚠️</div>
          <h2 className="mb-2 text-2xl font-semibold">Application Error</h2>
          <p className="mb-6 max-w-md text-gray-600">
            A critical error occurred. Please try refreshing the page.
          </p>

          {process.env.NODE_ENV === 'development' && (
            <div className="mb-6 max-w-lg rounded-md bg-gray-100 p-4 text-left">
              <p className="mb-2 text-xs font-medium text-gray-500">
                Error Details (dev only):
              </p>
              <code className="text-xs text-red-600 break-all">
                {error.message}
              </code>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={reset}
              className="rounded-md bg-gray-200 px-4 py-2 text-sm font-medium hover:bg-gray-300"
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.href = '/'}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
