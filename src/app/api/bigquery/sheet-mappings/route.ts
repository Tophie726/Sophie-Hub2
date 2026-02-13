/**
 * GET/POST /api/bigquery/sheet-mappings
 *
 * Reads the BigQuery reference sheet (client_id + Brand) and surfaces
 * partner mapping suggestions. POST applies all ready suggestions.
 */

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { requireRole } from '@/lib/auth/api-auth'
import { apiSuccess, apiValidationError, ApiErrors } from '@/lib/api/response'
import { mapSheetsAuthError, resolveSheetsAccessToken } from '@/lib/google/sheets-auth'
import {
  applyBigQueryReferenceSheetMappings,
  buildBigQueryReferenceSheetPreview,
} from '@/lib/bigquery/reference-sheet-mappings'

const ApplySchema = z.object({
  dry_run: z.boolean().optional().default(false),
})

export async function GET() {
  const auth = await requireRole('admin')
  if (!auth.authenticated) {
    return auth.response
  }

  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return ApiErrors.unauthorized('Not authenticated')
  }

  let accessToken: string
  try {
    const resolved = await resolveSheetsAccessToken(session.accessToken)
    accessToken = resolved.accessToken
  } catch (authError) {
    const mapped = mapSheetsAuthError(authError)
    if (mapped.status === 401) {
      return ApiErrors.unauthorized(mapped.message)
    }
    return ApiErrors.internal(mapped.message)
  }

  try {
    const preview = await buildBigQueryReferenceSheetPreview(accessToken)
    return apiSuccess(preview, 200, {
      'Cache-Control': 'no-store',
    })
  } catch (error) {
    console.error('BigQuery reference sheet GET error:', error)
    return ApiErrors.internal(
      error instanceof Error ? error.message : 'Failed to read reference sheet'
    )
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireRole('admin')
  if (!auth.authenticated) {
    return auth.response
  }

  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return ApiErrors.unauthorized('Not authenticated')
  }

  let accessToken: string
  try {
    const resolved = await resolveSheetsAccessToken(session.accessToken)
    accessToken = resolved.accessToken
  } catch (authError) {
    const mapped = mapSheetsAuthError(authError)
    if (mapped.status === 401) {
      return ApiErrors.unauthorized(mapped.message)
    }
    return ApiErrors.internal(mapped.message)
  }

  try {
    const body = await request.json().catch(() => ({}))
    const validation = ApplySchema.safeParse(body)
    if (!validation.success) {
      return apiValidationError(validation.error)
    }

    const result = await applyBigQueryReferenceSheetMappings(accessToken, {
      dryRun: validation.data.dry_run,
    })

    return apiSuccess(result, 200, {
      'Cache-Control': 'no-store',
    })
  } catch (error) {
    console.error('BigQuery reference sheet POST error:', error)
    return ApiErrors.internal(
      error instanceof Error ? error.message : 'Failed to sync reference sheet mappings'
    )
  }
}
