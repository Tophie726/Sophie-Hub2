export interface UsageOverview {
  total_cost_usd: number
  total_queries: number
  total_bytes_processed: number
  unique_accounts: number
  period_days: number
}

export interface DailyCost {
  date: string
  queries: number
  bytes: number
  cost: number
}

/** Cost breakdown by source (Sophie Hub, Power BI, Daton, etc.) */
export interface SourceBreakdown {
  source: string
  query_count: number
  total_bytes: number
  estimated_cost: number
  /** Percentage of total cost */
  pct: number
}

export interface AccountUsage {
  partner_id: string | null
  partner_name: string
  query_count: number
  total_bytes: number
  estimated_cost: number
  views_used: string[]
  last_query: string
}

/** Drill-down into a single source: top queriers by user_email */
export interface SourceDetailEntry {
  user_email: string
  query_count: number
  total_bytes: number
  estimated_cost: number
  first_query: string
  last_query: string
  /** Source category (only populated when source=All) */
  source_category?: string
}

export interface UsageData {
  overview: UsageOverview
  dailyCosts: DailyCost[]
  /** Daily costs broken down by source category (for filtered chart view) */
  dailyCostsBySource: Record<string, DailyCost[]>
  sourceBreakdown: SourceBreakdown[]
  accountUsage: AccountUsage[]
  cached_at: string
}
