'use client'

import { useState, useCallback, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { DashboardHeader } from '@/components/reporting/dashboard-header'
import { SectionContainer } from '@/components/reporting/section-container'
import { EmptyDashboard } from '@/components/reporting/empty-dashboard'
import { WidgetConfigDialog } from '@/components/reporting/widget-config-dialog'
import {
  migrateAutoPlacedWidgets,
  buildOccupancyMap,
  findFirstAvailable,
  getMaxRow,
} from '@/hooks/use-grid-occupancy'
import type {
  DashboardWithChildren,
  SectionWithWidgets,
  DashboardWidget,
  DateRange,
  WidgetConfig,
  WidgetType,
} from '@/types/modules'

interface DashboardBuilderProps {
  dashboard: DashboardWithChildren
  moduleSlug: string
}

export function DashboardBuilder({ dashboard: initial, moduleSlug }: DashboardBuilderProps) {
  const [dashboard, setDashboard] = useState(initial)
  const [hasChanges, setHasChanges] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop')
  const [dateRange, setDateRange] = useState<DateRange>({
    preset: (initial.date_range_default as DateRange['preset']) || '30d',
  })

  // Partner selection (for templates or override)
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(initial.partner_id || null)
  const [, setSelectedPartnerName] = useState<string | null>(null)

  // Widget config dialog state
  const [configDialogOpen, setConfigDialogOpen] = useState(false)
  const [editingWidget, setEditingWidget] = useState<DashboardWidget | null>(null)
  const [targetSectionId, setTargetSectionId] = useState<string | null>(null)

  // Migrate legacy widgets (all at grid_column=1, grid_row=1) to proper grid positions
  useEffect(() => {
    let migrated = false
    setDashboard((prev) => {
      const newSections = prev.sections.map((s) => {
        const migratedWidgets = migrateAutoPlacedWidgets(s.widgets)
        if (migratedWidgets !== s.widgets) {
          migrated = true
          return { ...s, widgets: migratedWidgets }
        }
        return s
      })
      if (migrated) {
        return { ...prev, sections: newSections }
      }
      return prev
    })
    if (migrated) {
      setHasChanges(true)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function markChanged() {
    setHasChanges(true)
  }

  // Partner selection
  function handlePartnerChange(partnerId: string, partnerName: string) {
    setSelectedPartnerId(partnerId)
    setSelectedPartnerName(partnerName)
  }

  // Title
  function handleTitleChange(title: string) {
    setDashboard((prev) => ({ ...prev, title }))
    markChanged()
  }

  // Date range
  function handleDateRangeChange(range: DateRange) {
    setDateRange(range)
  }

  // Edit mode toggle — clicking "Done" triggers save if there are changes
  function handleToggleEditMode() {
    if (isEditMode && hasChanges) {
      handleSave()
    }
    setIsEditMode((prev) => !prev)
  }

  // Sections
  function handleAddSection() {
    const newSection: SectionWithWidgets = {
      id: `temp-${Date.now()}`,
      dashboard_id: dashboard.id,
      title: `Section ${dashboard.sections.length + 1}`,
      sort_order: dashboard.sections.length,
      collapsed: false,
      created_at: new Date().toISOString(),
      widgets: [],
    }
    setDashboard((prev) => ({
      ...prev,
      sections: [...prev.sections, newSection],
    }))
    markChanged()
  }

  function handleToggleCollapse(sectionId: string, collapsed: boolean) {
    setDashboard((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === sectionId ? { ...s, collapsed } : s
      ),
    }))
    markChanged()
  }

  // Widgets
  function handleAddWidget(sectionId: string) {
    setTargetSectionId(sectionId)
    setEditingWidget(null)
    setConfigDialogOpen(true)
  }

  function handleEditWidget(widget: DashboardWidget) {
    setEditingWidget(widget)
    setTargetSectionId(widget.section_id)
    setConfigDialogOpen(true)
  }

  function handleDeleteWidget(widgetId: string) {
    setDashboard((prev) => ({
      ...prev,
      sections: prev.sections.map((s) => ({
        ...s,
        widgets: s.widgets.filter((w) => w.id !== widgetId),
      })),
    }))
    markChanged()
    toast.success('Widget removed')
  }

  function handleWidgetSave(widgetType: WidgetType, title: string, config: WidgetConfig, colSpan: number, rowSpan: number) {
    if (editingWidget) {
      // Update existing widget
      setDashboard((prev) => ({
        ...prev,
        sections: prev.sections.map((s) => ({
          ...s,
          widgets: s.widgets.map((w) =>
            w.id === editingWidget.id
              ? { ...w, widget_type: widgetType, title, config, col_span: colSpan, row_span: rowSpan }
              : w
          ),
        })),
      }))
      toast.success('Widget updated')
    } else if (targetSectionId) {
      // Add new widget — auto-place at first available position
      const section = dashboard.sections.find((s) => s.id === targetSectionId)
      const existingWidgets = section?.widgets || []
      const occupancy = buildOccupancyMap(existingWidgets)
      const maxR = getMaxRow(existingWidgets)
      const pos = findFirstAvailable(occupancy, colSpan, rowSpan, maxR)

      const newWidget: DashboardWidget = {
        id: `temp-${Date.now()}`,
        dashboard_id: dashboard.id,
        section_id: targetSectionId,
        widget_type: widgetType,
        title,
        grid_column: pos.col,
        grid_row: pos.row,
        col_span: colSpan,
        row_span: rowSpan,
        sort_order: existingWidgets.length,
        config,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      setDashboard((prev) => ({
        ...prev,
        sections: prev.sections.map((s) =>
          s.id === targetSectionId
            ? { ...s, widgets: [...s.widgets, newWidget] }
            : s
        ),
      }))
      toast.success('Widget added')
    }
    markChanged()
    setConfigDialogOpen(false)
    setEditingWidget(null)
    setTargetSectionId(null)
  }

  // Move widget to a new grid position (from snap-to-grid drag)
  const handleMoveWidget = useCallback((widgetId: string, gridColumn: number, gridRow: number) => {
    setDashboard((prev) => ({
      ...prev,
      sections: prev.sections.map((s) => ({
        ...s,
        widgets: s.widgets.map((w) =>
          w.id === widgetId
            ? { ...w, grid_column: gridColumn, grid_row: gridRow }
            : w
        ),
      })),
    }))
    markChanged()
  }, [])

  // Resize widget (from inline resize control)
  const handleResizeWidget = useCallback((widgetId: string, colSpan: number, rowSpan: number) => {
    setDashboard((prev) => ({
      ...prev,
      sections: prev.sections.map((s) => ({
        ...s,
        widgets: s.widgets.map((w) =>
          w.id === widgetId
            ? { ...w, col_span: colSpan, row_span: rowSpan }
            : w
        ),
      })),
    }))
    markChanged()
  }, [])

  // Save
  async function handleSave() {
    setIsSaving(true)
    try {
      // Save dashboard title
      const dashRes = await fetch(`/api/modules/dashboards/${dashboard.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: dashboard.title,
          date_range_default: dateRange.preset,
        }),
      })

      if (!dashRes.ok) {
        throw new Error('Failed to save dashboard')
      }

      // Save new sections
      for (const section of dashboard.sections) {
        if (section.id.startsWith('temp-')) {
          const secRes = await fetch(`/api/modules/dashboards/${dashboard.id}/sections`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              dashboard_id: dashboard.id,
              title: section.title,
              sort_order: section.sort_order,
            }),
          })
          if (secRes.ok) {
            const secJson = await secRes.json()
            const newId = secJson.data?.id
            if (newId) {
              setDashboard((prev) => ({
                ...prev,
                sections: prev.sections.map((s) =>
                  s.id === section.id
                    ? { ...s, id: newId, widgets: s.widgets.map((w) => ({ ...w, section_id: newId })) }
                    : s
                ),
              }))
            }
          }
        }
      }

      // Save widgets (new + existing)
      for (const section of dashboard.sections) {
        for (const widget of section.widgets) {
          if (widget.id.startsWith('temp-')) {
            await fetch(`/api/modules/dashboards/${dashboard.id}/widgets`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                dashboard_id: dashboard.id,
                section_id: widget.section_id,
                widget_type: widget.widget_type,
                title: widget.title,
                grid_column: widget.grid_column,
                grid_row: widget.grid_row,
                col_span: widget.col_span,
                row_span: widget.row_span,
                sort_order: widget.sort_order,
                config: widget.config,
              }),
            })
          } else {
            await fetch(`/api/modules/dashboards/${dashboard.id}/widgets`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                widget_id: widget.id,
                grid_column: widget.grid_column,
                grid_row: widget.grid_row,
                col_span: widget.col_span,
                row_span: widget.row_span,
                sort_order: widget.sort_order,
              }),
            })
          }
        }
      }

      setHasChanges(false)
      toast.success('Dashboard saved')
    } catch {
      toast.error('Failed to save dashboard')
    } finally {
      setIsSaving(false)
    }
  }

  const isMobilePreview = previewMode === 'mobile'

  const dashboardContent = (
    <div className={isMobilePreview ? 'space-y-4' : 'space-y-6'}>
      {dashboard.sections.length === 0 ? (
        <EmptyDashboard onAddSection={handleAddSection} />
      ) : (
        <>
          {dashboard.sections
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((section) => (
              <SectionContainer
                key={section.id}
                section={section}
                dateRange={dateRange}
                partnerId={selectedPartnerId || undefined}
                isEditMode={isEditMode}
                previewMode={previewMode}
                onAddWidget={handleAddWidget}
                onEditWidget={handleEditWidget}
                onDeleteWidget={handleDeleteWidget}
                onToggleCollapse={handleToggleCollapse}
                onMoveWidget={handleMoveWidget}
                onResizeWidget={handleResizeWidget}
              />
            ))}

          {!isMobilePreview && (
            <div className="pt-2">
              <Button
                variant="outline"
                className="w-full border-dashed active:scale-[0.97]"
                onClick={handleAddSection}
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Add Section
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )

  return (
    <div className="min-h-screen">
      <DashboardHeader
        title={dashboard.title}
        onTitleChange={handleTitleChange}
        dateRange={dateRange}
        onDateRangeChange={handleDateRangeChange}
        hasChanges={hasChanges}
        isSaving={isSaving}
        onSave={handleSave}
        moduleSlug={moduleSlug}
        selectedPartnerId={selectedPartnerId}
        onPartnerChange={handlePartnerChange}
        isEditMode={isEditMode}
        onToggleEditMode={handleToggleEditMode}
        previewMode={previewMode}
        onPreviewModeChange={setPreviewMode}
      />

      <div className="p-4 md:p-8">
        {isMobilePreview ? (
          // Mobile preview frame
          <div className="flex justify-center py-4">
            <div
              className="bg-background rounded-[2rem] overflow-hidden relative"
              style={{
                width: 375,
                maxHeight: 'calc(100vh - 10rem)',
                overflowY: 'auto',
                boxShadow: '0 0 0 8px rgba(0,0,0,0.08), 0 25px 60px rgba(0,0,0,0.12)',
              }}
            >
              {/* Notch */}
              <div className="sticky top-0 z-10 flex justify-center pt-2 pb-1 bg-background">
                <div className="w-20 h-1 rounded-full bg-muted-foreground/20" />
              </div>
              <div className="p-3">
                {dashboardContent}
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-7xl mx-auto">
            {dashboardContent}
          </div>
        )}
      </div>

      <WidgetConfigDialog
        open={configDialogOpen}
        onOpenChange={setConfigDialogOpen}
        widget={editingWidget}
        onSave={handleWidgetSave}
      />
    </div>
  )
}
