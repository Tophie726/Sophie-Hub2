'use client'

import { useState, useEffect, useMemo } from 'react'
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
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Shield,
  Eye,
  Search,
  Loader2,
  RotateCcw,
} from 'lucide-react'
import { easeOut, duration } from '@/lib/animations'
import type { Role } from '@/lib/auth/roles'
import type { ViewerContext, SubjectIdentity } from '@/lib/auth/viewer-context'
import {
  CANONICAL_PARTNER_TYPES,
  CANONICAL_PARTNER_TYPE_LABELS,
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
  partner_code?: string | null
}

interface AdminModeControlProps {
  userRole: Role | undefined
  menuOpen?: boolean
  onContextApplied?: () => void
}

const ROLE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'role:pod_leader', label: 'PPC Strategist' },
  { value: 'role:staff', label: 'Staff' },
  { value: 'role:admin', label: 'Admin' },
]

const PARTNER_TYPE_OPTIONS = CANONICAL_PARTNER_TYPES.map((type) => ({
  value: `ptype:${type}`,
  label: CANONICAL_PARTNER_TYPE_LABELS[type],
}))

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

  // Search dialog state
  const [searchDialog, setSearchDialog] = useState<'staff' | 'partner' | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchLoading, setSearchLoading] = useState(false)
  const [dialogStaffResults, setDialogStaffResults] = useState<StaffOption[]>([])
  const [dialogPartnerResults, setDialogPartnerResults] = useState<PartnerOption[]>([])

  const isAdmin = userRole === 'admin'

  // Fetch current viewer context on mount
  useEffect(() => {
    if (!isAdmin) return
    fetchViewerContext()

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
      // Silently fail — will default to admin mode ON
    }
  }

  // Close/reset search dialog when menu closes
  useEffect(() => {
    if (menuOpen === false) {
      setSearchDialog(null)
      setSearchQuery('')
      setDialogStaffResults([])
      setDialogPartnerResults([])
    }
  }, [menuOpen])

  // Debounced server-side search for staff/partner dialogs (avoids loading huge lists on open)
  useEffect(() => {
    if (!searchDialog) return

    const query = searchQuery.trim()
    if (query.length < 2) {
      setDialogStaffResults([])
      setDialogPartnerResults([])
      setSearchLoading(false)
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setSearchLoading(true)
      try {
        if (searchDialog === 'staff') {
          const res = await fetch(`/api/staff?search=${encodeURIComponent(query)}&limit=25`, { signal: controller.signal })
          if (!res.ok) throw new Error('Staff search failed')
          const json = await res.json()
          setDialogStaffResults((json.data?.staff || json.staff || []) as StaffOption[])
        } else {
          const res = await fetch(`/api/partners?search=${encodeURIComponent(query)}&limit=25`, { signal: controller.signal })
          if (!res.ok) throw new Error('Partner search failed')
          const json = await res.json()
          setDialogPartnerResults((json.data?.partners || json.partners || []) as PartnerOption[])
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setDialogStaffResults([])
          setDialogPartnerResults([])
        }
      } finally {
        setSearchLoading(false)
      }
    }, 280)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [searchDialog, searchQuery])

  // ---------- Actions ----------

  async function handleAdminModeToggle(checked: boolean) {
    const previous = adminModeOn
    setAdminModeOn(checked)
    setLoading(true)

    try {
      if (checked) {
        const res = await fetch('/api/viewer-context', { method: 'DELETE' })
        if (!res.ok && res.status !== 204) throw new Error()
        setViewerContext(null)
      } else {
        const res = await fetch('/api/viewer-context', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'self', targetId: null, adminModeOn: false }),
        })
        if (!res.ok) throw new Error()
        const json = await res.json()
        setViewerContext(json.data?.viewerContext ?? null)
      }

      window.dispatchEvent(new CustomEvent('viewer-context-changed', {
        detail: { adminModeOn: checked, resolvedRole: null, isImpersonating: false },
      }))
    } catch {
      setAdminModeOn(previous)
      toast.error('Failed to toggle admin mode')
    } finally {
      setLoading(false)
    }
  }

  async function handleSeeAs(type: SubjectIdentity['type'], targetId: string | null) {
    setLoading(true)
    try {
      const res = await fetch('/api/viewer-context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, targetId, adminModeOn: true }),
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

      toast.success(`Now viewing as: ${ctx.subject.targetLabel}`)
      window.dispatchEvent(new CustomEvent('viewer-context-changed', {
        detail: { adminModeOn: true, resolvedRole: ctx.subject.resolvedRole, isImpersonating: true },
      }))
      setSearchDialog(null)
      onContextApplied?.()
    } catch {
      toast.error('Failed to set viewer context')
    } finally {
      setLoading(false)
    }
  }

  async function resetContext() {
    setLoading(true)
    try {
      const res = await fetch('/api/viewer-context', { method: 'DELETE' })
      if (!res.ok && res.status !== 204) throw new Error()

      setViewerContext(null)
      setAdminModeOn(true)
      toast.success('Reset to your view')
      window.dispatchEvent(new CustomEvent('viewer-context-changed', {
        detail: { adminModeOn: true, resolvedRole: null, isImpersonating: false },
      }))
      onContextApplied?.()
    } catch {
      toast.error('Failed to reset')
    } finally {
      setLoading(false)
    }
  }

  // ---------- Dropdown handler ----------

  function handleDropdownChange(encoded: string) {
    // search:staff / search:partner → open search dialog
    if (encoded === 'search:staff') {
      setSearchQuery('')
      setSearchDialog('staff')
      return
    }
    if (encoded === 'search:partner') {
      setSearchQuery('')
      setSearchDialog('partner')
      return
    }

    // role:xxx → see as role
    if (encoded.startsWith('role:')) {
      handleSeeAs('role', encoded.slice(5))
      return
    }

    // ptype:xxx → see as partner type
    if (encoded.startsWith('ptype:')) {
      handleSeeAs('partner_type', encoded.slice(6))
      return
    }
  }

  // ---------- Derived ----------

  const isImpersonating = viewerContext?.isImpersonating ?? false
  const activeStaffId = viewerContext?.subject.type === 'staff' ? viewerContext.subject.targetId : null
  const activeRole = viewerContext?.subject.type === 'role' ? viewerContext.subject.targetId : null
  const activePartnerId = viewerContext?.subject.type === 'partner' ? viewerContext.subject.targetId : null
  const activePartnerType = viewerContext?.subject.type === 'partner_type' ? viewerContext.subject.targetId : null

  // Encode the current selection for the dropdown value
  const currentDropdownValue = useMemo(() => {
    if (activeRole) return `role:${activeRole}`
    if (activePartnerType) return `ptype:${activePartnerType}`
    if (activeStaffId) return `staff:${activeStaffId}` // won't match a dropdown item, but shows label
    if (activePartnerId) return `partner:${activePartnerId}`
    return undefined
  }, [activeRole, activePartnerType, activeStaffId, activePartnerId])

  // Display label for current selection
  const currentLabel = viewerContext?.subject.targetLabel

  const filteredDialogItems = useMemo(() => {
    if (searchDialog === 'staff') {
      return dialogStaffResults
    }
    if (searchDialog === 'partner') {
      return dialogPartnerResults
    }
    return []
  }, [searchDialog, dialogStaffResults, dialogPartnerResults])

  if (!isAdmin) return null

  // ---------- Render ----------

  return (
    <>
      <div className="p-3 space-y-3">
        {/* ── Admin Mode Toggle ── */}
        <div
          className={cn(
            'flex items-center justify-between rounded-lg px-3 py-2.5',
            'transition-colors duration-150',
            adminModeOn
              ? 'bg-primary/[0.06] dark:bg-primary/[0.12]'
              : 'bg-muted/40'
          )}
        >
          <div className="flex items-center gap-2.5">
            <Shield
              className={cn(
                'h-4 w-4 transition-colors duration-150',
                adminModeOn ? 'text-primary' : 'text-muted-foreground'
              )}
            />
            <label
              htmlFor="admin-mode-toggle"
              className="text-sm font-medium cursor-pointer select-none"
            >
              Admin Mode
            </label>
          </div>
          <Switch
            id="admin-mode-toggle"
            checked={adminModeOn}
            onCheckedChange={handleAdminModeToggle}
            disabled={loading}
            aria-label="Toggle admin mode"
          />
        </div>

        {/* ── Impersonation banner ── */}
        <AnimatePresence initial={false}>
          {isImpersonating && (
            <motion.div
              key="impersonation-banner"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: duration.micro, ease: easeOut }}
              className={cn(
                'flex items-center justify-between rounded-lg px-3 py-2',
                'bg-amber-500/10 dark:bg-amber-500/[0.15]',
                'border border-amber-500/20 dark:border-amber-500/25'
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Eye className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                <span className="text-xs text-amber-700 dark:text-amber-400 truncate">
                  Viewing as{' '}
                  <span className="font-medium">{currentLabel}</span>
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={resetContext}
                disabled={loading}
                className="h-6 px-2 text-[11px] shrink-0 text-amber-700 dark:text-amber-400 hover:bg-amber-500/15 hover:text-amber-800 dark:hover:text-amber-300"
                aria-label="Reset viewer context"
              >
                {loading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RotateCcw className="h-3 w-3" />
                )}
                <span className="ml-1">Reset</span>
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── See As — single dropdown ── */}
        <AnimatePresence initial={false} mode="wait">
          {adminModeOn ? (
            <motion.div
              key="see-as-dropdown"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: duration.micro, ease: easeOut }}
              className="space-y-2"
            >
              <div className="flex items-center gap-2 px-0.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  See As
                </span>
                <div className="flex-1 h-px bg-border/60" />
              </div>

              <Select
                value={currentDropdownValue}
                onValueChange={handleDropdownChange}
                disabled={loading}
              >
                <SelectTrigger
                  className={cn(
                    'h-9 text-sm',
                    isImpersonating && 'border-primary/40 bg-primary/5 text-primary'
                  )}
                >
                  <SelectValue placeholder="Select role or type…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Staff Roles</SelectLabel>
                    {ROLE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                    <SelectItem value="search:staff" className="text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Search className="h-3 w-3" />
                        Search person…
                      </span>
                    </SelectItem>
                  </SelectGroup>

                  <SelectSeparator />

                  <SelectGroup>
                    <SelectLabel>Partner Types</SelectLabel>
                    {PARTNER_TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                    <SelectItem value="search:partner" className="text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Search className="h-3 w-3" />
                        Search brand…
                      </span>
                    </SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </motion.div>
          ) : (
            <motion.p
              key="admin-off-hint"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: duration.micro, ease: easeOut }}
              className="text-xs text-muted-foreground px-0.5 py-1 leading-relaxed"
            >
              Viewing as your base role. Turn on to access admin features and See As.
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* ── Search Dialog ── Full search experience in a modal */}
      <Dialog
        open={searchDialog !== null}
        onOpenChange={(open) => {
          if (!open) setSearchDialog(null)
        }}
      >
        <DialogContent className="max-w-sm gap-3 p-0 overflow-hidden">
          <DialogHeader className="px-4 pt-4 pb-0">
            <DialogTitle className="text-base">
              {searchDialog === 'staff' ? 'Select Staff Member' : 'Select Partner Brand'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {searchDialog === 'staff'
                ? 'Preview the app as a specific staff member.'
                : 'Preview the app as a specific partner brand.'}
            </DialogDescription>
          </DialogHeader>

          <div className="px-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={searchDialog === 'staff' ? 'Search by name or email…' : 'Search by brand name…'}
                className="h-8 text-sm pl-8"
                autoFocus
              />
              {searchLoading && (
                <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground pointer-events-none" />
              )}
            </div>
          </div>

          <ScrollArea className="h-72 border-t border-border/40">
            <div className="p-1.5">
              {filteredDialogItems.length === 0 ? (
                searchQuery.trim().length < 2 ? (
                  <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                    Type at least 2 characters to search.
                  </p>
                ) : (
                  <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                    No results found.
                  </p>
                )
              ) : searchDialog === 'staff' ? (
                (filteredDialogItems as StaffOption[]).slice(0, 100).map((staff) => (
                  <button
                    key={staff.id}
                    type="button"
                    onClick={() => handleSeeAs('staff', staff.id)}
                    className={cn(
                      'w-full rounded-md px-3 py-2 text-left',
                      'transition-colors duration-100',
                      'hover:bg-accent active:scale-[0.997]',
                      activeStaffId === staff.id && 'bg-primary/10 dark:bg-primary/15'
                    )}
                    disabled={loading}
                  >
                    <p className="truncate text-sm font-medium text-foreground">
                      {staff.full_name || staff.email}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {staff.email} · {formatStaffRole(staff.role)}
                    </p>
                  </button>
                ))
              ) : (
                (filteredDialogItems as PartnerOption[]).slice(0, 100).map((partner) => (
                  <button
                    key={partner.id}
                    type="button"
                    onClick={() => handleSeeAs('partner', partner.id)}
                    className={cn(
                      'w-full rounded-md px-3 py-2 text-left',
                      'transition-colors duration-100',
                      'hover:bg-accent active:scale-[0.997]',
                      activePartnerId === partner.id && 'bg-primary/10 dark:bg-primary/15'
                    )}
                    disabled={loading}
                  >
                    <p className="truncate text-sm font-medium text-foreground">
                      {partner.brand_name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {partner.partner_code || 'Partner'}
                    </p>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  )
}
