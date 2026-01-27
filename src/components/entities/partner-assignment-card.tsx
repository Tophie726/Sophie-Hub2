import Link from 'next/link'
import { Building2 } from 'lucide-react'
import { StatusBadge } from './status-badge'
import type { StaffPartnerAssignment } from '@/types/entities'

function formatRole(role: string): string {
  return role
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

interface PartnerAssignmentCardProps {
  assignment: StaffPartnerAssignment
}

/**
 * Displays a partner assigned to a staff member.
 * Used on the Staff detail page.
 */
export function PartnerAssignmentCard({ assignment }: PartnerAssignmentCardProps) {
  const partner = assignment.partner as { id: string; brand_name: string; status: string | null }

  return (
    <Link href={`/partners/${partner.id}`}>
      <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border/60 hover:border-border hover:bg-muted/30 transition-colors cursor-pointer">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/10 shrink-0">
          <Building2 className="h-4 w-4 text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{partner.brand_name}</div>
          <div className="mt-0.5">
            <StatusBadge status={partner.status} entity="partners" />
          </div>
        </div>
        <div className="shrink-0">
          <span className="px-2 py-0.5 text-[10px] font-medium rounded-md bg-muted text-muted-foreground">
            {formatRole(assignment.assignment_role)}
          </span>
        </div>
      </div>
    </Link>
  )
}
