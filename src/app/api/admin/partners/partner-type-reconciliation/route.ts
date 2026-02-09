import { z } from 'zod'
import { requireRole } from '@/lib/auth/api-auth'
import { ROLES } from '@/lib/auth/roles'
import { apiError, apiSuccess, ApiErrors } from '@/lib/api/response'
import {
  listPartnerTypeReconciliation,
  runPartnerTypeReconciliation,
} from '@/lib/partners/partner-type-reconciliation'

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(5000).optional().default(200),
  offset: z.coerce.number().int().min(0).optional().default(0),
  search: z.string().max(200).optional(),
  mismatch_only: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  drift_only: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
})

const ReconcileBodySchema = z.object({
  dry_run: z.boolean().optional().default(true),
  limit: z.number().int().min(1).max(5000).optional().default(1000),
  mismatch_only: z.boolean().optional().default(false),
  drift_only: z.boolean().optional().default(false),
})

/**
 * GET /api/admin/partners/partner-type-reconciliation
 *
 * Returns reconciliation report comparing runtime-computed partner type
 * against persisted taxonomy columns.
 */
export async function GET(request: Request) {
  const auth = await requireRole(ROLES.ADMIN)
  if (!auth.authenticated) return auth.response

  try {
    const url = new URL(request.url)
    const validation = QuerySchema.safeParse({
      limit: url.searchParams.get('limit') || undefined,
      offset: url.searchParams.get('offset') || undefined,
      search: url.searchParams.get('search') || undefined,
      mismatch_only: url.searchParams.get('mismatch_only') || undefined,
      drift_only: url.searchParams.get('drift_only') || undefined,
    })

    if (!validation.success) {
      return apiError('VALIDATION_ERROR', validation.error.message, 400)
    }

    const { limit, offset, search, mismatch_only, drift_only } = validation.data
    const data = await listPartnerTypeReconciliation({
      limit,
      offset,
      search,
      mismatchOnly: mismatch_only,
      driftOnly: drift_only,
    })

    return apiSuccess(data, 200, {
      'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
    })
  } catch (error) {
    console.error('Partner type reconciliation report failed:', error)
    return ApiErrors.database()
  }
}

/**
 * POST /api/admin/partners/partner-type-reconciliation
 *
 * Recomputes and persists partner-type taxonomy fields.
 * Defaults to dry_run=true for safety.
 */
export async function POST(request: Request) {
  const auth = await requireRole(ROLES.ADMIN)
  if (!auth.authenticated) return auth.response

  try {
    const body = await request.json().catch(() => ({}))
    const validation = ReconcileBodySchema.safeParse(body)
    if (!validation.success) {
      return apiError('VALIDATION_ERROR', validation.error.message, 400)
    }

    const { dry_run, limit, mismatch_only, drift_only } = validation.data
    const data = await runPartnerTypeReconciliation({
      dryRun: dry_run,
      limit,
      mismatchOnly: mismatch_only,
      driftOnly: drift_only,
    })

    return apiSuccess(data)
  } catch (error) {
    console.error('Partner type reconciliation failed:', error)
    return ApiErrors.database()
  }
}
