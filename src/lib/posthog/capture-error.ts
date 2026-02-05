import posthog from 'posthog-js'

interface ErrorContext {
  componentStack?: string | null
  extra?: Record<string, unknown>
}

/**
 * Capture an error to PostHog for error tracking
 * Use this in error boundaries and catch blocks
 */
export function captureError(error: Error, context?: ErrorContext) {
  if (typeof window === 'undefined') return

  posthog.capture('$exception', {
    $exception_type: error.name,
    $exception_message: error.message,
    $exception_stack_trace_raw: error.stack,
    ...(context?.componentStack && { component_stack: context.componentStack }),
    ...(context?.extra && context.extra),
  })
}
