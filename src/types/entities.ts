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

// =============================================================================
// Partner & Staff Entity Types
// =============================================================================

/** Partner as returned from list API */
export interface PartnerListItem {
  id: string
  partner_code: string | null
  brand_name: string
  client_name: string | null
  client_email: string | null
  status: string | null
  tier: string | null
  parent_asin_count: number | null
  child_asin_count: number | null
  onboarding_date: string | null
  created_at: string
  // Staff name fields (raw text from source - always available)
  pod_leader_name: string | null
  brand_manager_name: string | null
  sales_rep_name: string | null
  // Staff linked records (from junction table - available when staff synced)
  pod_leader?: { id: string; full_name: string } | null
}

/** Staff as returned from list API */
export interface StaffListItem {
  id: string
  staff_code: string | null
  full_name: string
  email: string
  role: string | null
  department: string | null
  title: string | null
  status: string | null
  max_clients: number | null
  current_client_count: number | null
  services: string[] | null
  hire_date: string | null
  created_at: string
}

/** Full partner with all relationships for detail page */
export interface PartnerDetail {
  id: string
  partner_code: string | null
  brand_name: string
  client_name: string | null
  client_email: string | null
  client_phone: string | null
  status: string | null
  tier: string | null
  base_fee: number | null
  commission_rate: number | null
  billing_day: number | null
  onboarding_date: string | null
  contract_start_date: string | null
  contract_end_date: string | null
  churned_date: string | null
  parent_asin_count: number | null
  child_asin_count: number | null
  notes: string | null
  source_data?: Record<string, unknown> | null
  lineage?: Record<string, unknown> | null
  created_at: string
  updated_at: string | null
  assignments: PartnerAssignment[]
  asins: AsinSummary[]
  recent_statuses: WeeklyStatusSummary[]
}

export interface PartnerAssignment {
  id: string
  assignment_role: string
  is_primary: boolean | null
  assigned_at: string | null
  staff: { id: string; full_name: string; email: string; role: string | null }
}

export interface AsinSummary {
  id: string
  asin_code: string
  title: string | null
  status: string | null
  is_parent: boolean | null
}

export interface WeeklyStatusSummary {
  id: string
  week_start_date: string
  status: string | null
  notes: string | null
}

/** Full staff with relationships for detail page */
export interface StaffDetail {
  id: string
  staff_code: string | null
  full_name: string
  email: string
  phone: string | null
  slack_id: string | null
  role: string | null
  department: string | null
  title: string | null
  status: string | null
  max_clients: number | null
  current_client_count: number | null
  services: string[] | null
  hire_date: string | null
  probation_end_date: string | null
  departure_date: string | null
  dashboard_url: string | null
  calendly_url: string | null
  source_data?: Record<string, unknown> | null
  lineage?: Record<string, unknown> | null
  created_at: string
  updated_at: string | null
  assigned_partners: StaffPartnerAssignment[]
}

export interface StaffPartnerAssignment {
  id: string
  assignment_role: string
  is_primary: boolean | null
  partner: { id: string; brand_name: string; status: string | null }
}

// =============================================================================
// Category Display Config
// =============================================================================

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
