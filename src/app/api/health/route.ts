import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  version: string
  checks: {
    database: {
      status: 'up' | 'down'
      latencyMs?: number
      error?: string
    }
  }
}

/**
 * Health check endpoint for monitoring and load balancers
 * GET /api/health
 *
 * Returns 200 if healthy, 503 if unhealthy
 * No authentication required (needed for external health checks)
 */
export async function GET() {
  const health: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '0.0.0',
    checks: {
      database: {
        status: 'down',
      },
    },
  }

  // Check database connectivity
  try {
    const supabase = getAdminClient()
    const dbStart = Date.now()

    // Simple query to check database is responsive
    const { error } = await supabase
      .from('data_sources')
      .select('id')
      .limit(1)

    const dbLatency = Date.now() - dbStart

    if (error) {
      health.checks.database = {
        status: 'down',
        latencyMs: dbLatency,
        error: 'Database check failed',
      }
      health.status = 'unhealthy'
    } else {
      health.checks.database = {
        status: 'up',
        latencyMs: dbLatency,
      }
    }
  } catch (error) {
    console.error('Health check failed:', error)
    health.checks.database = {
      status: 'down',
      error: 'Database check failed',
    }
    health.status = 'unhealthy'
  }

  // Determine overall status
  const allChecksUp = health.checks.database.status === 'up'

  if (!allChecksUp) {
    health.status = 'unhealthy'
  }

  return NextResponse.json(health, {
    status: health.status === 'healthy' ? 200 : 503,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  })
}
