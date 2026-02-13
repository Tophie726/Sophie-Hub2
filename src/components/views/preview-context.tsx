'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import type { Role } from '@/lib/auth/roles'
import type { PreviewModule } from '@/lib/views/module-nav'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PreviewContextValue {
  /** View profile ID */
  viewId: string
  /** Subject type being previewed */
  subjectType: string
  /** Target ID (UUID or role slug) */
  targetId: string | null
  /** Resolved role for nav filtering */
  resolvedRole: Role
  /** Data mode */
  dataMode: 'snapshot' | 'live'
  /** Modules assigned to this view */
  modules: PreviewModule[]
  /** Currently active module slug (shown in content area) */
  activeModuleSlug: string | null
  /** Navigate to a module */
  setActiveModule: (slug: string | null) => void
  /** Whether edit mode is active (Wave 4) */
  isEditMode: boolean
  /** Set edit mode state */
  setEditMode: (enabled: boolean) => void
  /** Active dashboard ID for the current module (Wave 4) */
  activeDashboardId: string | null
  /** Set active dashboard ID */
  setActiveDashboardId: (id: string | null) => void
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const PreviewContext = createContext<PreviewContextValue | null>(null)

export function usePreviewContext(): PreviewContextValue {
  const ctx = useContext(PreviewContext)
  if (!ctx) {
    throw new Error('usePreviewContext must be used within PreviewProvider')
  }
  return ctx
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface PreviewProviderProps {
  viewId: string
  subjectType: string
  targetId: string | null
  resolvedRole: Role
  dataMode: 'snapshot' | 'live'
  modules: PreviewModule[]
  children: ReactNode
}

export function PreviewProvider({
  viewId,
  subjectType,
  targetId,
  resolvedRole,
  dataMode,
  modules,
  children,
}: PreviewProviderProps) {
  // Start on Dashboard (null) so every view lands on a consistent first page.
  const [activeModuleSlug, setActiveModuleSlug] = useState<string | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const [activeDashboardId, setActiveDashboardId] = useState<string | null>(null)

  const setActiveModule = useCallback((slug: string | null) => {
    setActiveModuleSlug(slug)
  }, [])

  const setEditMode = useCallback((enabled: boolean) => {
    setIsEditMode(enabled)
  }, [])

  return (
    <PreviewContext.Provider
      value={{
        viewId,
        subjectType,
        targetId,
        resolvedRole,
        dataMode,
        modules,
        activeModuleSlug,
        setActiveModule,
        isEditMode,
        setEditMode,
        activeDashboardId,
        setActiveDashboardId,
      }}
    >
      {children}
    </PreviewContext.Provider>
  )
}
