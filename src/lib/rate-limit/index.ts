/**
 * Rate Limiting Service
 *
 * Provides rate limiting for API endpoints to protect external services
 * (Google Sheets API, etc.) from being overwhelmed.
 *
 * Uses a sliding window algorithm with in-memory storage.
 * For production with multiple servers, consider Redis-based implementation.
 */

import { CACHE } from '@/lib/constants'

// =============================================================================
// Types
// =============================================================================

export interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  maxRequests: number
  /** Window size in milliseconds */
  windowMs: number
}

export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean
  /** Number of requests remaining in the current window */
  remaining: number
  /** Time in ms until the rate limit resets */
  resetIn: number
  /** Total limit for the window */
  limit: number
}

interface RateLimitEntry {
  timestamps: number[]
  windowStart: number
}

// =============================================================================
// Default Configurations
// =============================================================================

/**
 * Rate limit presets for different scenarios
 */
export const RATE_LIMITS = {
  /** Google Sheets API: 100 requests per 100 seconds per user */
  GOOGLE_SHEETS: {
    maxRequests: 100,
    windowMs: 100 * 1000, // 100 seconds
  },

  /** Sync operations: 60 per minute (batch dry runs hit once per tab) */
  SYNC: {
    maxRequests: 60,
    windowMs: 60 * 1000, // 1 minute
  },

  /** General API: 100 requests per minute */
  API_GENERAL: {
    maxRequests: 100,
    windowMs: 60 * 1000, // 1 minute
  },

  /** Partners list / dashboard widgets: 120 per minute (dashboards fire many parallel queries) */
  PARTNERS_LIST: {
    maxRequests: 120,
    windowMs: 60 * 1000, // 1 minute
  },

  /** Strict: 5 requests per minute (for expensive operations) */
  STRICT: {
    maxRequests: 5,
    windowMs: 60 * 1000, // 1 minute
  },
} as const

// =============================================================================
// Rate Limiter Class
// =============================================================================

class RateLimiter {
  private store = new Map<string, RateLimitEntry>()
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor() {
    // Clean up stale entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, 60 * 1000)
  }

  /**
   * Check if a request is allowed and record it
   */
  check(key: string, config: RateLimitConfig): RateLimitResult {
    const now = Date.now()
    const windowStart = now - config.windowMs

    // Get or create entry
    let entry = this.store.get(key)
    if (!entry) {
      entry = { timestamps: [], windowStart: now }
      this.store.set(key, entry)
    }

    // Remove timestamps outside the current window
    entry.timestamps = entry.timestamps.filter((ts) => ts > windowStart)

    // Check if limit exceeded
    const currentCount = entry.timestamps.length
    const allowed = currentCount < config.maxRequests

    if (allowed) {
      // Record this request
      entry.timestamps.push(now)
    }

    // Calculate reset time (when the oldest request in window expires)
    const oldestInWindow = entry.timestamps[0] || now
    const resetIn = Math.max(0, oldestInWindow + config.windowMs - now)

    return {
      allowed,
      remaining: Math.max(0, config.maxRequests - entry.timestamps.length),
      resetIn,
      limit: config.maxRequests,
    }
  }

  /**
   * Get current usage without recording a request
   */
  peek(key: string, config: RateLimitConfig): RateLimitResult {
    const now = Date.now()
    const windowStart = now - config.windowMs

    const entry = this.store.get(key)
    if (!entry) {
      return {
        allowed: true,
        remaining: config.maxRequests,
        resetIn: 0,
        limit: config.maxRequests,
      }
    }

    // Count requests in current window
    const timestamps = entry.timestamps.filter((ts) => ts > windowStart)
    const currentCount = timestamps.length

    const oldestInWindow = timestamps[0] || now
    const resetIn = Math.max(0, oldestInWindow + config.windowMs - now)

    return {
      allowed: currentCount < config.maxRequests,
      remaining: Math.max(0, config.maxRequests - currentCount),
      resetIn,
      limit: config.maxRequests,
    }
  }

  /**
   * Reset rate limit for a key
   */
  reset(key: string): void {
    this.store.delete(key)
  }

  /**
   * Clean up stale entries
   */
  private cleanup(): void {
    const now = Date.now()
    const maxAge = CACHE.RATE_LIMIT_CLEANUP

    // Convert to array to avoid iterator issues
    const entries = Array.from(this.store.entries())
    for (const [key, entry] of entries) {
      // Remove entries with no recent activity
      const latestTimestamp = entry.timestamps[entry.timestamps.length - 1] || 0
      if (now - latestTimestamp > maxAge) {
        this.store.delete(key)
      }
    }
  }

  /**
   * Stop the cleanup interval (for testing/shutdown)
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

let rateLimiterInstance: RateLimiter | null = null

export function getRateLimiter(): RateLimiter {
  if (!rateLimiterInstance) {
    rateLimiterInstance = new RateLimiter()
  }
  return rateLimiterInstance
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Check rate limit for a user + action combination
 */
export function checkRateLimit(
  userId: string,
  action: string,
  config: RateLimitConfig = RATE_LIMITS.API_GENERAL
): RateLimitResult {
  const key = `${userId}:${action}`
  return getRateLimiter().check(key, config)
}

/**
 * Check rate limit for Google Sheets API
 */
export function checkSheetsRateLimit(userId: string): RateLimitResult {
  return checkRateLimit(userId, 'sheets', RATE_LIMITS.GOOGLE_SHEETS)
}

/**
 * Check rate limit for sync operations
 */
export function checkSyncRateLimit(userId: string): RateLimitResult {
  return checkRateLimit(userId, 'sync', RATE_LIMITS.SYNC)
}

/**
 * Create rate limit headers for HTTP response
 */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': Math.ceil(result.resetIn / 1000).toString(),
  }
}
