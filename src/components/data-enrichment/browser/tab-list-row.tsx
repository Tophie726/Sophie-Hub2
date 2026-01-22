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

interface TabListRowProps {
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
  index: number
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

export function TabListRow({
  name,
  primaryEntity,
  status,
  columnCount,
  categoryStats,
  hasHeaders,
  updatedAt,
  onClick,
  isSelected = false,
  index,
}: TabListRowProps) {
  const isFlagged = status === 'flagged'
  const isHidden = status === 'hidden'
  const progress = calculateProgress(categoryStats)
  const entity = primaryEntity ? entityConfig[primaryEntity] : null

  return (
    <motion.button
      onClick={onClick}
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, ease: easeOut, delay: index * 0.02 }}
      className={cn(
        'w-full text-left grid grid-cols-[1fr,80px,120px,200px,80px] gap-4 items-center px-4 py-3 border-b transition-colors',
        'hover:bg-muted/50 focus:outline-none focus-visible:bg-muted/50',
        isSelected && 'bg-primary/5',
        isHidden && 'opacity-60',
        isFlagged && 'bg-amber-500/5'
      )}
    >
      {/* Tab Name with entity indicator */}
      <div className="flex items-center gap-2 min-w-0">
        {entity ? (
          <div className={cn('h-2.5 w-2.5 rounded-full flex-shrink-0', entity.color)} />
        ) : (
          <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30 flex-shrink-0" />
        )}
        <span className="font-medium text-sm truncate">{name}</span>
        {isFlagged && <Flag className="h-3 w-3 text-amber-500 flex-shrink-0" />}
        {isHidden && <EyeOff className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
      </div>

      {/* Headers */}
      <div className="flex items-center justify-center">
        {hasHeaders ? (
          <Check className="h-4 w-4 text-green-500" />
        ) : (
          <span className="text-muted-foreground/50">–</span>
        )}
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2">
        <Progress value={progress} className="h-1.5 flex-1" />
        <span className="text-xs text-muted-foreground tabular-nums w-8">{progress}%</span>
      </div>

      {/* Category Breakdown */}
      <div className="flex flex-wrap gap-1">
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
        {progress === 0 && (
          <span className="text-xs text-muted-foreground">{columnCount} cols</span>
        )}
      </div>

      {/* Last Edit */}
      <div className="text-xs text-muted-foreground text-right">
        {formatRelativeTime(updatedAt)}
      </div>
    </motion.button>
  )
}
