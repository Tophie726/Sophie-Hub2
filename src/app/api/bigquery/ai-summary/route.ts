/**
 * POST /api/bigquery/ai-summary
 *
 * Generates an AI text summary from BigQuery data.
 * Steps: validate input -> fetch BigQuery data -> send to Anthropic API -> return summary.
 */

import { NextRequest } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'
import Anthropic from '@anthropic-ai/sdk'
import { getAdminClient } from '@/lib/supabase/admin'
import { requireAuth, canAccessPartner } from '@/lib/auth/api-auth'
import { apiSuccess, apiError, ApiErrors, apiValidationError } from '@/lib/api/response'
import { checkRateLimit, rateLimitHeaders } from '@/lib/rate-limit'
import { BIGQUERY } from '@/lib/constants'
import { VIEW_ALIASES } from '@/types/modules'
import { COLUMN_METADATA } from '@/lib/bigquery/column-metadata'
import { z } from 'zod'

const supabase = getAdminClient()

// Server-side cache (10 min TTL)
const SERVER_CACHE_TTL = 10 * 60 * 1000
const serverCache = new Map<string, { data: unknown; timestamp: number }>()

setInterval(() => {
  const now = Date.now()
  serverCache.forEach((entry, key) => {
    if (now - entry.timestamp > SERVER_CACHE_TTL) serverCache.delete(key)
  })
}, 5 * 60 * 1000)

// Rate limit: 10 req/min for AI summaries
const AI_SUMMARY_RATE_LIMIT = { maxRequests: 10, windowMs: 60 * 1000 }

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

// Allowed columns per view (derived from column-metadata)
const ALLOWED_COLUMNS: Record<string, string[]> = Object.fromEntries(
  Object.entries(COLUMN_METADATA).map(([alias, meta]) => [
    VIEW_ALIASES[alias],
    meta.columns.map(c => c.column),
  ])
)

function sanitizeIdentifier(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, '')
}

function resolveViewName(alias: string): string | null {
  return VIEW_ALIASES[alias] || (Object.values(VIEW_ALIASES).includes(alias) ? alias : null)
}

const DateRangeSchema = z.object({
  preset: z.enum(['7d', '14d', '30d', '60d', '90d', 'mtd', 'last_month', 'ytd', '365d', 'custom']),
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

const RequestSchema = z.object({
  prompt: z.string().min(1).max(1000),
  view: z.string().min(1),
  metrics: z.array(z.string()).min(1).max(10),
  format: z.enum(['summary', 'bullets', 'comparison']),
  partner_id: z.string().uuid(),
  date_range: DateRangeSchema.optional(),
})

function getDateFilter(dateRange: z.infer<typeof DateRangeSchema>): { startDate?: string; endDate?: string } {
  const now = new Date()

  if (dateRange.preset === 'custom') {
    return { startDate: dateRange.start, endDate: dateRange.end }
  }

  const presetDays: Record<string, number> = {
    '7d': 7, '14d': 14, '30d': 30, '60d': 60, '90d': 90, '365d': 365,
  }

  if (presetDays[dateRange.preset]) {
    const start = new Date(now)
    start.setDate(start.getDate() - presetDays[dateRange.preset])
    return { startDate: start.toISOString().split('T')[0], endDate: now.toISOString().split('T')[0] }
  }

  if (dateRange.preset === 'mtd') {
    return {
      startDate: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`,
      endDate: now.toISOString().split('T')[0],
    }
  }

  if (dateRange.preset === 'last_month') {
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
    return {
      startDate: lastMonth.toISOString().split('T')[0],
      endDate: lastMonthEnd.toISOString().split('T')[0],
    }
  }

  if (dateRange.preset === 'ytd') {
    return {
      startDate: `${now.getFullYear()}-01-01`,
      endDate: now.toISOString().split('T')[0],
    }
  }

  return { startDate: undefined, endDate: undefined }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth()
  if (!auth.authenticated) return auth.response

  const rateLimit = checkRateLimit(auth.user.id, 'bigquery:ai-summary', AI_SUMMARY_RATE_LIMIT)
  if (!rateLimit.allowed) {
    return ApiErrors.rateLimited('AI summary rate limit exceeded. Please wait before requesting again.')
  }

  try {
    const body = await request.json()
    const validation = RequestSchema.safeParse(body)
    if (!validation.success) {
      return apiValidationError(validation.error)
    }

    const { prompt, view, metrics, format, partner_id, date_range } = validation.data

    // Auth: check partner access
    const canAccess = await canAccessPartner(auth.user.id, auth.user.role, partner_id)
    if (!canAccess) {
      return ApiErrors.forbidden('You do not have access to this partner')
    }

    // Resolve view
    const viewName = resolveViewName(view)
    if (!viewName) {
      return apiError('NOT_FOUND', `Unknown view: "${view}"`, 404)
    }

    // Validate columns
    const allowed = ALLOWED_COLUMNS[viewName]
    for (const col of metrics) {
      if (!allowed?.includes(col)) {
        return apiError('VALIDATION_ERROR', `Column "${col}" is not allowed for view "${view}"`, 400)
      }
    }

    // Look up partner's BigQuery client identifier
    const { data: mapping, error: mappingError } = await supabase
      .from('entity_external_ids')
      .select('external_id')
      .eq('entity_type', 'partners')
      .eq('entity_id', partner_id)
      .eq('source', 'bigquery')
      .maybeSingle()

    if (mappingError) return ApiErrors.database()
    if (!mapping) {
      return apiSuccess({ summary: 'This partner is not mapped to BigQuery data.' })
    }

    const clientId = mapping.external_id

    // Check server cache
    const cacheKey = JSON.stringify({ clientId, view, metrics, format, prompt, date_range })
    const cached = serverCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < SERVER_CACHE_TTL) {
      return apiSuccess(cached.data as Record<string, unknown>, 200, rateLimitHeaders(rateLimit))
    }

    // Build and execute BigQuery query
    const fullTable = `\`${BIGQUERY.PROJECT_ID}.${BIGQUERY.DATASET}.${viewName}\``
    const partnerField = PARTNER_FIELD_PER_VIEW[viewName] || 'client_id'

    const params: Record<string, string | number> = { clientId }
    const conditions: string[] = [`${partnerField} = @clientId`]

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
    const selectCols = metrics.map(sanitizeIdentifier)
    const query = `SELECT date, ${selectCols.join(', ')} FROM ${fullTable} WHERE ${whereClause} ORDER BY date DESC LIMIT 100`

    const bq = new BigQuery({ projectId: BIGQUERY.PROJECT_ID })
    const [job] = await bq.createQueryJob({
      query,
      params,
      labels: { source: 'sophie-hub', feature: 'ai-summary' },
    })
    const [rows] = await job.getQueryResults()

    if (!rows || rows.length === 0) {
      const noDataSummary = 'No data available for the selected date range and metrics.'
      const responseData = { summary: noDataSummary }
      serverCache.set(cacheKey, { data: responseData, timestamp: Date.now() })
      return apiSuccess(responseData, 200, rateLimitHeaders(rateLimit))
    }

    // Format data for the AI prompt
    const dataLines = rows.map((row) => {
      const parts: string[] = []
      const dateVal = row.date instanceof Date ? row.date.toISOString().split('T')[0] : String(row.date ?? '')
      parts.push(dateVal)
      for (const col of metrics) {
        const val = row[col]
        parts.push(`${col}=${val != null ? val : 'N/A'}`)
      }
      return parts.join(', ')
    })

    const formatInstructions: Record<string, string> = {
      summary: 'Provide a concise 2-3 sentence summary paragraph.',
      bullets: 'Provide 3-5 bullet points highlighting the most important insights. Use - for bullets.',
      comparison: 'Compare the metrics across the time period, noting trends, peaks, and any notable changes. Keep it to 3-4 sentences.',
    }

    const systemPrompt = `You are a data analyst for an Amazon brand management agency. You analyze BigQuery data for partner brands and provide clear, actionable insights. Be concise and specific with numbers. Use markdown bold (**text**) for emphasis on key figures.`

    const userPrompt = `${prompt}

Data view: ${view}
Metrics: ${metrics.join(', ')}
Time period: ${rows.length} data points

Data (most recent first):
${dataLines.slice(0, 50).join('\n')}

${formatInstructions[format]}
Do not mention BigQuery or the data source. Speak as if this is the partner's Amazon performance data.`

    // Call Anthropic API
    const anthropic = new Anthropic()
    const aiResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 500,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const summaryText = aiResponse.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n')

    const responseData = { summary: summaryText }
    serverCache.set(cacheKey, { data: responseData, timestamp: Date.now() })

    return apiSuccess(responseData, 200, rateLimitHeaders(rateLimit))
  } catch (error) {
    console.error('[ai-summary] Error:', error instanceof Error ? error.message : error)
    return ApiErrors.internal('Failed to generate AI summary')
  }
}
