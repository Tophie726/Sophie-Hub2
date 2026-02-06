/**
 * GET /api/bigquery/usage/source-detail?source=Team+Queries&period=30d
 *
 * Returns a breakdown of top queriers (by user_email) within a source category.
 * Admin-only. Cached for 1 hour.
 */

import { NextRequest } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'
import { requireRole } from '@/lib/auth/api-auth'
import { ROLES } from '@/lib/auth/roles'
import { apiSuccess, apiError, ApiErrors } from '@/lib/api/response'
import { BIGQUERY } from '@/lib/constants'
import type { SourceDetailEntry } from '@/types/usage'

const VALID_PERIODS = ['7d', '30d', '90d'] as const
type Period = (typeof VALID_PERIODS)[number]

const VALID_SOURCES = ['Sophie Hub', 'Daton (Sync)', 'BI Tools', 'Team Queries', 'Other'] as const
type Source = (typeof VALID_SOURCES)[number]

/** Map source name → SQL WHERE condition for filtering */
function sourceToCondition(source: Source): string {
  switch (source) {
    case 'Sophie Hub':
      return `labels IS NOT NULL AND EXISTS(SELECT 1 FROM UNNEST(labels) l WHERE l.key = 'source' AND l.value = 'sophie-hub')`
    case 'Daton (Sync)':
      return `LOWER(user_email) LIKE '%daton%'`
    case 'BI Tools':
      return `(LOWER(user_email) LIKE '%powerbi%' OR LOWER(user_email) LIKE '%looker%' OR LOWER(user_email) LIKE '%tableau%')`
    case 'Team Queries':
      return `(LOWER(user_email) LIKE '%@sophiesociety%' OR LOWER(user_email) LIKE '%@sophie-society%')`
    case 'Other':
      // Everything that doesn't match the above
      return `NOT (
        (labels IS NOT NULL AND EXISTS(SELECT 1 FROM UNNEST(labels) l WHERE l.key = 'source' AND l.value = 'sophie-hub'))
        OR LOWER(user_email) LIKE '%daton%'
        OR LOWER(user_email) LIKE '%powerbi%'
        OR LOWER(user_email) LIKE '%looker%'
        OR LOWER(user_email) LIKE '%tableau%'
        OR LOWER(user_email) LIKE '%@sophiesociety%'
        OR LOWER(user_email) LIKE '%@sophie-society%'
      )`
  }
}

function periodToDays(period: Period): number {
  switch (period) {
    case '7d': return 7
    case '30d': return 30
    case '90d': return 90
  }
}

// Simple in-memory cache (1hr TTL)
const detailCache = new Map<string, { data: SourceDetailEntry[]; timestamp: number }>()
const CACHE_TTL = 60 * 60 * 1000

export async function GET(request: NextRequest) {
  const auth = await requireRole(ROLES.ADMIN)
  if (!auth.authenticated) return auth.response

  const source = request.nextUrl.searchParams.get('source') as Source | null
  const period = (request.nextUrl.searchParams.get('period') || '30d') as Period

  if (!source || !VALID_SOURCES.includes(source)) {
    return apiError('VALIDATION_ERROR', `Invalid source. Use one of: ${VALID_SOURCES.join(', ')}`, 400)
  }
  if (!VALID_PERIODS.includes(period)) {
    return apiError('VALIDATION_ERROR', 'Invalid period. Use 7d, 30d, or 90d.', 400)
  }

  // Check cache
  const cacheKey = `${source}:${period}`
  const cached = detailCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return apiSuccess({ source, period, entries: cached.data })
  }

  const days = periodToDays(period)

  try {
    const bq = new BigQuery({ projectId: BIGQUERY.PROJECT_ID })
    const condition = sourceToCondition(source)

    const query = `
      SELECT
        user_email,
        COUNT(*) as query_count,
        SUM(total_bytes_processed) as total_bytes,
        SUM(total_bytes_processed) / 1099511627776 * 5.0 as estimated_cost,
        MIN(creation_time) as first_query,
        MAX(creation_time) as last_query
      FROM \`region-us\`.INFORMATION_SCHEMA.JOBS_BY_PROJECT
      WHERE
        creation_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${days} DAY)
        AND job_type = 'QUERY'
        AND state = 'DONE'
        AND error_result IS NULL
        AND cache_hit != true
        AND ${condition}
      GROUP BY user_email
      ORDER BY estimated_cost DESC
      LIMIT 50
    `

    const [job] = await bq.createQueryJob({
      query,
      labels: { source: 'sophie-hub', purpose: 'usage-source-detail' },
    })
    const [rows] = await job.getQueryResults()

    const entries: SourceDetailEntry[] = rows.map((row) => ({
      user_email: String(row.user_email ?? 'unknown'),
      query_count: Number(row.query_count ?? 0),
      total_bytes: Number(row.total_bytes ?? 0),
      estimated_cost: Number(row.estimated_cost ?? 0),
      first_query: row.first_query instanceof Date
        ? row.first_query.toISOString()
        : String(row.first_query?.value ?? row.first_query ?? ''),
      last_query: row.last_query instanceof Date
        ? row.last_query.toISOString()
        : String(row.last_query?.value ?? row.last_query ?? ''),
    }))

    detailCache.set(cacheKey, { data: entries, timestamp: Date.now() })
    return apiSuccess({ source, period, entries })
  } catch (error) {
    return ApiErrors.internal(
      error instanceof Error ? error.message : 'Failed to fetch source detail'
    )
  }
}
