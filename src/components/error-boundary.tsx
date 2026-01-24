'use client'

import { Component, ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * Error Boundary component for catching and handling React errors gracefully.
 * Prevents the entire app from crashing when a component throws an error.
 *
 * Usage:
 * ```tsx
 * <ErrorBoundary>
 *   <YourComponent />
 * </ErrorBoundary>
 *
 * // With custom fallback
 * <ErrorBoundary fallback={<CustomErrorUI />}>
 *   <YourComponent />
 * </ErrorBoundary>
 *
 * // With error callback (for logging to Sentry, etc.)
 * <ErrorBoundary onError={(error, info) => logToSentry(error, info)}>
 *   <YourComponent />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log to console in development
    console.error('ErrorBoundary caught an error:', error, errorInfo)

    // Call the onError callback if provided (for external logging)
    this.props.onError?.(error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default error UI
      return (
        <div className="flex min-h-[400px] flex-col items-center justify-center p-8 text-center">
          <div className="mb-4 rounded-full bg-destructive/10 p-3">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <h2 className="mb-2 text-lg font-semibold">Something went wrong</h2>
          <p className="mb-6 max-w-md text-sm text-muted-foreground">
            An unexpected error occurred. Please try refreshing the page or contact support if the problem persists.
          </p>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <div className="mb-6 max-w-lg rounded-md bg-muted p-4 text-left">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Error Details (dev only):</p>
              <code className="text-xs text-destructive">
                {this.state.error.message}
              </code>
            </div>
          )}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={this.handleReset}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Try Again
            </Button>
            <Button
              variant="default"
              onClick={() => window.location.reload()}
            >
              Refresh Page
            </Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * Hook to programmatically trigger error boundary
 * (for use with async errors that aren't caught by componentDidCatch)
 */
export function useErrorHandler() {
  return (error: Error) => {
    throw error
  }
}
