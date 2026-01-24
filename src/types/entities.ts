/**
 * Centralized entity type definitions
 *
 * These types are used across the application for consistency.
 * Import from here instead of defining locally to prevent drift.
 *
 * Usage:
 * ```typescript
 * import { CategoryStats, TabStatus, EntityType } from '@/types/entities'
 * ```
 */

// =============================================================================
// Core Entity Types
// =============================================================================

/**
 * Primary entity types in the system
 * - partners: Client brands we manage
 * - staff: Team members
 * - asins: Amazon products per partner
 */
export type EntityType = 'partners' | 'staff' | 'asins'

/**
 * Tab status for data source tabs
 * - active: Actively mapped and synced
 * - reference: Read-only reference data
 * - hidden: Hidden from normal view
 * - flagged: Flagged for review
 */
export type TabStatus = 'active' | 'reference' | 'hidden' | 'flagged'

/**
 * Column category for field classification
 */
export type ColumnCategory = 'partner' | 'staff' | 'asin' | 'weekly' | 'computed' | 'skip'

/**
 * Column category that allows null (unclassified)
 * Used in UI components during classification phase
 */
export type ColumnCategoryOrNull = ColumnCategory | null

/**
 * Authority level for field mappings
 * - source_of_truth: This source is authoritative for this field
 * - reference: Read-only lookup, doesn't update master record
 * - derived: Computed from other fields
 */
export type AuthorityLevel = 'source_of_truth' | 'reference' | 'derived'

// =============================================================================
// Statistics Types
// =============================================================================

/**
 * Category breakdown statistics
 * Used for progress tracking in data enrichment
 */
export interface CategoryStats {
  partner: number
  staff: number
  asin: number
  weekly: number
  computed: number
  skip: number
  unmapped: number
}

/**
 * Create empty category stats
 */
export function emptyCategoryStats(): CategoryStats {
  return {
    partner: 0,
    staff: 0,
    asin: 0,
    weekly: 0,
    computed: 0,
    skip: 0,
    unmapped: 0,
  }
}

/**
 * Calculate mapping progress percentage
 */
export function calculateProgress(stats: CategoryStats): number {
  const mapped = stats.partner + stats.staff + stats.asin + stats.weekly + stats.computed
  const total = mapped + stats.unmapped
  if (total === 0) return 0
  return Math.round((mapped / total) * 100)
}

// =============================================================================
// Data Source Types
// =============================================================================

/**
 * Tab mapping with statistics
 */
export interface TabWithStats {
  id: string
  tab_name: string
  primary_entity: EntityType | null
  header_row: number
  header_confirmed: boolean
  status: TabStatus
  notes: string | null
  updated_at: string | null
  columnCount: number
  categoryStats: CategoryStats
}

/**
 * Data source with all related stats
 */
export interface DataSourceWithStats {
  id: string
  name: string
  type: string
  spreadsheet_id: string
  spreadsheet_url: string | null
  created_at: string
  updated_at: string
  display_order?: number
  tabCount: number
  totalColumns: number
  mappedFieldsCount: number
  categoryStats: CategoryStats
  tabs: TabWithStats[]
}

// =============================================================================
// Entity Display Config
// =============================================================================

import type { LucideIcon } from 'lucide-react'

export interface EntityConfig {
  color: string
  bgColor: string
  borderColor: string
  label: string
  icon?: LucideIcon
}

/**
 * Display configuration for entity types
 * Usage: entityDisplayConfig.partners.color
 */
export const entityDisplayConfig: Record<EntityType, EntityConfig> = {
  partners: {
    color: 'text-blue-500',
    bgColor: 'bg-blue-500',
    borderColor: 'border-blue-500',
    label: 'Partners',
  },
  staff: {
    color: 'text-green-500',
    bgColor: 'bg-green-500',
    borderColor: 'border-green-500',
    label: 'Staff',
  },
  asins: {
    color: 'text-orange-500',
    bgColor: 'bg-orange-500',
    borderColor: 'border-orange-500',
    label: 'ASINs',
  },
}

/**
 * Display configuration for column categories
 */
export const categoryDisplayConfig: Record<ColumnCategory, EntityConfig> = {
  partner: {
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    label: 'Partner',
  },
  staff: {
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
    label: 'Staff',
  },
  asin: {
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/30',
    label: 'ASIN',
  },
  weekly: {
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
    label: 'Weekly',
  },
  computed: {
    color: 'text-cyan-500',
    bgColor: 'bg-cyan-500/10',
    borderColor: 'border-cyan-500/30',
    label: 'Computed',
  },
  skip: {
    color: 'text-gray-500',
    bgColor: 'bg-gray-500/10',
    borderColor: 'border-gray-500/30',
    label: 'Skip',
  },
}

/**
 * Status display configuration
 */
export const statusDisplayConfig: Record<TabStatus, { label: string; color: string }> = {
  active: { label: 'Active', color: 'text-green-500' },
  reference: { label: 'Reference', color: 'text-blue-500' },
  hidden: { label: 'Hidden', color: 'text-gray-500' },
  flagged: { label: 'Flagged', color: 'text-amber-500' },
}
