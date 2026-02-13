import { NextResponse } from 'next/server'
import type { HealthStatus } from '@/types/health.types'
import { getSystemHealth } from '@/lib/services/health.service'
import { apiSuccess, apiError, ErrorCodes } from '@/lib/api/response'

const CACHE_HEADERS: Record<string, string> = {
  'Cache-Control': 'no-cache, no-store, must-revalidate',
}

/**
 * Health check endpoint for monitoring and load balancers
 * GET /api/health
 *
 * Returns 200 if healthy, 503 if unhealthy
 * No authentication required (needed for external health checks)
 */
export async function GET(): Promise<NextResponse> {
  try {
    const health = await getSystemHealth()

    if (health.status === 'healthy') {
      return apiSuccess<HealthStatus>(health, 200, CACHE_HEADERS)
    }

    const response = apiError(
      ErrorCodes.INTERNAL_ERROR,
      'System health check failed',
      503,
      health
    )
    response.headers.set('Cache-Control', CACHE_HEADERS['Cache-Control'])
    return response
  } catch {
    const response = apiError(
      ErrorCodes.INTERNAL_ERROR,
      'Health check failed',
      503
    )
    response.headers.set('Cache-Control', CACHE_HEADERS['Cache-Control'])
    return response
  }
}
