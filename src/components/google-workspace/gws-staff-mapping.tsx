'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Search,
  Loader2,
  Check,
  X,
  Link2,
  Unlink,
  Sparkles,
  ChevronDown,
  AlertCircle,
  Download,
  Users,
  UserX,
  Shield,
  RefreshCw,
  UserPlus,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { ShimmerGrid } from '@/components/ui/shimmer-grid'
import { isStaffEligibleForAutoMapping } from '@/lib/staff/lifecycle'

interface DirectoryUser {
  google_user_id: string
  primary_email: string
  full_name: string | null
  org_unit_path: string | null
  is_suspended: boolean
  is_deleted: boolean
  is_admin: boolean
  account_type?: 'person' | 'shared_account'
  account_type_reason?: string
  account_type_override?: 'person' | 'shared_account' | null
  account_type_overridden?: boolean
  title: string | null
  thumbnail_photo_url: string | null
  // Mapping info (joined from API)
  staff_id: string | null
  staff_name: string | null
  staff_avatar_url?: string | null
  is_mapped: boolean
}

interface StaffMember {
  id: string
  full_name: string
  email: string
  status?: string | null
}

type FilterType = 'all' | 'mapped' | 'unmapped' | 'suspended' | 'admin' | 'shared'

const easeOut: [number, number, number, number] = [0.22, 1, 0.36, 1]
const PAGE_SIZE = 30

export function GWSStaffMapping() {
  const [directoryUsers, setDirectoryUsers] = useState<DirectoryUser[]>([])
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([])
  const [isLoadingUsers, setIsLoadingUsers] = useState(true)
  const [isLoadingStaff, setIsLoadingStaff] = useState(true)
  const [isAutoMatching, setIsAutoMatching] = useState(false)
  const [isEnriching, setIsEnriching] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isBootstrappingStaff, setIsBootstrappingStaff] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')
  const [selectedStaff, setSelectedStaff] = useState<Record<string, string>>({})
  const [savingUserId, setSavingUserId] = useState<string | null>(null)
  const [classificationSavingUserId, setClassificationSavingUserId] = useState<string | null>(null)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [error, setError] = useState<string | null>(null)
  const [syncStatus, setSyncStatus] = useState<{
    total: number
    active: number
    active_people: number
    active_shared: number
    suspended: number
    deleted: number
    mappings: number
    pending_staff_approvals: number
    last_sync_at: string | null
  } | null>(null)

  function normalizeSyncStatus(payload: unknown): {
    total: number
    active: number
    active_people: number
    active_shared: number
    suspended: number
    deleted: number
    mappings: number
    pending_staff_approvals: number
    last_sync_at: string | null
  } | null {
    if (!payload || typeof payload !== 'object') return null

    const raw = payload as Record<string, unknown>
    const snapshot = (raw.snapshot_stats as Record<string, unknown> | undefined) || {}

    return {
      total: Number(raw.total ?? snapshot.total ?? 0),
      active: Number(raw.active ?? snapshot.active ?? 0),
      active_people: Number(raw.active_people ?? snapshot.active_people ?? 0),
      active_shared: Number(raw.active_shared ?? snapshot.active_shared ?? 0),
      suspended: Number(raw.suspended ?? snapshot.suspended ?? 0),
      deleted: Number(raw.deleted ?? snapshot.deleted ?? 0),
      mappings: Number(raw.mappings ?? 0),
      pending_staff_approvals: Number(raw.pending_staff_approvals ?? 0),
      last_sync_at: (raw.last_sync_at as string | null | undefined) ?? null,
    }
  }

  // Fetch directory users from snapshot
  useEffect(() => {
    async function fetchUsers() {
      try {
        const res = await fetch('/api/google-workspace/users')
        if (!res.ok) throw new Error('Failed to fetch directory users')
        const json = await res.json()
        const users = json.data?.users || []

        // Fetch mappings to enrich user data
        const mappingsRes = await fetch('/api/google-workspace/mappings/staff')
        const mappingsJson = mappingsRes.ok ? await mappingsRes.json() : { data: { mappings: [] } }
        const mappings = mappingsJson.data?.mappings || []

        const mappingsByGoogleId = new Map(
          mappings.map((m: { google_user_id: string; staff_id: string; staff_name: string | null; staff_avatar_url?: string | null }) => [
            m.google_user_id,
            m,
          ])
        )

        const enrichedUsers: DirectoryUser[] = users.map((u: DirectoryUser) => {
          const mapping = mappingsByGoogleId.get(u.google_user_id) as {
            staff_id: string
            staff_name: string | null
            staff_avatar_url?: string | null
          } | undefined
          return {
            ...u,
            staff_id: mapping?.staff_id || null,
            staff_name: mapping?.staff_name || null,
            staff_avatar_url: mapping?.staff_avatar_url || null,
            is_mapped: !!mapping,
          }
        })

        setDirectoryUsers(enrichedUsers)
        setError(null)
      } catch (err) {
        console.error('Error fetching directory users:', err)
        setError('Failed to load directory users. Has the directory been synced?')
      } finally {
        setIsLoadingUsers(false)
      }
    }
    fetchUsers()
  }, [])

  // Fetch staff members
  useEffect(() => {
    async function fetchStaff() {
      try {
        const all: Array<{ id: string; full_name: string; email: string; status?: string | null }> = []
        const pageSize = 100
        let offset = 0
        let hasMore = true

        while (hasMore) {
          const res = await fetch(`/api/staff?limit=${pageSize}&offset=${offset}`)
          if (!res.ok) throw new Error('Failed to fetch staff')
          const json = await res.json()
          const list = json.data?.staff || json.staff || []

          all.push(...list)
          hasMore = Boolean(json.data?.has_more)
          offset += pageSize
        }

        setStaffMembers(
          all.map((s: { id: string; full_name: string; email: string; status?: string | null }) => ({
            id: s.id,
            full_name: s.full_name,
            email: s.email,
            status: s.status ?? null,
          }))
        )
      } catch (err) {
        console.error('Error fetching staff:', err)
      } finally {
        setIsLoadingStaff(false)
      }
    }
    fetchStaff()
  }, [])

  // Fetch sync status
  useEffect(() => {
    async function fetchSyncStatus() {
      try {
        const res = await fetch('/api/google-workspace/sync/status')
        if (!res.ok) return
        const json = await res.json()
        setSyncStatus(normalizeSyncStatus(json.data))
      } catch {
        // Non-critical
      }
    }
    fetchSyncStatus()
  }, [])

  const mappedStaffIds = useMemo(() => {
    return new Set(
      directoryUsers
        .filter(u => u.is_mapped && u.account_type !== 'shared_account')
        .map(u => u.staff_id!)
    )
  }, [directoryUsers])

  const activeUsers = useMemo(() => {
    return directoryUsers.filter(u => !u.is_suspended && !u.is_deleted)
  }, [directoryUsers])

  const activePersonUsers = useMemo(() => {
    return activeUsers.filter(u => u.account_type !== 'shared_account')
  }, [activeUsers])

  const activeSharedUsers = useMemo(() => {
    return activeUsers.filter(u => u.account_type === 'shared_account')
  }, [activeUsers])

  const inactiveStaffIds = useMemo(() => {
    return new Set(
      staffMembers
        .filter(s => !isStaffEligibleForAutoMapping(s.status))
        .map(s => s.id)
    )
  }, [staffMembers])

  const countablePersonUsers = useMemo(() => {
    return activePersonUsers.filter(u => !u.staff_id || !inactiveStaffIds.has(u.staff_id))
  }, [activePersonUsers, inactiveStaffIds])

  const filteredUsers = useMemo(() => {
    let filtered = directoryUsers

    if (filter === 'all') {
      filtered = filtered.filter(u => !u.is_deleted)
    } else if (filter === 'mapped') {
      filtered = filtered.filter(u => u.is_mapped && !u.is_deleted)
    } else if (filter === 'unmapped') {
      filtered = filtered.filter(
        u => !u.is_mapped && !u.is_suspended && !u.is_deleted && u.account_type !== 'shared_account'
      )
    } else if (filter === 'suspended') {
      filtered = filtered.filter(u => u.is_suspended)
    } else if (filter === 'admin') {
      filtered = filtered.filter(u => u.is_admin && !u.is_deleted)
    } else if (filter === 'shared') {
      filtered = filtered.filter(u => u.account_type === 'shared_account' && !u.is_deleted)
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(
        u =>
          u.primary_email.toLowerCase().includes(q) ||
          u.full_name?.toLowerCase().includes(q) ||
          u.title?.toLowerCase().includes(q) ||
          u.org_unit_path?.toLowerCase().includes(q) ||
          u.staff_name?.toLowerCase().includes(q)
      )
    }

    return filtered
  }, [directoryUsers, searchQuery, filter])

  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [searchQuery, filter])

  const visibleUsers = filteredUsers.slice(0, visibleCount)
  const hasMore = visibleCount < filteredUsers.length

  const mappedCount = countablePersonUsers.filter(u => u.is_mapped).length
  const unmappedCount = countablePersonUsers.filter(u => !u.is_mapped).length

  function autoAccountTypeLabel(user: DirectoryUser): string {
    return user.account_type === 'shared_account' ? 'Auto (Shared)' : 'Auto (Person)'
  }

  function formatClassificationReason(reason?: string): string {
    if (!reason) return ''
    return reason
      .replace(/manual_override:/g, 'manual override ')
      .replace(/_/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  // Sync directory
  async function handleSync() {
    setIsSyncing(true)
    try {
      const res = await fetch('/api/google-workspace/sync', { method: 'POST' })
      if (!res.ok) throw new Error('Sync failed')
      const json = await res.json()
      const result = json.data

      if (result?.success) {
        toast.success(
          `Synced ${result.total_pulled} users (${result.upserted} upserted, ${result.tombstoned} tombstoned)`
        )
        // Refresh users list
        const refreshRes = await fetch('/api/google-workspace/users')
        if (refreshRes.ok) {
          const refreshJson = await refreshRes.json()
          // Re-enrich with mappings
          const mappingsRes = await fetch('/api/google-workspace/mappings/staff')
          const mappingsJson = mappingsRes.ok ? await mappingsRes.json() : { data: { mappings: [] } }
          const mappings = mappingsJson.data?.mappings || []
          const mappingsByGoogleId = new Map(
            mappings.map((m: { google_user_id: string; staff_id: string; staff_name: string | null; staff_avatar_url?: string | null }) => [
              m.google_user_id,
              m,
            ])
          )
          const users = (refreshJson.data?.users || []).map((u: DirectoryUser) => {
            const mapping = mappingsByGoogleId.get(u.google_user_id) as {
              staff_id: string
              staff_name: string | null
              staff_avatar_url?: string | null
            } | undefined
            return {
              ...u,
              staff_id: mapping?.staff_id || null,
              staff_name: mapping?.staff_name || null,
              staff_avatar_url: mapping?.staff_avatar_url || null,
              is_mapped: !!mapping,
            }
          })
          setDirectoryUsers(users)
          setError(null)
        }
        // Refresh sync status
        const statusRes = await fetch('/api/google-workspace/sync/status')
        if (statusRes.ok) {
          const statusJson = await statusRes.json()
          setSyncStatus(normalizeSyncStatus(statusJson.data))
        }
      } else {
        toast.error(result?.error || 'Sync failed')
      }
    } catch (err) {
      console.error('Sync error:', err)
      toast.error('Directory sync failed')
    } finally {
      setIsSyncing(false)
    }
  }

  // Auto-match by email
  async function handleAutoMatch() {
    setIsAutoMatching(true)
    try {
      const res = await fetch('/api/google-workspace/mappings/staff/auto-match', {
        method: 'POST',
      })
      if (!res.ok) throw new Error('Auto-match failed')
      const json = await res.json()
      const result = json.data

      const aliasCount = result.suggested_alias_matches?.length || 0
      const sharedSkipped = result.shared_google_users_skipped || 0
      const approvalCandidates = result.staff_approval_candidates?.length || 0
      const pendingApprovals = result.staff_approvals_queue?.pending || 0
      let msg = `Matched ${result.matched} staff members by email`
      if (aliasCount > 0) {
        msg += ` (${aliasCount} alias suggestions need review)`
      }
      if (sharedSkipped > 0) {
        msg += ` (${sharedSkipped} shared inboxes skipped)`
      }
      if (approvalCandidates > 0) {
        msg += ` (${approvalCandidates} new staff candidates for approval)`
      }
      if (pendingApprovals > 0) {
        msg += ` (${pendingApprovals} pending approvals total)`
      }
      toast.success(msg)

      // Refresh users with mappings
      const refreshRes = await fetch('/api/google-workspace/users')
      const mappingsRes = await fetch('/api/google-workspace/mappings/staff')
      if (refreshRes.ok) {
        const refreshJson = await refreshRes.json()
        const mappingsJson = mappingsRes.ok ? await mappingsRes.json() : { data: { mappings: [] } }
        const mappings = mappingsJson.data?.mappings || []
        const mappingsByGoogleId = new Map(
          mappings.map((m: { google_user_id: string; staff_id: string; staff_name: string | null; staff_avatar_url?: string | null }) => [
            m.google_user_id,
            m,
          ])
        )
        const users = (refreshJson.data?.users || []).map((u: DirectoryUser) => {
          const mapping = mappingsByGoogleId.get(u.google_user_id) as {
            staff_id: string
            staff_name: string | null
            staff_avatar_url?: string | null
          } | undefined
          return {
            ...u,
            staff_id: mapping?.staff_id || null,
            staff_name: mapping?.staff_name || null,
            staff_avatar_url: mapping?.staff_avatar_url || null,
            is_mapped: !!mapping,
          }
        })
        setDirectoryUsers(users)
      }

      const statusRes = await fetch('/api/google-workspace/sync/status')
      if (statusRes.ok) {
        const statusJson = await statusRes.json()
        setSyncStatus(normalizeSyncStatus(statusJson.data))
      }
    } catch (err) {
      console.error('Auto-match error:', err)
      toast.error('Auto-match failed')
    } finally {
      setIsAutoMatching(false)
    }
  }

  // Bootstrap staff records from Google Workspace person accounts
  async function handleBootstrapStaffFromDirectory() {
    setIsBootstrappingStaff(true)
    try {
      // Always refresh directory first so seed uses latest accounts.
      const syncRes = await fetch('/api/google-workspace/sync', { method: 'POST' })
      if (!syncRes.ok) throw new Error('Directory sync failed')
      const syncJson = await syncRes.json()
      const syncResult = syncJson.data
      if (!syncResult?.success) {
        throw new Error(syncResult?.error || 'Directory sync failed')
      }

      const res = await fetch('/api/google-workspace/staff/bootstrap', { method: 'POST' })
      if (!res.ok) throw new Error('Staff bootstrap failed')
      const json = await res.json()
      const result = json.data

      toast.success(
        `Synced ${syncResult.total_pulled || 0} users, created ${result.created_staff || 0} staff, linked ${result.mapped_existing_staff || 0} existing`
      )

      // Refresh users with mappings
      const refreshRes = await fetch('/api/google-workspace/users')
      const mappingsRes = await fetch('/api/google-workspace/mappings/staff')
      if (refreshRes.ok) {
        const refreshJson = await refreshRes.json()
        const mappingsJson = mappingsRes.ok ? await mappingsRes.json() : { data: { mappings: [] } }
        const mappings = mappingsJson.data?.mappings || []
        const mappingsByGoogleId = new Map(
          mappings.map((m: { google_user_id: string; staff_id: string; staff_name: string | null; staff_avatar_url?: string | null }) => [
            m.google_user_id,
            m,
          ])
        )
        const users = (refreshJson.data?.users || []).map((u: DirectoryUser) => {
          const mapping = mappingsByGoogleId.get(u.google_user_id) as {
            staff_id: string
            staff_name: string | null
            staff_avatar_url?: string | null
          } | undefined
          return {
            ...u,
            staff_id: mapping?.staff_id || null,
            staff_name: mapping?.staff_name || null,
            staff_avatar_url: mapping?.staff_avatar_url || null,
            is_mapped: !!mapping,
          }
        })
        setDirectoryUsers(users)
      }

      // Refresh staff list
      const all: Array<{ id: string; full_name: string; email: string; status?: string | null }> = []
      const pageSize = 100
      let offset = 0
      let hasMore = true
      while (hasMore) {
        const staffRes = await fetch(`/api/staff?limit=${pageSize}&offset=${offset}`)
        if (!staffRes.ok) break
        const staffJson = await staffRes.json()
        const list = staffJson.data?.staff || staffJson.staff || []
        all.push(...list)
        hasMore = Boolean(staffJson.data?.has_more)
        offset += pageSize
      }
      setStaffMembers(
        all.map((s: { id: string; full_name: string; email: string; status?: string | null }) => ({
          id: s.id,
          full_name: s.full_name,
          email: s.email,
          status: s.status ?? null,
        }))
      )

      // Refresh sync status
      const statusRes = await fetch('/api/google-workspace/sync/status')
      if (statusRes.ok) {
        const statusJson = await statusRes.json()
        setSyncStatus(normalizeSyncStatus(statusJson.data))
      }
    } catch (err) {
      console.error('Staff bootstrap error:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to seed staff from Google Workspace')
    } finally {
      setIsBootstrappingStaff(false)
    }
  }

  // Enrich staff from directory
  async function handleEnrichStaff() {
    setIsEnriching(true)
    try {
      const res = await fetch('/api/google-workspace/enrich-staff', { method: 'POST' })
      if (!res.ok) throw new Error('Enrichment failed')
      const json = await res.json()
      const result = json.data

      const fields = result.fields_updated
      const parts: string[] = []
      if (fields.title > 0) parts.push(`${fields.title} titles`)
      if (fields.phone > 0) parts.push(`${fields.phone} phones`)
      if (fields.avatar_url > 0) parts.push(`${fields.avatar_url} avatars`)

      toast.success(
        `Enriched ${result.enriched} staff records${parts.length > 0 ? ` (${parts.join(', ')})` : ''}`
      )
    } catch (err) {
      console.error('Enrich error:', err)
      toast.error('Failed to enrich staff profiles')
    } finally {
      setIsEnriching(false)
    }
  }

  // Save individual mapping
  async function handleSaveMapping(googleUserId: string) {
    const staffId = selectedStaff[googleUserId]
    if (!staffId) return

    setSavingUserId(googleUserId)
    try {
      const user = directoryUsers.find(u => u.google_user_id === googleUserId)
      const res = await fetch('/api/google-workspace/mappings/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_id: staffId,
          google_user_id: googleUserId,
          primary_email: user?.primary_email,
        }),
      })

      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error?.message || 'Failed to save mapping')
      }

      const staff = staffMembers.find(s => s.id === staffId)
      setDirectoryUsers(prev =>
        prev.map(u =>
          u.google_user_id === googleUserId
            ? { ...u, is_mapped: true, staff_id: staffId, staff_name: staff?.full_name || null }
            : u
        )
      )
      setSelectedStaff(prev => {
        const next = { ...prev }
        delete next[googleUserId]
        return next
      })
      toast.success('Mapping saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSavingUserId(null)
    }
  }

  // Delete mapping
  async function handleDeleteMapping(googleUserId: string) {
    try {
      const mappingsRes = await fetch('/api/google-workspace/mappings/staff')
      if (!mappingsRes.ok) throw new Error('Failed to fetch mappings')
      const mappingsJson = await mappingsRes.json()
      const mapping = (mappingsJson.data?.mappings || []).find(
        (m: { google_user_id: string }) => m.google_user_id === googleUserId
      )

      if (!mapping) throw new Error('Mapping not found')

      const res = await fetch('/api/google-workspace/mappings/staff', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ google_user_id: googleUserId }),
      })
      if (!res.ok) throw new Error('Failed to delete mapping')

      setDirectoryUsers(prev =>
        prev.map(u =>
          u.google_user_id === googleUserId
            ? { ...u, is_mapped: false, staff_id: null, staff_name: null }
            : u
        )
      )
      toast.success('Mapping removed')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove')
    }
  }

  async function handleSetAccountTypeOverride(
    googleUserId: string,
    accountTypeOverride: 'auto' | 'person' | 'shared_account'
  ) {
    setClassificationSavingUserId(googleUserId)
    try {
      const res = await fetch('/api/google-workspace/users/classification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          google_user_id: googleUserId,
          account_type_override: accountTypeOverride,
        }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => null)
        throw new Error(json?.error?.message || 'Failed to update account type')
      }

      const json = await res.json()
      const updated = json.data as {
        account_type: 'person' | 'shared_account'
        account_type_reason: string
        account_type_overridden: boolean
        account_type_override: 'person' | 'shared_account' | null
      }

      setDirectoryUsers(prev =>
        prev.map(u =>
          u.google_user_id === googleUserId
            ? {
                ...u,
                account_type: updated.account_type,
                account_type_reason: updated.account_type_reason,
                account_type_overridden: updated.account_type_overridden,
                account_type_override: updated.account_type_override,
              }
            : u
        )
      )

      if (updated.account_type === 'shared_account') {
        setSelectedStaff(prev => {
          const next = { ...prev }
          delete next[googleUserId]
          return next
        })
      }

      const statusRes = await fetch('/api/google-workspace/sync/status')
      if (statusRes.ok) {
        const statusJson = await statusRes.json()
        setSyncStatus(normalizeSyncStatus(statusJson.data))
      }

      toast.success(
        accountTypeOverride === 'auto'
          ? 'Account type reset to auto'
          : `Account set to ${accountTypeOverride === 'person' ? 'person' : 'shared inbox'}`
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update account type')
    } finally {
      setClassificationSavingUserId(null)
    }
  }

  const isLoading = isLoadingUsers || isLoadingStaff

  if (isLoading) {
    return (
      <div className="space-y-4">
        <ShimmerGrid variant="grid" rows={1} columns={4} cellHeight={48} gap={12} />
        <ShimmerGrid variant="grid" rows={1} columns={3} cellHeight={28} gap={8} />
        <div className="border rounded-lg overflow-hidden">
          <ShimmerGrid variant="list" rows={8} cellHeight={52} gap={0} />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center py-12 text-center space-y-3">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-muted-foreground">{error}</p>
        <Button variant="outline" size="sm" onClick={handleSync}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Sync Directory Now
        </Button>
      </div>
    )
  }

  if (directoryUsers.length === 0) {
    return (
      <div className="flex flex-col items-center py-12 text-center space-y-3">
        <Users className="h-8 w-8 text-muted-foreground" />
        <p className="text-muted-foreground">No directory users found. Sync the directory first.</p>
        <Button onClick={handleSync} disabled={isSyncing}>
          {isSyncing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Syncing...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Sync Directory
            </>
          )}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Sync Status */}
      {syncStatus && (
        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-muted-foreground">Directory Snapshot</h4>
            {syncStatus.last_sync_at && (
              <span className="text-xs text-muted-foreground">
                Last synced: {new Date(syncStatus.last_sync_at).toLocaleString()}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard icon={<Users className="h-4 w-4" />} label="People" count={syncStatus.active_people ?? countablePersonUsers.length} color="text-blue-600" bgColor="bg-blue-500/10" />
            <StatCard icon={<UserX className="h-4 w-4" />} label="Suspended" count={syncStatus.suspended} color="text-orange-600" bgColor="bg-orange-500/10" />
            <StatCard icon={<Shield className="h-4 w-4" />} label="Mappings" count={syncStatus.mappings} color="text-green-600" bgColor="bg-green-500/10" />
            <StatCard icon={<UserX className="h-4 w-4" />} label="Shared" count={syncStatus.active_shared ?? activeSharedUsers.length} color="text-red-500" bgColor="bg-red-500/10" />
          </div>
        </div>
      )}

      {/* Mapping Stats + Actions */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Badge variant="outline">{countablePersonUsers.length} active staff users</Badge>
          <Badge variant="secondary" className="bg-green-500/10 text-green-600">
            {mappedCount} mapped
          </Badge>
          <Badge variant="secondary" className="bg-orange-500/10 text-orange-600">
            {unmappedCount} unmapped
          </Badge>
          <Badge variant="secondary" className="bg-amber-500/10 text-amber-500">
            {activeSharedUsers.length} shared inboxes
          </Badge>
          <Badge variant="secondary" className="bg-indigo-500/10 text-indigo-500">
            {syncStatus?.pending_staff_approvals ?? 0} pending approvals
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleSync} disabled={isSyncing || isBootstrappingStaff} variant="outline" size="sm">
            {isSyncing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Refreshing...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Directory
              </>
            )}
          </Button>
          <Button onClick={handleEnrichStaff} disabled={isEnriching || mappedCount === 0} variant="outline" size="sm">
            {isEnriching ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enriching...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Enrich profiles
              </>
            )}
          </Button>
          <Button onClick={handleAutoMatch} disabled={isAutoMatching || isBootstrappingStaff} variant="outline" size="sm">
            {isAutoMatching ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Matching...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Auto-match by email
              </>
            )}
          </Button>
          <Button onClick={handleBootstrapStaffFromDirectory} disabled={isBootstrappingStaff || isAutoMatching || isSyncing} size="sm">
            {isBootstrappingStaff ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Seeding staff...
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4 mr-2" />
                Seed Staff
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Select value={filter} onValueChange={(v) => setFilter(v as FilterType)}>
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Active</SelectItem>
            <SelectItem value="mapped">Mapped</SelectItem>
            <SelectItem value="unmapped">Unmapped</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
            <SelectItem value="shared">Shared Inboxes</SelectItem>
            <SelectItem value="admin">Admins</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* User list */}
      <div className="border rounded-lg divide-y max-h-[500px] overflow-y-auto dark:border-border/60 dark:ring-1 dark:ring-white/[0.06]">
        {filteredUsers.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No users match your search</div>
        ) : (
          visibleUsers.map((user) => {
            const isSaving = savingUserId === user.google_user_id
            const isClassificationSaving = classificationSavingUserId === user.google_user_id
            const selectedId = selectedStaff[user.google_user_id]

            return (
              <motion.div
                key={user.google_user_id}
                initial={false}
                animate={{
                  backgroundColor: user.is_mapped ? 'rgba(34, 197, 94, 0.05)' : 'transparent',
                }}
                transition={{ duration: 0.2, ease: easeOut }}
                className="flex items-center gap-3 p-3 hover:bg-muted/50"
              >
                {/* Avatar */}
                <DirectoryAvatar
                  name={user.full_name || user.primary_email}
                  primarySrc={user.staff_avatar_url || null}
                  fallbackSrc={user.thumbnail_photo_url}
                />

                {/* User info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {user.is_mapped ? (
                      <Link2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                    ) : (
                      <Unlink className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
                    )}
                    <span className="font-medium truncate">{user.full_name || user.primary_email}</span>
                    {user.title && (
                      <span className="text-xs text-muted-foreground truncate hidden lg:inline">
                        {user.title}
                      </span>
                    )}
                    {user.is_admin && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 flex-shrink-0">
                        Admin
                      </span>
                    )}
                    {user.account_type === 'shared_account' && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-500 flex-shrink-0">
                        Shared inbox
                      </span>
                    )}
                    {user.account_type_overridden && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-500 flex-shrink-0">
                        Override
                      </span>
                    )}
                    {user.is_suspended && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-500 flex-shrink-0">
                        Suspended
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-6">
                    <span className="text-xs text-muted-foreground truncate">{user.primary_email}</span>
                    {user.org_unit_path && user.org_unit_path !== '/' && (
                      <span className="text-[10px] text-muted-foreground/70 truncate hidden md:inline">
                        {user.org_unit_path}
                      </span>
                    )}
                    {user.account_type_reason && (
                      <span className="text-[10px] text-muted-foreground/70 truncate hidden xl:inline">
                        {user.account_type_overridden ? 'Manual:' : 'Auto:'}{' '}
                        {formatClassificationReason(user.account_type_reason)}
                      </span>
                    )}
                  </div>
                  {user.is_mapped && user.staff_name && (
                    <p className="text-sm text-muted-foreground ml-6 truncate">
                      &rarr; {user.staff_name}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Select
                    value={user.account_type_override || 'auto'}
                    onValueChange={(v) =>
                      handleSetAccountTypeOverride(
                        user.google_user_id,
                        v as 'auto' | 'person' | 'shared_account'
                      )
                    }
                    disabled={isClassificationSaving}
                  >
                    <SelectTrigger className="w-[130px] h-8 text-sm">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">{autoAccountTypeLabel(user)}</SelectItem>
                      <SelectItem value="person">Person</SelectItem>
                      <SelectItem value="shared_account">Shared</SelectItem>
                    </SelectContent>
                  </Select>
                  {user.is_mapped ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDeleteMapping(user.google_user_id)}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Remove
                    </Button>
                  ) : !user.is_suspended && user.account_type !== 'shared_account' ? (
                    <>
                      <Select
                        value={selectedId || ''}
                        onValueChange={(v) =>
                          setSelectedStaff(prev => ({ ...prev, [user.google_user_id]: v }))
                        }
                      >
                        <SelectTrigger className="w-[180px] h-8 text-sm">
                          <SelectValue placeholder="Select staff..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                          {staffMembers
                            .filter(s => !mappedStaffIds.has(s.id) && isStaffEligibleForAutoMapping(s.status))
                            .map(s => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.full_name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        className="h-8"
                        disabled={!selectedId || isSaving}
                        onClick={() => handleSaveMapping(user.google_user_id)}
                      >
                        {isSaving ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4" />
                        )}
                      </Button>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {user.account_type === 'shared_account' ? 'Shared account' : 'Suspended'}
                    </span>
                  )}
                </div>
              </motion.div>
            )
          })
        )}

        {hasMore && (
          <button
            onClick={() => setVisibleCount(prev => prev + PAGE_SIZE)}
            className="w-full p-3 text-sm text-muted-foreground hover:bg-muted/50 flex items-center justify-center gap-2"
          >
            <ChevronDown className="h-4 w-4" />
            Load more ({filteredUsers.length - visibleCount} remaining)
          </button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Map Google Workspace directory users to Sophie Hub staff members. Use auto-match to bulk-match
        by email address. After mapping, use &ldquo;Enrich profiles&rdquo; to pull job titles, phone numbers,
        and avatar photos into staff records.
      </p>
    </div>
  )
}

function StatCard({
  icon,
  label,
  count,
  color,
  bgColor,
}: {
  icon: React.ReactNode
  label: string
  count: number
  color: string
  bgColor: string
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg p-2.5">
      <div className={`flex h-8 w-8 items-center justify-center rounded-md ${bgColor} ${color} flex-shrink-0`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-lg font-bold tabular-nums leading-tight">{count}</p>
        <p className="text-[11px] text-muted-foreground leading-tight">{label}</p>
      </div>
    </div>
  )
}

function DirectoryAvatar({
  name,
  primarySrc,
  fallbackSrc,
}: {
  name: string
  primarySrc: string | null
  fallbackSrc: string | null
}) {
  const [primaryBroken, setPrimaryBroken] = useState(false)
  const [fallbackBroken, setFallbackBroken] = useState(false)

  if (primarySrc && !primaryBroken) {
    return (
      // Preferred avatar (staff profile, typically Slack-derived)
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={primarySrc}
        alt=""
        className="h-8 w-8 rounded-full flex-shrink-0 object-cover"
        onError={() => setPrimaryBroken(true)}
      />
    )
  }

  if (fallbackSrc && !fallbackBroken) {
    return (
      // Fallback: Google Workspace directory photo
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={fallbackSrc}
        alt=""
        className="h-8 w-8 rounded-full flex-shrink-0 object-cover"
        onError={() => setFallbackBroken(true)}
      />
    )
  }

  return (
    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
      <span className="text-xs font-medium text-muted-foreground">
        {name.charAt(0).toUpperCase()}
      </span>
    </div>
  )
}
