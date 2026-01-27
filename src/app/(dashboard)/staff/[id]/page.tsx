'use client'

import { useState, useEffect } from 'react'
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
import type { StaffDetail } from '@/types/entities'

function formatRole(role: string | null): string {
  if (!role) return ''
  return role
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

export default function StaffDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [staff, setStaff] = useState<StaffDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchStaff() {
      try {
        const res = await fetch(`/api/staff/${id}`)
        const json = await res.json()

        if (!res.ok) {
          setError(json.error?.message || 'Failed to load staff member')
          return
        }

        setStaff(json.data?.staff || null)
      } catch (err) {
        console.error('Failed to fetch staff:', err)
        setError('Failed to load staff member')
      } finally {
        setLoading(false)
      }
    }

    if (id) fetchStaff()
  }, [id])

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
            fields={[
              { label: 'Full Name', value: staff.full_name },
              { label: 'Staff Code', value: staff.staff_code },
              { label: 'Title', value: staff.title },
            ]}
          />

          {/* Contact */}
          <FieldGroupSection
            title="Contact"
            icon={<Contact className="h-4 w-4 text-muted-foreground" />}
            fields={[
              { label: 'Email', value: staff.email, type: 'email' },
              { label: 'Phone', value: staff.phone, type: 'phone' },
              { label: 'Slack ID', value: staff.slack_id },
            ]}
          />

          {/* Status & Role */}
          <FieldGroupSection
            title="Status & Role"
            icon={<Briefcase className="h-4 w-4 text-muted-foreground" />}
            fields={[
              { label: 'Role', value: staff.role },
              { label: 'Department', value: staff.department },
              { label: 'Status', value: staff.status },
              { label: 'Services', value: staff.services, type: 'array' },
            ]}
          />

          {/* Metrics */}
          <FieldGroupSection
            title="Metrics"
            icon={<BarChart3 className="h-4 w-4 text-muted-foreground" />}
            fields={[
              { label: 'Current Clients', value: staff.current_client_count, type: 'number' },
              { label: 'Max Clients', value: staff.max_clients, type: 'number' },
            ]}
          />

          {/* Dates */}
          <FieldGroupSection
            title="Dates"
            icon={<CalendarDays className="h-4 w-4 text-muted-foreground" />}
            fields={[
              { label: 'Hire Date', value: staff.hire_date, type: 'date' },
              { label: 'Probation End', value: staff.probation_end_date, type: 'date' },
              { label: 'Departure Date', value: staff.departure_date, type: 'date' },
            ]}
          />

          {/* Links */}
          <FieldGroupSection
            title="Links"
            icon={<Link2 className="h-4 w-4 text-muted-foreground" />}
            fields={[
              { label: 'Dashboard URL', value: staff.dashboard_url, type: 'url' },
              { label: 'Calendly URL', value: staff.calendly_url, type: 'url' },
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
