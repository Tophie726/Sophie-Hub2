/**
 * Amazon marketplace helpers.
 *
 * Notes:
 * - Keep this list additive and normalization-based so new codes can be added
 *   without changing query behavior for existing mappings.
 * - Query paths default to "all mapped marketplaces" when no filter is provided.
 */

export interface AmazonMarketplace {
  code: string
  name: string
  aliases: string[]
}

// Public Amazon marketplaces used in Sophie Hub mapping + filtering logic.
export const AMAZON_MARKETPLACES: AmazonMarketplace[] = [
  { code: 'US', name: 'United States', aliases: ['usa', 'united states', 'na us'] },
  { code: 'CA', name: 'Canada', aliases: ['canada', 'na ca'] },
  { code: 'MX', name: 'Mexico', aliases: ['mexico', 'na mx'] },
  { code: 'BR', name: 'Brazil', aliases: ['brazil', 'na br'] },
  { code: 'UK', name: 'United Kingdom', aliases: ['united kingdom', 'great britain', 'gb', 'eu uk'] },
  { code: 'DE', name: 'Germany', aliases: ['germany', 'deutschland', 'eu de'] },
  { code: 'FR', name: 'France', aliases: ['france', 'eu fr'] },
  { code: 'IT', name: 'Italy', aliases: ['italy', 'eu it'] },
  { code: 'ES', name: 'Spain', aliases: ['spain', 'eu es'] },
  { code: 'NL', name: 'Netherlands', aliases: ['netherlands', 'holland', 'eu nl'] },
  { code: 'SE', name: 'Sweden', aliases: ['sweden', 'eu se'] },
  { code: 'PL', name: 'Poland', aliases: ['poland', 'eu pl'] },
  { code: 'BE', name: 'Belgium', aliases: ['belgium', 'eu be'] },
  { code: 'IE', name: 'Ireland', aliases: ['ireland', 'eu ie'] },
  { code: 'TR', name: 'Turkey', aliases: ['turkey', 'trkiye'] },
  { code: 'JP', name: 'Japan', aliases: ['japan', 'apac jp'] },
  { code: 'AU', name: 'Australia', aliases: ['australia', 'apac au'] },
  { code: 'SG', name: 'Singapore', aliases: ['singapore', 'apac sg'] },
  { code: 'IN', name: 'India', aliases: ['india', 'apac in'] },
  { code: 'AE', name: 'United Arab Emirates', aliases: ['uae', 'united arab emirates', 'mena ae'] },
  { code: 'SA', name: 'Saudi Arabia', aliases: ['ksa', 'saudi arabia', 'mena sa'] },
  { code: 'EG', name: 'Egypt', aliases: ['egypt', 'mena eg'] },
  { code: 'ZA', name: 'South Africa', aliases: ['south africa', 'za'] },
]

const MARKETPLACE_BY_CODE = new Map(
  AMAZON_MARKETPLACES.map(marketplace => [marketplace.code, marketplace])
)

const ALIAS_TO_CODE = new Map<string, string>()

function normalizeAlias(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

for (const marketplace of AMAZON_MARKETPLACES) {
  ALIAS_TO_CODE.set(normalizeAlias(marketplace.code), marketplace.code)
  ALIAS_TO_CODE.set(normalizeAlias(marketplace.name), marketplace.code)
  for (const alias of marketplace.aliases) {
    ALIAS_TO_CODE.set(normalizeAlias(alias), marketplace.code)
  }
}

export function normalizeMarketplaceCode(value: string | null | undefined): string | null {
  if (!value) return null
  const normalized = normalizeAlias(value)
  if (!normalized) return null
  return ALIAS_TO_CODE.get(normalized) || null
}

export function normalizeMarketplaceCodes(values: Array<string | null | undefined>): string[] {
  const codes: string[] = []
  const seen = new Set<string>()

  for (const value of values) {
    const code = normalizeMarketplaceCode(value)
    if (!code || seen.has(code)) continue
    seen.add(code)
    codes.push(code)
  }

  return codes
}

function tokenize(value: string): string[] {
  return normalizeAlias(value)
    .split(' ')
    .map(token => token.trim())
    .filter(Boolean)
}

/**
 * Infer marketplace code from free text (client ID/name/brand).
 * Returns null if no reliable match is found or if ambiguous.
 */
export function inferMarketplaceCodeFromText(...values: Array<string | null | undefined>): string | null {
  const source = values
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(' ')
  if (!source) return null

  const normalized = ` ${normalizeAlias(source)} `
  const byScore = new Map<string, number>()

  for (const marketplace of AMAZON_MARKETPLACES) {
    let score = 0
    const candidates = [marketplace.code, marketplace.name, ...marketplace.aliases]
    for (const candidate of candidates) {
      const candidateNorm = normalizeAlias(candidate)
      if (!candidateNorm) continue
      if (normalized.includes(` ${candidateNorm} `)) {
        score = Math.max(score, candidateNorm.length)
      }
    }

    // Suffix bonus for compact IDs like "ASIOPPHIRE MX" or "brand-us"
    const tokens = tokenize(source)
    if (tokens.length > 0 && tokens[tokens.length - 1] === marketplace.code.toLowerCase()) {
      score = Math.max(score, 100)
    }

    if (score > 0) {
      byScore.set(marketplace.code, score)
    }
  }

  if (byScore.size === 0) return null

  const ranked = Array.from(byScore.entries()).sort((a, b) => b[1] - a[1])
  if (ranked.length === 1) return ranked[0][0]
  if (ranked[0][1] === ranked[1][1]) return null
  return ranked[0][0]
}

export function getMarketplaceByCode(code: string | null | undefined): AmazonMarketplace | null {
  if (!code) return null
  return MARKETPLACE_BY_CODE.get(code) || null
}
