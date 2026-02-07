/**
 * Staff lifecycle helpers used by connector mapping logic.
 *
 * The status field is historically free-form in some environments, so we
 * normalize by pattern and keep checks conservative.
 */

const INACTIVE_STATUS_KEYWORDS = [
  'inactive',
  'departed',
  'legacy_hidden',
  'legacy',
  'hidden',
  'archived',
  'archive',
]

export function normalizeStaffStatus(status: string | null | undefined): string {
  return (status || '').trim().toLowerCase()
}

/**
 * Whether this staff record should be considered an active lifecycle record for
 * auto-mapping and "active staff user" counts.
 */
export function isStaffEligibleForAutoMapping(status: string | null | undefined): boolean {
  const normalized = normalizeStaffStatus(status)
  if (!normalized) return true

  return !INACTIVE_STATUS_KEYWORDS.some(keyword => normalized.includes(keyword))
}
