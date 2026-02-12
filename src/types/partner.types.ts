/**
 * Partner Type Definitions
 *
 * Shared types for partner entities used across repositories,
 * services, and API routes.
 */

import type { PartnerStatusValue } from '@/lib/partners/computed-status'
import type { StatusColorBucket } from '@/lib/status-colors'

/** Raw partner record from database */
export interface PartnerRecord {
  id: string
  brand_name: string
  client_name: string | null
  client_email: string | null
  partner_code: string | null
  status: string | null
  tier: string | null
  onboarding_date: string | null
  pod_leader_name: string | null
  source_data: Record<string, Record<string, Record<string, unknown>>> | null
  created_at: string
  updated_at: string
}

/** Staff reference for assignments */
export interface StaffReference {
  id: string
  full_name: string
}

/** Partner enriched with computed weekly status */
export interface PartnerWithComputedStatus extends PartnerRecord {
  computed_status: PartnerStatusValue | null
  computed_status_label: string
  computed_status_bucket: StatusColorBucket
  latest_weekly_status: string | null
  status_matches: boolean
  weeks_without_data: number
}

/** Partner with staff assignments and BigQuery mapping */
export interface PartnerWithAssignments extends PartnerWithComputedStatus {
  pod_leader: StaffReference | null
  sales_rep: StaffReference | null
  has_bigquery: boolean
  bigquery_client_name: string | null
}

/** Query parameters for listing partners */
export interface ListPartnersQuery {
  search?: string
  status?: string
  tier?: string
  sort: string
  order: 'asc' | 'desc'
  limit: number
  offset: number
}

/** Response shape for partner list endpoint */
export interface ListPartnersResult {
  partners: PartnerWithAssignments[]
  total: number
  has_more: boolean
}

/** Input for creating a new partner */
export interface CreatePartnerInput {
  brand_name: string
  client_name: string | null
  client_email: string | null
  status: string
  tier: string | null
}

/** Raw assignment record from join query */
export interface AssignmentRecord {
  partner_id: string
  assignment_role: string
  staff: StaffReference | null
}

/** BigQuery external ID mapping record */
export interface BigQueryMappingRecord {
  entity_id: string
  external_id: string
}
