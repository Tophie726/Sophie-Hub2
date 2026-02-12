/**
 * Health Check Repository
 *
 * Handles database connectivity checks for health monitoring.
 * Isolated database operations for health check endpoint.
 */

import { getAdminClient } from '@/lib/supabase/admin'
import type { DatabaseHealthCheck } from '@/types/health.types'

/**
 * Check database connectivity and measure latency
 * Performs a simple query to verify database is responsive
 */
export async function checkDatabaseHealth(): Promise<DatabaseHealthCheck> {
  const supabase = getAdminClient()
  const dbStart = Date.now()

  try {
    // Simple query to check database is responsive
    const { error } = await supabase
      .from('data_sources')
      .select('id')
      .limit(1)

    const dbLatency = Date.now() - dbStart

    if (error) {
      return {
        status: 'down',
        latencyMs: dbLatency,
        error: 'Database check failed',
      }
    }

    return {
      status: 'up',
      latencyMs: dbLatency,
    }
  } catch (error: unknown) {
    const dbLatency = Date.now() - dbStart
    return {
      status: 'down',
      latencyMs: dbLatency,
      error: error instanceof Error ? error.message : 'Database check failed',
    }
  }
}
