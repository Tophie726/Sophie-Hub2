'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent } from '@/components/ui/card'
import {
  Building2,
  Users,
  ArrowUpRight,
  Loader2,
} from 'lucide-react'
import Link from 'next/link'
import { HealthDistributionCard } from '@/components/dashboard/health-distribution-card'

interface TableStats {
  partners: { count: number; activeCount: number; fields: string[] }
  staff: { count: number; fields: string[] }
}

export default function DashboardPage() {
  const [stats, setStats] = useState<TableStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const statsRes = await fetch('/api/stats/tables')

        if (statsRes.ok) {
          const data = await statsRes.json()
          setStats(data)
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [])

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <PageHeader title="Dashboard" />
        <div className="flex items-center justify-center py-32">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <PageHeader title="Dashboard" />

      <div className="p-6 md:p-8">
        <div className="space-y-6">
          {/* Primary Stats */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Partners */}
            <Link href="/partners">
              <Card className="group relative overflow-hidden transition-all duration-200 hover:shadow-md hover:border-primary/20">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10">
                      <Building2 className="h-6 w-6 text-blue-500" />
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 transition-all duration-200 group-hover:opacity-100" />
                  </div>
                  <div className="mt-4">
                    <p className="text-3xl font-bold tabular-nums">{stats?.partners.activeCount ?? 0}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Active Partners
                      {stats?.partners.count && stats.partners.count > stats.partners.activeCount && (
                        <span className="text-xs ml-1">of {stats.partners.count}</span>
                      )}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* Staff */}
            <Link href="/staff">
              <Card className="group relative overflow-hidden transition-all duration-200 hover:shadow-md hover:border-primary/20">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-500/10">
                      <Users className="h-6 w-6 text-green-500" />
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 transition-all duration-200 group-hover:opacity-100" />
                  </div>
                  <div className="mt-4">
                    <p className="text-3xl font-bold tabular-nums">{stats?.staff.count ?? 0}</p>
                    <p className="text-sm text-muted-foreground mt-1">Staff Members</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>

          {/* Partner Health Distribution */}
          {(stats?.partners.count ?? 0) > 0 && (
            <HealthDistributionCard />
          )}
        </div>
      </div>
    </div>
  )
}
