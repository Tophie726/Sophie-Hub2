'use client'

import { useEffect, useMemo } from 'react'
import { SessionProvider } from 'next-auth/react'
import { LayoutDashboard } from 'lucide-react'
import { type NavSection } from '@/lib/navigation/config'
import { type PreviewModule } from '@/lib/views/module-nav'
import { SidebarContent } from '@/components/layout/sidebar'
import { PreviewProvider, usePreviewContext } from './preview-context'
import { PreviewModuleContent } from './preview-module-content'
import type { PreviewSessionPayload } from '@/lib/views/preview-session'
import { sendToParent, listenFromParent } from '@/lib/views/preview-bridge'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PreviewShellProps {
  session: PreviewSessionPayload
  modules: PreviewModule[]
  previewIdentity: {
    name: string
    roleLabel: string
  }
}

// ---------------------------------------------------------------------------
// Shell Component (renders the full app experience)
// ---------------------------------------------------------------------------

function PreviewShellInner({ previewIdentity }: { previewIdentity: PreviewShellProps['previewIdentity'] }) {
  const {
    modules,
    activeModuleSlug,
    setActiveModule,
    setEditMode,
  } = usePreviewContext()
  const roleLabel = previewIdentity.roleLabel.toLowerCase()

  // Bridge: notify parent that preview is ready, listen for commands
  useEffect(() => {
    sendToParent({ type: 'previewReady' })

    return listenFromParent((msg) => {
      if (msg.type === 'refreshRequested') {
        window.location.reload()
      } else if (msg.type === 'editModeChanged') {
        setEditMode(msg.enabled)
      } else if (msg.type === 'activeModuleChanged') {
        setActiveModule(msg.slug)
      }
    })
  }, [setEditMode, setActiveModule])

  // Intercept sidebar module link clicks so they update context state
  // instead of triggering a Next.js navigation (which would lose the token)
  function handleSidebarClick(e: React.MouseEvent) {
    const link = (e.target as HTMLElement).closest('a')
    if (!link) return

    const href = link.getAttribute('href')
    if (!href) return

    if (href === '/preview' || href === '/preview/dashboard') {
      e.preventDefault()
      setActiveModule(null)
      // Report module deselection to parent
      sendToParent({ type: 'activeModuleReport', moduleSlug: '', dashboardId: null })
      return
    }

    if (!href.startsWith('/preview/module/')) return

    e.preventDefault()
    const slug = href.replace('/preview/module/', '')
    setActiveModule(slug)

    // Report active module to parent (P2-2: iframe → parent ownership)
    const mod = modules.find((m) => m.slug === slug)
    sendToParent({
      type: 'activeModuleReport',
      moduleSlug: slug,
      dashboardId: mod?.dashboardId || null,
    })
  }

  // Build preview-only navigation: Dashboard only.
  // Modules are composed within the dashboard canvas (not as menu pages).
  const navSections = useMemo<NavSection[]>(() => {
    return [{
      title: 'Overview',
      items: [
        {
          name: 'Dashboard',
          href: '/preview',
          icon: LayoutDashboard,
        },
      ],
    }]
  }, [])

  // Find active module
  const activeModule = modules.find((m) => m.slug === activeModuleSlug)

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar — uses shared component with navOverride (HR-3) */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <aside
        className="hidden md:block fixed left-0 top-0 z-40 h-screen w-64 border-r border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
        onClick={handleSidebarClick}
      >
        <SidebarContent
          navOverride={navSections}
          hideUserControls={false}
          previewIdentity={previewIdentity}
          layoutId="previewNav"
          onNavigate={undefined}
        />
      </aside>

      {/* Main content area */}
      <main className="pl-0 md:pl-64">
        <div className="min-h-screen">
          {/* Subtle preview badge */}
          <div className="fixed right-4 top-3 z-30 rounded-full border border-border/60 bg-background/85 px-2.5 py-1 text-[10px] uppercase tracking-wide text-muted-foreground backdrop-blur">
            Preview as {roleLabel}
          </div>

          {/* Content */}
          <div className="p-6">
            {activeModule ? (
              <PreviewModuleContent module={activeModule} />
            ) : (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold">Dashboard</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    This is the base landing page for the selected audience.
                  </p>
                </div>

                {modules.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl border border-dashed border-border">
                    <h3 className="text-sm font-medium text-muted-foreground">No modules assigned</h3>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      Add modules from the builder toolbar to populate this view.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {modules.map((module) => (
                      <section key={module.moduleId} className="rounded-xl border border-border/60 bg-card/30 p-4">
                        <div className="mb-3">
                          <h3 className="text-sm font-semibold">{module.name}</h3>
                        </div>
                        <PreviewModuleContent module={module} showTitle={false} />
                      </section>
                    ))}
                    <div className="text-xs text-muted-foreground/70">
                      Modules render inline so you can design the full page layout as the audience will see it.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Root Shell (wraps with providers)
// ---------------------------------------------------------------------------

export function PreviewShell({ session, modules, previewIdentity }: PreviewShellProps) {
  return (
    <SessionProvider>
      <PreviewProvider
        viewId={session.vid}
        subjectType={session.subjectType}
        targetId={session.targetId}
        resolvedRole={session.resolvedRole}
        dataMode={session.dataMode}
        modules={modules}
      >
        <PreviewShellInner previewIdentity={previewIdentity} />
      </PreviewProvider>
    </SessionProvider>
  )
}
