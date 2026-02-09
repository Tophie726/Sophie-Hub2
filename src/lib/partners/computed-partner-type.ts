/**
 * Computed Partner Type
 *
 * Keeps both:
 * 1) legacy "Partner type" value from source_data
 * 2) app-derived type from staffing signals (pod leader / brand manager / conversion strategist)
 *
 * This mirrors the computed-status approach:
 * - We keep legacy for comparison and migration safety.
 * - We derive an app-side type for forward usage (billing/view logic).
 * - We flag mismatches so operators can reconcile data drift.
 */

export type CanonicalPartnerType =
  | 'ppc_basic'
  | 'sophie_ppc'
  | 'cc'
  | 'fam'
  | 'pli'
  | 'tiktok'

export const CANONICAL_PARTNER_TYPES: CanonicalPartnerType[] = [
  'ppc_basic',
  'sophie_ppc',
  'cc',
  'fam',
  'pli',
  'tiktok',
]

export const CANONICAL_PARTNER_TYPE_LABELS: Record<CanonicalPartnerType, string> = {
  ppc_basic: 'PPC Basic',
  sophie_ppc: 'The Sophie PPC Partnership',
  cc: 'CC',
  fam: 'FAM',
  pli: 'PLI',
  tiktok: 'TTS',
}

export interface ComputePartnerTypeInput {
  sourceData?: Record<string, Record<string, Record<string, unknown>>> | null
  podLeaderName?: string | null
  brandManagerName?: string | null
}

export interface ComputedPartnerTypeResult {
  computedCanonical: CanonicalPartnerType | null
  computedLabel: string
  computedSource: 'staffing' | 'legacy_partner_type' | 'unknown'
  legacyRaw: string | null
  legacyCanonical: CanonicalPartnerType | null
  legacyLabel: string | null
  staffingCanonical: CanonicalPartnerType | null
  staffingLabel: string | null
  matchesLegacy: boolean
  isSharedPartner: boolean
  reason: string
}

export interface PersistedPartnerTypeFields {
  computed_partner_type: CanonicalPartnerType | null
  computed_partner_type_source: ComputedPartnerTypeResult['computedSource']
  staffing_partner_type: CanonicalPartnerType | null
  legacy_partner_type_raw: string | null
  legacy_partner_type: CanonicalPartnerType | null
  partner_type_matches: boolean
  partner_type_is_shared: boolean
  partner_type_reason: string
  partner_type_computed_at: string
}

function normalizeText(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function firstMeaningfulValue(values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (typeof value !== 'string') continue
    const trimmed = value.trim()
    if (!trimmed) continue
    return trimmed
  }
  return null
}

function hasAssignmentSignal(value: string | null): boolean {
  if (!value) return false
  const normalized = normalizeText(value)
  if (!normalized) return false

  // Explicitly treat these as "not assigned" placeholders.
  const emptyLike = new Set(['no', 'na', 'nna', 'none', 'null', 'nill', 'unassigned'])
  return !emptyLike.has(normalized)
}

function extractSourceValueByHeaders(
  sourceData: Record<string, Record<string, Record<string, unknown>>> | null | undefined,
  headerKeys: string[]
): string | null {
  if (!sourceData) return null
  const target = new Set(headerKeys.map(normalizeText))

  for (const connector of Object.values(sourceData)) {
    if (typeof connector !== 'object' || !connector) continue
    for (const tabData of Object.values(connector)) {
      if (typeof tabData !== 'object' || !tabData) continue
      for (const [columnName, rawValue] of Object.entries(tabData)) {
        if (!target.has(normalizeText(columnName))) continue
        if (typeof rawValue !== 'string') continue
        const trimmed = rawValue.trim()
        if (trimmed) return trimmed
      }
    }
  }
  return null
}

function mapLegacyPartnerType(raw: string | null): {
  canonical: CanonicalPartnerType | null
  label: string | null
} {
  if (!raw) return { canonical: null, label: null }

  const normalized = normalizeText(raw)

  if (normalized.includes('ppcpremium') || normalized.includes('sophieppc') || normalized.includes('partnership')) {
    return { canonical: 'sophie_ppc', label: CANONICAL_PARTNER_TYPE_LABELS.sophie_ppc }
  }

  if (normalized.includes('contentpremium') || normalized.includes('onlycontent')) {
    return { canonical: 'cc', label: CANONICAL_PARTNER_TYPE_LABELS.cc }
  }

  if (normalized === 'fam' || normalized.includes('fullaccountmanagement')) {
    return { canonical: 'fam', label: CANONICAL_PARTNER_TYPE_LABELS.fam }
  }

  if (normalized.includes('t0') || normalized.includes('productincubator')) {
    return { canonical: 'pli', label: CANONICAL_PARTNER_TYPE_LABELS.pli }
  }

  if (normalized.includes('ppcclient') || normalized.includes('ppcbasic')) {
    return { canonical: 'ppc_basic', label: CANONICAL_PARTNER_TYPE_LABELS.ppc_basic }
  }

  if (normalized.includes('tts') || normalized.includes('tiktok')) {
    return { canonical: 'tiktok', label: CANONICAL_PARTNER_TYPE_LABELS.tiktok }
  }

  return { canonical: null, label: null }
}

function deriveFromStaffingSignals(input: ComputePartnerTypeInput): {
  canonical: CanonicalPartnerType | null
  label: string | null
  isSharedPartner: boolean
  reason: string
} {
  const podLeaderFromSource = extractSourceValueByHeaders(input.sourceData, [
    'POD Leader',
    'Pod Leader',
    'Pod lead',
  ])
  const brandManagerFromSource = extractSourceValueByHeaders(input.sourceData, [
    'Brand Manager',
    'Brand manager',
  ])
  const conversionStrategistFromSource = extractSourceValueByHeaders(input.sourceData, [
    'Conversion Strategist',
    'Conversion strategist',
  ])

  const podLeaderSignal = firstMeaningfulValue([input.podLeaderName, podLeaderFromSource])
  const brandManagerSignal = firstMeaningfulValue([input.brandManagerName, brandManagerFromSource])

  // No canonical DB field yet, so this is sourced from raw tab data.
  const conversionStrategistSignal = firstMeaningfulValue([conversionStrategistFromSource])

  const hasPodLeader = hasAssignmentSignal(podLeaderSignal)
  const hasBrandManager = hasAssignmentSignal(brandManagerSignal)
  const hasConversionStrategist = hasAssignmentSignal(conversionStrategistSignal)

  if (hasBrandManager) {
    if (hasPodLeader) {
      return {
        canonical: 'fam',
        label: CANONICAL_PARTNER_TYPE_LABELS.fam,
        isSharedPartner: true,
        reason: hasConversionStrategist
          ? 'Brand Manager + PPC Strategist + Conversion Strategist -> shared FAM + PPC support'
          : 'Brand Manager + PPC Strategist -> shared FAM + PPC Basic',
      }
    }

    return {
      canonical: 'fam',
      label: CANONICAL_PARTNER_TYPE_LABELS.fam,
      isSharedPartner: false,
      reason: hasConversionStrategist
        ? 'Brand Manager without PPC Strategist -> FAM owns PPC/CC'
        : 'Brand Manager without PPC Strategist/Conversion Strategist -> FAM handling PPC/CC under pod',
    }
  }

  if (hasPodLeader && hasConversionStrategist) {
    return {
      canonical: 'sophie_ppc',
      label: CANONICAL_PARTNER_TYPE_LABELS.sophie_ppc,
      isSharedPartner: false,
      reason: 'PPC Strategist + Conversion Strategist -> The Sophie PPC Partnership',
    }
  }

  if (hasPodLeader) {
    return {
      canonical: 'ppc_basic',
      label: CANONICAL_PARTNER_TYPE_LABELS.ppc_basic,
      isSharedPartner: false,
      reason: 'PPC Strategist present -> PPC Basic',
    }
  }

  return {
    canonical: null,
    label: null,
    isSharedPartner: false,
    reason: 'No staffing-derived partner type signals',
  }
}

export function computePartnerType(input: ComputePartnerTypeInput): ComputedPartnerTypeResult {
  const legacyRaw = extractSourceValueByHeaders(input.sourceData, ['Partner type', 'Partner Type'])
  const legacy = mapLegacyPartnerType(legacyRaw)
  const staffing = deriveFromStaffingSignals(input)

  const computedCanonical = staffing.canonical ?? legacy.canonical
  const computedLabel = computedCanonical
    ? CANONICAL_PARTNER_TYPE_LABELS[computedCanonical]
    : 'Unknown'
  const computedSource: ComputedPartnerTypeResult['computedSource'] = staffing.canonical
    ? 'staffing'
    : legacy.canonical
      ? 'legacy_partner_type'
      : 'unknown'

  const matchesLegacy = !(staffing.canonical && legacy.canonical) || staffing.canonical === legacy.canonical

  let reason = staffing.reason
  if (staffing.canonical && legacy.canonical && staffing.canonical !== legacy.canonical) {
    reason += `; legacy Partner type maps to ${CANONICAL_PARTNER_TYPE_LABELS[legacy.canonical]}`
  } else if (!staffing.canonical && legacy.canonical) {
    reason = 'No staffing signal; falling back to legacy Partner type'
  }

  return {
    computedCanonical,
    computedLabel,
    computedSource,
    legacyRaw,
    legacyCanonical: legacy.canonical,
    legacyLabel: legacy.label,
    staffingCanonical: staffing.canonical,
    staffingLabel: staffing.label,
    matchesLegacy,
    isSharedPartner: staffing.isSharedPartner,
    reason,
  }
}

export function buildPartnerTypePersistenceFields(
  input: ComputePartnerTypeInput,
  computedAt: string = new Date().toISOString()
): PersistedPartnerTypeFields {
  const computed = computePartnerType(input)

  return {
    computed_partner_type: computed.computedCanonical,
    computed_partner_type_source: computed.computedSource,
    staffing_partner_type: computed.staffingCanonical,
    legacy_partner_type_raw: computed.legacyRaw,
    legacy_partner_type: computed.legacyCanonical,
    partner_type_matches: computed.matchesLegacy,
    partner_type_is_shared: computed.isSharedPartner,
    partner_type_reason: computed.reason,
    partner_type_computed_at: computedAt,
  }
}
