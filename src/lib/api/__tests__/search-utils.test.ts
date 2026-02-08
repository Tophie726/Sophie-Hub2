import { describe, it, expect } from 'vitest'
import { escapePostgrestValue } from '../search-utils'

describe('escapePostgrestValue', () => {
  it('escapes PostgREST grammar injection payload', () => {
    const result = escapePostgrestValue('test,status.eq.admin')
    expect(result).toBe('test\\,status\\.eq\\.admin')
    expect(result).not.toContain(',status.eq.')
  })

  it('escapes SQL wildcard characters', () => {
    expect(escapePostgrestValue('%')).toBe('\\%')
    expect(escapePostgrestValue('_')).toBe('\\_')
    expect(escapePostgrestValue('100%')).toBe('100\\%')
  })

  it('escapes parentheses, commas, and dots', () => {
    expect(escapePostgrestValue('foo(bar)')).toBe('foo\\(bar\\)')
    expect(escapePostgrestValue('a.b.c')).toBe('a\\.b\\.c')
    expect(escapePostgrestValue('x,y')).toBe('x\\,y')
  })

  it('passes through normal search terms unchanged', () => {
    expect(escapePostgrestValue('John Smith')).toBe('John Smith')
    expect(escapePostgrestValue('hello')).toBe('hello')
  })

  it('handles apostrophe/quote without parser break', () => {
    expect(escapePostgrestValue("o'hara")).toBe("o'hara")
    expect(escapePostgrestValue('O\'Brien')).toBe("O'Brien")
  })

  it('returns empty string for empty/whitespace input', () => {
    expect(escapePostgrestValue('')).toBe('')
    expect(escapePostgrestValue('   ')).toBe('')
  })

  it('escapes backslashes first to prevent double-escaping', () => {
    expect(escapePostgrestValue('a\\b')).toBe('a\\\\b')
  })
})
