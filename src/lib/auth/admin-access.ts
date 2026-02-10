const STATIC_ADMIN_EMAILS = [
  // External contractors with temporary admin backend access
  'aviana@codesignery.com',
  'josedalida@codesignery.com',
  'mikee@codesignery.com',
  'mcrogado@codesignery.com',
  'ac@codesignery.com',
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

