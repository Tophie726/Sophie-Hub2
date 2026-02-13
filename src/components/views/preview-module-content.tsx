'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Loader2 } from 'lucide-react'
import type { PreviewModule } from '@/lib/views/module-nav'
import type { DashboardWidget, DashboardWithChildren, DateRange } from '@/types/modules'
import { WidgetRenderer } from '@/components/reporting/widget-renderer'
import { sendToParent } from '@/lib/views/preview-bridge'
import { usePreviewContext } from './preview-context'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PreviewModuleContentProps {
  module: PreviewModule
  showTitle?: boolean
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Renders the content for a selected module in the preview shell.
 *
 * In v1, this shows the module's dashboard sections and widgets in read-only
 * mode. If no dashboard is assigned, shows a placeholder.
 */
export function PreviewModuleContent({ module, showTitle = true }: PreviewModuleContentProps) {
  const { dataMode, subjectType, targetId, isEditMode, setActiveDashboardId } = usePreviewContext()
  const [dashboard, setDashboard] = useState<DashboardWithChildren | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const effectivePartnerId = subjectType === 'partner' ? targetId || undefined : undefined
  const effectiveDataMode = subjectType === 'partner' ? dataMode : 'snapshot'

  const defaultDateRange = useMemo<DateRange>(() => ({
    preset: (
      dashboard?.date_range_default &&
      ['7d', '14d', '30d', '60d', '90d', 'mtd', 'last_month', 'ytd', '365d', 'custom'].includes(dashboard.date_range_default)
    ) ? (dashboard.date_range_default as DateRange['preset']) : '30d',
  }), [dashboard?.date_range_default])

  function gridPlacement(widget: DashboardWidget): CSSProperties {
    const colStart = Math.max(1, widget.grid_column + 1)
    const rowStart = Math.max(1, widget.grid_row + 1)
    const colSpan = Math.max(1, widget.col_span)
    const rowSpan = Math.max(1, widget.row_span)

    return {
      gridColumn: `${colStart} / span ${colSpan}`,
      gridRow: `${rowStart} / span ${rowSpan}`,
      minHeight: `${Math.max(120, rowSpan * 110)}px`,
    }
  }

  // Report active module to parent on mount/change (P3 from Round 12)
  useEffect(() => {
    sendToParent({
      type: 'activeModuleReport',
      moduleSlug: module.slug,
      dashboardId: module.dashboardId || null,
    })
    if (module.dashboardId) {
      setActiveDashboardId(module.dashboardId)
    }
  }, [module.slug, module.dashboardId, setActiveDashboardId])

  useEffect(() => {
    if (!module.dashboardId) {
      setDashboard(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    fetch(`/api/modules/dashboards/${module.dashboardId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load dashboard')
        return res.json()
      })
      .then((json) => {
        if (!cancelled) {
          setDashboard(json.data?.dashboard ?? json.dashboard ?? null)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message)
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [module.dashboardId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    )
  }

  if (!module.dashboardId || !dashboard) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="rounded-lg border border-dashed border-border p-8">
          <h3 className="text-sm font-medium">{module.name}</h3>
          <p className="text-xs text-muted-foreground mt-1">
            No dashboard configured for this module yet.
          </p>
          <p className="text-xs text-muted-foreground/70 mt-2">
            Create a dashboard in Modules to see content here.
          </p>
        </div>
      </div>
    )
  }

  // Render dashboard sections and widgets
  return (
    <div className="space-y-6">
      {showTitle && (
        <div>
          <h2 className="text-lg font-semibold">{dashboard.title || module.name}</h2>
          {dashboard.description && (
            <p className="text-sm text-muted-foreground mt-1">{dashboard.description}</p>
          )}
        </div>
      )}

      {dashboard.sections && dashboard.sections.length > 0 ? (
        <div className="space-y-8">
          {dashboard.sections.map((section) => (
            <div key={section.id} className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">
                {section.title}
              </h3>
              {section.widgets && section.widgets.length > 0 ? (
                <div
                  className="grid gap-4"
                  style={{
                    gridTemplateColumns: 'repeat(8, minmax(0, 1fr))',
                    gridAutoRows: 'minmax(110px, auto)',
                  }}
                >
                  {[...section.widgets]
                    .sort((a, b) => a.sort_order - b.sort_order)
                    .map((widget) => (
                    <div
                      key={widget.id}
                      className={`rounded-lg border bg-card p-3 shadow-sm overflow-hidden transition-colors ${
                        isEditMode
                          ? 'border-primary/40 cursor-pointer hover:border-primary/70 hover:shadow-md'
                          : 'border-border/60'
                      }`}
                      style={gridPlacement(widget)}
                      onClick={isEditMode ? () => {
                        sendToParent({
                          type: 'widgetEditRequested',
                          widgetId: widget.id,
                          sectionId: section.id,
                          dashboardId: dashboard.id,
                        })
                      } : undefined}
                    >
                      <div className="mb-2 border-b border-border/40 pb-2">
                        <h4 className="text-sm font-medium leading-tight">{widget.title}</h4>
                      </div>
                      <div className="h-full min-h-[72px]">
                        <WidgetRenderer
                          widget={widget}
                          dateRange={defaultDateRange}
                          partnerId={effectivePartnerId}
                          dataMode={effectiveDataMode}
                          refreshTick={0}
                          forceRefreshToken={0}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground/70">No widgets in this section.</p>
              )}

              {/* Edit mode: Add Widget button per section */}
              {isEditMode && (
                <button
                  type="button"
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-primary/30 py-2 text-xs text-primary/70 transition-colors hover:border-primary/50 hover:text-primary hover:bg-primary/5"
                  onClick={() => {
                    sendToParent({
                      type: 'addWidgetRequested',
                      sectionId: section.id,
                      dashboardId: dashboard.id,
                    })
                  }}
                >
                  + Add Widget
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div>
          <p className="text-sm text-muted-foreground">This dashboard has no sections yet.</p>
          {isEditMode && (
            <p className="text-xs text-muted-foreground/70 mt-1">
              Use the Settings drawer to add sections.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
