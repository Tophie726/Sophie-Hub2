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

export interface AccountUsage {
  partner_id: string | null
  partner_name: string
  query_count: number
  total_bytes: number
  estimated_cost: number
  views_used: string[]
  last_query: string
}

export interface UsageData {
  overview: UsageOverview
  dailyCosts: DailyCost[]
  accountUsage: AccountUsage[]
  cached_at: string
}
