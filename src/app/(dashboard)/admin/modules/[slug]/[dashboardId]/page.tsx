'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading dashboard...</span>
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
