const STATIC_ADMIN_EMAILS = [
  // External contractors with temporary admin backend access
  'aviana@codesignery.com',
  'josedalida@codesignery.com',
  'mikee@codesignery.com',
]

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function getAdminEmailAllowlist(rawEnvValue: string | undefined = process.env.ADMIN_EMAILS): Set<string> {
  const fromEnv = (rawEnvValue || '')
    .split(',')
    .map(normalizeEmail)
    .filter(Boolean)

  return new Set([
    ...STATIC_ADMIN_EMAILS,
    ...fromEnv,
  ])
}

export function isAdminEmail(email: string, rawEnvValue: string | undefined = process.env.ADMIN_EMAILS): boolean {
  const normalized = normalizeEmail(email)
  return getAdminEmailAllowlist(rawEnvValue).has(normalized)
}

/**
 * Check if a user is a "true admin" — full admin (staffRole === 'admin')
 * or listed in ADMIN_EMAILS.
 *
 * operations_admin is explicitly excluded. This matches the See-As policy
 * and is required for preview impersonation (HR-7).
 */
export function isTrueAdmin(staffRole: string | null, email: string): boolean {
  if (isAdminEmail(email)) return true
  return staffRole === 'admin'
}

