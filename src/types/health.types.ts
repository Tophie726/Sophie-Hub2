/**
 * Health Check Type Definitions
 *
 * Used for monitoring and load balancer health checks.
 */

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  version: string
  checks: {
    database: DatabaseHealthCheck
  }
}

export interface DatabaseHealthCheck {
  status: 'up' | 'down'
  latencyMs?: number
  error?: string
}
