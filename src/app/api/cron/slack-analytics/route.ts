/**
 * POST /api/cron/slack-analytics
 *
 * Daily Vercel cron handler for computing Slack response time analytics.
 * Runs the rolling window computation: [today - LOOKAHEAD_DAYS, yesterday].
 *
 * Scheduled: daily at 6am UTC (configured in vercel.json)
 * Auth: CRON_SECRET bearer token (Vercel sets this automatically)
 */

import { NextRequest } from 'next/server'
import { apiSuccess, apiError } from '@/lib/api/response'
import { computeDailyRollingWindow } from '@/lib/slack/analytics'

export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('Slack analytics cron: CRON_SECRET is not configured')
    return apiError('INTERNAL_ERROR', 'Cron secret is not configured', 500)
  }

  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
    return apiError('UNAUTHORIZED', 'Invalid cron secret', 401)
  }

  const startTime = Date.now()

  try {
    console.log('Slack analytics cron: starting daily rolling window computation')

    const result = await computeDailyRollingWindow()
    const durationMs = Date.now() - startTime

    console.log(
      `Slack analytics cron: completed in ${durationMs}ms — ` +
      `${result.computed} computed, ${result.failed} failed`
    )

    return apiSuccess({
      computed: result.computed,
      failed: result.failed,
      errors: result.errors.length > 0 ? result.errors.slice(0, 10) : [],
      duration_ms: durationMs,
    })
  } catch (error) {
    const durationMs = Date.now() - startTime
    console.error(`Slack analytics cron: failed after ${durationMs}ms:`, error)

    return apiError(
      'INTERNAL_ERROR',
      `Analytics cron failed: ${error instanceof Error ? error.message : String(error)}`,
      500
    )
  }
}
