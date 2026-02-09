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

  it('keeps explicit personal alias patterns as person', () => {
    expect(classifyGoogleAccountEmail('chris.rawlings@sophiesociety.com')).toMatchObject({
      type: 'person',
    })
  })

  it('treats ambiguous single-token emails as shared until human-name evidence exists', () => {
    expect(classifyGoogleAccountEmail('kevin@sophiesociety.com')).toMatchObject({
      type: 'shared_account',
    })

    expect(
      resolveGoogleAccountType('kevin@sophiesociety.com', null, {
        fullName: 'Kevin Rodriguez',
        orgUnitPath: '/',
        title: null,
      })
    ).toMatchObject({
      type: 'person',
      reason: 'human_name_email_match',
    })
  })

  it('promotes fallback single-token aliases to person when name convention matches', () => {
    expect(
      resolveGoogleAccountType('ana@sophiesociety.com', null, {
        fullName: 'Ana Maria Gavrilović',
        orgUnitPath: '/',
        title: null,
      })
    ).toMatchObject({
      type: 'person',
      reason: 'human_name_email_match',
    })

    expect(
      resolveGoogleAccountType('viki@sophiesociety.com', null, {
        fullName: 'Viktorija Tuomas',
        orgUnitPath: '/',
        title: null,
      })
    ).toMatchObject({
      type: 'person',
      reason: 'human_name_email_match',
    })
  })

  it('keeps fallback aliases shared when shared-name context is present', () => {
    expect(
      resolveGoogleAccountType('analytics@sophiesociety.com', null, {
        fullName: 'Sophie Society',
        orgUnitPath: '/',
        title: null,
      })
    ).toMatchObject({
      type: 'shared_account',
      reason: 'shared_name_hint',
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

  it('keeps partner/pod role aliases as shared even with a human display name', () => {
    expect(
      resolveGoogleAccountType('partner-success@sophiesociety.com', null, {
        fullName: 'Chris Rawlings',
        orgUnitPath: '/',
        title: null,
      })
    ).toMatchObject({
      type: 'shared_account',
    })

    expect(
      resolveGoogleAccountType('podanalytics@sophiesociety.com', null, {
        fullName: 'Richard Turner',
        orgUnitPath: '/',
        title: null,
      })
    ).toMatchObject({
      type: 'shared_account',
    })
  })
})
