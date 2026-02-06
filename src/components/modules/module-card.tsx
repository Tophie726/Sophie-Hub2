'use client'

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
  const Icon = (module.icon && ICON_MAP[module.icon]) || DEFAULT_ICON
  const color = module.color || 'orange'
  const bgClass = COLOR_BG[color] || COLOR_BG.orange
  const textClass = COLOR_TEXT[color] || COLOR_TEXT.orange

  return (
    <Link href={`/admin/modules/${module.slug}`}>
      <motion.div
        whileHover={{ y: -4, scale: 1.01 }}
        whileTap={{ scale: 0.97 }}
        transition={{ duration: duration.ui, ease: easeOut }}
        className="group relative bg-card rounded-xl p-4 md:p-6 cursor-pointer transition-shadow hover:shadow-lg"
        style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.08)' }}
      >
        <div className="flex items-start gap-3 md:gap-4">
          <div
            className={`flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-xl transition-transform group-hover:scale-110 shrink-0 ${bgClass}`}
          >
            <Icon className={`h-5 w-5 md:h-6 md:w-6 ${textClass}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold truncate">{module.name}</h3>
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
          </div>
        </div>
      </motion.div>
    </Link>
  )
}
