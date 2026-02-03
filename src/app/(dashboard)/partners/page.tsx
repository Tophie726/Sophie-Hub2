'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { Building2, Plus, Database, ChevronRight, Loader2 } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ShimmerGrid } from '@/components/ui/shimmer-grid'
import { EntityListToolbar } from '@/components/entities/entity-list-toolbar'
import { StatusBadge } from '@/components/entities/status-badge'
import { TierBadge } from '@/components/entities/tier-badge'
import { useDebounce } from '@/lib/hooks/use-debounce'
import { cn } from '@/lib/utils'
import type { PartnerListItem } from '@/types/entities'

const statusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'paused', label: 'Paused' },
  { value: 'at_risk', label: 'At Risk' },
  { value: 'offboarding', label: 'Offboarding' },
  { value: 'churned', label: 'Churned' },
]

const sortOptions = [
  { value: 'brand_name', label: 'Brand Name' },
  { value: 'created_at', label: 'Date Added' },
  { value: 'onboarding_date', label: 'Onboarding Date' },
  { value: 'tier', label: 'Tier' },
]

function PartnerRow({ partner }: { partner: PartnerListItem }) {
  const asinCount = (partner.parent_asin_count || 0) + (partner.child_asin_count || 0)

  return (
    <Link href={`/partners/${partner.id}`}>
      <div className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/30 transition-colors cursor-pointer">
        {/* Brand name + code */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">{partner.brand_name}</span>
            {partner.partner_code && (
              <span className="hidden sm:inline text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
                {partner.partner_code}
              </span>
            )}
          </div>
          {/* Mobile: show client name below brand */}
          <div className="md:hidden text-xs text-muted-foreground mt-0.5 truncate">
            {partner.client_name || 'No client contact'}
          </div>
        </div>

        {/* Status */}
        <div className="w-24 hidden md:block">
          <StatusBadge status={partner.status} entity="partners" />
        </div>

        {/* Tier */}
        <div className="w-20 hidden md:block">
          <TierBadge tier={partner.tier} />
        </div>

        {/* Client name */}
        <div className="w-32 hidden lg:block text-sm text-muted-foreground truncate">
          {partner.client_name || '--'}
        </div>

        {/* Pod leader */}
        <div className="w-32 hidden lg:block text-sm text-muted-foreground truncate">
          {partner.pod_leader?.full_name || '--'}
        </div>

        {/* ASIN count */}
        <div className="w-16 hidden md:block text-sm text-muted-foreground tabular-nums text-right">
          {asinCount > 0 ? asinCount : '--'}
        </div>

        {/* Onboarding date */}
        <div className="w-28 hidden xl:block text-sm text-muted-foreground text-right">
          {partner.onboarding_date
            ? format(parseISO(partner.onboarding_date), 'MMM d, yyyy')
            : '--'}
        </div>

        {/* Mobile status + chevron */}
        <div className="flex md:hidden items-center gap-2 shrink-0">
          <StatusBadge status={partner.status} entity="partners" />
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
    </Link>
  )
}

export default function PartnersPage() {
  const [partners, setPartners] = useState<PartnerListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [sort, setSort] = useState('brand_name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)

  const debouncedSearch = useDebounce(search, 300)

  const fetchPartners = useCallback(async (append = false, currentOffset = 0) => {
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

      const res = await fetch(`/api/partners?${params}`)
      const json = await res.json()
      const data = json.data

      if (data) {
        if (append) {
          setPartners(prev => [...prev, ...data.partners])
        } else {
          setPartners(data.partners)
        }
        setTotal(data.total)
        setHasMore(data.has_more)
      }
    } catch (error) {
      console.error('Failed to fetch partners:', error)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [debouncedSearch, statusFilter, sort, sortOrder])

  // Fetch on filter/search/sort change
  useEffect(() => {
    fetchPartners(false)
  }, [fetchPartners])

  const handleLoadMore = () => {
    fetchPartners(true, partners.length)
  }

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Partners"
        description={total > 0 ? `${total} partner brands` : 'View and manage all partner brands'}
      >
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Add Partner</span>
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
        resultCount={partners.length}
        totalCount={total}
        placeholder="Search brand, client, or code..."
      />

      <div className="p-6 md:p-8">
        {loading ? (
          <div className="rounded-xl border bg-card p-1">
            <ShimmerGrid variant="table" rows={10} columns={6} />
          </div>
        ) : partners.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500/10 mb-6">
                <Building2 className="h-8 w-8 text-blue-500" />
              </div>
              <h2 className="text-xl font-semibold mb-2">
                {debouncedSearch || statusFilter.length > 0
                  ? 'No partners match your filters'
                  : 'No partners yet'}
              </h2>
              <p className="text-muted-foreground text-center max-w-md mb-6">
                {debouncedSearch || statusFilter.length > 0
                  ? 'Try adjusting your search or filters to find what you\'re looking for.'
                  : 'Partners will appear here as you map fields through Data Enrichment. Connect a Google Sheet, map your columns, and sync — data flows in automatically.'}
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
              <div className="hidden md:flex items-center gap-4 px-5 py-2.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                <div className="flex-1 min-w-0">Brand</div>
                <div className="w-24">Status</div>
                <div className="w-20">Tier</div>
                <div className="w-32 hidden lg:block">Client</div>
                <div className="w-32 hidden lg:block">Pod Leader</div>
                <div className="w-16 text-right">ASINs</div>
                <div className="w-28 hidden xl:block text-right">Onboarded</div>
              </div>
              {partners.map(partner => (
                <PartnerRow key={partner.id} partner={partner} />
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
