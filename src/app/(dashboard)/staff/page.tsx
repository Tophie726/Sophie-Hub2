'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { Users, Plus, Database, ChevronRight, Loader2 } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ShimmerGrid } from '@/components/ui/shimmer-grid'
import { EntityListToolbar } from '@/components/entities/entity-list-toolbar'
import { StatusBadge } from '@/components/entities/status-badge'
import { useDebounce } from '@/lib/hooks/use-debounce'
import type { StaffListItem } from '@/types/entities'

const statusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'on_leave', label: 'On Leave' },
  { value: 'offboarding', label: 'Offboarding' },
  { value: 'departed', label: 'Departed' },
]

const sortOptions = [
  { value: 'full_name', label: 'Name' },
  { value: 'created_at', label: 'Date Added' },
  { value: 'role', label: 'Role' },
  { value: 'hire_date', label: 'Hire Date' },
]

function formatRole(role: string | null): string {
  if (!role) return '--'
  return role
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

function StaffRow({ staff }: { staff: StaffListItem }) {
  const clientInfo = staff.max_clients
    ? `${staff.current_client_count || 0}/${staff.max_clients}`
    : `${staff.current_client_count || 0}`

  return (
    <Link href={`/staff/${staff.id}`}>
      <div className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/30 transition-colors cursor-pointer">
        {/* Name + code */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">{staff.full_name}</span>
            {staff.staff_code && (
              <span className="hidden sm:inline text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
                {staff.staff_code}
              </span>
            )}
          </div>
          {/* Mobile: show role below name */}
          <div className="md:hidden text-xs text-muted-foreground mt-0.5 truncate">
            {formatRole(staff.role)}
            {staff.department ? ` · ${staff.department}` : ''}
          </div>
        </div>

        {/* Role */}
        <div className="w-32 hidden md:block text-sm text-muted-foreground truncate">
          {formatRole(staff.role)}
        </div>

        {/* Department */}
        <div className="w-28 hidden lg:block text-sm text-muted-foreground truncate">
          {staff.department || '--'}
        </div>

        {/* Status */}
        <div className="w-24 hidden md:block">
          <StatusBadge status={staff.status} entity="staff" />
        </div>

        {/* Client count */}
        <div className="w-16 hidden md:block text-sm text-muted-foreground tabular-nums text-right">
          {clientInfo}
        </div>

        {/* Services */}
        <div className="w-36 hidden xl:block">
          {staff.services && staff.services.length > 0 ? (
            <div className="flex gap-1 overflow-hidden">
              {staff.services.slice(0, 2).map((s, i) => (
                <span
                  key={i}
                  className="inline-flex px-1.5 py-0.5 text-[10px] rounded bg-muted text-muted-foreground truncate max-w-[70px]"
                >
                  {s.replace(/_/g, ' ')}
                </span>
              ))}
              {staff.services.length > 2 && (
                <span className="text-[10px] text-muted-foreground">
                  +{staff.services.length - 2}
                </span>
              )}
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">--</span>
          )}
        </div>

        {/* Mobile status + chevron */}
        <div className="flex md:hidden items-center gap-2 shrink-0">
          <StatusBadge status={staff.status} entity="staff" />
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
    </Link>
  )
}

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [sort, setSort] = useState('full_name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)

  const debouncedSearch = useDebounce(search, 300)

  const fetchStaff = useCallback(async (append = false, currentOffset = 0) => {
    if (append) {
      setLoadingMore(true)
    } else {
      setLoading(true)
    }

    try {
      const params = new URLSearchParams()
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (statusFilter.length) params.set('status', statusFilter.join(','))
      params.set('sort', sort)
      params.set('order', sortOrder)
      params.set('limit', '50')
      params.set('offset', String(append ? currentOffset : 0))

      const res = await fetch(`/api/staff?${params}`)
      const json = await res.json()
      const data = json.data

      if (data) {
        if (append) {
          setStaff(prev => [...prev, ...data.staff])
        } else {
          setStaff(data.staff)
        }
        setTotal(data.total)
        setHasMore(data.has_more)
      }
    } catch (error) {
      console.error('Failed to fetch staff:', error)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [debouncedSearch, statusFilter, sort, sortOrder])

  useEffect(() => {
    fetchStaff(false)
  }, [fetchStaff])

  const handleLoadMore = () => {
    fetchStaff(true, staff.length)
  }

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Staff"
        description={total > 0 ? `${total} team members` : 'View and manage team members'}
      >
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Add Staff</span>
        </Button>
      </PageHeader>

      <EntityListToolbar
        search={search}
        onSearchChange={setSearch}
        statusOptions={statusOptions}
        selectedStatuses={statusFilter}
        onStatusChange={setStatusFilter}
        sortOptions={sortOptions}
        currentSort={sort}
        sortOrder={sortOrder}
        onSortChange={(s, o) => { setSort(s); setSortOrder(o) }}
        resultCount={staff.length}
        totalCount={total}
        placeholder="Search name, email, or code..."
      />

      <div className="p-6 md:p-8">
        {loading ? (
          <div className="rounded-xl border bg-card p-1">
            <ShimmerGrid variant="table" rows={10} columns={5} />
          </div>
        ) : staff.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-green-500/10 mb-6">
                <Users className="h-8 w-8 text-green-500" />
              </div>
              <h2 className="text-xl font-semibold mb-2">
                {debouncedSearch || statusFilter.length > 0
                  ? 'No staff match your filters'
                  : 'No staff members yet'}
              </h2>
              <p className="text-muted-foreground text-center max-w-md mb-6">
                {debouncedSearch || statusFilter.length > 0
                  ? 'Try adjusting your search or filters to find what you\'re looking for.'
                  : 'Staff members will appear here as you map fields through Data Enrichment. Connect a Google Sheet, map your columns, and sync — data flows in automatically.'}
              </p>
              {!debouncedSearch && statusFilter.length === 0 && (
                <Link href="/admin/data-enrichment">
                  <Button className="gap-2">
                    <Database className="h-4 w-4" />
                    Set Up Data Enrichment
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="rounded-xl border bg-card divide-y divide-border/60">
              {/* Header row — desktop only */}
              <div className="hidden md:flex items-center px-5 py-2.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                <div className="flex-1 min-w-0">Name</div>
                <div className="w-32">Role</div>
                <div className="w-28 hidden lg:block">Department</div>
                <div className="w-24">Status</div>
                <div className="w-16 text-right">Clients</div>
                <div className="w-36 hidden xl:block">Services</div>
              </div>
              {staff.map(member => (
                <StaffRow key={member.id} staff={member} />
              ))}
            </div>

            {hasMore && (
              <div className="flex justify-center mt-6">
                <Button
                  variant="outline"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="gap-2"
                >
                  {loadingMore ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  Load More
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
