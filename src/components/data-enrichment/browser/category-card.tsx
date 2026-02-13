'use client'

import { motion } from 'framer-motion'
import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CategoryCardProps {
  title: string
  description: string
  icon: LucideIcon | React.ComponentType<{ className?: string }>
  iconColor: string
  bgColor: string
  stats?: {
    sources: number
    tabs: number
    fields: number
  }
  comingSoon?: boolean
  onClick?: () => void
}

const easeOut: [number, number, number, number] = [0.22, 1, 0.36, 1]

export function CategoryCard({
  title,
  description,
  icon: Icon,
  iconColor,
  bgColor,
  stats,
  comingSoon = false,
  onClick,
}: CategoryCardProps) {
  return (
    <motion.button
      onClick={onClick}
      disabled={comingSoon}
      whileHover={comingSoon ? {} : { scale: 1.02, y: -4 }}
      whileTap={comingSoon ? {} : { scale: 0.98 }}
      transition={{ duration: 0.2, ease: easeOut }}
      className={cn(
        'relative group w-full p-5 md:p-8 rounded-2xl border text-left transition-all overflow-hidden',
        comingSoon
          ? 'cursor-not-allowed border-dashed border-border/60 bg-gradient-to-br from-muted/35 via-card/95 to-muted/20'
          : 'cursor-pointer bg-card hover:border-primary/30 hover:shadow-lg hover:shadow-black/5'
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          'flex h-12 w-12 md:h-16 md:w-16 items-center justify-center rounded-xl md:rounded-2xl mb-4 md:mb-6',
          !comingSoon && 'transition-transform group-hover:scale-110',
          comingSoon ? 'bg-muted/35 border border-border/60' : bgColor
        )}
        style={{ transitionDuration: '200ms' }}
      >
        <Icon
          className={cn(
            'h-6 w-6 md:h-8 md:w-8',
            iconColor,
            comingSoon && 'grayscale contrast-75 brightness-90 saturate-0 opacity-65'
          )}
        />
      </div>

      {/* Title & Description */}
      <h3 className={cn('text-lg md:text-xl font-semibold mb-1.5 md:mb-2', comingSoon && 'text-foreground/65')}>{title}</h3>
      <p className={cn('text-sm text-muted-foreground mb-4 md:mb-6 line-clamp-2', comingSoon && 'text-muted-foreground/70')}>
        {description}
      </p>

      {/* Stats or Coming Soon */}
      {comingSoon ? (
        <div className="inline-flex items-center px-3 py-1.5 rounded-full border border-border/55 bg-muted/60 text-xs font-medium text-muted-foreground/75">
          Coming Soon
        </div>
      ) : stats ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 md:gap-x-4 text-sm">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold tabular-nums">{stats.sources}</span>
            <span className="text-muted-foreground">sources</span>
          </div>
          <div className="hidden md:block h-4 w-px bg-border" />
          <div className="flex items-center gap-1.5">
            <span className="font-semibold tabular-nums">{stats.tabs}</span>
            <span className="text-muted-foreground">tabs</span>
          </div>
          <div className="hidden md:block h-4 w-px bg-border" />
          <div className="flex items-center gap-1.5">
            <span className="font-semibold tabular-nums">{stats.fields}</span>
            <span className="text-muted-foreground">fields</span>
          </div>
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">
          Click to get started
        </div>
      )}

      {/* Hover gradient effect */}
      {!comingSoon && (
        <div
          className={cn(
            'absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none',
            'bg-gradient-to-br from-primary/5 to-transparent'
          )}
          style={{ transitionDuration: '300ms' }}
        />
      )}

      {comingSoon && (
        <div
          className="absolute inset-0 rounded-2xl pointer-events-none bg-gradient-to-br from-black/10 via-transparent to-black/25"
        />
      )}
    </motion.button>
  )
}
