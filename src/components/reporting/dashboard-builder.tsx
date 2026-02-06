'use client'

import { useState, useCallback } from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { DashboardHeader } from '@/components/reporting/dashboard-header'
import { SectionContainer } from '@/components/reporting/section-container'
import { EmptyDashboard } from '@/components/reporting/empty-dashboard'
import { WidgetConfigDialog } from '@/components/reporting/widget-config-dialog'
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
  const [dateRange, setDateRange] = useState<DateRange>({
    preset: (initial.date_range_default as DateRange['preset']) || '30d',
  })

  // Partner selection (for templates or override)
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(initial.partner_id || null)
  const [selectedPartnerName, setSelectedPartnerName] = useState<string | null>(null)

  // Widget config dialog state
  const [configDialogOpen, setConfigDialogOpen] = useState(false)
  const [editingWidget, setEditingWidget] = useState<DashboardWidget | null>(null)
  const [targetSectionId, setTargetSectionId] = useState<string | null>(null)

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
      // Add new widget
      const section = dashboard.sections.find((s) => s.id === targetSectionId)
      const newWidget: DashboardWidget = {
        id: `temp-${Date.now()}`,
        dashboard_id: dashboard.id,
        section_id: targetSectionId,
        widget_type: widgetType,
        title,
        grid_column: 1,
        grid_row: 1,
        col_span: colSpan,
        row_span: rowSpan,
        sort_order: section?.widgets.length || 0,
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
              // Update section ID and its widgets' section_id references
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

      // Save new widgets
      for (const section of dashboard.sections) {
        for (const widget of section.widgets) {
          if (widget.id.startsWith('temp-')) {
            const sectionId = section.id.startsWith('temp-') ? section.id : section.id
            await fetch(`/api/modules/dashboards/${dashboard.id}/widgets`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                dashboard_id: dashboard.id,
                section_id: widget.section_id,
                widget_type: widget.widget_type,
                title: widget.title,
                col_span: widget.col_span,
                row_span: widget.row_span,
                sort_order: widget.sort_order,
                config: widget.config,
              }),
            })
          }
        }
      }

      setHasChanges(false)
      toast.success('Dashboard saved')
    } catch (err) {
      toast.error('Failed to save dashboard')
    } finally {
      setIsSaving(false)
    }
  }

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
      />

      <div className="p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
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
                    onAddWidget={handleAddWidget}
                    onEditWidget={handleEditWidget}
                    onDeleteWidget={handleDeleteWidget}
                    onToggleCollapse={handleToggleCollapse}
                  />
                ))}

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
            </>
          )}
        </div>
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
