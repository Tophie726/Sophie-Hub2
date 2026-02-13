'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ShimmerBar, ShimmerGrid } from '@/components/ui/shimmer-grid'
import { cn } from '@/lib/utils'
import {
  ArrowLeft,
  Monitor,
  Tablet,
  Smartphone,
  RectangleHorizontal,
  RectangleVertical,
  Maximize2,
  Minimize2,
  Settings,
  Plus,
  Pencil,
  PencilOff,
  Loader2,
} from 'lucide-react'
import { DeviceFrame, type PreviewMode, type TabletOrientation } from '@/components/views/device-frame'
import { SettingsDrawer } from '@/components/views/settings-drawer'
import { AudienceSelector } from '@/components/views/audience-selector'
import { AddModuleModal } from '@/components/views/add-module-modal'
import { listenFromPreview, sendToPreview } from '@/lib/views/preview-bridge'
import { useViewBuilderData } from './use-view-builder-data'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AudienceState {
  subjectType: 'self' | 'staff' | 'partner' | 'role' | 'partner_type'
  targetId: string | null
  targetLabel?: string | null
}

interface ViewAudienceRuleLike {
  target_type: string
  target_id: string | null
  tier: number
  priority: number
  is_active?: boolean
}

const DEFAULT_AUDIENCE: AudienceState = {
  subjectType: 'self',
  targetId: null,
}

function inferAudienceFromRules(rules: ViewAudienceRuleLike[] | undefined): AudienceState {
  if (!rules || rules.length === 0) return DEFAULT_AUDIENCE

  const candidate = [...rules]
    .filter((rule) => rule.is_active !== false)
    .sort((a, b) => a.tier - b.tier || a.priority - b.priority)[0]

  if (!candidate) return DEFAULT_AUDIENCE

  switch (candidate.target_type) {
    case 'role':
      if (candidate.target_id) {
        return { subjectType: 'role', targetId: candidate.target_id }
      }
      break
    case 'partner_type':
      if (candidate.target_id) {
        return { subjectType: 'partner_type', targetId: candidate.target_id }
      }
      break
    case 'partner':
      if (candidate.target_id) {
        return { subjectType: 'partner', targetId: candidate.target_id }
      }
      break
    case 'staff':
      if (candidate.target_id) {
        return { subjectType: 'staff', targetId: candidate.target_id }
      }
      break
    case 'default':
      return { subjectType: 'role', targetId: 'staff' }
  }

  return DEFAULT_AUDIENCE
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ViewBuilderPage() {
  const params = useParams<{ viewId: string }>()
  const viewId = params?.viewId
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Data from extracted hook
  const data = useViewBuilderData(viewId)

  // Preview state
  const [previewToken, setPreviewToken] = useState<string | null>(null)
  const [previewReady, setPreviewReady] = useState(false)
  const [previewMode, setPreviewMode] = useState<PreviewMode>('desktop')
  const [tabletOrientation, setTabletOrientation] = useState<TabletOrientation>('portrait')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [tokenLoading, setTokenLoading] = useState(false)

  // UI state
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [addModuleOpen, setAddModuleOpen] = useState(false)

  // Edit mode state (Wave 4)
  const [isEditMode, setIsEditMode] = useState(false)
  const [editModeLoading, setEditModeLoading] = useState(false)
  const [activeModuleSlug, setActiveModuleSlug] = useState<string | null>(null)
  const [activeDashboardId, setActiveDashboardId] = useState<string | null>(null)

  // Audience state
  const [audience, setAudience] = useState<AudienceState>(DEFAULT_AUDIENCE)
  const [audienceInitialized, setAudienceInitialized] = useState(false)
  const [dataMode, setDataMode] = useState<'snapshot' | 'live'>('snapshot')

  // Reset audience/bootstrap state when navigating between views
  useEffect(() => {
    setAudience(DEFAULT_AUDIENCE)
    setAudienceInitialized(false)
    setPreviewToken(null)
    setPreviewReady(false)
  }, [viewId])

  // -------------------------------------------------------------------------
  // Token creation
  // -------------------------------------------------------------------------

  const createToken = useCallback(async (
    aud: AudienceState,
    dm: 'snapshot' | 'live' = 'snapshot'
  ) => {
    if (!viewId) return

    setTokenLoading(true)
    setPreviewReady(false)

    try {
      const res = await fetch('/api/admin/views/preview-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          viewId,
          subjectType: aud.subjectType,
          subjectTargetId: aud.targetId,
          dataMode: dm,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error?.message || 'Failed to create preview session')
        return
      }

      const json = await res.json()
      setPreviewToken(json.data?.token || json.token)
    } catch {
      toast.error('Failed to create preview session')
    } finally {
      setTokenLoading(false)
    }
  }, [viewId])

  // Resolve initial audience from view rules so previews open in-context
  useEffect(() => {
    if (!data.view || data.loading || audienceInitialized) return

    const inferredAudience = inferAudienceFromRules(data.view.view_audience_rules)
    setAudience(inferredAudience)
    setDataMode('snapshot')
    setAudienceInitialized(true)
  }, [data.loading, data.view, audienceInitialized])

  // Create initial token once data loads
  useEffect(() => {
    if (audienceInitialized && !data.loading && data.view && !previewToken && !tokenLoading) {
      void createToken(audience, dataMode)
    }
  }, [audienceInitialized, data.loading, data.view, previewToken, tokenLoading, createToken, audience, dataMode])

  // Auto-refresh token every 12 minutes (tokens expire at 15 min)
  useEffect(() => {
    if (!previewToken) return

    const interval = setInterval(() => {
      void createToken(audience, dataMode)
    }, 12 * 60 * 1000)

    return () => clearInterval(interval)
  }, [previewToken, audience, dataMode, createToken])

  // -------------------------------------------------------------------------
  // Bridge listener
  // -------------------------------------------------------------------------

  useEffect(() => {
    return listenFromPreview((msg) => {
      if (msg.type === 'previewReady') {
        setPreviewReady(true)
      } else if (msg.type === 'previewError') {
        toast.error(`Preview error: ${msg.message}`)
      } else if (msg.type === 'activeModuleReport') {
        // P2-2: parent is source of truth for active module
        setActiveModuleSlug(msg.moduleSlug || null)
        setActiveDashboardId(msg.dashboardId)
        // If edit mode was on and module changed, disable edit mode
        if (isEditMode && msg.moduleSlug !== activeModuleSlug) {
          setIsEditMode(false)
          sendToPreview(iframeRef.current, { type: 'editModeChanged', enabled: false })
        }
        // Fetch dashboard data for section management
        if (msg.dashboardId) {
          void data.fetchDashboard(msg.dashboardId)
        }
      } else if (msg.type === 'widgetEditRequested') {
        // Widget clicked in edit mode — could open config dialog
        toast.info(`Widget edit: ${msg.widgetId}`)
      } else if (msg.type === 'addWidgetRequested') {
        // Add widget button clicked in section
        toast.info('Add widget requested — open config dialog')
      } else if (msg.type === 'compositionSaved') {
        // Composition saved in iframe
        if (activeDashboardId) {
          void data.fetchDashboard(activeDashboardId)
        }
      }
    }, iframeRef)
  }, [isEditMode, activeModuleSlug, activeDashboardId, data])

  // -------------------------------------------------------------------------
  // Audience change handler
  // -------------------------------------------------------------------------

  function handleAudienceChange(subjectType: AudienceState['subjectType'], targetId: string | null, targetLabel?: string) {
    const newAudience: AudienceState = { subjectType, targetId, targetLabel: targetLabel ?? null }
    setAudience(newAudience)
    // Auto-downgrade to snapshot for abstract types (API rejects live for self/role/partner_type)
    if (subjectType !== 'staff' && subjectType !== 'partner' && dataMode === 'live') {
      setDataMode('snapshot')
    }
    // Disable edit mode on audience switch (Wave 4)
    if (isEditMode) {
      setIsEditMode(false)
      sendToPreview(iframeRef.current, { type: 'editModeChanged', enabled: false })
    }
    setPreviewReady(false)
    setPreviewToken(null) // triggers token creation via effect
  }

  function handleDataModeChange(dm: 'snapshot' | 'live') {
    setDataMode(dm)
    setPreviewReady(false)
    setPreviewToken(null)
  }

  // -------------------------------------------------------------------------
  // Module mutation handler (wraps hook + bridge notification)
  // -------------------------------------------------------------------------

  async function handleModuleToggle(moduleId: string, checked: boolean) {
    await data.handleToggleModule(moduleId, checked)
    // Tell iframe to refresh after module change
    sendToPreview(iframeRef.current, { type: 'refreshRequested' })
  }

  async function handleReorderModules(order: Array<{ module_id: string; sort_order: number }>) {
    if (!viewId) return

    try {
      const res = await fetch(`/api/admin/views/${viewId}/modules/reorder`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order }),
      })

      if (!res.ok) {
        toast.error('Failed to reorder modules')
        return
      }

      await data.fetchAssignments()
      sendToPreview(iframeRef.current, { type: 'refreshRequested' })
    } catch {
      toast.error('Failed to reorder modules')
    }
  }

  // -------------------------------------------------------------------------
  // Edit mode toggle (Wave 4: fork-on-edit)
  // -------------------------------------------------------------------------

  async function handleToggleEditMode() {
    if (!viewId) return

    if (isEditMode) {
      // Exiting edit mode
      setIsEditMode(false)
      sendToPreview(iframeRef.current, { type: 'editModeChanged', enabled: false })
      return
    }

    // Entering edit mode — need to fork if on template
    if (!activeModuleSlug) {
      toast.error('Select a module to edit')
      return
    }

    // Find the assignment for the active module
    const assignment = data.assignedModules.find(
      (a) => a.module?.slug === activeModuleSlug
    )
    if (!assignment) {
      toast.error('Module not assigned to this view')
      return
    }

    setEditModeLoading(true)
    try {
      const res = await fetch(`/api/admin/views/${viewId}/fork-dashboard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleAssignmentId: assignment.id }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error?.message || 'Failed to prepare dashboard for editing')
        return
      }

      const json = await res.json()
      const dashboardId = json.data?.dashboardId
      if (json.data?.forked) {
        toast.success('Dashboard forked for this view')
        // Refresh assignments to pick up the new dashboard_id
        await data.fetchAssignments()
      }

      setActiveDashboardId(dashboardId)
      if (dashboardId) {
        await data.fetchDashboard(dashboardId)
      }

      setIsEditMode(true)
      sendToPreview(iframeRef.current, { type: 'editModeChanged', enabled: true })
    } catch {
      toast.error('Failed to enter edit mode')
    } finally {
      setEditModeLoading(false)
    }
  }

  // -------------------------------------------------------------------------
  // Section CRUD handlers (Wave 4: view-scoped routes)
  // -------------------------------------------------------------------------

  async function handleAddSection(title: string) {
    if (!viewId || !activeDashboardId) return
    try {
      const res = await fetch(`/api/admin/views/${viewId}/sections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dashboardId: activeDashboardId, title }),
      })
      if (!res.ok) {
        toast.error('Failed to add section')
        return
      }
      toast.success('Section added')
      await data.fetchDashboard(activeDashboardId)
      sendToPreview(iframeRef.current, { type: 'refreshRequested' })
    } catch {
      toast.error('Failed to add section')
    }
  }

  async function handleRenameSection(sectionId: string, title: string) {
    if (!viewId) return
    try {
      const res = await fetch(`/api/admin/views/${viewId}/sections/${sectionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      })
      if (!res.ok) {
        toast.error('Failed to rename section')
        return
      }
      if (activeDashboardId) await data.fetchDashboard(activeDashboardId)
      sendToPreview(iframeRef.current, { type: 'refreshRequested' })
    } catch {
      toast.error('Failed to rename section')
    }
  }

  async function handleDeleteSection(sectionId: string) {
    if (!viewId) return
    try {
      const res = await fetch(`/api/admin/views/${viewId}/sections/${sectionId}`, {
        method: 'DELETE',
      })
      if (!res.ok && res.status !== 204) {
        toast.error('Failed to delete section')
        return
      }
      toast.success('Section deleted')
      if (activeDashboardId) await data.fetchDashboard(activeDashboardId)
      sendToPreview(iframeRef.current, { type: 'refreshRequested' })
    } catch {
      toast.error('Failed to delete section')
    }
  }

  async function handleReorderSections(order: Array<{ id: string; sort_order: number }>) {
    if (!viewId || !activeDashboardId) return
    try {
      const res = await fetch(`/api/admin/views/${viewId}/sections`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dashboardId: activeDashboardId, order }),
      })
      if (!res.ok) {
        toast.error('Failed to reorder sections')
        return
      }
      await data.fetchDashboard(activeDashboardId)
      sendToPreview(iframeRef.current, { type: 'refreshRequested' })
    } catch {
      toast.error('Failed to reorder sections')
    }
  }

  // -------------------------------------------------------------------------
  // Fullscreen
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!isFullscreen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsFullscreen(false)
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isFullscreen])

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (data.loading) {
    return (
      <div className="h-[calc(100vh-4rem)] flex flex-col">
        <div className="flex-none flex items-center gap-2 border-b border-border/40 bg-background/95 px-3 py-2">
          <ShimmerBar width={26} height={26} className="rounded-md" />
          <ShimmerBar width={180} height={14} />
          <div className="ml-auto flex items-center gap-2">
            <ShimmerBar width={120} height={28} className="rounded-md" />
            <ShimmerBar width={94} height={28} className="rounded-md" />
            <ShimmerBar width={28} height={28} className="rounded-md" />
            <ShimmerBar width={28} height={28} className="rounded-md" />
          </div>
        </div>
        <div className="flex-1 bg-muted/30 p-4">
          <div className="h-full rounded-xl border border-border/50 bg-background p-4">
            <ShimmerGrid rows={9} columns={3} cellHeight={34} gap={12} />
          </div>
        </div>
      </div>
    )
  }

  if (!data.view) {
    return (
      <div className="p-8">
        <div className="rounded-xl border border-border/60 bg-card p-6 text-sm text-muted-foreground">
          View not found.{' '}
          <Link href="/admin/views" className="text-primary hover:underline">
            Return to Views
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className={cn(
      isFullscreen ? 'fixed inset-0 z-50 bg-background flex flex-col' : 'flex flex-col',
      !isFullscreen && 'h-[calc(100vh-4rem)]'
    )}>
      {/* ================================================================= */}
      {/* Toolbar                                                            */}
      {/* ================================================================= */}
      <div className="flex-none flex items-center gap-2 border-b border-border/40 bg-background/95 backdrop-blur px-3 py-2">
        {/* Back */}
        <Link href="/admin/views">
          <Button variant="ghost" size="sm" className="h-8 px-2">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>

        {/* View name */}
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-semibold truncate">{data.view.name}</h1>
        </div>

        {/* Audience selector */}
        <AudienceSelector
          current={audience}
          dataMode={dataMode}
          viewRules={data.view.view_audience_rules || []}
          onSelect={handleAudienceChange}
          onDataModeChange={handleDataModeChange}
        />

        {/* Device toggle */}
        <div className="hidden md:flex items-center rounded-lg p-0.5" style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.08)' }}>
          {(['desktop', 'tablet', 'mobile'] as const).map((mode) => {
            const Icon = mode === 'desktop' ? Monitor : mode === 'tablet' ? Tablet : Smartphone
            return (
              <button
                key={mode}
                type="button"
                onClick={() => setPreviewMode(mode)}
                className={cn(
                  'p-1.5 rounded-md transition-colors',
                  previewMode === mode ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
                title={mode.charAt(0).toUpperCase() + mode.slice(1)}
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            )
          })}
        </div>

        {/* Tablet orientation toggle */}
        {previewMode === 'tablet' && (
          <div className="hidden md:flex items-center rounded-lg p-0.5" style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.08)' }}>
            <button
              type="button"
              onClick={() => setTabletOrientation('portrait')}
              className={cn(
                'p-1.5 rounded-md transition-colors',
                tabletOrientation === 'portrait' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
              title="Tablet Portrait"
            >
              <RectangleVertical className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setTabletOrientation('landscape')}
              className={cn(
                'p-1.5 rounded-md transition-colors',
                tabletOrientation === 'landscape' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
              title="Tablet Landscape"
            >
              <RectangleHorizontal className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Edit mode toggle (Wave 4) */}
        <Button
          variant={isEditMode ? 'default' : 'ghost'}
          size="sm"
          className={cn('h-8 px-2.5 gap-1.5', isEditMode && 'bg-primary text-primary-foreground')}
          onClick={handleToggleEditMode}
          disabled={editModeLoading || previewMode === 'mobile'}
          title={isEditMode ? 'Exit Edit Mode' : 'Enter Edit Mode'}
        >
          {editModeLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : isEditMode ? (
            <PencilOff className="h-3.5 w-3.5" />
          ) : (
            <Pencil className="h-3.5 w-3.5" />
          )}
          <span className="hidden md:inline text-xs">{isEditMode ? 'Editing' : 'Edit'}</span>
        </Button>

        {/* Settings gear */}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => setSettingsOpen(true)}
          title="Settings"
        >
          <Settings className="h-4 w-4" />
        </Button>

        {/* Add module */}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => setAddModuleOpen(true)}
          title="Add Module"
        >
          <Plus className="h-4 w-4" />
        </Button>

        {/* Fullscreen toggle */}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => setIsFullscreen((prev) => !prev)}
          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </Button>
      </div>

      {/* ================================================================= */}
      {/* iframe Preview                                                     */}
      {/* ================================================================= */}
      <div className="flex-1 relative overflow-hidden bg-muted/30">
        <DeviceFrame
          mode={previewMode}
          tabletOrientation={tabletOrientation}
          isFullscreen={isFullscreen}
        >
          {previewToken ? (
            <iframe
              ref={iframeRef}
              src={`/preview?token=${previewToken}`}
              className="w-full h-full border-0"
              title="View Preview"
              onLoad={() => setPreviewReady(true)}
            />
          ) : (
            <div className="h-full p-4">
              <ShimmerGrid rows={8} columns={3} cellHeight={30} gap={10} />
            </div>
          )}
        </DeviceFrame>

        {/* Loading overlay while iframe initializes */}
        {previewToken && !previewReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm pointer-events-none">
            <div className="w-64 space-y-2 rounded-lg border border-border/60 bg-background/80 px-4 py-3">
              <ShimmerBar width="100%" height={12} />
              <ShimmerBar width="70%" height={10} />
            </div>
          </div>
        )}
      </div>

      {/* ================================================================= */}
      {/* Settings Drawer                                                    */}
      {/* ================================================================= */}
      <SettingsDrawer
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        view={data.view}
        assignments={data.assignments}
        modules={data.modules}
        assignedModules={data.assignedModules}
        metaName={data.metaName}
        setMetaName={data.setMetaName}
        metaDescription={data.metaDescription}
        setMetaDescription={data.setMetaDescription}
        savingMeta={data.savingMeta}
        onSaveMeta={data.handleSaveMeta}
        onToggleViewField={data.handleToggleViewField}
        onAddRule={data.handleAddRule}
        onDeleteRule={data.handleDeleteRule}
        onReorderModules={handleReorderModules}
        addRuleState={data.addRuleState}
        // Wave 4: section management
        activeDashboardId={activeDashboardId}
        activeModuleSlug={activeModuleSlug}
        dashboardSections={data.dashboardSections}
        isEditMode={isEditMode}
        onAddSection={handleAddSection}
        onRenameSection={handleRenameSection}
        onDeleteSection={handleDeleteSection}
        onReorderSections={handleReorderSections}
      />

      {/* ================================================================= */}
      {/* Add Module Modal                                                   */}
      {/* ================================================================= */}
      <AddModuleModal
        open={addModuleOpen}
        onOpenChange={setAddModuleOpen}
        modules={data.modules}
        assignmentByModuleId={data.assignmentByModuleId}
        onToggleModule={handleModuleToggle}
        moduleMutationId={data.moduleMutationId}
      />
    </div>
  )
}
