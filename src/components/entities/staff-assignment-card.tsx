import Link from 'next/link'
import { User } from 'lucide-react'
import type { PartnerAssignment } from '@/types/entities'

function formatRole(role: string): string {
  return role
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

interface StaffAssignmentCardProps {
  assignment: PartnerAssignment
}

/**
 * Displays a staff member assigned to a partner.
 * Used on the Partner detail page.
 */
export function StaffAssignmentCard({ assignment }: StaffAssignmentCardProps) {
  const staff = assignment.staff as { id: string; full_name: string; email: string; role: string | null }

  return (
    <Link href={`/staff/${staff.id}`}>
      <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border/60 hover:border-border hover:bg-muted/30 transition-colors cursor-pointer">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/10 shrink-0">
          <User className="h-4 w-4 text-green-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{staff.full_name}</div>
          <div className="text-xs text-muted-foreground">{staff.email}</div>
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
