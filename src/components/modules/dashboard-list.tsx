'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { Plus, LayoutDashboard } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { Button } from '@/components/ui/button'
import { ShimmerBar, ShimmerGrid } from '@/components/ui/shimmer-grid'
import { CreateDashboardDialog } from './create-dashboard-dialog'
import { useDashboardsQuery } from '@/lib/hooks/use-module-query'
import type { Module, Dashboard } from '@/types/modules'

interface DashboardWithMeta extends Dashboard {
  partner_name?: string | null
  widget_count?: number
}

interface DashboardListProps {
  module: Module
}

export function DashboardList({ module }: DashboardListProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data: dashboardsRaw, isLoading, error: queryError } = useDashboardsQuery(module.id)
  const dashboards = (dashboardsRaw || []) as DashboardWithMeta[]
  const error = queryError ? queryError.message : null
  const [createOpen, setCreateOpen] = useState(false)
  const [pendingDashboardId, setPendingDashboardId] = useState<string | null>(null)

  function openDashboard(dashboardId: string) {
    setPendingDashboardId(dashboardId)
    router.push(`/admin/modules/${module.slug}/${dashboardId}`)
  }

  function handleCreated(dashboard: Dashboard) {
    queryClient.setQueryData(
      ['modules', 'dashboards', module.id],
      (old: DashboardWithMeta[] | undefined) => [...(old || []), dashboard as DashboardWithMeta]
    )
  }

  // Separate templates and partner dashboards
  const templates = dashboards.filter((d) => d.is_template)
  const partnerDashboards = dashboards.filter((d) => !d.is_template)

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-end">
          <ShimmerBar width={140} height={36} className="rounded-md" />
        </div>

        <div className="space-y-2">
          <ShimmerBar width={90} height={12} />
          <div
            className="rounded-lg overflow-hidden p-3"
            style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.08)' }}
          >
            <ShimmerGrid variant="table" rows={4} columns={3} cellHeight={28} />
          </div>
        </div>

        <div className="space-y-2">
          <ShimmerBar width={140} height={12} />
          <div
            className="rounded-lg overflow-hidden p-3"
            style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.08)' }}
          >
            <ShimmerGrid variant="table" rows={4} columns={4} cellHeight={28} />
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center px-4">
        <p className="text-sm text-destructive">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-3 text-sm text-primary hover:underline"
        >
          Try again
        </button>
      </div>
    )
  }

  if (dashboards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center px-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted mb-4">
          <LayoutDashboard className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="font-semibold">No dashboards yet</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          Create your first dashboard to start building partner reporting views.
        </p>
        <Button onClick={() => setCreateOpen(true)} className="mt-4 h-10 md:h-9">
          <Plus className="h-4 w-4 mr-2" />
          Create Dashboard
        </Button>
        <CreateDashboardDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          moduleId={module.id}
          onCreated={handleCreated}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <Button onClick={() => setCreateOpen(true)} className="h-10 md:h-9">
          <Plus className="h-4 w-4 mr-2" />
          Create Dashboard
        </Button>
      </div>

      {/* Templates section */}
      {templates.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground px-1">Templates</h3>
          <div className="rounded-lg overflow-hidden" style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.08)' }}>
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">Dashboard Name</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5 hidden md:table-cell">Widgets</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5 hidden md:table-cell">Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((d) => (
                  <tr
                    key={d.id}
                    onClick={() => openDashboard(d.id)}
                    className={`border-b last:border-0 hover:bg-muted/20 cursor-pointer transition-colors ${
                      pendingDashboardId === d.id ? 'bg-primary/5' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{d.title}</span>
                        <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-blue-500/10 text-blue-600 shrink-0">
                          Template
                        </span>
                        {pendingDashboardId === d.id && (
                          <span className="text-[10px] text-primary">Opening...</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground hidden md:table-cell" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {d.widget_count ?? 0}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground hidden md:table-cell">
                      {formatDistanceToNow(new Date(d.updated_at), { addSuffix: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Partner dashboards */}
      {partnerDashboards.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground px-1">Partner Dashboards</h3>
          <div className="rounded-lg overflow-hidden" style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.08)' }}>
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">Dashboard Name</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5 hidden md:table-cell">Partner</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5 hidden md:table-cell">Widgets</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5 hidden md:table-cell">Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {partnerDashboards.map((d) => (
                  <tr
                    key={d.id}
                    onClick={() => openDashboard(d.id)}
                    className={`border-b last:border-0 hover:bg-muted/20 cursor-pointer transition-colors ${
                      pendingDashboardId === d.id ? 'bg-primary/5' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{d.title}</span>
                        {pendingDashboardId === d.id && (
                          <span className="text-[10px] text-primary">Opening...</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground hidden md:table-cell">
                      {d.partner_name || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground hidden md:table-cell" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {d.widget_count ?? 0}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground hidden md:table-cell">
                      {formatDistanceToNow(new Date(d.updated_at), { addSuffix: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <CreateDashboardDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        moduleId={module.id}
        onCreated={handleCreated}
      />
    </div>
  )
}
