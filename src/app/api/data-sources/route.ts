/**
 * Data Sources API Route
 *
 * Thin controller layer - handles HTTP concerns only.
 * Business logic delegated to service layer.
 * Database operations delegated to repository layer.
 */

import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/api-auth'
import {
  apiSuccess,
  apiError,
  apiValidationError,
  ApiErrors,
  ErrorCodes
} from '@/lib/api/response'
import { DataSourceSchemaV2 } from '@/lib/validations/schemas'
import * as dataSourceService from '@/lib/services/data-source.service'
import { createLogger } from '@/lib/logger'

const log = createLogger('api:data-sources')

/**
 * POST - Create a new data source (admin only)
 * Supports both legacy format { spreadsheet_id } and new format { type, connection_config }
 */
export async function POST(request: Request): Promise<NextResponse> {
  const auth = await requirePermission('data-enrichment:write')
  if (!auth.authenticated) return auth.response

  try {
    const body = await request.json()

    // Validate input with V2 schema (supports both formats)
    const validation = DataSourceSchemaV2.create.safeParse(body)
    if (!validation.success) {
      return apiValidationError(validation.error)
    }

    const { name, spreadsheet_id, spreadsheet_url, type, connection_config } = validation.data

    // Delegate to service layer
    const result = await dataSourceService.createDataSource({
      name,
      spreadsheet_id,
      spreadsheet_url,
      type,
      connection_config,
      userId: auth.user?.id,
      userEmail: auth.user?.email || undefined,
    })

    // Handle conflict case
    if (result.isConflict) {
      return apiError(
        ErrorCodes.CONFLICT,
        'This spreadsheet is already connected',
        409,
        { existingId: result.conflictId }
      )
    }

    return apiSuccess({ source: result.source }, 201)
  } catch (error: unknown) {
    log.error('Error in POST /api/data-sources', error)
    return ApiErrors.internal()
  }
}

/**
 * GET - Fetch all data sources with stats (admin only)
 * Optimized: Uses 3 queries total instead of N+1 pattern (was 1 + N + N*M queries)
 */
export async function GET(): Promise<NextResponse> {
  const auth = await requirePermission('data-enrichment:read')
  if (!auth.authenticated) return auth.response

  try {
    const sources = await dataSourceService.getAllDataSourcesWithStats()

    return apiSuccess(
      { sources },
      200,
      {
        'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
      }
    )
  } catch (error: unknown) {
    log.error('Error in GET /api/data-sources', error)
    return ApiErrors.database()
  }
}
