'use client'

import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent } from '@/components/ui/card'
import {
  Building2,
  Users,
  ArrowUpRight,
} from 'lucide-react'
import Link from 'next/link'
import { HealthDistributionCard } from '@/components/dashboard/health-distribution-card'
import { useStatsQuery } from '@/lib/hooks/use-stats-query'

export default function DashboardPage() {
  const { data: stats, isLoading } = useStatsQuery()

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <PageHeader title="Dashboard" />
        <div className="p-4 md:p-8 space-y-4">
          {/* Shimmer skeleton matching 2-col stat card layout */}
          <div className="grid grid-cols-2 gap-3 md:gap-4">
            <div className="rounded-xl bg-gradient-to-r from-muted/40 via-muted/15 to-muted/40 bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite] h-[120px]" />
            <div className="rounded-xl bg-gradient-to-r from-muted/40 via-muted/15 to-muted/40 bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite] h-[120px]" style={{ animationDelay: '40ms' }} />
          </div>
          {/* Health distribution skeleton */}
          <div className="rounded-xl bg-gradient-to-r from-muted/40 via-muted/15 to-muted/40 bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite] h-[200px]" style={{ animationDelay: '80ms' }} />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <PageHeader title="Dashboard" />

      <div className="p-4 md:p-8">
        <div className="space-y-6">
          {/* Primary Stats */}
          <div className="grid grid-cols-2 gap-3 md:gap-4">
            {/* Partners */}
            <Link href="/partners">
              <Card className="group relative overflow-hidden transition-all duration-200 hover:shadow-md hover:border-primary/20 active:scale-[0.97]">
                <CardContent className="p-4 md:p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-xl bg-blue-500/10">
                      <Building2 className="h-5 w-5 md:h-6 md:w-6 text-blue-500" />
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 transition-all duration-200 group-hover:opacity-100" />
                  </div>
                  <div className="mt-4">
                    <p className="text-2xl md:text-3xl font-bold tabular-nums">{stats?.partners.activeCount ?? 0}</p>
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
              <Card className="group relative overflow-hidden transition-all duration-200 hover:shadow-md hover:border-primary/20 active:scale-[0.97]">
                <CardContent className="p-4 md:p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-xl bg-green-500/10">
                      <Users className="h-5 w-5 md:h-6 md:w-6 text-green-500" />
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 transition-all duration-200 group-hover:opacity-100" />
                  </div>
                  <div className="mt-4">
                    <p className="text-2xl md:text-3xl font-bold tabular-nums">{stats?.staff.count ?? 0}</p>
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
