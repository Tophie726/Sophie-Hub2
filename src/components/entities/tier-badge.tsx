import { cn } from '@/lib/utils'

const tierStyles: Record<string, string> = {
  tier_0: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
  tier_1: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  tier_2: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
  tier_3: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
  tier_4: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
}

const defaultStyle = 'bg-gray-500/10 text-gray-500 border-gray-500/20'

function formatTier(tier: string): string {
  // tier_0 -> Tier 0, or just capitalize if different format
  if (tier.startsWith('tier_')) {
    return `Tier ${tier.replace('tier_', '')}`
  }
  return tier.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

interface TierBadgeProps {
  tier: string | null
  className?: string
}

export function TierBadge({ tier, className }: TierBadgeProps) {
  if (!tier) return <span className="text-sm text-muted-foreground">--</span>

  const style = tierStyles[tier] || defaultStyle

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-md border',
        style,
        className
      )}
    >
      {formatTier(tier)}
    </span>
  )
}
