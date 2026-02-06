/**
 * GET /api/bigquery/usage?period=30d
 *
 * Returns BigQuery usage and cost data for the admin dashboard.
 * Uses a single combined INFORMATION_SCHEMA query (date × source) and derives:
 *   - Daily totals (aggregate across sources)
 *   - Daily costs per source (for filtered chart)
 *   - Source breakdown (aggregate across days)
 *   - Overall totals
 * Plus Supabase bigquery_query_logs for Sophie Hub per-partner attribution.
 *
 * Admin-only. Cached for 1 hour.
 */

import { NextRequest } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'
import { getAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth/api-auth'
import { ROLES } from '@/lib/auth/roles'
import { apiSuccess, apiError, ApiErrors } from '@/lib/api/response'
import { BIGQUERY } from '@/lib/constants'
import { getCachedUsage, setCachedUsage } from '@/lib/bigquery/usage-cache'
import type { UsageData, UsageOverview, DailyCost, SourceBreakdown, AccountUsage } from '@/types/usage'

const supabase = getAdminClient()

const VALID_PERIODS = ['7d', '30d', '90d'] as const
type Period = (typeof VALID_PERIODS)[number]

/** The CASE expression used to categorize query sources */
const SOURCE_CASE = `
  CASE
    WHEN labels IS NOT NULL AND EXISTS(
      SELECT 1 FROM UNNEST(labels) l WHERE l.key = 'source' AND l.value = 'sophie-hub'
    ) THEN 'Sophie Hub'
    WHEN LOWER(user_email) LIKE '%daton%' THEN 'Daton (Sync)'
    WHEN LOWER(user_email) LIKE '%powerbi%'
      OR LOWER(user_email) LIKE '%looker%'
      OR LOWER(user_email) LIKE '%tableau%'
      THEN 'BI Tools'
    WHEN LOWER(user_email) LIKE '%@sophiesociety%'
      OR LOWER(user_email) LIKE '%@sophie-society%'
      THEN 'Team Queries'
    ELSE 'Other'
  END
`

function periodToDays(period: Period): number {
  switch (period) {
    case '7d': return 7
    case '30d': return 30
    case '90d': return 90
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireRole(ROLES.ADMIN)
  if (!auth.authenticated) return auth.response

  const period = (request.nextUrl.searchParams.get('period') || '30d') as Period
  if (!VALID_PERIODS.includes(period)) {
    return apiError('VALIDATION_ERROR', 'Invalid period. Use 7d, 30d, or 90d.', 400)
  }

  // Check cache
  const cached = getCachedUsage(period)
  if (cached) {
    return apiSuccess(cached)
  }

  const days = periodToDays(period)
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  const startDateStr = startDate.toISOString().split('T')[0]

  try {
    // Run combined INFORMATION_SCHEMA query + Supabase in parallel
    const [combinedResult, supabaseResult] = await Promise.allSettled([
      fetchCombinedStats(days),
      fetchSupabaseStats(startDateStr),
    ])

    let dailyCosts: DailyCost[] = []
    let dailyCostsBySource: Record<string, DailyCost[]> = {}
    let sourceBreakdown: SourceBreakdown[] = []
    let totals = { cost: 0, queries: 0, bytes: 0 }

    if (combinedResult.status === 'fulfilled') {
      dailyCosts = combinedResult.value.dailyCosts
      dailyCostsBySource = combinedResult.value.dailyCostsBySource
      sourceBreakdown = combinedResult.value.sourceBreakdown
      totals = combinedResult.value.totals
    }

    let accountUsage: AccountUsage[] = []
    let uniqueAccounts = 0

    if (supabaseResult.status === 'fulfilled') {
      accountUsage = supabaseResult.value.accounts
      uniqueAccounts = supabaseResult.value.uniqueAccounts
    }

    const overview: UsageOverview = {
      total_cost_usd: totals.cost,
      total_queries: totals.queries,
      total_bytes_processed: totals.bytes,
      unique_accounts: uniqueAccounts,
      period_days: days,
    }

    const data: UsageData = {
      overview,
      dailyCosts,
      dailyCostsBySource,
      sourceBreakdown,
      accountUsage,
      cached_at: new Date().toISOString(),
    }

    setCachedUsage(period, data)
    return apiSuccess(data)
  } catch (error) {
    return ApiErrors.internal(
      error instanceof Error ? error.message : 'Failed to fetch usage data'
    )
  }
}

// =============================================================================
// Combined INFORMATION_SCHEMA query: daily × source in one scan
// =============================================================================

/**
 * Single query that groups by (date, source_category).
 * From this we derive:
 *   - dailyCosts: sum across sources per day
 *   - dailyCostsBySource: per source per day (for chart filtering)
 *   - sourceBreakdown: sum across days per source
 *   - totals: grand totals
 */
async function fetchCombinedStats(days: number): Promise<{
  dailyCosts: DailyCost[]
  dailyCostsBySource: Record<string, DailyCost[]>
  sourceBreakdown: SourceBreakdown[]
  totals: { cost: number; queries: number; bytes: number }
}> {
  const bq = new BigQuery({ projectId: BIGQUERY.PROJECT_ID })

  const query = `
    SELECT
      DATE(creation_time) as query_date,
      ${SOURCE_CASE} as source_category,
      COUNT(*) as query_count,
      SUM(total_bytes_processed) as total_bytes,
      SUM(total_bytes_processed) / 1099511627776 * 5.0 as estimated_cost
    FROM \`region-us\`.INFORMATION_SCHEMA.JOBS_BY_PROJECT
    WHERE
      creation_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${days} DAY)
      AND job_type = 'QUERY'
      AND state = 'DONE'
      AND error_result IS NULL
      AND cache_hit != true
    GROUP BY query_date, source_category
    ORDER BY query_date ASC, estimated_cost DESC
  `

  const [job] = await bq.createQueryJob({
    query,
    labels: { source: 'sophie-hub', purpose: 'usage-dashboard' },
  })
  const [rows] = await job.getQueryResults()

  // Accumulators
  const dailyTotals = new Map<string, { queries: number; bytes: number; cost: number }>()
  const bySource = new Map<string, { queries: number; bytes: number; cost: number }>()
  const dailyBySource = new Map<string, Map<string, { queries: number; bytes: number; cost: number }>>()

  let totalCost = 0
  let totalQueries = 0
  let totalBytes = 0

  for (const row of rows) {
    const date = row.query_date instanceof Date
      ? row.query_date.toISOString().split('T')[0]
      : row.query_date?.value
        ? String(row.query_date.value)
        : String(row.query_date ?? '')

    const source = String(row.source_category ?? 'Other')
    const queries = Number(row.query_count ?? 0)
    const bytes = Number(row.total_bytes ?? 0)
    const cost = Number(row.estimated_cost ?? 0)

    totalCost += cost
    totalQueries += queries
    totalBytes += bytes

    // Daily totals (all sources combined)
    const existing = dailyTotals.get(date)
    if (existing) {
      existing.queries += queries
      existing.bytes += bytes
      existing.cost += cost
    } else {
      dailyTotals.set(date, { queries, bytes, cost })
    }

    // Source totals (all days combined)
    const srcExisting = bySource.get(source)
    if (srcExisting) {
      srcExisting.queries += queries
      srcExisting.bytes += bytes
      srcExisting.cost += cost
    } else {
      bySource.set(source, { queries, bytes, cost })
    }

    // Daily per source
    if (!dailyBySource.has(source)) {
      dailyBySource.set(source, new Map())
    }
    const srcDailyMap = dailyBySource.get(source)!
    const srcDaily = srcDailyMap.get(date)
    if (srcDaily) {
      srcDaily.queries += queries
      srcDaily.bytes += bytes
      srcDaily.cost += cost
    } else {
      srcDailyMap.set(date, { queries, bytes, cost })
    }
  }

  // Build dailyCosts array (sorted by date)
  const dailyCosts: DailyCost[] = Array.from(dailyTotals.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, d]) => ({ date, queries: d.queries, bytes: d.bytes, cost: d.cost }))

  // Build dailyCostsBySource
  const dailyCostsBySource: Record<string, DailyCost[]> = {}
  for (const [source, dayMap] of Array.from(dailyBySource.entries())) {
    dailyCostsBySource[source] = Array.from(dayMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, d]) => ({ date, queries: d.queries, bytes: d.bytes, cost: d.cost }))
  }

  // Build sourceBreakdown with percentages
  const sourceBreakdown: SourceBreakdown[] = Array.from(bySource.entries())
    .map(([source, d]) => ({
      source,
      query_count: d.queries,
      total_bytes: d.bytes,
      estimated_cost: d.cost,
      pct: totalCost > 0 ? (d.cost / totalCost) * 100 : 0,
    }))
    .sort((a, b) => b.estimated_cost - a.estimated_cost)

  return {
    dailyCosts,
    dailyCostsBySource,
    sourceBreakdown,
    totals: { cost: totalCost, queries: totalQueries, bytes: totalBytes },
  }
}

// =============================================================================
// Supabase query logs (Sophie Hub per-partner attribution)
// =============================================================================

async function fetchSupabaseStats(startDate: string): Promise<{
  accounts: AccountUsage[]
  uniqueAccounts: number
}> {
  const { data: logs, error } = await supabase
    .from('bigquery_query_logs')
    .select('partner_id, partner_name, view_alias, bytes_processed, estimated_cost_usd, created_at')
    .gte('created_at', startDate)
    .order('created_at', { ascending: false })

  if (error || !logs) {
    return { accounts: [], uniqueAccounts: 0 }
  }

  // Aggregate by partner
  const byPartner = new Map<string, {
    partner_id: string | null
    partner_name: string
    query_count: number
    total_bytes: number
    estimated_cost: number
    views: Set<string>
    last_query: string
  }>()

  for (const log of logs) {
    const key = log.partner_name || log.partner_id || 'unknown'
    const existing = byPartner.get(key)

    if (existing) {
      existing.query_count++
      existing.total_bytes += Number(log.bytes_processed ?? 0)
      existing.estimated_cost += Number(log.estimated_cost_usd ?? 0)
      if (log.view_alias) existing.views.add(log.view_alias)
    } else {
      const views = new Set<string>()
      if (log.view_alias) views.add(log.view_alias)

      byPartner.set(key, {
        partner_id: log.partner_id,
        partner_name: log.partner_name || 'Unknown',
        query_count: 1,
        total_bytes: Number(log.bytes_processed ?? 0),
        estimated_cost: Number(log.estimated_cost_usd ?? 0),
        views,
        last_query: log.created_at,
      })
    }
  }

  const accounts: AccountUsage[] = Array.from(byPartner.values())
    .map((a) => ({
      partner_id: a.partner_id,
      partner_name: a.partner_name,
      query_count: a.query_count,
      total_bytes: a.total_bytes,
      estimated_cost: a.estimated_cost,
      views_used: Array.from(a.views),
      last_query: a.last_query,
    }))
    .sort((a, b) => b.estimated_cost - a.estimated_cost)

  return {
    accounts,
    uniqueAccounts: byPartner.size,
  }
}
