import { buildPartnerTypePersistenceFields, computePartnerType } from '@/lib/partners/computed-partner-type'

function buildSourceData(values: Record<string, string>) {
  return {
    gsheets: {
      'Master Client Sheet': values,
    },
  }
}

describe('computePartnerType', () => {
  it('maps legacy Partner type and falls back when staffing signals are missing', () => {
    const result = computePartnerType({
      sourceData: buildSourceData({
        'Partner type': 'PPC Premium',
      }),
      podLeaderName: null,
      brandManagerName: null,
    })

    expect(result.computedCanonical).toBe('sophie_ppc')
    expect(result.computedSource).toBe('legacy_partner_type')
    expect(result.legacyCanonical).toBe('sophie_ppc')
    expect(result.matchesLegacy).toBe(true)
  })

  it('derives FAM shared model from Brand Manager + Pod Leader and flags mismatch', () => {
    const result = computePartnerType({
      sourceData: buildSourceData({
        'Partner type': 'PPC Client',
      }),
      podLeaderName: 'Matias',
      brandManagerName: 'Nina',
    })

    expect(result.computedCanonical).toBe('fam')
    expect(result.computedSource).toBe('staffing')
    expect(result.isSharedPartner).toBe(true)
    expect(result.matchesLegacy).toBe(false)
  })

  it('derives Sophie PPC Partnership from Pod Leader + Conversion Strategist', () => {
    const result = computePartnerType({
      sourceData: buildSourceData({
        'Conversion Strategist': 'Sam',
      }),
      podLeaderName: 'Matias',
      brandManagerName: null,
    })

    expect(result.computedCanonical).toBe('sophie_ppc')
    expect(result.computedSource).toBe('staffing')
    expect(result.matchesLegacy).toBe(true)
  })

  it('ignores Content Subscriber as a partner type signal', () => {
    const result = computePartnerType({
      sourceData: buildSourceData({
        'Content Subscriber': 'Yes (Premium)',
      }),
      podLeaderName: null,
      brandManagerName: null,
    })

    expect(result.computedCanonical).toBeNull()
    expect(result.computedSource).toBe('unknown')
    expect(result.legacyCanonical).toBeNull()
  })

  it('maps T0 / Product Incubator to PLI', () => {
    const result = computePartnerType({
      sourceData: buildSourceData({
        'Partner type': 'T0 / Product Incubator',
      }),
      podLeaderName: null,
      brandManagerName: null,
    })

    expect(result.computedCanonical).toBe('pli')
    expect(result.computedLabel).toBe('PLI')
  })

  it('builds persisted fields payload for partner writes', () => {
    const computedAt = '2026-02-09T00:00:00.000Z'
    const fields = buildPartnerTypePersistenceFields({
      sourceData: buildSourceData({
        'Partner type': 'PPC Client',
        'Conversion Strategist': 'Sam',
      }),
      podLeaderName: 'Matias',
      brandManagerName: null,
    }, computedAt)

    expect(fields).toEqual({
      computed_partner_type: 'sophie_ppc',
      computed_partner_type_source: 'staffing',
      staffing_partner_type: 'sophie_ppc',
      legacy_partner_type_raw: 'PPC Client',
      legacy_partner_type: 'ppc_basic',
      partner_type_matches: false,
      partner_type_is_shared: false,
      partner_type_reason: 'PPC Strategist + Conversion Strategist -> The Sophie PPC Partnership; legacy Partner type maps to PPC Basic',
      partner_type_computed_at: computedAt,
    })
  })
})
