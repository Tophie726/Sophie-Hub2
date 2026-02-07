/**
 * Heuristics for distinguishing person accounts from shared inbox/service accounts.
 *
 * This is intentionally conservative: if uncertain, classify as "person" to avoid
 * suppressing legitimate staff accounts from matching flows.
 */

export type GoogleAccountType = 'person' | 'shared_account'
export type GoogleAccountTypeOverride = GoogleAccountType | null

const SHARED_KEYWORDS = [
  'admin',
  'audit',
  'audits',
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
  'customer-service',
  'customer_service',
  'noreply',
  'no-reply',
  'notifications',
  'customersuccess',
  'brandmanager',
  'contentmanager',
]

const PERSON_PATTERN = /^[a-z]+([._-][a-z]+)+$/i

export function classifyGoogleAccountEmail(email: string): {
  type: GoogleAccountType
  reason: string
} {
  const localPart = email.split('@')[0]?.toLowerCase() || ''
  if (!localPart) {
    return { type: 'person', reason: 'no_local_part' }
  }

  const collapsed = localPart.replace(/[._-]/g, '')
  const tokens = localPart.split(/[._-]+/).filter(Boolean)
  const sharedTokenSet = new Set(SHARED_KEYWORDS.map(k => k.toLowerCase()))
  const sharedCollapsedSet = new Set(SHARED_KEYWORDS.map(k => k.toLowerCase().replace(/[-_]/g, '')))

  // Shared account detection first, using exact token/alias matches.
  // Avoid substring matching (e.g. "chris" should not match "hr").
  if (tokens.some(token => sharedTokenSet.has(token)) || sharedCollapsedSet.has(collapsed)) {
    return { type: 'shared_account', reason: 'shared_keyword_match' }
  }

  if (PERSON_PATTERN.test(localPart)) {
    return { type: 'person', reason: 'name_like_pattern' }
  }

  return { type: 'person', reason: 'default_person' }
}

export function resolveGoogleAccountType(
  email: string,
  override: GoogleAccountTypeOverride | undefined
): { type: GoogleAccountType; reason: string; overridden: boolean } {
  if (override === 'person' || override === 'shared_account') {
    return {
      type: override,
      reason: `manual_override:${override}`,
      overridden: true,
    }
  }

  const auto = classifyGoogleAccountEmail(email)
  return {
    type: auto.type,
    reason: auto.reason,
    overridden: false,
  }
}
