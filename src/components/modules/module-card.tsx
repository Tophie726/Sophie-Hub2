'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import {
  BarChart3,
  Blocks,
  FileText,
  Package,
  ShoppingCart,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react'
import { easeOut, duration } from '@/lib/animations'
import { cn } from '@/lib/utils'
import type { Module } from '@/types/modules'

/** Map icon name strings from the database to Lucide components */
const ICON_MAP: Record<string, LucideIcon> = {
  BarChart3,
  Blocks,
  FileText,
  Package,
  ShoppingCart,
  TrendingUp,
}

const DEFAULT_ICON = Blocks

/** Static Tailwind class maps so the purger includes them */
const COLOR_BG: Record<string, string> = {
  orange: 'bg-orange-500/10',
  blue: 'bg-blue-500/10',
  green: 'bg-green-500/10',
  purple: 'bg-purple-500/10',
  red: 'bg-red-500/10',
  gray: 'bg-gray-500/10',
}

const COLOR_TEXT: Record<string, string> = {
  orange: 'text-orange-600',
  blue: 'text-blue-600',
  green: 'text-green-600',
  purple: 'text-purple-600',
  red: 'text-red-600',
  gray: 'text-gray-600',
}

interface ModuleCardProps {
  module: Module
}

export function ModuleCard({ module }: ModuleCardProps) {
  const [isNavigating, setIsNavigating] = useState(false)
  const Icon = (module.icon && ICON_MAP[module.icon]) || DEFAULT_ICON
  const color = module.color || 'orange'
  const bgClass = COLOR_BG[color] || COLOR_BG.orange
  const textClass = COLOR_TEXT[color] || COLOR_TEXT.orange

  return (
    <Link
      href={`/admin/modules/${module.slug}`}
      onClick={() => setIsNavigating(true)}
      className="block"
    >
      <motion.div
        whileHover={{ y: -4, scale: 1.01 }}
        whileTap={{ scale: 0.97 }}
        transition={{ duration: duration.ui, ease: easeOut }}
        className={cn(
          'group relative bg-card rounded-xl p-4 md:p-6 cursor-pointer transition-shadow hover:shadow-lg',
          isNavigating && 'shadow-lg'
        )}
        style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.08)' }}
      >
        {isNavigating && (
          <>
            <div className="pointer-events-none absolute inset-0 rounded-xl border border-primary/40" />
            <div className="pointer-events-none absolute left-4 right-4 bottom-3 h-1 rounded-full overflow-hidden bg-muted/40">
              <div className="h-full w-full bg-gradient-to-r from-primary/20 via-primary/60 to-primary/20 bg-[length:200%_100%] animate-[shimmer_1.2s_ease-in-out_infinite]" />
            </div>
          </>
        )}
        <div className="flex items-start gap-3 md:gap-4">
          <div
            className={`flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-xl transition-transform group-hover:scale-110 shrink-0 ${bgClass}`}
          >
            <Icon className={`h-5 w-5 md:h-6 md:w-6 ${textClass}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold leading-snug text-[15px] line-clamp-2">
                {module.name}
              </h3>
              {module.enabled ? (
                <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-green-500/10 text-green-600 shrink-0">
                  Enabled
                </span>
              ) : (
                <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-muted text-muted-foreground shrink-0">
                  Disabled
                </span>
              )}
            </div>
            {module.description && (
              <p className="text-xs md:text-sm text-muted-foreground mt-1 line-clamp-2">
                {module.description}
              </p>
            )}
            {isNavigating && (
              <p className="text-[11px] text-primary mt-2">
                Opening module...
              </p>
            )}
          </div>
        </div>
      </motion.div>
    </Link>
  )
}
