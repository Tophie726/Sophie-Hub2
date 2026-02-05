'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Building2,
  Loader2,
  Users,
  Package,
  CalendarDays,
  DollarSign,
  Contact,
  LayoutDashboard,
  Calendar,
  RefreshCw,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/entities/status-badge'
import { TierBadge } from '@/components/entities/tier-badge'
import { FieldGroupSection } from '@/components/entities/field-group-section'
import { StaffAssignmentCard } from '@/components/entities/staff-assignment-card'
import { WeeklyStatusTab } from '@/components/partners/weekly-status-tab'
import { BigQueryDataPanel } from '@/components/data-enrichment/bigquery/bigquery-data-panel'
import type { PartnerDetail } from '@/types/entities'
import type { FieldLineageMap } from '@/types/lineage'

type TabId = 'overview' | 'weekly'

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="h-4 w-4" /> },
  { id: 'weekly', label: 'Weekly Status', icon: <Calendar className="h-4 w-4" /> },
]

export default function PartnerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()

  // Initialize tab from URL query param, default to 'overview'
  const initialTab = (searchParams.get('tab') as TabId) || 'overview'
  const validTab = TABS.some(t => t.id === initialTab) ? initialTab : 'overview'

  const [partner, setPartner] = useState<PartnerDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>(validTab)
  const [isSyncing, setIsSyncing] = useState(false)

  const fetchPartner = useCallback(async () => {
    try {
      const res = await fetch(`/api/partners/${id}`)
      const json = await res.json()

      if (!res.ok) {
        setError(json.error?.message || 'Failed to load partner')
        return
      }

      setPartner(json.data?.partner || null)
    } catch (err) {
      console.error('Failed to fetch partner:', err)
      setError('Failed to load partner')
    } finally {
      setLoading(false)
    }
  }, [id])

  // Sync this partner's data from the source sheet
  const handleSync = async () => {
    if (!id || isSyncing) return

    setIsSyncing(true)
    try {
      const res = await fetch(`/api/partners/${id}/sync`, { method: 'POST' })
      const json = await res.json()

      if (!res.ok) {
        toast.error(json.error?.message || 'Sync failed')
        return
      }

      const data = json.data
      if (data?.synced) {
        toast.success(data.message || 'Partner synced successfully')
        // Refresh partner data
        await fetchPartner()
      } else {
        toast.warning(data?.message || 'Partner not found in source sheet')
      }
    } catch (err) {
      console.error('Sync failed:', err)
      toast.error('Failed to sync partner')
    } finally {
      setIsSyncing(false)
    }
  }

  useEffect(() => {
    if (id) fetchPartner()
  }, [id, fetchPartner])

  if (loading) {
    return (
      <div className="min-h-screen">
        <PageHeader title="Partner" />
        <div className="flex items-center justify-center py-32">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (error || !partner) {
    return (
      <div className="min-h-screen">
        <PageHeader title="Partner" />
        <div className="flex flex-col items-center justify-center py-32 gap-4">
          <Building2 className="h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">{error || 'Partner not found'}</p>
          <Link href="/partners">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Partners
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <PageHeader
        title={partner.brand_name}
        description={partner.partner_code || undefined}
      >
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSync}
            disabled={isSyncing || loading}
            className="h-8 w-8 p-0"
            title="Sync from all data sources"
          >
            <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
          </Button>
          <StatusBadge status={partner.status} entity="partners" />
          <TierBadge tier={partner.tier} />
        </div>
      </PageHeader>

      <div className="p-6 md:p-8">
        {/* Back link */}
        <Link
          href="/partners"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          All Partners
        </Link>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1 mb-6 w-fit">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                relative flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors
                ${activeTab === tab.id
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
                }
              `}
            >
              {activeTab === tab.id && (
                <motion.div
                  layoutId="partnerTabIndicator"
                  className="absolute inset-0 bg-background shadow-sm rounded-md"
                  transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                {tab.icon}
                {tab.label}
              </span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="max-w-4xl">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Core Info */}
              <FieldGroupSection
                title="Core Info"
                icon={<Building2 className="h-4 w-4 text-muted-foreground" />}
                lineageMap={partner.lineage as FieldLineageMap | undefined}
                fields={[
                  { label: 'Brand Name', value: partner.brand_name, fieldKey: 'brand_name' },
                  { label: 'Partner Code', value: partner.partner_code, fieldKey: 'partner_code' },
                  { label: 'Status', value: partner.status, fieldKey: 'status' },
                  { label: 'Tier', value: partner.tier, fieldKey: 'tier' },
                  { label: 'Notes', value: partner.notes, fieldKey: 'notes' },
                ]}
              />

              {/* Contact */}
              <FieldGroupSection
                title="Contact"
                icon={<Contact className="h-4 w-4 text-muted-foreground" />}
                lineageMap={partner.lineage as FieldLineageMap | undefined}
                fields={[
                  { label: 'Client Name', value: partner.client_name, fieldKey: 'client_name' },
                  { label: 'Client Email', value: partner.client_email, type: 'email', fieldKey: 'client_email' },
                  { label: 'Client Phone', value: partner.client_phone, type: 'phone', fieldKey: 'client_phone' },
                ]}
              />

              {/* Financial */}
              <FieldGroupSection
                title="Financial"
                icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
                lineageMap={partner.lineage as FieldLineageMap | undefined}
                fields={[
                  { label: 'Base Fee', value: partner.base_fee, type: 'currency', fieldKey: 'base_fee' },
                  { label: 'Commission Rate', value: partner.commission_rate, type: 'percent', fieldKey: 'commission_rate' },
                  { label: 'Billing Day', value: partner.billing_day, type: 'number', fieldKey: 'billing_day' },
                ]}
              />

              {/* Dates */}
              <FieldGroupSection
                title="Dates"
                icon={<CalendarDays className="h-4 w-4 text-muted-foreground" />}
                lineageMap={partner.lineage as FieldLineageMap | undefined}
                fields={[
                  { label: 'Onboarding Date', value: partner.onboarding_date, type: 'date', fieldKey: 'onboarding_date' },
                  { label: 'Contract Start', value: partner.contract_start_date, type: 'date', fieldKey: 'contract_start_date' },
                  { label: 'Contract End', value: partner.contract_end_date, type: 'date', fieldKey: 'contract_end_date' },
                  { label: 'Churned Date', value: partner.churned_date, type: 'date', fieldKey: 'churned_date' },
                ]}
              />

              {/* Metrics */}
              <FieldGroupSection
                title="Metrics"
                icon={<Package className="h-4 w-4 text-muted-foreground" />}
                lineageMap={partner.lineage as FieldLineageMap | undefined}
                fields={[
                  { label: 'Parent ASINs', value: partner.parent_asin_count, type: 'number', fieldKey: 'parent_asin_count' },
                  { label: 'Child ASINs', value: partner.child_asin_count, type: 'number', fieldKey: 'child_asin_count' },
                ]}
              />

              {/* Staff Assignments */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    Staff Assignments
                    {partner.assignments.length > 0 && (
                      <span className="text-xs text-muted-foreground font-normal">
                        ({partner.assignments.length})
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {partner.assignments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No staff assigned yet</p>
                  ) : (
                    <div className="space-y-2">
                      {partner.assignments.map(assignment => (
                        <StaffAssignmentCard
                          key={assignment.id}
                          assignment={assignment}
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* ASINs */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    ASINs
                    {partner.asins.length > 0 && (
                      <span className="text-xs text-muted-foreground font-normal">
                        ({partner.asins.length})
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {partner.asins.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No ASINs linked</p>
                  ) : (
                    <div className="divide-y divide-border/60 -mx-6 px-6">
                      {partner.asins.map(asin => (
                        <div key={asin.id} className="flex items-center gap-3 py-2.5">
                          <code className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {asin.asin_code}
                          </code>
                          <span className="text-sm truncate flex-1">
                            {asin.title || 'Untitled'}
                          </span>
                          {asin.is_parent && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 border border-blue-500/20">
                              Parent
                            </span>
                          )}
                          {asin.status && (
                            <span className="text-[10px] text-muted-foreground">
                              {asin.status}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* BigQuery Data */}
              <BigQueryDataPanel partnerId={id} />
            </div>
          )}

          {activeTab === 'weekly' && (
            <WeeklyStatusTab
              statuses={partner.recent_statuses}
              sourceData={partner.source_data as Record<string, Record<string, Record<string, unknown>>> | null | undefined}
            />
          )}
        </div>
      </div>
    </div>
  )
}
