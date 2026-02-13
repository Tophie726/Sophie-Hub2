/**
 * POST /api/cron/partner-type-reconciliation
 *
 * Nightly safety pass to keep persisted partner taxonomy aligned with
 * source_data + staffing signals. This is a reconciliation pass only;
 * partner sync writes already compute these fields inline.
 *
 * Auth: CRON_SECRET bearer token
 */

import { NextRequest } from 'next/server'
import { apiError, apiSuccess } from '@/lib/api/response'
import { runPartnerTypeReconciliation } from '@/lib/partners/partner-type-reconciliation'

export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('Partner type reconciliation cron: CRON_SECRET is not configured')
    return apiError('INTERNAL_ERROR', 'Cron secret is not configured', 500)
  }

  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
    return apiError('UNAUTHORIZED', 'Invalid cron secret', 401)
  }

  const startTime = Date.now()

  try {
    console.log('Partner type reconciliation cron: starting')

    const result = await runPartnerTypeReconciliation({
      dryRun: false,
      limit: 5000,
      mismatchOnly: false,
      driftOnly: false,
    })

    const durationMs = Date.now() - startTime
    console.log(
      `Partner type reconciliation cron: completed in ${durationMs}ms — ` +
      `${result.updated} updated, ${result.failed} failed`
    )

    return apiSuccess({
      ...result,
      duration_ms: durationMs,
    })
  } catch (error) {
    const durationMs = Date.now() - startTime
    console.error(`Partner type reconciliation cron: failed after ${durationMs}ms:`, error)

    return apiError(
      'INTERNAL_ERROR',
      `Partner type reconciliation cron failed: ${error instanceof Error ? error.message : String(error)}`,
      500
    )
  }
}
