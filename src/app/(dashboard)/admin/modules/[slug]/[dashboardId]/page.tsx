'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ShimmerBar, ShimmerGrid } from '@/components/ui/shimmer-grid'
import { DashboardBuilder } from '@/components/reporting/dashboard-builder'
import type { DashboardWithChildren } from '@/types/modules'

export default function DashboardBuilderPage() {
  const params = useParams()
  const dashboardId = params.dashboardId as string
  const moduleSlug = params.slug as string

  const [dashboard, setDashboard] = useState<DashboardWithChildren | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadDashboard() {
      try {
        const res = await fetch(`/api/modules/dashboards/${dashboardId}`)
        if (!res.ok) {
          const json = await res.json().catch(() => ({}))
          throw new Error(json.error?.message || 'Failed to load dashboard')
        }
        const json = await res.json()
        setDashboard(json.data?.dashboard || json.data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard')
      } finally {
        setIsLoading(false)
      }
    }

    loadDashboard()
  }, [dashboardId])

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <div className="border-b border-border/40 bg-background/95 backdrop-blur sticky top-14 md:top-0 z-30">
          <div className="flex items-center justify-between gap-2 px-4 md:px-8 min-h-[4rem]">
            <ShimmerBar width={220} height={20} />
            <div className="flex items-center gap-2">
              <ShimmerBar width={130} height={34} className="rounded-md" />
              <ShimmerBar width={120} height={34} className="rounded-md" />
              <ShimmerBar width={90} height={34} className="rounded-md" />
            </div>
          </div>
        </div>

        <div className="p-4 md:p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="space-y-3">
              <ShimmerBar width={180} height={16} />
              <div className="rounded-xl border bg-card p-4">
                <ShimmerGrid variant="grid" rows={1} columns={1} cellHeight={220} />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-xl border bg-card p-4">
                <ShimmerGrid variant="grid" rows={1} columns={1} cellHeight={140} />
              </div>
              <div className="rounded-xl border bg-card p-4">
                <ShimmerGrid variant="grid" rows={1} columns={1} cellHeight={140} />
              </div>
            </div>

            <div className="rounded-xl border bg-card p-4">
              <ShimmerGrid variant="table" rows={6} columns={5} cellHeight={26} />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !dashboard) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center text-center gap-3">
          <AlertCircle className="h-8 w-8 text-destructive/60" />
          <p className="text-sm text-muted-foreground">{error || 'Dashboard not found'}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.reload()}
          >
            Retry
          </Button>
        </div>
      </div>
    )
  }

  return (
    <DashboardBuilder
      dashboard={dashboard}
      moduleSlug={moduleSlug}
    />
  )
}
