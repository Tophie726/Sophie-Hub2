/**
 * Standardized API response helpers
 *
 * Provides consistent response format across all API routes:
 * - Success: { success: true, data: T, meta: { timestamp } }
 * - Error: { success: false, error: { code, message, details? }, meta: { timestamp } }
 *
 * Usage:
 * ```typescript
 * import { apiSuccess, apiError, apiValidationError } from '@/lib/api/response'
 *
 * // Success
 * return apiSuccess({ sources: data })
 *
 * // Error
 * return apiError('NOT_FOUND', 'Resource not found', 404)
 *
 * // Validation error (from Zod)
 * const result = schema.safeParse(body)
 * if (!result.success) {
 *   return apiValidationError(result.error)
 * }
 * ```
 */

import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

// =============================================================================
// Types
// =============================================================================

interface ApiMeta {
  timestamp: string
  requestId?: string
}

interface ApiSuccessResponse<T> {
  success: true
  data: T
  meta: ApiMeta
}

interface ApiErrorResponse {
  success: false
  error: {
    code: string
    message: string
    details?: unknown
  }
  meta: ApiMeta
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse

// =============================================================================
// Error Codes
// =============================================================================

export const ErrorCodes = {
  // Client errors (4xx)
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',

  // Server errors (5xx)
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_API_ERROR: 'EXTERNAL_API_ERROR',
} as const

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes]

// =============================================================================
// Response Helpers
// =============================================================================

/**
 * Create a successful API response
 */
export function apiSuccess<T>(data: T, status = 200, headers?: Record<string, string>): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
      },
    },
    { status, headers }
  )
}

/**
 * Create an error API response
 */
export function apiError(
  code: ErrorCode | string,
  message: string,
  status = 500,
  details?: unknown
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        ...(details !== undefined && { details }),
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    },
    { status }
  )
}

/**
 * Create a validation error response from Zod error
 */
export function apiValidationError(zodError: ZodError): NextResponse<ApiErrorResponse> {
  return apiError(
    ErrorCodes.VALIDATION_ERROR,
    'Invalid input',
    400,
    zodError.flatten()
  )
}

// =============================================================================
// Convenience Methods
// =============================================================================

export const ApiErrors = {
  unauthorized: (message = 'Authentication required') =>
    apiError(ErrorCodes.UNAUTHORIZED, message, 401),

  forbidden: (message = 'Access denied') =>
    apiError(ErrorCodes.FORBIDDEN, message, 403),

  notFound: (resource = 'Resource') =>
    apiError(ErrorCodes.NOT_FOUND, `${resource} not found`, 404),

  conflict: (message: string) =>
    apiError(ErrorCodes.CONFLICT, message, 409),

  rateLimited: (message = 'Too many requests') =>
    apiError(ErrorCodes.RATE_LIMITED, message, 429),

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  internal: (..._args: unknown[]) =>
    apiError(ErrorCodes.INTERNAL_ERROR, 'An unexpected error occurred', 500),

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  database: (..._args: unknown[]) =>
    apiError(ErrorCodes.DATABASE_ERROR, 'Database error', 500),

  externalApi: (service: string, message?: string) =>
    apiError(ErrorCodes.EXTERNAL_API_ERROR, message || `${service} API error`, 502),
}
