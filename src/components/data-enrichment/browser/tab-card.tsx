'use client'

import { motion } from 'framer-motion'
import { Check, EyeOff, Flag, Building2, Users, Package } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Progress } from '@/components/ui/progress'

type TabStatus = 'active' | 'reference' | 'hidden' | 'flagged'
type EntityType = 'partners' | 'staff' | 'asins' | null

interface CategoryStats {
  partner: number
  staff: number
  asin: number
  weekly: number
  computed: number
  skip: number
  unmapped: number
}

interface TabCardProps {
  id: string
  name: string
  primaryEntity: EntityType
  status: TabStatus
  columnCount: number
  categoryStats: CategoryStats
  hasHeaders: boolean
  updatedAt: string | null
  onClick: () => void
  isSelected?: boolean
}

const easeOut: [number, number, number, number] = [0.22, 1, 0.36, 1]

const entityConfig = {
  partners: {
    color: 'bg-blue-500',
    label: 'Partners',
    icon: Building2,
  },
  staff: {
    color: 'bg-green-500',
    label: 'Staff',
    icon: Users,
  },
  asins: {
    color: 'bg-orange-500',
    label: 'ASINs',
    icon: Package,
  },
}

function formatRelativeTime(dateString: string | null): string {
  if (!dateString) return '–'

  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  return `${Math.floor(diffDays / 30)}mo ago`
}

function calculateProgress(stats: CategoryStats): number {
  const mapped = stats.partner + stats.staff + stats.asin + stats.weekly + stats.computed + stats.skip
  const total = mapped + stats.unmapped
  if (total === 0) return 0
  return Math.round((mapped / total) * 100)
}

export function TabCard({
  name,
  primaryEntity,
  status,
  columnCount,
  categoryStats,
  hasHeaders,
  updatedAt,
  onClick,
  isSelected = false,
}: TabCardProps) {
  const isFlagged = status === 'flagged'
  const isHidden = status === 'hidden'
  const progress = calculateProgress(categoryStats)
  const entity = primaryEntity ? entityConfig[primaryEntity] : null

  return (
    <motion.button
      onClick={onClick}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2, ease: easeOut }}
      className={cn(
        'relative w-full text-left p-4 rounded-xl border bg-card transition-shadow',
        'hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
        isSelected && 'ring-2 ring-primary',
        isHidden && 'opacity-60',
        isFlagged && 'border-amber-500/30 bg-amber-500/5'
      )}
    >
      {/* Header row: entity dot + name + status icon */}
      <div className="flex items-center gap-2 mb-3">
        {/* Entity indicator */}
        {entity ? (
          <div className={cn('h-2.5 w-2.5 rounded-full', entity.color)} />
        ) : (
          <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
        )}

        {/* Tab name */}
        <span className="flex-1 font-medium text-sm truncate">{name}</span>

        {/* Status icons */}
        {isFlagged && <Flag className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />}
        {isHidden && <EyeOff className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />}
      </div>

      {/* Entity label or unmapped status */}
      <div className="text-xs text-muted-foreground mb-3">
        {entity ? entity.label : 'Not mapped'}
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <Progress
          value={progress}
          className="h-1.5"
        />
        <div className="flex items-center justify-between mt-1">
          <span className="text-[10px] text-muted-foreground">{progress}%</span>
          <span className="text-[10px] text-muted-foreground">{columnCount} cols</span>
        </div>
      </div>

      {/* Category breakdown badges */}
      <div className="flex flex-wrap gap-1 mb-3 min-h-[22px]">
        {categoryStats.partner > 0 && (
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-blue-500/10 text-blue-600">
            <Building2 className="h-2.5 w-2.5" />
            {categoryStats.partner}
          </span>
        )}
        {categoryStats.staff > 0 && (
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-green-500/10 text-green-600">
            <Users className="h-2.5 w-2.5" />
            {categoryStats.staff}
          </span>
        )}
        {categoryStats.asin > 0 && (
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-orange-500/10 text-orange-600">
            <Package className="h-2.5 w-2.5" />
            {categoryStats.asin}
          </span>
        )}
        {categoryStats.skip > 0 && (
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-muted text-muted-foreground">
            Skip {categoryStats.skip}
          </span>
        )}
      </div>

      {/* Footer: header status + last edited */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground border-t pt-2">
        <div className="flex items-center gap-1">
          {hasHeaders ? (
            <>
              <Check className="h-3 w-3 text-green-500" />
              <span>Headers</span>
            </>
          ) : (
            <span className="text-muted-foreground/60">– No headers</span>
          )}
        </div>
        <span>{formatRelativeTime(updatedAt)}</span>
      </div>
    </motion.button>
  )
}
