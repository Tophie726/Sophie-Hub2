import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { requirePermission } from '@/lib/auth/api-auth'
import { apiSuccess, apiValidationError, ApiErrors } from '@/lib/api/response'
import { getSyncEngine } from '@/lib/sync'
import { z } from 'zod'

// Validation schema for sync options
const SyncOptionsSchema = z.object({
  dry_run: z.boolean().optional().default(false),
  force_overwrite: z.boolean().optional().default(false),
  row_limit: z.number().int().positive().optional(),
})

/**
 * POST /api/sync/tab/[id]
 *
 * Trigger a sync for a specific tab mapping.
 *
 * Request body:
 * {
 *   dry_run?: boolean     - Preview changes without applying
 *   force_overwrite?: boolean - Ignore authority rules (admin only)
 *   row_limit?: number    - Limit rows for testing
 * }
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     sync_run_id: string,
 *     stats: {
 *       rows_processed: number,
 *       rows_created: number,
 *       rows_updated: number,
 *       rows_skipped: number,
 *       errors: Array<{ row, column?, message, severity }>
 *     },
 *     changes: EntityChange[]  // Only in dry_run mode
 *     duration_ms: number
 *   }
 * }
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  // Require data-enrichment:write permission
  const auth = await requirePermission('data-enrichment:write')
  if (!auth.authenticated) return auth.response

  // Get session for access token
  const session = await getServerSession(authOptions)
  if (!session?.accessToken) {
    return ApiErrors.unauthorized('No access token available. Please re-authenticate.')
  }

  try {
    const body = await request.json().catch(() => ({}))

    // Validate options
    const validation = SyncOptionsSchema.safeParse(body)
    if (!validation.success) {
      return apiValidationError(validation.error)
    }

    const options = validation.data
    const tabMappingId = params.id

    // Get the sync engine and run sync
    const engine = getSyncEngine()
    const result = await engine.syncTab(tabMappingId, session.accessToken, {
      dryRun: options.dry_run,
      forceOverwrite: options.force_overwrite,
      rowLimit: options.row_limit,
      triggeredBy: auth.user.id,
    })

    // Transform to API response format
    return apiSuccess({
      sync_run_id: result.syncRunId,
      stats: {
        rows_processed: result.stats.rowsProcessed,
        rows_created: result.stats.rowsCreated,
        rows_updated: result.stats.rowsUpdated,
        rows_skipped: result.stats.rowsSkipped,
        errors: result.stats.errors,
      },
      changes: result.changes,
      duration_ms: result.durationMs,
    })
  } catch (error) {
    console.error('Error in POST /api/sync/tab/[id]:', error)

    if (error instanceof Error) {
      // Return more specific error messages
      if (error.message.includes('Tab mapping not found')) {
        return ApiErrors.notFound('Tab mapping')
      }
      if (error.message.includes('No key column')) {
        return apiSuccess(
          {
            success: false,
            error: error.message,
          },
          400
        )
      }
    }

    return ApiErrors.internal()
  }
}
