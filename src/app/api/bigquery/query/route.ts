/**
 * POST /api/bigquery/query
 *
 * Executes parameterized BigQuery queries for dashboard widgets.
 * Builds SQL server-side from widget config - never exposes raw SQL to clients.
 *
 * Supports:
 * - Metric queries (single aggregated value)
 * - Chart queries (time series with GROUP BY)
 * - Table queries (raw rows with column selection)
 */

import { NextRequest } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'
import { getAdminClient } from '@/lib/supabase/admin'
import { requireAuth, canAccessPartner } from '@/lib/auth/api-auth'
import { apiSuccess, apiError, ApiErrors, apiValidationError } from '@/lib/api/response'
import { checkRateLimit, RATE_LIMITS, rateLimitHeaders } from '@/lib/rate-limit'
import { BIGQUERY } from '@/lib/constants'
import { VIEW_ALIASES } from '@/types/modules'
import { COLUMN_METADATA } from '@/lib/bigquery/column-metadata'
import {
  inferMarketplaceCodeFromText,
  normalizeMarketplaceCode,
  normalizeMarketplaceCodes,
} from '@/lib/amazon/marketplaces'
import { z } from 'zod'

const supabase = getAdminClient()

// =============================================================================
// Server-side response cache (10 min TTL, keyed by query params)
// =============================================================================

const SERVER_CACHE_TTL = 10 * 60 * 1000 // 10 minutes
const serverCache = new Map<string, { data: unknown; timestamp: number }>()

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  serverCache.forEach((entry, key) => {
    if (now - entry.timestamp > SERVER_CACHE_TTL) serverCache.delete(key)
  })
}, 5 * 60 * 1000)

// =============================================================================
// Column whitelist per view (derived from column-metadata.ts)
// =============================================================================

const ALLOWED_COLUMNS: Record<string, string[]> = Object.fromEntries(
  Object.entries(COLUMN_METADATA).map(([alias, meta]) => [
    VIEW_ALIASES[alias],
    meta.columns.map(c => c.column),
  ])
)

// Partner identifier field varies by view
const PARTNER_FIELD_PER_VIEW: Record<string, string> = {
  pbi_sellingpartner_sales_unified_latest: 'client_id',
  pbi_sellingpartner_refunds_unified_latest: 'client_id',
  pbi_sp_par_unified_latest: 'client_name',
  pbi_sd_par_unified_latest: 'client_name',
  pbi_sb_str_unified_latest: 'client_id',
  pbi_dim_products_unified_latest: 'client_id',
  pbi_match_unified_latest: 'client_name',
}

const VALID_AGGREGATIONS = ['sum', 'avg', 'count', 'min', 'max'] as const
const VALID_SORT_DIRECTIONS = ['asc', 'desc'] as const

// =============================================================================
// Request validation
// =============================================================================

const DateRangeSchema = z.object({
  preset: z.enum(['7d', '14d', '30d', '60d', '90d', 'mtd', 'last_month', 'ytd', '365d', 'custom']),
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  comparison: z.enum(['previous_period', 'same_period_last_year', 'none']).optional(),
})

const QuerySchema = z.object({
  partner_id: z.string().uuid(),
  view: z.string().min(1),
  metrics: z.array(z.string()).min(1).max(10),
  aggregation: z.enum(VALID_AGGREGATIONS).optional().default('sum'),
  mode: z.enum(['aggregate', 'raw']).optional().default('aggregate'),
  date_range: DateRangeSchema.optional(),
  group_by: z.string().optional(),
  sort_by: z.string().optional(),
  sort_direction: z.enum(VALID_SORT_DIRECTIONS).optional().default('asc'),
  limit: z.number().int().min(1).max(1000).optional().default(100),
  data_mode: z.enum(['snapshot', 'live']).optional(),
  marketplaces: z.array(z.string().min(2).max(64)).max(25).optional(),
  force_refresh: z.boolean().optional().default(false),
})

// =============================================================================
// Helpers
// =============================================================================

function resolveViewName(alias: string): string | null {
  return VIEW_ALIASES[alias] || (Object.values(VIEW_ALIASES).includes(alias) ? alias : null)
}

function isColumnAllowed(viewName: string, column: string): boolean {
  const allowed = ALLOWED_COLUMNS[viewName]
  if (!allowed) return false
  return allowed.includes(column)
}

function getDateFilter(dateRange: z.infer<typeof DateRangeSchema>): { startDate?: string; endDate?: string } {
  if (dateRange.preset === 'custom') {
    return { startDate: dateRange.start, endDate: dateRange.end }
  }

  const now = new Date()
  const today = now.toISOString().split('T')[0]

  // Simple day-offset presets
  const dayPresets: Record<string, number> = {
    '7d': 7, '14d': 14, '30d': 30, '60d': 60, '90d': 90, '365d': 365,
  }

  if (dateRange.preset in dayPresets) {
    const start = new Date(now)
    start.setDate(start.getDate() - dayPresets[dateRange.preset])
    return { startDate: start.toISOString().split('T')[0], endDate: today }
  }

  if (dateRange.preset === 'mtd') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    return { startDate: start.toISOString().split('T')[0], endDate: today }
  }

  if (dateRange.preset === 'last_month') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const end = new Date(now.getFullYear(), now.getMonth(), 0) // last day of prev month
    return { startDate: start.toISOString().split('T')[0], endDate: end.toISOString().split('T')[0] }
  }

  if (dateRange.preset === 'ytd') {
    const start = new Date(now.getFullYear(), 0, 1)
    return { startDate: start.toISOString().split('T')[0], endDate: today }
  }

  // Fallback: last 30 days
  const fallback = new Date(now)
  fallback.setDate(fallback.getDate() - 30)
  return { startDate: fallback.toISOString().split('T')[0], endDate: today }
}

function sanitizeIdentifier(name: string): string {
  // Only allow alphanumeric and underscores
  return name.replace(/[^a-zA-Z0-9_]/g, '')
}

function getPartnerFilterCondition(partnerField: string): string {
  // Normalize comparisons to STRING so mixed identifier types (INT64 client_id vs
  // string mapping values) don't throw BigQuery signature errors.
  return `CAST(${partnerField} AS STRING) IN UNNEST(@clientIds)`
}

function extractMarketplaceCodeFromMapping(mapping: {
  external_id: string
  metadata: Record<string, unknown> | null
}): string | null {
  const root = mapping.metadata
  const fromRoot = typeof root?.marketplace_code === 'string'
    ? normalizeMarketplaceCode(root.marketplace_code)
    : null
  if (fromRoot) return fromRoot

  const referenceSheet = root?.reference_sheet
  if (referenceSheet && typeof referenceSheet === 'object') {
    const fromSheet = typeof (referenceSheet as Record<string, unknown>).marketplace_code === 'string'
      ? normalizeMarketplaceCode((referenceSheet as Record<string, unknown>).marketplace_code as string)
      : null
    if (fromSheet) return fromSheet
  }

  return inferMarketplaceCodeFromText(mapping.external_id)
}

// =============================================================================
// Route handler
// =============================================================================

export async function POST(request: NextRequest) {
  const auth = await requireAuth()
  if (!auth.authenticated) return auth.response

  try {
    const body = await request.json()
    const validation = QuerySchema.safeParse(body)
    if (!validation.success) {
      return apiValidationError(validation.error)
    }

    const {
      partner_id,
      view,
      metrics,
      aggregation,
      mode,
      date_range,
      group_by,
      sort_by,
      sort_direction,
      limit,
      marketplaces,
      force_refresh,
    } = validation.data

    // Rate limits:
    // - General dashboard querying allows high parallelism.
    // - Explicit force refresh bypasses cache, so add a stricter per-query cooldown.
    const rateLimitAction = force_refresh
      ? `bigquery:live-refresh:${partner_id}:${view}:${mode}:${group_by || '-'}:${metrics.join(',')}`
      : 'bigquery:query'
    const rateLimitConfig = force_refresh ? RATE_LIMITS.LIVE_REFRESH : RATE_LIMITS.PARTNERS_LIST
    const rateLimit = checkRateLimit(auth.user.id, rateLimitAction, rateLimitConfig)
    if (!rateLimit.allowed) {
      const response = ApiErrors.rateLimited(
        force_refresh
          ? `Live refresh is cooling down. Try again in ${Math.ceil(rateLimit.resetIn / 1000)}s.`
          : 'Too many BigQuery requests. Please wait before querying again.'
      )
      const headers = rateLimitHeaders(rateLimit)
      response.headers.set('X-RateLimit-Limit', headers['X-RateLimit-Limit'])
      response.headers.set('X-RateLimit-Remaining', headers['X-RateLimit-Remaining'])
      response.headers.set('X-RateLimit-Reset', headers['X-RateLimit-Reset'])
      response.headers.set('Retry-After', Math.max(1, Math.ceil(rateLimit.resetIn / 1000)).toString())
      return response
    }

    // Auth: check partner access
    const canAccess = await canAccessPartner(auth.user.id, auth.user.role, partner_id)
    if (!canAccess) {
      return ApiErrors.forbidden('You do not have access to this partner')
    }

    // Resolve view name
    const viewName = resolveViewName(view)
    if (!viewName) {
      return apiError('NOT_FOUND', `Unknown view: "${view}"`, 404)
    }

    // Validate all column names against whitelist
    for (const col of metrics) {
      if (!isColumnAllowed(viewName, col)) {
        return apiError('VALIDATION_ERROR', `Column "${col}" is not allowed for view "${view}"`, 400)
      }
    }
    if (group_by && !isColumnAllowed(viewName, group_by)) {
      return apiError('VALIDATION_ERROR', `Column "${group_by}" is not allowed for group_by`, 400)
    }
    if (sort_by && !isColumnAllowed(viewName, sort_by)) {
      return apiError('VALIDATION_ERROR', `Column "${sort_by}" is not allowed for sort_by`, 400)
    }

    // Look up partner's BigQuery client identifiers (multi-marketplace aware)
    const { data: mappings, error: mappingError } = await supabase
      .from('entity_external_ids')
      .select('external_id, metadata')
      .eq('entity_type', 'partners')
      .eq('entity_id', partner_id)
      .eq('source', 'bigquery')
      .order('updated_at', { ascending: false })

    if (mappingError) return ApiErrors.database()
    if (!mappings || mappings.length === 0) {
      return apiSuccess({
        mapped: false,
        message: 'This partner is not mapped to a BigQuery client identifier',
        data: null,
      })
    }

    const requestedMarketplaceCodes = normalizeMarketplaceCodes(marketplaces || [])
    const filteredMappings = requestedMarketplaceCodes.length > 0
      ? mappings.filter((mapping) => {
          const mappedCode = extractMarketplaceCodeFromMapping(mapping as {
            external_id: string
            metadata: Record<string, unknown> | null
          })
          return !!mappedCode && requestedMarketplaceCodes.includes(mappedCode)
        })
      : mappings

    const clientIds = Array.from(
      new Set(
        filteredMappings
          .map(mapping => String(mapping.external_id || '').trim())
          .filter(value => value.length > 0)
      )
    )

    if (clientIds.length === 0) {
      return apiSuccess({
        mapped: true,
        message: 'No mapped client identifiers found for the selected marketplaces',
        data: null,
      })
    }

    // Check server-side cache before building/executing query
    const cacheKey = JSON.stringify({
      clientIds: clientIds.slice().sort(),
      marketplaces: requestedMarketplaceCodes.slice().sort(),
      view,
      metrics,
      aggregation,
      mode,
      date_range,
      group_by,
      sort_by,
      sort_direction,
      limit,
    })
    const cached = serverCache.get(cacheKey)
    if (!force_refresh && cached && Date.now() - cached.timestamp < SERVER_CACHE_TTL) {
      return apiSuccess(cached.data as Record<string, unknown>, 200, rateLimitHeaders(rateLimit))
    }

    const fullTable = `\`${BIGQUERY.PROJECT_ID}.${BIGQUERY.DATASET}.${viewName}\``
    const partnerField = PARTNER_FIELD_PER_VIEW[viewName] || 'client_id'

    // Build query
    const params: Record<string, string | number | string[]> = { clientIds }
    const conditions: string[] = [getPartnerFilterCondition(partnerField)]

    // Date filtering
    if (date_range) {
      const { startDate, endDate } = getDateFilter(date_range)
      if (startDate) {
        conditions.push('date >= @startDate')
        params.startDate = startDate
      }
      if (endDate) {
        conditions.push('date <= @endDate')
        params.endDate = endDate
      }
    }

    const whereClause = conditions.join(' AND ')

    let query: string
    let isAggregated = false
    let isRaw = false

    if (mode === 'raw') {
      // Raw row query (for table widgets) - no aggregation
      const selectCols = metrics.map(sanitizeIdentifier).join(', ')
      query = `SELECT ${selectCols} FROM ${fullTable} WHERE ${whereClause}`

      const safeSortBy = sort_by ? sanitizeIdentifier(sort_by) : sanitizeIdentifier(metrics[0])
      query += ` ORDER BY ${safeSortBy} ${sort_direction === 'desc' ? 'DESC' : 'ASC'}`
      query += ` LIMIT ${limit}`
      isRaw = true
    } else if (group_by) {
      // Time series / grouped query (for charts)
      const safeGroupBy = sanitizeIdentifier(group_by)
      const selectParts = metrics.map((col) => {
        const safeCol = sanitizeIdentifier(col)
        return `${aggregation}(${safeCol}) as ${safeCol}`
      })

      query = `SELECT ${safeGroupBy}, ${selectParts.join(', ')} FROM ${fullTable} WHERE ${whereClause} GROUP BY ${safeGroupBy}`

      const safeSortBy = sort_by ? sanitizeIdentifier(sort_by) : safeGroupBy
      query += ` ORDER BY ${safeSortBy} ${sort_direction === 'desc' ? 'DESC' : 'ASC'}`
      query += ` LIMIT ${limit}`
      isAggregated = true
    } else if (metrics.length === 1) {
      // Single metric aggregation
      const safeCol = sanitizeIdentifier(metrics[0])
      query = `SELECT ${aggregation}(${safeCol}) as value FROM ${fullTable} WHERE ${whereClause}`
      isAggregated = true
    } else {
      // Multi-metric aggregation (no group by)
      const selectParts = metrics.map((col) => {
        const safeCol = sanitizeIdentifier(col)
        return `${aggregation}(${safeCol}) as ${safeCol}`
      })
      query = `SELECT ${selectParts.join(', ')} FROM ${fullTable} WHERE ${whereClause}`
      isAggregated = true
    }

    // Execute
    const bq = new BigQuery({ projectId: BIGQUERY.PROJECT_ID })
    const [job] = await bq.createQueryJob({
      query,
      params,
      labels: { source: 'sophie-hub', view: view },
    })
    const [rows] = await job.getQueryResults()

    // Fire-and-forget: log usage without blocking response
    job.getMetadata().then(([jobMeta]) => {
      const bytesProcessed = parseInt(jobMeta.statistics?.totalBytesProcessed || '0', 10)
      const startMs = parseInt(jobMeta.statistics?.startTime || '0', 10)
      const endMs = parseInt(jobMeta.statistics?.endTime || '0', 10)
      const durationMs = startMs && endMs ? endMs - startMs : null
      const estimatedCost = (bytesProcessed / 1_099_511_627_776) * 5.0

      Promise.resolve(
        supabase.from('bigquery_query_logs').insert({
          user_id: auth.user.id,
          partner_id,
          partner_name: clientIds[0] || null,
          view_alias: view,
          view_name: viewName,
          bytes_processed: bytesProcessed,
          estimated_cost_usd: estimatedCost,
          duration_ms: durationMs,
          query_mode: mode,
        })
      ).then((result) => {
        if (result && typeof result === 'object' && 'error' in result && result.error) {
          console.error('[bq-usage-log] Insert failed:', result.error)
        }
      }).catch((err) => {
        console.error('[bq-usage-log] Unexpected error:', err)
      })
    }).catch(() => {})

    // Format response based on query type
    let responseData: Record<string, unknown>

    if (isRaw) {
      // Table data: { headers, rows, total_rows }
      const headers = metrics
      const tableRows = rows.map((r) =>
        metrics.map((col) => {
          const val = r[col]
          if (val instanceof Date) return val.toISOString().split('T')[0]
          if (val && typeof val === 'object' && val.value) return String(val.value)
          return String(val ?? '')
        })
      )

      responseData = {
        mapped: true,
        clientId: clientIds[0] || null,
        clientIds,
        marketplaces: requestedMarketplaceCodes,
        type: 'table',
        data: { headers, rows: tableRows, total_rows: tableRows.length },
      }
    } else if (group_by) {
      // Chart data: { labels, datasets }
      const labels = rows.map((r) => {
        const val = r[group_by]
        if (val instanceof Date) return val.toISOString().split('T')[0]
        if (val && typeof val === 'object' && val.value) return String(val.value)
        return String(val ?? '')
      })
      const datasets = metrics.map((metric) => ({
        label: metric,
        data: rows.map((r) => Number(r[metric] ?? 0)),
      }))

      responseData = {
        mapped: true,
        clientId: clientIds[0] || null,
        clientIds,
        marketplaces: requestedMarketplaceCodes,
        type: 'chart',
        data: { labels, datasets },
        rowCount: rows.length,
      }
    } else if (isAggregated && metrics.length === 1) {
      // Single metric
      const value = rows.length > 0 ? Number(rows[0].value ?? 0) : 0

      responseData = {
        mapped: true,
        clientId: clientIds[0] || null,
        clientIds,
        marketplaces: requestedMarketplaceCodes,
        type: 'metric',
        data: { value },
      }
    } else {
      // Multi-metric aggregation
      const data: Record<string, number> = {}
      if (rows.length > 0) {
        for (const metric of metrics) {
          data[metric] = Number(rows[0][metric] ?? 0)
        }
      }

      responseData = {
        mapped: true,
        clientId: clientIds[0] || null,
        clientIds,
        marketplaces: requestedMarketplaceCodes,
        type: 'metrics',
        data,
      }
    }

    // Cache the response
    serverCache.set(cacheKey, { data: responseData, timestamp: Date.now() })

    return apiSuccess(responseData, 200, rateLimitHeaders(rateLimit))
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.error('[bigquery-query] Error:', detail)

    if (process.env.NODE_ENV !== 'production') {
      return apiError('INTERNAL_ERROR', `BigQuery query failed: ${detail}`, 500)
    }

    return ApiErrors.internal()
  }
}
