import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface ComputedPartnerTypeBadgeProps {
  computedLabel: string
  computedSource: 'staffing' | 'legacy_partner_type' | 'unknown'
  legacyRaw?: string | null
  legacyLabel?: string | null
  partnerTypeMatches?: boolean
  isSharedPartner?: boolean
  reason?: string | null
  className?: string
}

function styleForPartnerType(label: string): string {
  const normalized = label.toLowerCase()
  if (normalized.includes('fam')) return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
  if (normalized.includes('ppc')) return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
  if (normalized === 'cc') return 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20'
  if (normalized === 'pli') return 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20'
  if (normalized === 'tts') return 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20'
  return 'bg-gray-500/10 text-gray-500 border-gray-500/20'
}

function sourceLabel(source: ComputedPartnerTypeBadgeProps['computedSource']): string {
  if (source === 'staffing') return 'Staffing logic'
  if (source === 'legacy_partner_type') return 'Legacy Partner type'
  return 'Unknown'
}

export function ComputedPartnerTypeBadge({
  computedLabel,
  computedSource,
  legacyRaw,
  legacyLabel,
  partnerTypeMatches = true,
  isSharedPartner = false,
  reason,
  className,
}: ComputedPartnerTypeBadgeProps) {
  const showMismatch = !partnerTypeMatches && !!legacyRaw
  const badgeStyle = styleForPartnerType(computedLabel)

  const badge = (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-md border',
        badgeStyle,
        showMismatch && 'ring-1 ring-amber-500 ring-offset-1',
        className
      )}
    >
      {computedLabel}
      {isSharedPartner && (
        <span className="text-[10px] opacity-80">(Shared)</span>
      )}
      {showMismatch && (
        <span className="text-amber-500" title="Computed partner type differs from legacy Partner type">
          ⚠
        </span>
      )}
    </span>
  )

  return (
    <TooltipProvider delayDuration={250}>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent side="top" className="text-xs max-w-xs">
          <div className="space-y-1">
            <div>
              <span className="text-muted-foreground">Computed: </span>
              <span className="font-medium">{computedLabel}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Source: </span>
              <span>{sourceLabel(computedSource)}</span>
            </div>
            {legacyRaw && (
              <div>
                <span className="text-muted-foreground">Legacy Partner type: </span>
                <span>{legacyRaw}</span>
                {legacyLabel && (
                  <span className="text-muted-foreground">{' -> '}{legacyLabel}</span>
                )}
              </div>
            )}
            {showMismatch && (
              <div className="text-amber-500">
                Legacy value does not match staffing-derived type.
              </div>
            )}
            {reason && (
              <div className="text-muted-foreground">
                {reason}
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
