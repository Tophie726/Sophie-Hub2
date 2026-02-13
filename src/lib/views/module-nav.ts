/**
 * Module-to-Navigation mapper for preview shell.
 *
 * Converts assigned modules into a NavSection that can be injected
 * into the preview sidebar. Each module becomes a navigable page.
 */

import {
  Blocks,
  BarChart3,
  Calendar,
  FileText,
  ShoppingCart,
  TrendingUp,
  Package,
  Users,
  Database,
  type LucideIcon,
} from 'lucide-react'
import type { NavSection } from '@/lib/navigation/config'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PreviewModule {
  moduleId: string
  slug: string
  name: string
  icon: string
  color: string
  sortOrder: number
  dashboardId: string | null
}

// ---------------------------------------------------------------------------
// Icon resolver
// ---------------------------------------------------------------------------

const ICON_MAP: Record<string, LucideIcon> = {
  Blocks,
  BarChart3,
  Calendar,
  FileText,
  ShoppingCart,
  TrendingUp,
  Package,
  Users,
  Database,
}

function resolveIcon(iconName: string | null | undefined): LucideIcon {
  if (!iconName) return Blocks
  return ICON_MAP[iconName] ?? Blocks
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build a NavSection from assigned modules for the preview sidebar.
 *
 * Each module becomes a nav item linking to `/preview/module/[slug]`.
 * Items are ordered by sortOrder (ascending).
 */
export function buildModuleNavSection(modules: PreviewModule[]): NavSection {
  const sorted = [...modules].sort((a, b) => a.sortOrder - b.sortOrder)

  return {
    title: 'Modules',
    items: sorted.map((m) => ({
      name: m.name,
      href: `/preview/module/${m.slug}`,
      icon: resolveIcon(m.icon),
    })),
  }
}

/**
 * Build the full navigation for the preview shell.
 *
 * Combines role-filtered base navigation with dynamic module section.
 */
export function buildPreviewNavigation(
  baseNav: NavSection[],
  modules: PreviewModule[],
): NavSection[] {
  if (modules.length === 0) return baseNav

  const moduleSection = buildModuleNavSection(modules)
  return [...baseNav, moduleSection]
}
