'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, User, Users, Package, Globe, Building2, Loader2, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import {
  CANONICAL_PARTNER_TYPES,
  CANONICAL_PARTNER_TYPE_LABELS,
} from '@/lib/partners/computed-partner-type'
import type { AudienceRule } from '@/app/(dashboard)/admin/views/[viewId]/use-view-builder-data'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SubjectType = 'self' | 'staff' | 'partner' | 'role' | 'partner_type'

interface StaffResult {
  id: string
  full_name: string
  email: string
  role: string | null
}

interface PartnerResult {
  id: string
  brand_name: string
  partner_code: string | null
}

interface AudienceSelectorProps {
  current: {
    subjectType: SubjectType
    targetId: string | null
    targetLabel?: string | null
  }
  dataMode: 'snapshot' | 'live'
  viewRules: AudienceRule[]
  onSelect: (subjectType: SubjectType, targetId: string | null, targetLabel?: string) => void
  onDataModeChange: (mode: 'snapshot' | 'live') => void
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'pod_leader', label: 'PPC Strategist' },
  { value: 'staff', label: 'Staff' },
] as const

const SEARCH_DEBOUNCE_MS = 300
const SEARCH_LIMIT = 8

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getAudienceLabel(
  subjectType: SubjectType,
  targetId: string | null,
  targetLabel?: string | null
): string {
  if (subjectType === 'self') return 'Self (Admin)'
  if (subjectType === 'role') {
    const role = ROLE_OPTIONS.find((r) => r.value === targetId)
    return role ? role.label : targetId || 'Role'
  }
  if (subjectType === 'partner_type') {
    const label = targetId
      ? CANONICAL_PARTNER_TYPE_LABELS[targetId as keyof typeof CANONICAL_PARTNER_TYPE_LABELS]
      : null
    return label || targetId || 'Partner Type'
  }
  if (subjectType === 'staff') {
    return targetLabel || `Staff: ${targetId ? targetId.slice(0, 8) : '...'}`
  }
  if (subjectType === 'partner') {
    return targetLabel || `Partner: ${targetId ? targetId.slice(0, 8) : '...'}`
  }
  return 'Default'
}

/** Check if live data mode is supported for a given subject type */
function isLiveSupported(subjectType: SubjectType): boolean {
  return subjectType === 'staff' || subjectType === 'partner'
}

// ---------------------------------------------------------------------------
// Search Hook
// ---------------------------------------------------------------------------

function useEntitySearch<T>(
  endpoint: string,
  resultKey: string,
  enabled: boolean
) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<T[]>([])
  const [loading, setLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!enabled) {
      setResults([])
      return
    }

    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setResults([])
      return
    }

    const timer = setTimeout(async () => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      setLoading(true)
      try {
        const res = await fetch(
          `${endpoint}?search=${encodeURIComponent(trimmed)}&limit=${SEARCH_LIMIT}`,
          { signal: controller.signal }
        )
        if (!res.ok) throw new Error()
        const json = await res.json()
        const items = json.data?.[resultKey] || json[resultKey] || []
        setResults(items)
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setResults([])
      } finally {
        setLoading(false)
      }
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      abortRef.current?.abort()
    }
  }, [query, endpoint, resultKey, enabled])

  function reset() {
    setQuery('')
    setResults([])
    setLoading(false)
    abortRef.current?.abort()
  }

  return { query, setQuery, results, loading, reset }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AudienceSelector({
  current,
  dataMode,
  viewRules,
  onSelect,
  onDataModeChange,
}: AudienceSelectorProps) {
  const [open, setOpen] = useState(false)

  const staffSearch = useEntitySearch<StaffResult>('/api/staff', 'staff', open)
  const partnerSearch = useEntitySearch<PartnerResult>('/api/partners', 'partners', open)

  function select(subjectType: SubjectType, targetId: string | null, targetLabel?: string) {
    onSelect(subjectType, targetId, targetLabel)
    staffSearch.reset()
    partnerSearch.reset()
    setOpen(false)
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (!nextOpen) {
      staffSearch.reset()
      partnerSearch.reset()
    }
  }

  const label = getAudienceLabel(current.subjectType, current.targetId, current.targetLabel)
  const ruleCount = viewRules.length

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs max-w-[200px]"
        >
          <span className="truncate">{label}</span>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[300px] p-0">
        <div className="max-h-[500px] overflow-y-auto">
          {/* Self */}
          <div className="p-1">
            <button
              type="button"
              onClick={() => select('self', null)}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent',
                current.subjectType === 'self' && 'bg-accent'
              )}
            >
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              Self (Admin View)
            </button>
          </div>

          <div className="border-t border-border/40" />

          {/* Staff Roles */}
          <div className="p-1">
            <p className="px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
              Staff Roles
            </p>
            {ROLE_OPTIONS.map((role) => (
              <button
                key={role.value}
                type="button"
                onClick={() => select('role', role.value)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent',
                  current.subjectType === 'role' && current.targetId === role.value && 'bg-accent'
                )}
              >
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                {role.label}
              </button>
            ))}
          </div>

          <div className="border-t border-border/40" />

          {/* Specific Staff Member — Searchable */}
          <div className="p-1">
            <p className="px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
              Specific Staff
            </p>
            <div className="px-2 pb-1 space-y-1">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/50" />
                <Input
                  value={staffSearch.query}
                  onChange={(e) => staffSearch.setQuery(e.target.value)}
                  placeholder="Search by name or email..."
                  className="h-8 text-xs pl-7"
                />
                {staffSearch.loading && (
                  <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3 w-3 animate-spin text-muted-foreground/50" />
                )}
              </div>
              {staffSearch.results.length > 0 && (
                <div className="space-y-0.5">
                  {staffSearch.results.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => select('staff', s.id, s.full_name)}
                      className={cn(
                        'flex w-full flex-col rounded-md px-3 py-1.5 text-left transition-colors hover:bg-accent',
                        current.subjectType === 'staff' && current.targetId === s.id && 'bg-accent'
                      )}
                    >
                      <span className="text-xs font-medium truncate">{s.full_name}</span>
                      <span className="text-[10px] text-muted-foreground truncate">{s.email}</span>
                    </button>
                  ))}
                </div>
              )}
              {staffSearch.query.trim().length >= 2 && !staffSearch.loading && staffSearch.results.length === 0 && (
                <p className="px-3 py-1.5 text-[10px] text-muted-foreground/70">No staff found</p>
              )}
            </div>
          </div>

          <div className="border-t border-border/40" />

          {/* Partner Types */}
          <div className="p-1">
            <p className="px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
              Partner Types
            </p>
            {CANONICAL_PARTNER_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => select('partner_type', type)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent',
                  current.subjectType === 'partner_type' && current.targetId === type && 'bg-accent'
                )}
              >
                <Package className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="truncate">{CANONICAL_PARTNER_TYPE_LABELS[type]}</span>
              </button>
            ))}
          </div>

          <div className="border-t border-border/40" />

          {/* Specific Partner — Searchable */}
          <div className="p-1">
            <p className="px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
              Specific Partner
            </p>
            <div className="px-2 pb-1 space-y-1">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/50" />
                <Input
                  value={partnerSearch.query}
                  onChange={(e) => partnerSearch.setQuery(e.target.value)}
                  placeholder="Search by brand name..."
                  className="h-8 text-xs pl-7"
                />
                {partnerSearch.loading && (
                  <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3 w-3 animate-spin text-muted-foreground/50" />
                )}
              </div>
              {partnerSearch.results.length > 0 && (
                <div className="space-y-0.5">
                  {partnerSearch.results.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => select('partner', p.id, p.brand_name)}
                      className={cn(
                        'flex w-full flex-col rounded-md px-3 py-1.5 text-left transition-colors hover:bg-accent',
                        current.subjectType === 'partner' && current.targetId === p.id && 'bg-accent'
                      )}
                    >
                      <span className="text-xs font-medium truncate">{p.brand_name}</span>
                      {p.partner_code && (
                        <span className="text-[10px] text-muted-foreground truncate">{p.partner_code}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {partnerSearch.query.trim().length >= 2 && !partnerSearch.loading && partnerSearch.results.length === 0 && (
                <p className="px-3 py-1.5 text-[10px] text-muted-foreground/70">No partners found</p>
              )}
            </div>
          </div>

          <div className="border-t border-border/40" />

          {/* Default */}
          <div className="p-1">
            <button
              type="button"
              onClick={() => select('role', 'staff')}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent',
              )}
            >
              <Globe className="h-3.5 w-3.5 text-muted-foreground" />
              Default (Staff)
            </button>
          </div>

          <div className="border-t border-border/40" />

          {/* Footer: Data mode toggle + rule count */}
          <div className="p-2 px-3 space-y-2">
            {/* Data mode */}
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
                Data Mode
              </span>
              <div className="flex items-center rounded-md p-0.5" style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.08)' }}>
                <button
                  type="button"
                  onClick={() => onDataModeChange('snapshot')}
                  className={cn(
                    'px-2 py-0.5 text-[10px] font-medium rounded transition-colors',
                    dataMode === 'snapshot'
                      ? 'bg-muted text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  Snapshot
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (isLiveSupported(current.subjectType)) {
                      onDataModeChange('live')
                    }
                  }}
                  disabled={!isLiveSupported(current.subjectType)}
                  className={cn(
                    'px-2 py-0.5 text-[10px] font-medium rounded transition-colors',
                    dataMode === 'live'
                      ? 'bg-muted text-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                    !isLiveSupported(current.subjectType) && 'opacity-40 cursor-not-allowed'
                  )}
                >
                  Live
                </button>
              </div>
            </div>

            {/* Rule count info */}
            {ruleCount > 0 && (
              <div className="flex items-center gap-1.5">
                <Building2 className="h-3 w-3 text-muted-foreground/50" />
                <span className="text-[10px] text-muted-foreground/70">
                  {ruleCount} audience rule{ruleCount !== 1 ? 's' : ''} configured
                </span>
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
