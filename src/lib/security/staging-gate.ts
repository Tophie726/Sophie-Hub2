const COOKIE_PREFIX = 'sophie-gate-v1:'

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return toHex(digest)
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

export async function createStagingGateCookieValue(stagingPassword: string): Promise<string> {
  const hash = await sha256(stagingPassword)
  return `${COOKIE_PREFIX}${hash}`
}

export async function isValidStagingGateCookie(cookieValue: string, stagingPassword: string): Promise<boolean> {
  if (!cookieValue || !stagingPassword) return false

  const expected = await createStagingGateCookieValue(stagingPassword)
  return safeEqual(cookieValue, expected)
}
