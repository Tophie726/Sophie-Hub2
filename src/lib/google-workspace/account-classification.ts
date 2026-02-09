/**
 * Heuristics for distinguishing person accounts from shared inbox/service accounts.
 *
 * This is intentionally conservative toward shared classification:
 * if uncertain, classify as shared_account and require operator override.
 */

export type GoogleAccountType = 'person' | 'shared_account'
export type GoogleAccountTypeOverride = GoogleAccountType | null

interface GoogleAccountClassificationContext {
  fullName?: string | null
  orgUnitPath?: string | null
  title?: string | null
}

const SHARED_KEYWORDS = [
  'admin',
  'audit',
  'audits',
  'catalog',
  'catalogue',
  'catalogmanager',
  'cataloguemanager',
  'support',
  'help',
  'hello',
  'info',
  'marketing',
  'sales',
  'finance',
  'billing',
  'accounts',
  'hr',
  'people',
  'careers',
  'jobs',
  'team',
  'office',
  'operations',
  'ops',
  'brand',
  'content',
  'social',
  'socials',
  'media',
  'legal',
  'compliance',
  'customer',
  'customerservice',
  'customersuccess',
  'customer-service',
  'customer_service',
  'leadgen',
  'lead-gen',
  'lead_gen',
  'leadgeneration',
  'lead-generation',
  'lead_generation',
  'bizdev',
  'businessdev',
  'business-development',
  'business_development',
  'growth',
  'partnerships',
  'partneradmin',
  'partner-admin',
  'partner_admin',
  'partnersuccess',
  'partner-success',
  'partner_success',
  'podanalytics',
  'pod-analytics',
  'pod_analytics',
  'procurement',
  'comms',
  'noreply',
  'no-reply',
  'notifications',
  'brandmanager',
  'contentmanager',
]

/**
 * Prefix-only hints catch role aliases with numeric suffixes, e.g. leadgen2@...
 * Keep this list narrow to avoid false positives.
 */
const SHARED_PREFIX_HINTS = [
  'leadgen',
  'leadgeneration',
  'catalog',
  'catalogue',
  'brandmanager',
  'contentmanager',
  'noreply',
  'notifications',
  'billing',
  'support',
  'admin',
  'audit',
  'partneradmin',
  'partnersuccess',
  'podanalytics',
]

/**
 * Compound token rules for role aliases that are split by separator:
 * - partner-success@
 * - pod-analytics@
 */
const SHARED_COMPOUND_TOKENS: Array<[string, string]> = [
  ['partner', 'admin'],
  ['partner', 'success'],
  ['pod', 'analytics'],
]

const PERSON_PATTERN = /^[a-z]+([._-][a-z]+)+$/i
const HUMAN_FULL_NAME_PATTERN = /^[a-z]+(?:\s+[a-z'’-]+){1,2}$/i
const SHARED_NAME_HINTS = [
  'sophie society',
  'lead gen',
  'lead generation',
  'support',
  'customer service',
  'customer success',
  'audits',
  'audit',
  'operations',
  'finance',
  'admin',
]
const SHARED_ORG_UNIT_HINTS = [
  'shared',
  'inbox',
  'group',
  'service-account',
  'service_account',
  'serviceaccounts',
  'aliases',
  'systems',
]
const SHARED_TITLE_HINTS = [
  'shared inbox',
  'team inbox',
  'support inbox',
  'distribution list',
  'service account',
  'group mailbox',
]

function normalizeToken(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z]/g, '')
}

function extractNameTokens(fullName: string): string[] {
  return fullName
    .split(/\s+/)
    .map(normalizeToken)
    .filter(token => token.length >= 2)
}

function emailMatchesHumanName(localPart: string, fullName: string): boolean {
  const nameTokens = extractNameTokens(fullName)
  if (nameTokens.length < 2) return false

  const first = nameTokens[0]
  const last = nameTokens[nameTokens.length - 1]
  const localCollapsed = normalizeToken(localPart).replace(/\d+$/g, '')
  const localTokens = localPart
    .split(/[._-]+/)
    .map(normalizeToken)
    .filter(Boolean)

  if (!localCollapsed) return false

  // Direct token matches (first-name aliases are common in this workspace).
  if (localCollapsed === first || localCollapsed === last) return true

  // Common generated aliases.
  const commonAliases = new Set([
    `${first}${last}`,
    `${first}${last.charAt(0)}`,
    `${first.charAt(0)}${last}`,
  ])
  if (commonAliases.has(localCollapsed)) return true

  // Tokenized aliases: first.last, first_l, f.last, etc.
  if (localTokens.length >= 2) {
    const tokenMatches = localTokens.every(token => {
      if (!token) return false
      if (nameTokens.includes(token)) return true
      return nameTokens.some(name => token.length === 1 && name.startsWith(token))
    })
    if (tokenMatches) return true
  }

  return false
}

export function classifyGoogleAccountEmail(email: string): {
  type: GoogleAccountType
  reason: string
} {
  const localPart = email.split('@')[0]?.toLowerCase() || ''
  if (!localPart) {
    return { type: 'shared_account', reason: 'no_local_part' }
  }

  const collapsed = localPart.replace(/[._-]/g, '')
  const collapsedNoDigits = collapsed.replace(/\d+$/g, '')
  const tokens = localPart.split(/[._-]+/).filter(Boolean)
  const normalizedTokens = tokens.map(token => token.replace(/\d+$/g, ''))
  const sharedTokenSet = new Set(SHARED_KEYWORDS.map(k => k.toLowerCase()))
  const sharedCollapsedSet = new Set(SHARED_KEYWORDS.map(k => k.toLowerCase().replace(/[-_]/g, '')))

  // Shared account detection first, using exact token/alias matches.
  // Avoid substring matching (e.g. "chris" should not match "hr").
  if (
    normalizedTokens.some(token => sharedTokenSet.has(token)) ||
    sharedCollapsedSet.has(collapsed) ||
    sharedCollapsedSet.has(collapsedNoDigits)
  ) {
    return { type: 'shared_account', reason: 'shared_keyword_match' }
  }

  if (
    SHARED_COMPOUND_TOKENS.some(
      ([a, b]) => normalizedTokens.includes(a) && normalizedTokens.includes(b)
    )
  ) {
    return { type: 'shared_account', reason: 'shared_compound_hint' }
  }

  if (SHARED_PREFIX_HINTS.some(prefix => collapsed.startsWith(prefix))) {
    return { type: 'shared_account', reason: 'shared_prefix_hint' }
  }

  // Strong person-only email pattern: explicit first.last style.
  if (PERSON_PATTERN.test(localPart) && /[._-]/.test(localPart)) {
    return { type: 'person', reason: 'name_like_pattern' }
  }

  return { type: 'shared_account', reason: 'default_shared_fallback' }
}

export function resolveGoogleAccountType(
  email: string,
  override: GoogleAccountTypeOverride | undefined,
  context?: GoogleAccountClassificationContext
): { type: GoogleAccountType; reason: string; overridden: boolean } {
  if (override === 'person' || override === 'shared_account') {
    return {
      type: override,
      reason: `manual_override:${override}`,
      overridden: true,
    }
  }

  const auto = classifyGoogleAccountEmail(email)
  if (auto.type === 'shared_account') {
    // Some person aliases are single-token (e.g., "kevin@").
    // Promote to person only when we have positive human-name evidence.
    const fullName = (context?.fullName || '').trim().toLowerCase()
    if (fullName && HUMAN_FULL_NAME_PATTERN.test(fullName) && emailMatchesHumanName(email.split('@')[0] || '', fullName)) {
      return {
        type: 'person',
        reason: 'human_name_email_match',
        overridden: false,
      }
    }

    return {
      type: auto.type,
      reason: auto.reason,
      overridden: false,
    }
  }

  const fullName = (context?.fullName || '').trim().toLowerCase()
  const orgUnitPath = (context?.orgUnitPath || '').trim().toLowerCase()
  const title = (context?.title || '').trim().toLowerCase()

  if (orgUnitPath && SHARED_ORG_UNIT_HINTS.some(h => orgUnitPath.includes(h))) {
    return {
      type: 'shared_account',
      reason: 'shared_org_unit_hint',
      overridden: false,
    }
  }

  if (title && SHARED_TITLE_HINTS.some(h => title.includes(h))) {
    return {
      type: 'shared_account',
      reason: 'shared_title_hint',
      overridden: false,
    }
  }

  if (fullName) {
    if (SHARED_NAME_HINTS.some(h => fullName.includes(h))) {
      return {
        type: 'shared_account',
        reason: 'shared_name_hint',
        overridden: false,
      }
    }

    if (HUMAN_FULL_NAME_PATTERN.test(fullName) && PERSON_PATTERN.test(email.split('@')[0]?.toLowerCase() || '')) {
      return {
        type: 'person',
        reason: 'human_name_pattern',
        overridden: false,
      }
    }
  }

  return {
    type: 'shared_account',
    reason: 'default_shared_fallback',
    overridden: false,
  }
}
