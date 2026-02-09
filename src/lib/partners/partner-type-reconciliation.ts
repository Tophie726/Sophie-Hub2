import { escapePostgrestValue } from '@/lib/api/search-utils'
import { getAdminClient } from '@/lib/supabase/admin'
import {
  buildPartnerTypePersistenceFields,
  CANONICAL_PARTNER_TYPE_LABELS,
  type CanonicalPartnerType,
  type PersistedPartnerTypeFields,
} from '@/lib/partners/computed-partner-type'

const supabase = getAdminClient()

export type PartnerTypeSource = 'staffing' | 'legacy_partner_type' | 'unknown'

export interface PartnerTypeReconciliationRow {
  id: string
  brand_name: string
  partner_code: string | null
  client_name: string | null
  computed_partner_type: CanonicalPartnerType | null
  computed_partner_type_label: string | null
  computed_partner_type_source: PartnerTypeSource
  staffing_partner_type: CanonicalPartnerType | null
  staffing_partner_type_label: string | null
  legacy_partner_type_raw: string | null
  legacy_partner_type: CanonicalPartnerType | null
  legacy_partner_type_label: string | null
  partner_type_matches: boolean
  partner_type_is_shared: boolean
  partner_type_reason: string
  legacy_mismatch: boolean
  persistence_drift: boolean
  persisted_partner_type: CanonicalPartnerType | null
  persisted_partner_type_source: PartnerTypeSource | null
  persisted_partner_type_matches: boolean | null
  persisted_partner_type_computed_at: string | null
  update_fields: PersistedPartnerTypeFields
}

export interface PartnerTypeReconciliationListInput {
  limit: number
  offset: number
  search?: string
  mismatchOnly?: boolean
  driftOnly?: boolean
}

export interface PartnerTypeReconciliationRunInput {
  dryRun: boolean
  limit: number
  mismatchOnly?: boolean
  driftOnly?: boolean
}

type PartnerRow = {
  id: string
  brand_name: string
  partner_code: string | null
  client_name: string | null
  pod_leader_name: string | null
  brand_manager_name: string | null
  source_data: Record<string, Record<string, Record<string, unknown>>> | null
  computed_partner_type: CanonicalPartnerType | null
  computed_partner_type_source: PartnerTypeSource | null
  staffing_partner_type: CanonicalPartnerType | null
  legacy_partner_type_raw: string | null
  legacy_partner_type: CanonicalPartnerType | null
  partner_type_matches: boolean | null
  partner_type_is_shared: boolean | null
  partner_type_reason: string | null
  partner_type_computed_at: string | null
}

const PERSISTED_FIELDS_TO_COMPARE = [
  'computed_partner_type',
  'computed_partner_type_source',
  'staffing_partner_type',
  'legacy_partner_type_raw',
  'legacy_partner_type',
  'partner_type_matches',
  'partner_type_is_shared',
  'partner_type_reason',
] as const

function normalizeText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

function areEqual(a: unknown, b: unknown): boolean {
  if (typeof a === 'string' || typeof b === 'string') {
    return normalizeText(a) === normalizeText(b)
  }
  return a === b
}

function canonicalLabel(value: CanonicalPartnerType | null): string | null {
  if (!value) return null
  return CANONICAL_PARTNER_TYPE_LABELS[value] || null
}

function projectPartner(partner: PartnerRow): PartnerTypeReconciliationRow {
  const computed = buildPartnerTypePersistenceFields({
    sourceData: partner.source_data,
    podLeaderName: partner.pod_leader_name,
    brandManagerName: partner.brand_manager_name,
  })

  const persistenceDrift = PERSISTED_FIELDS_TO_COMPARE.some((field) => {
    return !areEqual(partner[field], computed[field])
  })

  const legacyMismatch = computed.partner_type_matches === false

  return {
    id: partner.id,
    brand_name: partner.brand_name,
    partner_code: partner.partner_code,
    client_name: partner.client_name,
    computed_partner_type: computed.computed_partner_type,
    computed_partner_type_label: canonicalLabel(computed.computed_partner_type),
    computed_partner_type_source: computed.computed_partner_type_source,
    staffing_partner_type: computed.staffing_partner_type,
    staffing_partner_type_label: canonicalLabel(computed.staffing_partner_type),
    legacy_partner_type_raw: computed.legacy_partner_type_raw,
    legacy_partner_type: computed.legacy_partner_type,
    legacy_partner_type_label: canonicalLabel(computed.legacy_partner_type),
    partner_type_matches: computed.partner_type_matches,
    partner_type_is_shared: computed.partner_type_is_shared,
    partner_type_reason: computed.partner_type_reason,
    legacy_mismatch: legacyMismatch,
    persistence_drift: persistenceDrift,
    persisted_partner_type: partner.computed_partner_type,
    persisted_partner_type_source: partner.computed_partner_type_source,
    persisted_partner_type_matches: partner.partner_type_matches,
    persisted_partner_type_computed_at: partner.partner_type_computed_at,
    update_fields: computed,
  }
}

async function fetchPartners(limit: number, search?: string): Promise<PartnerRow[]> {
  let query = supabase
    .from('partners')
    .select(`
      id,
      brand_name,
      partner_code,
      client_name,
      pod_leader_name,
      brand_manager_name,
      source_data,
      computed_partner_type,
      computed_partner_type_source,
      staffing_partner_type,
      legacy_partner_type_raw,
      legacy_partner_type,
      partner_type_matches,
      partner_type_is_shared,
      partner_type_reason,
      partner_type_computed_at
    `)
    .order('brand_name', { ascending: true })
    .limit(limit)

  if (search) {
    const escaped = escapePostgrestValue(search)
    query = query.or(`brand_name.ilike.${escaped},client_name.ilike.${escaped},partner_code.ilike.${escaped}`)
  }

  const { data, error } = await query
  if (error) throw error

  return (data || []) as PartnerRow[]
}

export async function listPartnerTypeReconciliation(input: PartnerTypeReconciliationListInput) {
  const rows = await fetchPartners(5000, input.search)
  const projected = rows.map(projectPartner)

  let filtered = projected
  if (input.mismatchOnly) {
    filtered = filtered.filter((row) => row.legacy_mismatch)
  }
  if (input.driftOnly) {
    filtered = filtered.filter((row) => row.persistence_drift)
  }

  const total = filtered.length
  const paginated = filtered.slice(input.offset, input.offset + input.limit)
  const responseRows = paginated.map((row) => {
    const clone = { ...row }
    delete clone.update_fields
    return clone
  })

  return {
    rows: responseRows,
    total,
    has_more: total > input.offset + input.limit,
    summary: {
      legacy_mismatch_count: projected.filter((row) => row.legacy_mismatch).length,
      persistence_drift_count: projected.filter((row) => row.persistence_drift).length,
    },
  }
}

export async function runPartnerTypeReconciliation(input: PartnerTypeReconciliationRunInput) {
  const rows = await fetchPartners(input.limit)
  const projected = rows.map(projectPartner)

  let targets = projected.filter((row) => row.persistence_drift)
  if (input.mismatchOnly) {
    targets = targets.filter((row) => row.legacy_mismatch)
  }
  if (input.driftOnly) {
    targets = targets.filter((row) => row.persistence_drift)
  }

  const updated: string[] = []
  const failed: Array<{ id: string; brand_name: string; error: string }> = []

  if (!input.dryRun) {
    const computedAt = new Date().toISOString()

    for (const partner of targets) {
      const { error } = await supabase
        .from('partners')
        .update({
          ...partner.update_fields,
          partner_type_computed_at: computedAt,
        })
        .eq('id', partner.id)

      if (error) {
        failed.push({
          id: partner.id,
          brand_name: partner.brand_name,
          error: error.message,
        })
        continue
      }

      updated.push(partner.id)
    }
  }

  return {
    dry_run: input.dryRun,
    scanned: rows.length,
    candidates: targets.length,
    updated: input.dryRun ? 0 : updated.length,
    failed: failed.length,
    sample: targets.slice(0, 25).map((row) => ({
      id: row.id,
      brand_name: row.brand_name,
      computed_partner_type: row.computed_partner_type,
      persisted_partner_type: row.persisted_partner_type,
      legacy_mismatch: row.legacy_mismatch,
      persistence_drift: row.persistence_drift,
    })),
    errors: failed,
    summary: {
      legacy_mismatch_count: projected.filter((row) => row.legacy_mismatch).length,
      persistence_drift_count: projected.filter((row) => row.persistence_drift).length,
    },
  }
}
