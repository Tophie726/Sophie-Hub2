/**
 * Partner Service
 *
 * Business logic for partner operations.
 * Orchestrates repository calls, computed status, and data merging.
 */

import { computePartnerStatus, matchesStatusFilter } from '@/lib/partners/computed-status'
import * as partnerRepo from '@/lib/repositories/partner.repository'
import type {
  PartnerRecord,
  PartnerWithComputedStatus,
  PartnerWithAssignments,
  StaffReference,
  ListPartnersQuery,
  ListPartnersResult,
  CreatePartnerInput,
} from '@/types/partner.types'

/**
 * Enrich partner records with computed status from weekly data
 */
function enrichWithComputedStatus(
  partners: PartnerRecord[]
): PartnerWithComputedStatus[] {
  return partners.map(p => {
    const computed = computePartnerStatus(p.source_data, p.status)
    return {
      ...p,
      computed_status: computed.computedStatus,
      computed_status_label: computed.displayLabel,
      computed_status_bucket: computed.bucket,
      latest_weekly_status: computed.latestWeeklyStatus,
      status_matches: computed.matchesSheetStatus,
      weeks_without_data: computed.weeksWithoutData,
    }
  })
}

/**
 * Build lookup maps from assignment records
 */
function buildAssignmentLookups(
  assignments: { partner_id: string; assignment_role: string; staff: StaffReference | null }[]
): {
  podLeaders: Record<string, StaffReference>
  salesReps: Record<string, StaffReference>
} {
  const podLeaders: Record<string, StaffReference> = {}
  const salesReps: Record<string, StaffReference> = {}

  for (const a of assignments) {
    if (!a.staff) continue
    if (a.assignment_role === 'pod_leader') {
      podLeaders[a.partner_id] = a.staff
    } else if (a.assignment_role === 'sales_rep') {
      salesReps[a.partner_id] = a.staff
    }
  }

  return { podLeaders, salesReps }
}

/**
 * List partners with search, filter, sort, and pagination
 */
export async function listPartners(
  query: ListPartnersQuery
): Promise<ListPartnersResult> {
  const tierFilters = query.tier
    ? query.tier.split(',').map(t => t.trim()).filter(Boolean)
    : undefined

  // Fetch all matching partners from DB
  const allPartners = await partnerRepo.findPartners({
    search: query.search,
    tierFilters,
    sort: query.sort,
    order: query.order,
  })

  // Enrich with computed status
  let enriched = enrichWithComputedStatus(allPartners)

  // Apply status filter based on computed status (must be done in JS)
  const statusFilters = query.status
    ? query.status.split(',').map(s => s.trim()).filter(Boolean)
    : []

  if (statusFilters.length > 0) {
    enriched = enriched.filter(p =>
      matchesStatusFilter(p.source_data, p.status, statusFilters)
    )
  }

  // Paginate after filtering
  const total = enriched.length
  const paginated = enriched.slice(query.offset, query.offset + query.limit)

  // Batch fetch related data for the current page only
  const partnerIds = paginated.map(p => p.id)

  const [assignments, bqMappings] = await Promise.all([
    partnerRepo.findAssignmentsByPartnerIds(partnerIds),
    partnerRepo.findBigQueryMappings(partnerIds),
  ])

  // Build lookup maps
  const { podLeaders, salesReps } = buildAssignmentLookups(assignments)

  const bqLookup: Record<string, string> = {}
  for (const m of bqMappings) {
    bqLookup[m.entity_id] = m.external_id
  }

  // Merge into final shape
  const partners: PartnerWithAssignments[] = paginated.map(p => ({
    ...p,
    pod_leader: podLeaders[p.id] || null,
    sales_rep: salesReps[p.id] || null,
    has_bigquery: !!bqLookup[p.id],
    bigquery_client_name: bqLookup[p.id] || null,
  }))

  return {
    partners,
    total,
    has_more: total > query.offset + query.limit,
  }
}

/**
 * Create a new partner with duplicate checking
 */
export async function createPartner(
  input: CreatePartnerInput
): Promise<
  | { isConflict: false; partner: PartnerRecord }
  | { isConflict: true; brandName: string }
> {
  const existing = await partnerRepo.findPartnerByBrandName(input.brand_name)

  if (existing) {
    return { isConflict: true, brandName: input.brand_name }
  }

  const partner = await partnerRepo.createPartner(input)
  return { isConflict: false, partner }
}
