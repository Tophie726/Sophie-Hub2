/**
 * GET /api/bigquery/client-names
 *
 * Fetches distinct client_name values from BigQuery unified views.
 * Used for partner mapping UI.
 *
 * Server-side cache: BigQuery queries are slow (~15s), so we cache for 10 min.
 */

import { bigQueryConnector } from '@/lib/connectors/bigquery'
import { requireRole } from '@/lib/auth/api-auth'
import { apiSuccess, ApiErrors } from '@/lib/api/response'
import {
  getCachedClientNames,
  setCachedClientNames,
} from '@/lib/connectors/bigquery-cache'

export async function GET() {
  try {
    // Require admin role (Data Enrichment is admin-only)
    const authResult = await requireRole('admin')
    if (!authResult.authenticated) {
      return authResult.response
    }

    // Check shared server-side cache first
    const cached = getCachedClientNames()
    if (cached) {
      console.log('[BigQuery client-names] Serving from cache')
      const response = apiSuccess({
        clientNames: cached,
        count: cached.length,
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

    // Update shared cache
    setCachedClientNames(clientNames)
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
