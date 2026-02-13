/**
 * GET /api/bigquery/client-names
 *
 * Fetches distinct BigQuery client identifiers and unions them with
 * currently saved partner mappings.
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
import { getAdminClient } from '@/lib/supabase/admin'

const supabase = getAdminClient()

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

    const [clientNames, existingMappingsResult] = await Promise.all([
      bigQueryConnector.getClientNames(config),
      supabase
        .from('entity_external_ids')
        .select('external_id')
        .eq('entity_type', 'partners')
        .eq('source', 'bigquery'),
    ])

    if (existingMappingsResult.error) {
      console.error('BigQuery client-names mapping fetch error:', existingMappingsResult.error)
      return ApiErrors.database()
    }

    const mappedExternalIds = (existingMappingsResult.data || [])
      .map(row => row.external_id)
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)

    const mergedIdentifiers = Array.from(
      new Set([...clientNames, ...mappedExternalIds])
    ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))

    // Update shared cache
    setCachedClientNames(mergedIdentifiers)
    console.log(`[BigQuery client-names] Cached ${mergedIdentifiers.length} identifiers`)

    // Add Cache-Control header for browser caching too
    const response = apiSuccess({
      clientNames: mergedIdentifiers,
      count: mergedIdentifiers.length,
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
