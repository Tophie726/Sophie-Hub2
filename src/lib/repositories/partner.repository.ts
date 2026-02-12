/**
 * Partner Repository
 *
 * Handles all database operations for the partners table.
 * No business logic — only typed Supabase queries.
 */

import { getAdminClient } from '@/lib/supabase/admin'
import { escapePostgrestValue } from '@/lib/api/search-utils'
import type {
  PartnerRecord,
  AssignmentRecord,
  BigQueryMappingRecord,
  CreatePartnerInput,
  StaffReference,
} from '@/types/partner.types'

const supabase = getAdminClient()

export interface PartnerQueryParams {
  search?: string
  tierFilters?: string[]
  sort: string
  order: 'asc' | 'desc'
}

/**
 * Fetch partners with search, tier filter, and sorting
 */
export async function findPartners(
  params: PartnerQueryParams
): Promise<PartnerRecord[]> {
  let query = supabase
    .from('partners')
    .select('*')

  if (params.search) {
    const escaped = escapePostgrestValue(params.search)
    query = query.or(
      `brand_name.ilike.%${escaped}%,client_name.ilike.%${escaped}%,partner_code.ilike.%${escaped}%`
    )
  }

  if (params.tierFilters && params.tierFilters.length > 0) {
    query = query.in('tier', params.tierFilters)
  }

  query = query
    .order(params.sort, { ascending: params.order === 'asc' })
    .limit(5000)

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to fetch partners: ${error.message}`)
  }

  return (data || []) as PartnerRecord[]
}

/**
 * Fetch active staff assignments for given partner IDs
 */
export async function findAssignmentsByPartnerIds(
  partnerIds: string[]
): Promise<AssignmentRecord[]> {
  if (partnerIds.length === 0) return []

  const { data, error } = await supabase
    .from('partner_assignments')
    .select('partner_id, assignment_role, staff:staff_id(id, full_name)')
    .in('partner_id', partnerIds)
    .in('assignment_role', ['pod_leader', 'sales_rep'])
    .is('unassigned_at', null)

  if (error) {
    throw new Error(`Failed to fetch assignments: ${error.message}`)
  }

  return (data || []).map(a => ({
    partner_id: a.partner_id,
    assignment_role: a.assignment_role,
    staff: a.staff as unknown as StaffReference | null,
  }))
}

/**
 * Fetch BigQuery external ID mappings for given partner IDs
 */
export async function findBigQueryMappings(
  partnerIds: string[]
): Promise<BigQueryMappingRecord[]> {
  if (partnerIds.length === 0) return []

  const { data, error } = await supabase
    .from('entity_external_ids')
    .select('entity_id, external_id')
    .eq('entity_type', 'partners')
    .eq('source', 'bigquery')
    .in('entity_id', partnerIds)

  if (error) {
    throw new Error(`Failed to fetch BigQuery mappings: ${error.message}`)
  }

  return (data || []) as BigQueryMappingRecord[]
}

/**
 * Find a partner by brand name (case-insensitive)
 */
export async function findPartnerByBrandName(
  brandName: string
): Promise<{ id: string } | null> {
  const { data, error } = await supabase
    .from('partners')
    .select('id')
    .ilike('brand_name', brandName)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to check existing partner: ${error.message}`)
  }

  return data
}

/**
 * Insert a new partner record
 */
export async function createPartner(
  input: CreatePartnerInput
): Promise<PartnerRecord> {
  const { data, error } = await supabase
    .from('partners')
    .insert({
      brand_name: input.brand_name,
      client_name: input.client_name,
      client_email: input.client_email,
      status: input.status,
      tier: input.tier,
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create partner: ${error.message}`)
  }

  if (!data) {
    throw new Error('Partner creation returned no data')
  }

  return data as PartnerRecord
}
