/**
 * POST /api/cron/slack-sync
 *
 * Vercel cron handler for chunked message sync.
 * Scheduled every 5 minutes. Each invocation:
 * 1. Finds the active sync run (status = 'running' or 'pending')
 * 2. Claims the lease (anti-overlap protection)
 * 3. Processes the next batch of channels
 * 4. Updates run progress
 *
 * If no active run exists, exits immediately (no-op).
 *
 * @see src/docs/SLACK-ROLLOUT-PLAN.md §2.4 for architecture
 */

import { NextRequest } from 'next/server'
import { apiSuccess, apiError } from '@/lib/api/response'
import { getAdminClient } from '@/lib/supabase/admin'
import { processChunk } from '@/lib/slack/sync'

export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('Slack sync cron: CRON_SECRET is not configured')
    return apiError('INTERNAL_ERROR', 'Cron secret is not configured', 500)
  }

  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
    return apiError('UNAUTHORIZED', 'Invalid cron secret', 401)
  }

  const startTime = Date.now()

  try {
    const supabase = getAdminClient()

    // Find active sync run
    const { data: activeRun, error: runError } = await supabase
      .from('slack_sync_runs')
      .select('id, status')
      .in('status', ['pending', 'running'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (runError) {
      console.error('Slack sync cron: error finding active run:', runError)
      return apiError('DATABASE_ERROR', 'Failed to find active sync run', 500)
    }

    if (!activeRun) {
      // No active run — nothing to do
      return apiSuccess({ status: 'no_active_run', duration_ms: Date.now() - startTime })
    }

    console.log(`Slack sync cron: processing chunk for run ${activeRun.id} (status: ${activeRun.status})`)

    const summary = await processChunk(activeRun.id)
    const durationMs = Date.now() - startTime

    console.log(
      `Slack sync cron: chunk complete in ${durationMs}ms — ` +
      `${summary.channels_synced} synced, ${summary.channels_failed} failed, ` +
      `${summary.total_messages} messages`
    )

    return apiSuccess({
      run_id: summary.run_id,
      channels_synced: summary.channels_synced,
      channels_failed: summary.channels_failed,
      total_messages: summary.total_messages,
      duration_ms: durationMs,
    })
  } catch (error) {
    const durationMs = Date.now() - startTime
    console.error(`Slack sync cron: failed after ${durationMs}ms:`, error)

    return apiError(
      'INTERNAL_ERROR',
      `Sync cron failed: ${error instanceof Error ? error.message : String(error)}`,
      500
    )
  }
}
