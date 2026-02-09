import { z } from 'zod'
import { requireRole } from '@/lib/auth/api-auth'
import { ROLES } from '@/lib/auth/roles'
import { apiError, apiSuccess, ApiErrors } from '@/lib/api/response'
import { escapePostgrestValue } from '@/lib/api/search-utils'
import { getAdminClient } from '@/lib/supabase/admin'
import {
  buildPartnerTypePersistenceFields,
  CANONICAL_PARTNER_TYPE_LABELS,
  type CanonicalPartnerType,
} from '@/lib/partners/computed-partner-type'

const supabase = getAdminClient()

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(5000).optional().default(200),
  offset: z.coerce.number().int().min(0).optional().default(0),
  search: z.string().max(200).optional(),
  mismatch_only: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  drift_only: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
})

const ReconcileBodySchema = z.object({
  dry_run: z.boolean().optional().default(true),
  limit: z.number().int().min(1).max(5000).optional().default(1000),
  mismatch_only: z.boolean().optional().default(false),
  drift_only: z.boolean().optional().default(false),
})

type PartnerRow = {
  id: string
  brand_name: string
  partner_code: string | null
  client_name: string | null
  pod_leader_name: string | null
  brand_manager_name: string | null
  source_data: Record<string, Record<string, Record<string, unknown>>> | null
  computed_partner_type: CanonicalPartnerType | null
  computed_partner_type_source: 'staffing' | 'legacy_partner_type' | 'unknown' | null
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

function projectPartner(partner: PartnerRow) {
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

async function fetchPartners(limit: number, search?: string) {
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
  if (error) {
    throw error
  }

  return (data || []) as PartnerRow[]
}

/**
 * GET /api/admin/partners/partner-type-reconciliation
 *
 * Returns reconciliation report comparing runtime-computed partner type
 * against persisted taxonomy columns.
 */
export async function GET(request: Request) {
  const auth = await requireRole(ROLES.ADMIN)
  if (!auth.authenticated) return auth.response

  try {
    const url = new URL(request.url)
    const validation = QuerySchema.safeParse({
      limit: url.searchParams.get('limit') || undefined,
      offset: url.searchParams.get('offset') || undefined,
      search: url.searchParams.get('search') || undefined,
      mismatch_only: url.searchParams.get('mismatch_only') || undefined,
      drift_only: url.searchParams.get('drift_only') || undefined,
    })

    if (!validation.success) {
      return apiError('VALIDATION_ERROR', validation.error.message, 400)
    }

    const { limit, offset, search, mismatch_only, drift_only } = validation.data
    const rows = await fetchPartners(5000, search)
    const projected = rows.map(projectPartner)

    let filtered = projected
    if (mismatch_only) {
      filtered = filtered.filter((row) => row.legacy_mismatch)
    }
    if (drift_only) {
      filtered = filtered.filter((row) => row.persistence_drift)
    }

    const total = filtered.length
    const paginated = filtered.slice(offset, offset + limit)
    const responseRows = paginated.map((row) => {
      const clone = { ...row }
      delete clone.update_fields
      return clone
    })

    return apiSuccess({
      rows: responseRows,
      total,
      has_more: total > offset + limit,
      summary: {
        legacy_mismatch_count: projected.filter((row) => row.legacy_mismatch).length,
        persistence_drift_count: projected.filter((row) => row.persistence_drift).length,
      },
    }, 200, {
      'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
    })
  } catch (error) {
    console.error('Partner type reconciliation report failed:', error)
    return ApiErrors.database()
  }
}

/**
 * POST /api/admin/partners/partner-type-reconciliation
 *
 * Recomputes and persists partner-type taxonomy fields.
 * Defaults to dry_run=true for safety.
 */
export async function POST(request: Request) {
  const auth = await requireRole(ROLES.ADMIN)
  if (!auth.authenticated) return auth.response

  try {
    const body = await request.json().catch(() => ({}))
    const validation = ReconcileBodySchema.safeParse(body)
    if (!validation.success) {
      return apiError('VALIDATION_ERROR', validation.error.message, 400)
    }

    const { dry_run, limit, mismatch_only, drift_only } = validation.data
    const rows = await fetchPartners(limit)
    const projected = rows.map(projectPartner)

    let targets = projected.filter((row) => row.persistence_drift)
    if (mismatch_only) {
      targets = targets.filter((row) => row.legacy_mismatch)
    }
    if (drift_only) {
      targets = targets.filter((row) => row.persistence_drift)
    }

    const updated: string[] = []
    const failed: Array<{ id: string; brand_name: string; error: string }> = []

    if (!dry_run) {
      for (const partner of targets) {
        const { error } = await supabase
          .from('partners')
          .update({
            ...partner.update_fields,
            partner_type_computed_at: new Date().toISOString(),
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

    return apiSuccess({
      dry_run,
      scanned: rows.length,
      candidates: targets.length,
      updated: dry_run ? 0 : updated.length,
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
    })
  } catch (error) {
    console.error('Partner type reconciliation failed:', error)
    return ApiErrors.database()
  }
}
