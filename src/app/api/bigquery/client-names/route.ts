/**
 * GET /api/bigquery/client-names
 *
 * Fetches distinct client_name values from BigQuery unified views.
 * Used for partner mapping UI.
 *
 * Server-side cache: BigQuery queries are slow (~15s), so we cache for 10 min.
 */

import { NextResponse } from 'next/server'
import { bigQueryConnector } from '@/lib/connectors/bigquery'
import { requireRole } from '@/lib/auth/api-auth'
import { apiSuccess, ApiErrors } from '@/lib/api/response'

// Server-side in-memory cache for client names
// BigQuery queries are expensive (~15s), cache for 10 minutes
const CACHE_TTL = 10 * 60 * 1000 // 10 minutes
let cachedClientNames: string[] | null = null
let cacheTimestamp = 0

export async function GET() {
  try {
    // Require admin role (Data Enrichment is admin-only)
    const authResult = await requireRole('admin')
    if (authResult instanceof NextResponse) {
      return authResult
    }

    // Check server-side cache first
    const now = Date.now()
    if (cachedClientNames && (now - cacheTimestamp) < CACHE_TTL) {
      console.log('[BigQuery client-names] Serving from cache')
      const response = apiSuccess({
        clientNames: cachedClientNames,
        count: cachedClientNames.length,
        cached: true
      })
      response.headers.set('Cache-Control', 'private, max-age=300')
      return response
    }

    console.log('[BigQuery client-names] Fetching from BigQuery...')
    const config = {
      type: 'bigquery' as const,
      project_id: 'sophie-society-reporting',
      dataset_id: 'pbi',
    }

    const clientNames = await bigQueryConnector.getClientNames(config)

    // Update server cache
    cachedClientNames = clientNames
    cacheTimestamp = now
    console.log(`[BigQuery client-names] Cached ${clientNames.length} names`)

    // Add Cache-Control header for browser caching too
    const response = apiSuccess({
      clientNames,
      count: clientNames.length,
      cached: false
    })
    response.headers.set('Cache-Control', 'private, max-age=300') // 5 min browser cache
    return response
  } catch (error) {
    console.error('BigQuery client-names error:', error)
    return ApiErrors.internal(
      error instanceof Error ? error.message : 'Failed to fetch client names'
    )
  }
}
