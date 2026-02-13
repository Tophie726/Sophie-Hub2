/**
 * POST /api/cron/slack-clickup-sync
 *
 * Daily automation:
 * - scans a configured Slack channel for task progress signals
 * - mirrors updates into ClickUp task comments
 * - posts a staging snapshot digest back to Slack
 *
 * Auth: CRON_SECRET bearer token
 */

import { NextRequest } from 'next/server'
import { apiError, apiSuccess } from '@/lib/api/response'
import { runSlackClickUpDailySync } from '@/lib/automation/slack-clickup-sync'

export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('Slack ClickUp sync cron: CRON_SECRET is not configured')
    return apiError('INTERNAL_ERROR', 'Cron secret is not configured', 500)
  }

  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
    return apiError('UNAUTHORIZED', 'Invalid cron secret', 401)
  }

  const start = Date.now()

  try {
    const summary = await runSlackClickUpDailySync()
    return apiSuccess({
      ...summary,
      duration_ms: Date.now() - start,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('Slack ClickUp sync cron failed:', error)
    return apiError('INTERNAL_ERROR', `Slack ClickUp sync failed: ${message}`, 500)
  }
}
