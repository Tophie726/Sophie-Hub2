'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Users,
  Loader2,
  Building2,
  Contact,
  Briefcase,
  BarChart3,
  CalendarDays,
  Link2,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/entities/status-badge'
import { FieldGroupSection } from '@/components/entities/field-group-section'
import { PartnerAssignmentCard } from '@/components/entities/partner-assignment-card'
import { useStaffDetailQuery } from '@/lib/hooks/use-staff-query'
import type { StaffDetail } from '@/types/entities'
import type { FieldLineageMap } from '@/types/lineage'

function formatRole(role: string | null): string {
  if (!role) return ''
  return role
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function extractGoogleSnapshotDate(
  sourceData: Record<string, unknown> | null | undefined,
  key: 'last_login_time' | 'last_seen_at'
): string | null {
  if (!isRecord(sourceData)) return null
  const googleWorkspace = sourceData.google_workspace
  if (!isRecord(googleWorkspace)) return null
  const snapshot = googleWorkspace.directory_snapshot
  if (!isRecord(snapshot)) return null
  const raw = snapshot[key]
  return typeof raw === 'string' && raw.trim().length > 0 ? raw : null
}

export default function StaffDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: staff, isLoading: loading, error: queryError } = useStaffDetailQuery(id) as {
    data: StaffDetail | null | undefined
    isLoading: boolean
    error: Error | null
  }
  const error = queryError?.message || null
  const gwsLastLogin = extractGoogleSnapshotDate(staff?.source_data, 'last_login_time')
  const gwsLastSeen = extractGoogleSnapshotDate(staff?.source_data, 'last_seen_at')

  if (loading) {
    return (
      <div className="min-h-screen">
        <PageHeader title="Staff" />
        <div className="flex items-center justify-center py-32">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (error || !staff) {
    return (
      <div className="min-h-screen">
        <PageHeader title="Staff" />
        <div className="flex flex-col items-center justify-center py-32 gap-4">
          <Users className="h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">{error || 'Staff member not found'}</p>
          <Link href="/staff">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Staff
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <PageHeader
        title={staff.full_name}
        description={[formatRole(staff.role), staff.department].filter(Boolean).join(' · ') || undefined}
      >
        <StatusBadge status={staff.status} entity="staff" />
      </PageHeader>

      <div className="p-6 md:p-8">
        {/* Back link */}
        <Link
          href="/staff"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          All Staff
        </Link>

        <div className="max-w-4xl space-y-6">
          {/* Core Info */}
          <FieldGroupSection
            title="Core Info"
            icon={<Users className="h-4 w-4 text-muted-foreground" />}
            lineageMap={staff.lineage as FieldLineageMap | undefined}
            fields={[
              { label: 'Full Name', value: staff.full_name, fieldKey: 'full_name' },
              { label: 'Staff Code', value: staff.staff_code, fieldKey: 'staff_code' },
              { label: 'Title', value: staff.title, fieldKey: 'title' },
            ]}
          />

          {/* Contact */}
          <FieldGroupSection
            title="Contact"
            icon={<Contact className="h-4 w-4 text-muted-foreground" />}
            lineageMap={staff.lineage as FieldLineageMap | undefined}
            fields={[
              { label: 'Email', value: staff.email, type: 'email', fieldKey: 'email' },
              { label: 'Phone', value: staff.phone, type: 'phone', fieldKey: 'phone' },
              { label: 'Slack ID', value: staff.slack_id, fieldKey: 'slack_id' },
            ]}
          />

          {/* Status & Role */}
          <FieldGroupSection
            title="Status & Role"
            icon={<Briefcase className="h-4 w-4 text-muted-foreground" />}
            lineageMap={staff.lineage as FieldLineageMap | undefined}
            fields={[
              { label: 'Role', value: staff.role, fieldKey: 'role' },
              { label: 'Department', value: staff.department, fieldKey: 'department' },
              { label: 'Status', value: staff.status, fieldKey: 'status' },
              { label: 'Status Tags', value: staff.status_tags, type: 'array', fieldKey: 'status_tags' },
              { label: 'Services', value: staff.services, type: 'array', fieldKey: 'services' },
            ]}
          />

          {/* Metrics */}
          <FieldGroupSection
            title="Metrics"
            icon={<BarChart3 className="h-4 w-4 text-muted-foreground" />}
            lineageMap={staff.lineage as FieldLineageMap | undefined}
            fields={[
              { label: 'Current Clients', value: staff.current_client_count, type: 'number', fieldKey: 'current_client_count' },
              { label: 'Max Clients', value: staff.max_clients, type: 'number', fieldKey: 'max_clients' },
            ]}
          />

          {/* Dates */}
          <FieldGroupSection
            title="Dates"
            icon={<CalendarDays className="h-4 w-4 text-muted-foreground" />}
            lineageMap={staff.lineage as FieldLineageMap | undefined}
            fields={[
              { label: 'Hire Date', value: staff.hire_date, type: 'date', fieldKey: 'hire_date' },
              { label: 'Probation End', value: staff.probation_end_date, type: 'date', fieldKey: 'probation_end_date' },
              { label: 'Departure Date', value: staff.departure_date, type: 'date', fieldKey: 'departure_date' },
              { label: 'Google Last Login', value: gwsLastLogin, type: 'date' },
              { label: 'Google Last Seen (Sync)', value: gwsLastSeen, type: 'date' },
            ]}
          />

          {/* Links */}
          <FieldGroupSection
            title="Links"
            icon={<Link2 className="h-4 w-4 text-muted-foreground" />}
            lineageMap={staff.lineage as FieldLineageMap | undefined}
            fields={[
              { label: 'Dashboard URL', value: staff.dashboard_url, type: 'url', fieldKey: 'dashboard_url' },
              { label: 'Calendly URL', value: staff.calendly_url, type: 'url', fieldKey: 'calendly_url' },
            ]}
          />

          {/* Assigned Partners */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                Assigned Partners
                {staff.assigned_partners.length > 0 && (
                  <span className="text-xs text-muted-foreground font-normal">
                    ({staff.assigned_partners.length})
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {staff.assigned_partners.length === 0 ? (
                <p className="text-sm text-muted-foreground">No partners assigned</p>
              ) : (
                <div className="space-y-2">
                  {staff.assigned_partners.map(assignment => (
                    <PartnerAssignmentCard
                      key={assignment.id}
                      assignment={assignment}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
