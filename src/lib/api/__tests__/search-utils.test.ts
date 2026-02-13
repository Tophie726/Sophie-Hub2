import { escapePostgrestValue } from '../search-utils'

describe('escapePostgrestValue', () => {
  it('wraps result in PostgREST double-quotes with ILIKE wildcards', () => {
    expect(escapePostgrestValue('hello')).toBe('"%hello%"')
  })

  it('prevents PostgREST grammar injection (commas, dots, parens)', () => {
    // Commas, dots, and parens are grammar chars in .or() — double-quoting neutralizes them
    const result = escapePostgrestValue('test,status.eq.admin')
    expect(result).toBe('"%test,status.eq.admin%"')
    // The value is inside quotes, so PostgREST treats it as a literal string
  })

  it('escapes SQL wildcard characters', () => {
    expect(escapePostgrestValue('%')).toBe('"%\\%%"')
    expect(escapePostgrestValue('_')).toBe('"%\\_%"')
    expect(escapePostgrestValue('100%')).toBe('"%100\\%%"')
  })

  it('handles parentheses, commas, and dots inside quotes', () => {
    expect(escapePostgrestValue('foo(bar)')).toBe('"%foo(bar)%"')
    expect(escapePostgrestValue('a.b.c')).toBe('"%a.b.c%"')
    expect(escapePostgrestValue('x,y')).toBe('"%x,y%"')
  })

  it('passes through normal search terms wrapped in quotes', () => {
    expect(escapePostgrestValue('John Smith')).toBe('"%John Smith%"')
  })

  it('handles apostrophe/quote without parser break', () => {
    expect(escapePostgrestValue("o'hara")).toBe('"%o\'hara%"')
    expect(escapePostgrestValue('O\'Brien')).toBe('"%O\'Brien%"')
  })

  it('escapes double quotes inside value (PostgREST delimiter)', () => {
    expect(escapePostgrestValue('say "hello"')).toBe('"%say ""hello""%"')
  })

  it('returns empty string for empty/whitespace input', () => {
    expect(escapePostgrestValue('')).toBe('')
    expect(escapePostgrestValue('   ')).toBe('')
  })

  it('escapes backslashes before ILIKE wildcards to prevent double-escaping', () => {
    expect(escapePostgrestValue('a\\b')).toBe('"%a\\\\b%"')
    // Backslash + percent: backslash escaped first, then % escaped
    expect(escapePostgrestValue('a\\%b')).toBe('"%a\\\\\\%b%"')
  })
})
