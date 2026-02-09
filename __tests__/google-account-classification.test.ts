import { classifyGoogleAccountEmail, resolveGoogleAccountType } from '@/lib/google-workspace/account-classification'

describe('Google account classification', () => {
  it('classifies role inbox aliases with numeric suffixes as shared', () => {
    expect(classifyGoogleAccountEmail('brandmanager21@sophiesociety.com')).toMatchObject({
      type: 'shared_account',
    })
    expect(classifyGoogleAccountEmail('catalogue9@sophiesociety.com')).toMatchObject({
      type: 'shared_account',
    })
  })

  it('classifies partner and pod role aliases as shared', () => {
    expect(classifyGoogleAccountEmail('partner-success@sophiesociety.com')).toMatchObject({
      type: 'shared_account',
    })
    expect(classifyGoogleAccountEmail('partneradmin@sophiesociety.com')).toMatchObject({
      type: 'shared_account',
    })
    expect(classifyGoogleAccountEmail('podanalytics@sophiesociety.com')).toMatchObject({
      type: 'shared_account',
    })
  })

  it('keeps real personal emails as person', () => {
    expect(classifyGoogleAccountEmail('chris.rawlings@sophiesociety.com')).toMatchObject({
      type: 'person',
    })
    expect(classifyGoogleAccountEmail('kevin@sophiesociety.com')).toMatchObject({
      type: 'person',
    })
  })

  it('does not let human full_name override a shared email classification', () => {
    const resolved = resolveGoogleAccountType('brandmanager21@sophiesociety.com', null, {
      fullName: 'Chris Rawlings',
      orgUnitPath: '/',
      title: null,
    })

    expect(resolved.type).toBe('shared_account')
    expect(resolved.overridden).toBe(false)
  })
})
