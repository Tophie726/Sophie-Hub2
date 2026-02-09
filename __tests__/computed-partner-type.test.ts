import { computePartnerType } from '@/lib/partners/computed-partner-type'

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
})
