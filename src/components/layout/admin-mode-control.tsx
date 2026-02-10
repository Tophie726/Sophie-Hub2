'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  X,
  Users,
  Building2,
  Shield,
  Loader2,
} from 'lucide-react'
import { easeOutStandard, duration } from '@/lib/animations'
import type { Role } from '@/lib/auth/roles'
import type { ViewerContext, SubjectIdentity } from '@/lib/auth/viewer-context'
import {
  CANONICAL_PARTNER_TYPES,
  CANONICAL_PARTNER_TYPE_LABELS,
  type CanonicalPartnerType,
} from '@/lib/partners/computed-partner-type'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StaffOption {
  id: string
  full_name: string
  email: string
  role: string
}

interface PartnerOption {
  id: string
  brand_name: string
  computed_partner_type: CanonicalPartnerType | null
  computed_partner_type_label: string | null
}

interface AdminModeControlProps {
  userRole: Role | undefined
  menuOpen?: boolean
  onContextApplied?: () => void
}

// ---------------------------------------------------------------------------
// Module-level cache for see-as options
// ---------------------------------------------------------------------------

let cachedStaff: StaffOption[] | null = null
let cachedPartners: PartnerOption[] | null = null

const ROLE_OPTIONS: Array<{ value: Role; label: string }> = [
  { value: 'pod_leader', label: 'PPC Strategist' },
  { value: 'staff', label: 'Staff' },
  { value: 'admin', label: 'Admin' },
]

function formatStaffRole(role: string | null | undefined): string {
  if (!role) return 'Staff'
  if (role === 'pod_leader') return 'PPC Strategist'
  if (role === 'operations_admin') return 'Operations Admin'
  return role
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AdminModeControl({ userRole, menuOpen, onContextApplied }: AdminModeControlProps) {
  const [viewerContext, setViewerContext] = useState<ViewerContext | null>(null)
  const [adminModeOn, setAdminModeOn] = useState(true)
  const [loading, setLoading] = useState(false)
  const [optionsLoading, setOptionsLoading] = useState(false)

  // Options for the see-as selector
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>(cachedStaff || [])
  const [partnerOptions, setPartnerOptions] = useState<PartnerOption[]>(cachedPartners || [])
  const [staffSearch, setStaffSearch] = useState('')
  const [partnerSearch, setPartnerSearch] = useState('')
  const isAdmin = userRole === 'admin'

  // Fetch current viewer context on mount
  useEffect(() => {
    if (!isAdmin) return
    fetchViewerContext()

    // Listen for context changes from badge reset
    function handleContextChange() {
      fetchViewerContext()
    }
    window.addEventListener('viewer-context-changed', handleContextChange)
    return () => window.removeEventListener('viewer-context-changed', handleContextChange)
  }, [isAdmin])

  async function fetchViewerContext() {
    try {
      const res = await fetch('/api/viewer-context')
      if (!res.ok) return
      const json = await res.json()
      const ctx = json.data?.viewerContext as ViewerContext | undefined
      if (ctx) {
        setViewerContext(ctx)
        setAdminModeOn(ctx.adminModeOn)
      }
    } catch {
      // Silently fail - will default to normal admin state
    }
  }

  // Fetch staff and partner options when the menu opens.
  const loadOptions = useCallback(async () => {
    if (cachedStaff && cachedPartners) {
      setStaffOptions(cachedStaff)
      setPartnerOptions(cachedPartners)
      return
    }

    setOptionsLoading(true)
    try {
      const [staffRes, partnersRes] = await Promise.all([
        fetch('/api/staff?limit=100&sort=full_name&order=asc'),
        fetch('/api/partners?limit=500'),
      ])

      if (staffRes.ok) {
        const staffJson = await staffRes.json()
        const staff = (staffJson.data?.staff || staffJson.staff || []) as StaffOption[]
        cachedStaff = staff
        setStaffOptions(staff)
      }

      if (partnersRes.ok) {
        const partnersJson = await partnersRes.json()
        const partners = (partnersJson.data?.partners || partnersJson.partners || []) as Array<{
          id: string
          brand_name: string
          computed_partner_type: CanonicalPartnerType | null
          computed_partner_type_label: string | null
        }>
        cachedPartners = partners
        setPartnerOptions(partners)
      }
    } catch {
      toast.error('Failed to load see-as options')
    } finally {
      setOptionsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isAdmin) return
    if (menuOpen === false) return
    loadOptions()
  }, [isAdmin, menuOpen, loadOptions])

  // Handle admin mode toggle
  async function handleAdminModeToggle(checked: boolean) {
    setAdminModeOn(checked)

    if (!checked) {
      await resetContext(false)
      return
    }
  }

  // Handle see-as selection
  async function handleSeeAs(type: SubjectIdentity['type'], targetId: string | null) {
    setLoading(true)
    try {
      const res = await fetch('/api/viewer-context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, targetId }),
      })

      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error?.message || 'Failed to set viewer context')
        return
      }

      const json = await res.json()
      const ctx = json.data?.viewerContext as ViewerContext
      setViewerContext(ctx)
      setAdminModeOn(ctx.adminModeOn)

      const label = ctx.subject.targetLabel
      toast.success(`Now viewing as: ${label}`)
      window.dispatchEvent(new CustomEvent('viewer-context-changed'))
      onContextApplied?.()
    } catch {
      toast.error('Failed to set viewer context')
    } finally {
      setLoading(false)
    }
  }

  // Reset viewer context
  async function resetContext(showToast: boolean = true) {
    setLoading(true)
    try {
      const res = await fetch('/api/viewer-context', { method: 'DELETE' })
      if (!res.ok && res.status !== 204) {
        toast.error('Failed to reset viewer context')
        return
      }

      setViewerContext(null)
      if (showToast) toast.success('Viewer context reset')
      window.dispatchEvent(new CustomEvent('viewer-context-changed'))
      onContextApplied?.()
    } catch {
      toast.error('Failed to reset viewer context')
    } finally {
      setLoading(false)
    }
  }

  const isImpersonating = viewerContext?.isImpersonating ?? false

  const activeStaffId = viewerContext?.subject.type === 'staff' ? viewerContext.subject.targetId : null
  const activeRole = viewerContext?.subject.type === 'role' ? viewerContext.subject.targetId : null
  const activePartnerId = viewerContext?.subject.type === 'partner' ? viewerContext.subject.targetId : null
  const activePartnerType = viewerContext?.subject.type === 'partner_type' ? viewerContext.subject.targetId : null

  const filteredStaff = useMemo(() => {
    const query = staffSearch.trim().toLowerCase()
    if (!query) return staffOptions
    return staffOptions.filter((member) =>
      `${member.full_name || ''} ${member.email || ''}`.toLowerCase().includes(query)
    )
  }, [staffOptions, staffSearch])

  const filteredPartners = useMemo(() => {
    const query = partnerSearch.trim().toLowerCase()
    if (!query) return partnerOptions
    return partnerOptions.filter((partner) =>
      (partner.brand_name || '').toLowerCase().includes(query)
    )
  }, [partnerOptions, partnerSearch])

  // Only render for admin users
  if (!isAdmin) return null

  return (
    <div className="p-3 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">See As</h4>
        {isImpersonating && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => resetContext()}
            disabled={loading}
            className="h-7 px-2 text-xs text-muted-foreground"
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
            <span className="ml-1">Reset</span>
          </Button>
        )}
      </div>

      <div className="flex items-center justify-between rounded-md border border-border/60 bg-muted/20 px-3 py-2">
        <label htmlFor="admin-mode-toggle" className="text-sm font-medium cursor-pointer select-none">
          Admin Mode
        </label>
        <Switch
          id="admin-mode-toggle"
          checked={adminModeOn}
          onCheckedChange={handleAdminModeToggle}
          aria-label="Toggle admin mode"
        />
      </div>

      <AnimatePresence>
        {isImpersonating && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: duration.ui, ease: easeOutStandard }}
            className="overflow-hidden"
          >
            <div className="rounded-md bg-amber-500/10 dark:bg-amber-500/15 px-2.5 py-1.5 text-xs text-amber-700 dark:text-amber-400">
              Viewing as: <span className="font-medium">{viewerContext?.subject.targetLabel}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!adminModeOn ? (
        <p className="text-xs text-muted-foreground">
          Admin mode is off. You are viewing with your default role permissions.
        </p>
      ) : optionsLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-3 rounded-md border border-border/60 p-3">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              Staff
            </p>

            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Shield className="h-3.5 w-3.5" />
                Role
              </label>
              <Select
                value={activeRole && ROLE_OPTIONS.some((role) => role.value === activeRole) ? activeRole : undefined}
                onValueChange={(value) => handleSeeAs('role', value)}
                disabled={loading}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Select a role..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Staff Roles</SelectLabel>
                    {ROLE_OPTIONS.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Person</label>
              <Input
                value={staffSearch}
                onChange={(event) => setStaffSearch(event.target.value)}
                placeholder="Search staff..."
                className="h-8 text-sm"
              />
              <ScrollArea className="h-36 rounded-md border border-border/60">
                <div className="space-y-1 p-1.5">
                  {filteredStaff.length === 0 ? (
                    <p className="px-2 py-1.5 text-xs text-muted-foreground">No staff matched your search.</p>
                  ) : (
                    filteredStaff.slice(0, 80).map((staff) => (
                      <button
                        key={staff.id}
                        type="button"
                        onClick={() => handleSeeAs('staff', staff.id)}
                        className={cn(
                          'w-full rounded-md px-2 py-1.5 text-left transition-colors',
                          'hover:bg-accent',
                          activeStaffId === staff.id && 'bg-primary/10'
                        )}
                        disabled={loading}
                      >
                        <p className="truncate text-xs font-medium text-foreground">{staff.full_name || staff.email}</p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {staff.email} • {formatStaffRole(staff.role)}
                        </p>
                      </button>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>

          <div className="space-y-3 rounded-md border border-border/60 p-3">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Building2 className="h-3.5 w-3.5" />
              Partner
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Type</label>
              <Select
                value={
                  activePartnerType && CANONICAL_PARTNER_TYPES.includes(activePartnerType as CanonicalPartnerType)
                    ? activePartnerType
                    : undefined
                }
                onValueChange={(value) => handleSeeAs('partner_type', value)}
                disabled={loading}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Select a partner type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Product / Partner Type</SelectLabel>
                    {CANONICAL_PARTNER_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {CANONICAL_PARTNER_TYPE_LABELS[type]}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Brand</label>
              <Input
                value={partnerSearch}
                onChange={(event) => setPartnerSearch(event.target.value)}
                placeholder="Search brands..."
                className="h-8 text-sm"
              />
              <ScrollArea className="h-36 rounded-md border border-border/60">
                <div className="space-y-1 p-1.5">
                  {filteredPartners.length === 0 ? (
                    <p className="px-2 py-1.5 text-xs text-muted-foreground">No partner matched your search.</p>
                  ) : (
                    filteredPartners.slice(0, 80).map((partner) => (
                      <button
                        key={partner.id}
                        type="button"
                        onClick={() => handleSeeAs('partner', partner.id)}
                        className={cn(
                          'w-full rounded-md px-2 py-1.5 text-left transition-colors',
                          'hover:bg-accent',
                          activePartnerId === partner.id && 'bg-primary/10'
                        )}
                        disabled={loading}
                      >
                        <p className="truncate text-xs font-medium text-foreground">{partner.brand_name}</p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {partner.computed_partner_type_label || 'Unknown type'}
                        </p>
                      </button>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
