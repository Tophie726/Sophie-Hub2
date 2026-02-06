/**
 * GET /api/bigquery/usage?period=30d
 *
 * Returns BigQuery usage and cost data for the admin dashboard.
 * Combines three data sources:
 *   1. INFORMATION_SCHEMA.JOBS_BY_PROJECT — ground-truth daily totals (excludes cached)
 *   2. INFORMATION_SCHEMA.JOBS_BY_PROJECT — source breakdown by labels/user_email
 *   3. bigquery_query_logs (Supabase) — Sophie Hub per-partner attribution
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
    // Run all three data sources in parallel
    const [infoSchemaResult, sourceResult, supabaseResult] = await Promise.allSettled([
      fetchInfoSchemaStats(days),
      fetchSourceBreakdown(days),
      fetchSupabaseStats(startDateStr),
    ])

    // INFORMATION_SCHEMA: daily cost trend + totals
    let dailyCosts: DailyCost[] = []
    let infoSchemaTotals = { cost: 0, queries: 0, bytes: 0 }

    if (infoSchemaResult.status === 'fulfilled') {
      dailyCosts = infoSchemaResult.value.dailyCosts
      infoSchemaTotals = infoSchemaResult.value.totals
    }

    // Source breakdown
    let sourceBreakdown: SourceBreakdown[] = []
    if (sourceResult.status === 'fulfilled') {
      sourceBreakdown = sourceResult.value
    }

    // Supabase logs: per-partner breakdown
    let accountUsage: AccountUsage[] = []
    let uniqueAccounts = 0

    if (supabaseResult.status === 'fulfilled') {
      accountUsage = supabaseResult.value.accounts
      uniqueAccounts = supabaseResult.value.uniqueAccounts
    }

    const overview: UsageOverview = {
      total_cost_usd: infoSchemaTotals.cost,
      total_queries: infoSchemaTotals.queries,
      total_bytes_processed: infoSchemaTotals.bytes,
      unique_accounts: uniqueAccounts,
      period_days: days,
    }

    const data: UsageData = {
      overview,
      dailyCosts,
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
// INFORMATION_SCHEMA: daily cost trend + totals (excludes cached queries)
// =============================================================================

async function fetchInfoSchemaStats(days: number): Promise<{
  dailyCosts: DailyCost[]
  totals: { cost: number; queries: number; bytes: number }
}> {
  const bq = new BigQuery({ projectId: BIGQUERY.PROJECT_ID })

  const query = `
    SELECT
      DATE(creation_time) as query_date,
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
    GROUP BY query_date
    ORDER BY query_date ASC
  `

  const [job] = await bq.createQueryJob({
    query,
    labels: { source: 'sophie-hub', purpose: 'usage-dashboard' },
  })
  const [rows] = await job.getQueryResults()

  let totalCost = 0
  let totalQueries = 0
  let totalBytes = 0

  const dailyCosts: DailyCost[] = rows.map((row) => {
    const date = row.query_date instanceof Date
      ? row.query_date.toISOString().split('T')[0]
      : row.query_date?.value
        ? String(row.query_date.value)
        : String(row.query_date ?? '')

    const queries = Number(row.query_count ?? 0)
    const bytes = Number(row.total_bytes ?? 0)
    const cost = Number(row.estimated_cost ?? 0)

    totalCost += cost
    totalQueries += queries
    totalBytes += bytes

    return { date, queries, bytes, cost }
  })

  return {
    dailyCosts,
    totals: { cost: totalCost, queries: totalQueries, bytes: totalBytes },
  }
}

// =============================================================================
// INFORMATION_SCHEMA: source breakdown (by job labels + user_email)
// =============================================================================

/**
 * Categorize queries by source using BigQuery job labels and user_email.
 *
 * Sophie Hub queries are tagged with labels.source = 'sophie-hub'.
 * Other sources are identified by user_email patterns:
 *   - Service accounts with 'daton' → Daton pipeline
 *   - Service accounts with 'powerbi' or 'looker' → Power BI / BI tools
 *   - Regular @sophiesociety.com emails → Console / Manual
 *   - Everything else → Other
 */
async function fetchSourceBreakdown(days: number): Promise<SourceBreakdown[]> {
  const bq = new BigQuery({ projectId: BIGQUERY.PROJECT_ID })

  // Query that categorizes by source using labels and user_email
  const query = `
    SELECT
      CASE
        WHEN labels IS NOT NULL AND EXISTS(
          SELECT 1 FROM UNNEST(labels) l WHERE l.key = 'source' AND l.value = 'sophie-hub'
        ) THEN 'Sophie Hub'
        WHEN LOWER(user_email) LIKE '%daton%' THEN 'Daton Pipeline'
        WHEN LOWER(user_email) LIKE '%powerbi%'
          OR LOWER(user_email) LIKE '%looker%'
          OR LOWER(user_email) LIKE '%tableau%'
          THEN 'BI Tools'
        WHEN LOWER(user_email) LIKE '%@sophiesociety%'
          OR LOWER(user_email) LIKE '%@sophie-society%'
          THEN 'Manual (Team)'
        ELSE 'Other'
      END as source_category,
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
    GROUP BY source_category
    ORDER BY estimated_cost DESC
  `

  const [job] = await bq.createQueryJob({
    query,
    labels: { source: 'sophie-hub', purpose: 'usage-dashboard' },
  })
  const [rows] = await job.getQueryResults()

  // Calculate total for percentage
  let grandTotal = 0
  const raw = rows.map((row) => {
    const cost = Number(row.estimated_cost ?? 0)
    grandTotal += cost
    return {
      source: String(row.source_category ?? 'Other'),
      query_count: Number(row.query_count ?? 0),
      total_bytes: Number(row.total_bytes ?? 0),
      estimated_cost: cost,
    }
  })

  return raw.map((r) => ({
    ...r,
    pct: grandTotal > 0 ? (r.estimated_cost / grandTotal) * 100 : 0,
  }))
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

  // Convert to array, sorted by cost descending
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
