import { getAdminEmailAllowlist, isAdminEmail } from '@/lib/auth/admin-access'

describe('admin access allowlist', () => {
  it('includes static contractor admin emails', () => {
    expect(isAdminEmail('aviana@codesignery.com', '')).toBe(true)
    expect(isAdminEmail('josedalida@codesignery.com', '')).toBe(true)
    expect(isAdminEmail('mikee@codesignery.com', '')).toBe(true)
  })

  it('merges ADMIN_EMAILS env values with static allowlist', () => {
    const allowlist = getAdminEmailAllowlist('admin@test.com,tomas@sophiesociety.com')

    expect(allowlist.has('admin@test.com')).toBe(true)
    expect(allowlist.has('tomas@sophiesociety.com')).toBe(true)
    expect(allowlist.has('aviana@codesignery.com')).toBe(true)
  })

  it('normalizes case and whitespace', () => {
    expect(isAdminEmail('  AViAnA@CodeSignery.com  ', '')).toBe(true)
  })
})

