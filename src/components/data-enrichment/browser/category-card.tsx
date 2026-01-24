'use client'

import { motion } from 'framer-motion'
import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CategoryCardProps {
  title: string
  description: string
  icon: LucideIcon
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
        'relative group w-full p-5 md:p-8 rounded-2xl border text-left transition-all',
        'bg-card hover:shadow-lg hover:shadow-black/5',
        comingSoon
          ? 'opacity-60 cursor-not-allowed border-dashed'
          : 'cursor-pointer hover:border-primary/30'
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          'flex h-12 w-12 md:h-16 md:w-16 items-center justify-center rounded-xl md:rounded-2xl mb-4 md:mb-6',
          'transition-transform group-hover:scale-110',
          bgColor
        )}
        style={{ transitionDuration: '200ms' }}
      >
        <Icon className={cn('h-6 w-6 md:h-8 md:w-8', iconColor)} />
      </div>

      {/* Title & Description */}
      <h3 className="text-lg md:text-xl font-semibold mb-1.5 md:mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground mb-4 md:mb-6 line-clamp-2">
        {description}
      </p>

      {/* Stats or Coming Soon */}
      {comingSoon ? (
        <div className="inline-flex items-center px-3 py-1.5 rounded-full bg-muted text-xs font-medium text-muted-foreground">
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
    </motion.button>
  )
}
