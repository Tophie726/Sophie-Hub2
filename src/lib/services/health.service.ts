/**
 * Health Check Service
 *
 * Business logic for system health monitoring.
 * Orchestrates health checks across different system components.
 */

import type { HealthStatus } from '@/types/health.types'
import * as healthRepo from '@/lib/repositories/health.repository'

/**
 * Get overall system health status
 * Performs checks on all critical system components
 */
export async function getSystemHealth(): Promise<HealthStatus> {
  const timestamp = new Date().toISOString()
  const version = process.env.npm_package_version || '0.0.0'

  // Check database connectivity
  const databaseCheck = await healthRepo.checkDatabaseHealth()

  // Determine overall status based on all checks
  const status = databaseCheck.status === 'up' ? 'healthy' : 'unhealthy'

  return {
    status,
    timestamp,
    version,
    checks: {
      database: databaseCheck,
    },
  }
}
