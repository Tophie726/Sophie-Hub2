'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import type { Module, DashboardWithChildren, DashboardSection } from '@/types/modules'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AudienceRule {
  id: string
  tier: number
  target_type: string
  target_id: string | null
  priority: number
  is_active: boolean
  created_at: string
}

export interface ViewDetail {
  id: string
  slug: string
  name: string
  description: string | null
  is_default: boolean
  is_active: boolean
  created_at: string
  updated_at: string
  view_audience_rules: AudienceRule[]
}

export interface ViewModuleAssignment {
  id: string
  view_id: string
  module_id: string
  dashboard_id: string | null
  sort_order: number
  config: Record<string, unknown>
  modules?: Module
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useViewBuilderData(viewId: string | undefined) {
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<ViewDetail | null>(null)
  const [modules, setModules] = useState<Module[]>([])
  const [assignments, setAssignments] = useState<ViewModuleAssignment[]>([])

  const [moduleMutationId, setModuleMutationId] = useState<string | null>(null)

  const [metaName, setMetaName] = useState('')
  const [metaDescription, setMetaDescription] = useState('')
  const [savingMeta, setSavingMeta] = useState(false)

  // Dashboard state (Wave 4)
  const [activeDashboard, setActiveDashboard] = useState<DashboardWithChildren | null>(null)
  const [dashboardLoading, setDashboardLoading] = useState(false)

  const [addRuleType, setAddRuleType] = useState<string>('')
  const [addRuleTargetId, setAddRuleTargetId] = useState('')
  const [addRulePriority, setAddRulePriority] = useState('0')
  const [addRuleSubmitting, setAddRuleSubmitting] = useState(false)

  // -------------------------------------------------------------------------
  // Derived state
  // -------------------------------------------------------------------------

  const modulesById = useMemo(() => {
    const map = new Map<string, Module>()
    for (const m of modules) map.set(m.id, m)
    return map
  }, [modules])

  const assignmentByModuleId = useMemo(() => {
    const map = new Map<string, ViewModuleAssignment>()
    for (const a of assignments) map.set(a.module_id, a)
    return map
  }, [assignments])

  const assignedModules = useMemo(() => {
    return [...assignments]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((assignment) => ({
        ...assignment,
        module: assignment.modules || modulesById.get(assignment.module_id) || null,
      }))
  }, [assignments, modulesById])

  // -------------------------------------------------------------------------
  // Fetch functions
  // -------------------------------------------------------------------------

  const dashboardSections = useMemo<DashboardSection[]>(() => {
    if (!activeDashboard?.sections) return []
    return [...activeDashboard.sections].sort((a, b) => a.sort_order - b.sort_order)
  }, [activeDashboard])

  const fetchDashboard = useCallback(async (dashboardId: string) => {
    setDashboardLoading(true)
    try {
      const res = await fetch(`/api/modules/dashboards/${dashboardId}`)
      if (!res.ok) {
        setActiveDashboard(null)
        return
      }
      const json = await res.json()
      setActiveDashboard(json.data?.dashboard ?? json.dashboard ?? null)
    } catch {
      setActiveDashboard(null)
    } finally {
      setDashboardLoading(false)
    }
  }, [])

  const fetchView = useCallback(async () => {
    if (!viewId) return

    const res = await fetch(`/api/admin/views/${viewId}`)
    if (!res.ok) throw new Error('Failed to fetch view')
    const json = await res.json()
    const viewData = (json.data?.view || null) as ViewDetail | null

    setView(viewData)
    setMetaName(viewData?.name || '')
    setMetaDescription(viewData?.description || '')
  }, [viewId])

  const fetchModules = useCallback(async () => {
    const res = await fetch('/api/modules')
    if (!res.ok) throw new Error('Failed to fetch modules')
    const json = await res.json()
    setModules((json.data?.modules || []) as Module[])
  }, [])

  const fetchAssignments = useCallback(async () => {
    if (!viewId) return

    const res = await fetch(`/api/admin/views/${viewId}/modules`)
    if (!res.ok) throw new Error('Failed to fetch module assignments')
    const json = await res.json()
    setAssignments((json.data?.assignments || []) as ViewModuleAssignment[])
  }, [viewId])

  async function refreshAll() {
    try {
      await Promise.all([fetchView(), fetchAssignments()])
    } catch {
      toast.error('Failed to refresh view state')
    }
  }

  // -------------------------------------------------------------------------
  // Initial load
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!viewId) return

    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const [viewResult, modulesResult, assignmentsResult] = await Promise.allSettled([
          fetchView(),
          fetchModules(),
          fetchAssignments(),
        ])

        if (viewResult.status === 'rejected') {
          throw new Error('Failed to load view details')
        }

        if (modulesResult.status === 'rejected' || assignmentsResult.status === 'rejected') {
          if (!cancelled) {
            toast.error('Some view data failed to load. You can still continue editing.')
          }
        }
      } catch {
        if (!cancelled) toast.error('Failed to load view builder')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [viewId, fetchView, fetchModules, fetchAssignments])

  // -------------------------------------------------------------------------
  // Mutation handlers
  // -------------------------------------------------------------------------

  async function handleToggleModule(moduleId: string, checked: boolean) {
    if (!viewId) return

    setModuleMutationId(moduleId)

    try {
      if (checked) {
        const res = await fetch(`/api/admin/views/${viewId}/modules`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ module_id: moduleId }),
        })

        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          toast.error(err.error?.message || 'Failed to assign module')
          return
        }

        toast.success('Module assigned')
      } else {
        const res = await fetch(`/api/admin/views/${viewId}/modules`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ module_id: moduleId }),
        })

        if (!res.ok && res.status !== 204) {
          const err = await res.json().catch(() => ({}))
          toast.error(err.error?.message || 'Failed to remove module')
          return
        }

        toast.success('Module removed')
      }

      await fetchAssignments()
    } catch {
      toast.error('Failed to update module assignment')
    } finally {
      setModuleMutationId(null)
    }
  }

  async function handleToggleViewField(field: 'is_active' | 'is_default', value: boolean) {
    if (!viewId) return

    try {
      const res = await fetch(`/api/admin/views/${viewId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      })

      if (!res.ok) {
        toast.error('Failed to update view')
        return
      }

      await fetchView()
    } catch {
      toast.error('Failed to update view')
    }
  }

  async function handleSaveMeta() {
    if (!viewId || !metaName.trim()) return

    setSavingMeta(true)

    try {
      const res = await fetch(`/api/admin/views/${viewId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: metaName.trim(),
          description: metaDescription.trim() || null,
        }),
      })

      if (!res.ok) {
        toast.error('Failed to save view settings')
        return
      }

      toast.success('View settings saved')
      await fetchView()
    } catch {
      toast.error('Failed to save view settings')
    } finally {
      setSavingMeta(false)
    }
  }

  async function handleAddRule(event: React.FormEvent) {
    event.preventDefault()
    if (!viewId || !addRuleType) return

    setAddRuleSubmitting(true)

    const targetId = addRuleType === 'default'
      ? null
      : addRuleTargetId.trim() || null

    try {
      const res = await fetch(`/api/admin/views/${viewId}/rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_type: addRuleType,
          target_id: targetId,
          priority: Number(addRulePriority) || 0,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error?.message || 'Failed to add rule')
        return
      }

      toast.success('Rule added')
      setAddRuleType('')
      setAddRuleTargetId('')
      setAddRulePriority('0')
      await fetchView()
    } catch {
      toast.error('Failed to add rule')
    } finally {
      setAddRuleSubmitting(false)
    }
  }

  async function handleDeleteRule(ruleId: string) {
    if (!viewId) return

    try {
      const res = await fetch(`/api/admin/views/${viewId}/rules/${ruleId}`, { method: 'DELETE' })
      if (!res.ok && res.status !== 204) {
        toast.error('Failed to remove rule')
        return
      }

      toast.success('Rule removed')
      await fetchView()
    } catch {
      toast.error('Failed to remove rule')
    }
  }

  // -------------------------------------------------------------------------
  // Return
  // -------------------------------------------------------------------------

  return {
    view,
    modules,
    assignments,
    loading,
    modulesById,
    assignmentByModuleId,
    assignedModules,

    metaName,
    setMetaName,
    metaDescription,
    setMetaDescription,
    savingMeta,

    fetchView,
    fetchModules,
    fetchAssignments,
    refreshAll,

    handleToggleModule,
    handleToggleViewField,
    handleSaveMeta,
    handleAddRule,
    handleDeleteRule,
    moduleMutationId,

    // Wave 4: dashboard composition
    activeDashboard,
    dashboardSections,
    dashboardLoading,
    fetchDashboard,

    addRuleState: {
      type: addRuleType,
      setType: setAddRuleType,
      targetId: addRuleTargetId,
      setTargetId: setAddRuleTargetId,
      priority: addRulePriority,
      setPriority: setAddRulePriority,
      submitting: addRuleSubmitting,
    },
  }
}
