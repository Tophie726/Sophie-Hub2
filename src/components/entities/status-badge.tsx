import { cn } from '@/lib/utils'

const partnerStatusStyles: Record<string, string> = {
  active: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
  onboarding: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  paused: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  at_risk: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  offboarding: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
  churned: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
}

const staffStatusStyles: Record<string, string> = {
  active: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
  onboarding: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  on_leave: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  offboarding: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
  departed: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
}

const defaultStyle = 'bg-gray-500/10 text-gray-500 border-gray-500/20'

function formatStatus(status: string): string {
  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

interface StatusBadgeProps {
  status: string | null
  entity: 'partners' | 'staff'
  className?: string
}

export function StatusBadge({ status, entity, className }: StatusBadgeProps) {
  if (!status) return <span className="text-sm text-muted-foreground">--</span>

  const styles = entity === 'partners' ? partnerStatusStyles : staffStatusStyles
  const style = styles[status] || defaultStyle

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-md border',
        style,
        className
      )}
    >
      {formatStatus(status)}
    </span>
  )
}
