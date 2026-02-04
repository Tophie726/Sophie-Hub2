'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  Building2,
  Users,
  Database,
  ArrowRight,
  ArrowUpRight,
  FileSpreadsheet,
  Loader2,
} from 'lucide-react'
import Link from 'next/link'
import { HealthDistributionCard } from '@/components/dashboard/health-distribution-card'

interface TableStats {
  partners: { count: number; fields: string[] }
  staff: { count: number; fields: string[] }
}

interface DataSourceStats {
  id: string
  name: string
  tabCount: number
  totalColumns: number
  mappedFieldsCount: number
  categoryStats: {
    partner: number
    staff: number
    asin: number
    weekly: number
    computed: number
    skip: number
    unmapped: number
  }
}

export default function DashboardPage() {
  const [stats, setStats] = useState<TableStats | null>(null)
  const [dataSources, setDataSources] = useState<DataSourceStats[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const [statsRes, sourcesRes] = await Promise.all([
          fetch('/api/stats/tables'),
          fetch('/api/data-sources'),
        ])

        if (statsRes.ok) {
          const data = await statsRes.json()
          setStats(data)
        }

        if (sourcesRes.ok) {
          const data = await sourcesRes.json()
          setDataSources(data.sources || [])
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [])

  // Calculate data enrichment progress
  const totalMappedColumns = dataSources.reduce((sum, ds) => {
    const mapped = ds.categoryStats.partner + ds.categoryStats.staff + ds.categoryStats.asin +
                   ds.categoryStats.weekly + ds.categoryStats.computed + ds.categoryStats.skip
    return sum + mapped
  }, 0)

  const totalColumns = dataSources.reduce((sum, ds) => {
    const mapped = ds.categoryStats.partner + ds.categoryStats.staff + ds.categoryStats.asin +
                   ds.categoryStats.weekly + ds.categoryStats.computed + ds.categoryStats.skip
    return sum + mapped + ds.categoryStats.unmapped
  }, 0)

  const enrichmentProgress = totalColumns > 0 ? Math.round((totalMappedColumns / totalColumns) * 100) : 0
  const totalTabs = dataSources.reduce((sum, ds) => sum + ds.tabCount, 0)

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
          <div className="grid gap-4 md:grid-cols-3">
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
                    <p className="text-3xl font-bold tabular-nums">{stats?.partners.count ?? 0}</p>
                    <p className="text-sm text-muted-foreground mt-1">Partners</p>
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

            {/* Data Sources */}
            <Link href="/admin/data-enrichment">
              <Card className="group relative overflow-hidden transition-all duration-200 hover:shadow-md hover:border-primary/20">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-500/10">
                      <Database className="h-6 w-6 text-orange-500" />
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 transition-all duration-200 group-hover:opacity-100" />
                  </div>
                  <div className="mt-4">
                    <p className="text-3xl font-bold tabular-nums">{dataSources.length}</p>
                    <p className="text-sm text-muted-foreground mt-1">Data Sources</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>

          {/* Partner Health Distribution */}
          {(stats?.partners.count ?? 0) > 0 && (
            <HealthDistributionCard />
          )}

          {/* Data Enrichment Progress */}
          {dataSources.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Data Enrichment</CardTitle>
                    <CardDescription>
                      {totalTabs} tab{totalTabs !== 1 ? 's' : ''} across {dataSources.length} source{dataSources.length !== 1 ? 's' : ''}
                    </CardDescription>
                  </div>
                  <Link
                    href="/admin/data-enrichment"
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                  >
                    Manage
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Column mapping progress</span>
                    <span className="font-medium tabular-nums">{enrichmentProgress}%</span>
                  </div>
                  <Progress value={enrichmentProgress} className="h-2" />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 pt-2">
                  <div className="text-center p-3 md:p-3 rounded-lg bg-blue-500/5">
                    <p className="text-base md:text-lg font-semibold text-blue-600 tabular-nums">
                      {dataSources.reduce((s, d) => s + d.categoryStats.partner, 0)}
                    </p>
                    <p className="text-xs text-muted-foreground">Partner</p>
                  </div>
                  <div className="text-center p-3 md:p-3 rounded-lg bg-green-500/5">
                    <p className="text-base md:text-lg font-semibold text-green-600 tabular-nums">
                      {dataSources.reduce((s, d) => s + d.categoryStats.staff, 0)}
                    </p>
                    <p className="text-xs text-muted-foreground">Staff</p>
                  </div>
                  <div className="text-center p-3 md:p-3 rounded-lg bg-orange-500/5">
                    <p className="text-base md:text-lg font-semibold text-orange-600 tabular-nums">
                      {dataSources.reduce((s, d) => s + d.categoryStats.asin, 0)}
                    </p>
                    <p className="text-xs text-muted-foreground">ASIN</p>
                  </div>
                  <div className="text-center p-3 md:p-3 rounded-lg bg-muted/50">
                    <p className="text-base md:text-lg font-semibold text-muted-foreground tabular-nums">
                      {dataSources.reduce((s, d) => s + d.categoryStats.unmapped, 0)}
                    </p>
                    <p className="text-xs text-muted-foreground">Unmapped</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Connected Sources */}
          {dataSources.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-muted-foreground">Connected Sources</h3>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {dataSources.slice(0, 4).map((source) => {
                  const mapped = source.categoryStats.partner + source.categoryStats.staff +
                                 source.categoryStats.asin + source.categoryStats.weekly +
                                 source.categoryStats.computed + source.categoryStats.skip
                  const total = mapped + source.categoryStats.unmapped
                  const progress = total > 0 ? Math.round((mapped / total) * 100) : 0

                  return (
                    <Link key={source.id} href={`/admin/data-enrichment?view=sheets-browser&source=${source.id}`}>
                      <Card className="group transition-all duration-200 hover:shadow-sm hover:border-primary/20">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10 flex-shrink-0">
                              <FileSpreadsheet className="h-5 w-5 text-green-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{source.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {source.tabCount} tab{source.tabCount !== 1 ? 's' : ''} · {progress}% mapped
                              </p>
                            </div>
                            <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}

          {/* Empty state when no data */}
          {dataSources.length === 0 && (stats?.partners.count ?? 0) === 0 && (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-500/10 mb-4">
                  <Database className="h-6 w-6 text-orange-500" />
                </div>
                <h3 className="font-medium mb-1">Get started with data</h3>
                <p className="text-sm text-muted-foreground max-w-sm mb-4">
                  Connect a Google Sheet to start bringing your partner and staff data into Sophie Hub.
                </p>
                <Link
                  href="/admin/data-enrichment"
                  className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                >
                  Connect Data Source
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
