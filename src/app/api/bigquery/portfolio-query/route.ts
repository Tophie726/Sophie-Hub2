/**
 * POST /api/bigquery/portfolio-query
 *
 * Executes cross-brand BigQuery queries for the portfolio dashboard.
 * Unlike /api/bigquery/query (single-partner), this queries ALL brands
 * or a filtered subset. Admin-only.
 *
 * Supports:
 * - Aggregate metrics across all/filtered brands
 * - Time series with GROUP BY date
 * - Per-brand breakdown with group_by_brand
 * - Raw table data
 */

import { NextRequest } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'
import { getAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth/api-auth'
import { ROLES } from '@/lib/auth/roles'
import { apiSuccess, apiError, ApiErrors, apiValidationError } from '@/lib/api/response'
import { checkRateLimit, RATE_LIMITS, rateLimitHeaders } from '@/lib/rate-limit'
import { BIGQUERY } from '@/lib/constants'
import { VIEW_ALIASES } from '@/types/modules'
import { COLUMN_METADATA } from '@/lib/bigquery/column-metadata'
import { z } from 'zod'

const supabase = getAdminClient()

// Column whitelist per view (derived from column-metadata.ts)
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

// Request validation
const DateRangeSchema = z.object({
  preset: z.enum(['7d', '30d', '90d', 'custom']),
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

const PortfolioQuerySchema = z.object({
  view: z.string().min(1),
  metrics: z.array(z.string()).min(1).max(10),
  aggregation: z.enum(VALID_AGGREGATIONS).optional().default('sum'),
  mode: z.enum(['aggregate', 'raw']).optional().default('aggregate'),
  date_range: DateRangeSchema.optional(),
  group_by: z.string().optional(),
  group_by_brand: z.boolean().optional().default(false),
  partner_ids: z.array(z.string().uuid()).optional(),
  sort_by: z.string().optional(),
  sort_direction: z.enum(VALID_SORT_DIRECTIONS).optional().default('desc'),
  limit: z.number().int().min(1).max(1000).optional().default(100),
})

// Helpers
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
  const days = dateRange.preset === '7d' ? 7 : dateRange.preset === '30d' ? 30 : 90
  const start = new Date(now)
  start.setDate(start.getDate() - days)
  return {
    startDate: start.toISOString().split('T')[0],
    endDate: now.toISOString().split('T')[0],
  }
}

function sanitizeIdentifier(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, '')
}

// Simple in-memory cache (10min TTL for portfolio queries)
const portfolioCache = new Map<string, { data: unknown; timestamp: number }>()
const CACHE_TTL = 10 * 60 * 1000

function getCached(key: string): unknown | null {
  const entry = portfolioCache.get(key)
  if (!entry) return null
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    portfolioCache.delete(key)
    return null
  }
  return entry.data
}

export async function POST(request: NextRequest) {
  const auth = await requireRole(ROLES.ADMIN)
  if (!auth.authenticated) return auth.response

  // Rate limit: portfolio queries are expensive (scan all brands)
  const rateLimit = checkRateLimit(auth.user.id, 'bigquery:portfolio', RATE_LIMITS.STRICT)
  if (!rateLimit.allowed) {
    return ApiErrors.rateLimited('Too many portfolio queries. Please wait before querying again.')
  }

  try {
    const body = await request.json()
    const validation = PortfolioQuerySchema.safeParse(body)
    if (!validation.success) {
      return apiValidationError(validation.error)
    }

    const {
      view, metrics, aggregation, mode, date_range,
      group_by, group_by_brand, partner_ids,
      sort_by, sort_direction, limit,
    } = validation.data

    // Resolve view name
    const viewName = resolveViewName(view)
    if (!viewName) {
      return apiError('NOT_FOUND', `Unknown view: "${view}"`, 404)
    }

    // Validate columns against whitelist
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

    // Build cache key
    const cacheKey = JSON.stringify({ view, metrics, aggregation, mode, date_range, group_by, group_by_brand, partner_ids, sort_by, sort_direction, limit })
    const cached = getCached(cacheKey)
    if (cached) {
      return apiSuccess(cached, 200, rateLimitHeaders(rateLimit))
    }

    const fullTable = `\`${BIGQUERY.PROJECT_ID}.${BIGQUERY.DATASET}.${viewName}\``
    const partnerField = PARTNER_FIELD_PER_VIEW[viewName] || 'client_id'

    // Build WHERE conditions
    const params: Record<string, string | number> = {}
    const conditions: string[] = []

    // Optional partner filter
    if (partner_ids && partner_ids.length > 0) {
      // Look up client_names/client_ids from entity_external_ids
      const { data: mappings, error: mappingError } = await supabase
        .from('entity_external_ids')
        .select('external_id')
        .eq('entity_type', 'partners')
        .eq('source', 'bigquery')
        .in('entity_id', partner_ids)

      if (mappingError) return ApiErrors.database()

      const clientNames = (mappings || []).map(m => m.external_id)
      if (clientNames.length === 0) {
        // No mappings found — return empty result
        return apiSuccess({
          type: 'empty',
          data: null,
          brand_count: 0,
          message: 'No mapped brands found for selected partners',
        })
      }

      // Parameterize the IN clause
      clientNames.forEach((name, i) => {
        params[`client_${i}`] = name
      })
      const inClause = clientNames.map((_, i) => `@client_${i}`).join(', ')
      conditions.push(`${partnerField} IN (${inClause})`)
    }

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

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Build query based on mode
    let query: string

    if (mode === 'raw') {
      // Raw rows (for table widgets)
      const selectCols = metrics.map(sanitizeIdentifier)
      if (group_by_brand) {
        selectCols.unshift(sanitizeIdentifier(partnerField))
      }
      query = `SELECT ${selectCols.join(', ')} FROM ${fullTable} ${whereClause}`

      const safeSortBy = sort_by ? sanitizeIdentifier(sort_by) : sanitizeIdentifier(metrics[0])
      query += ` ORDER BY ${safeSortBy} ${sort_direction === 'desc' ? 'DESC' : 'ASC'}`
      query += ` LIMIT ${limit}`
    } else if (group_by || group_by_brand) {
      // Aggregated with grouping (time series and/or per-brand)
      const groupByCols: string[] = []
      if (group_by) groupByCols.push(sanitizeIdentifier(group_by))
      if (group_by_brand) groupByCols.push(sanitizeIdentifier(partnerField))

      const selectParts = [
        ...groupByCols,
        ...metrics.map((col) => {
          const safeCol = sanitizeIdentifier(col)
          return `${aggregation}(${safeCol}) as ${safeCol}`
        }),
      ]

      query = `SELECT ${selectParts.join(', ')} FROM ${fullTable} ${whereClause} GROUP BY ${groupByCols.join(', ')}`

      const safeSortBy = sort_by ? sanitizeIdentifier(sort_by) : (group_by ? sanitizeIdentifier(group_by) : sanitizeIdentifier(metrics[0]))
      query += ` ORDER BY ${safeSortBy} ${sort_direction === 'desc' ? 'DESC' : 'ASC'}`
      query += ` LIMIT ${limit}`
    } else {
      // Pure aggregate (single row result)
      if (metrics.length === 1) {
        const safeCol = sanitizeIdentifier(metrics[0])
        query = `SELECT ${aggregation}(${safeCol}) as value FROM ${fullTable} ${whereClause}`
      } else {
        const selectParts = metrics.map((col) => {
          const safeCol = sanitizeIdentifier(col)
          return `${aggregation}(${safeCol}) as ${safeCol}`
        })
        query = `SELECT ${selectParts.join(', ')} FROM ${fullTable} ${whereClause}`
      }
    }

    // Execute
    const bq = new BigQuery({ projectId: BIGQUERY.PROJECT_ID })
    const [job] = await bq.createQueryJob({
      query,
      params,
      labels: { source: 'sophie-hub', view: view, purpose: 'portfolio' },
    })
    const [rows] = await job.getQueryResults()

    // Log usage (fire-and-forget)
    job.getMetadata().then(([jobMeta]) => {
      const bytesProcessed = parseInt(jobMeta.statistics?.totalBytesProcessed || '0', 10)
      const estimatedCost = (bytesProcessed / 1_099_511_627_776) * 5.0

      Promise.resolve(
        supabase.from('bigquery_query_logs').insert({
          user_id: auth.user.id,
          partner_id: null,
          partner_name: 'portfolio',
          view_alias: view,
          view_name: viewName,
          bytes_processed: bytesProcessed,
          estimated_cost_usd: estimatedCost,
          duration_ms: null,
          query_mode: `portfolio-${mode}`,
        })
      ).catch((err) => {
        console.error('[bq-portfolio-log] Insert failed:', err)
      })
    }).catch(() => {})

    // Format response
    let result: unknown

    if (mode === 'raw' || (group_by_brand && !group_by)) {
      // Table data
      const allCols = group_by_brand ? [partnerField, ...metrics] : metrics
      const headers = allCols
      const tableRows = rows.map((r) =>
        allCols.map((col) => {
          const val = r[col]
          if (val instanceof Date) return val.toISOString().split('T')[0]
          if (val && typeof val === 'object' && 'value' in val) return String(val.value)
          return String(val ?? '')
        })
      )

      result = {
        type: 'table',
        data: { headers, rows: tableRows, total_rows: tableRows.length },
        brand_count: group_by_brand ? new Set(tableRows.map(r => r[0])).size : null,
      }
    } else if (group_by) {
      // Chart data
      const labels = rows.map((r) => {
        const val = r[group_by]
        if (val instanceof Date) return val.toISOString().split('T')[0]
        if (val && typeof val === 'object' && 'value' in val) return String(val.value)
        return String(val ?? '')
      })
      const datasets = metrics.map((metric) => ({
        label: metric,
        data: rows.map((r) => Number(r[metric] ?? 0)),
      }))

      result = {
        type: 'chart',
        data: { labels, datasets },
        rowCount: rows.length,
      }
    } else if (metrics.length === 1) {
      // Single metric
      const value = rows.length > 0 ? Number(rows[0].value ?? 0) : 0
      result = { type: 'metric', data: { value } }
    } else {
      // Multi-metric
      const data: Record<string, number> = {}
      if (rows.length > 0) {
        for (const metric of metrics) {
          data[metric] = Number(rows[0][metric] ?? 0)
        }
      }
      result = { type: 'metrics', data }
    }

    // Cache result
    portfolioCache.set(cacheKey, { data: result, timestamp: Date.now() })

    return apiSuccess(result, 200, rateLimitHeaders(rateLimit))
  } catch (error) {
    console.error('[portfolio-query] Error:', error instanceof Error ? error.message : error)
    return ApiErrors.internal('Portfolio query failed')
  }
}
