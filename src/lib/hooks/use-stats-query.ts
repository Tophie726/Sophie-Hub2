import { useQuery } from '@tanstack/react-query'

interface TableStats {
  partners: { count: number; activeCount: number; fields: string[] }
  staff: { count: number; fields: string[] }
}

export function useStatsQuery() {
  return useQuery<TableStats>({
    queryKey: ['stats'],
    queryFn: async () => {
      const res = await fetch('/api/stats/tables')
      if (!res.ok) throw new Error('Failed to fetch stats')
      const json = await res.json()
      // Stats API returns { partners, staff } directly (no data wrapper)
      return json.data ?? json
    },
  })
}

interface HealthBucket {
  id: string
  label: string
  color: string
  count: number
}

interface HealthDistribution {
  buckets: HealthBucket[]
  total: number
  unmappedCount: number
  lastCalculated: string
}

export function useHealthDistributionQuery() {
  return useQuery<HealthDistribution | null>({
    queryKey: ['stats', 'health-distribution'],
    queryFn: async () => {
      const res = await fetch('/api/stats/health-distribution')
      if (!res.ok) return null
      const json = await res.json()
      return json.data || json
    },
  })
}
