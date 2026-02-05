/**
 * Tests for sync value transforms.
 *
 * Source: src/lib/sync/transforms.ts
 */
import { applyTransform, getTransform, isValidTransform } from '@/lib/sync/transforms'

describe('isValidTransform()', () => {
  it('recognizes all valid transform types', () => {
    const validTypes = ['none', 'trim', 'lowercase', 'uppercase', 'date', 'currency', 'boolean', 'number', 'json', 'value_mapping']
    for (const t of validTypes) {
      expect(isValidTransform(t)).toBe(true)
    }
  })

  it('rejects invalid transform types', () => {
    expect(isValidTransform('regex')).toBe(false)
    expect(isValidTransform('custom')).toBe(false)
    expect(isValidTransform('')).toBe(false)
  })
})

describe('getTransform()', () => {
  it('returns a function for each type', () => {
    expect(typeof getTransform('none')).toBe('function')
    expect(typeof getTransform('trim')).toBe('function')
    expect(typeof getTransform(null)).toBe('function')
  })

  it('falls back to none for null', () => {
    const result = getTransform(null)
    expect(result('hello')).toBe('hello')
  })
})

// =========================================================================
// Transform: none
// =========================================================================

describe('transform: none', () => {
  it('passes value through unchanged', () => {
    expect(applyTransform('hello', 'none')).toBe('hello')
    expect(applyTransform('  spaces  ', 'none')).toBe('  spaces  ')
    expect(applyTransform('', 'none')).toBe('')
  })
})

// =========================================================================
// Transform: trim
// =========================================================================

describe('transform: trim', () => {
  it('trims leading and trailing whitespace', () => {
    expect(applyTransform('  hello  ', 'trim')).toBe('hello')
    expect(applyTransform('\thello\n', 'trim')).toBe('hello')
  })

  it('returns empty string for whitespace-only input', () => {
    expect(applyTransform('   ', 'trim')).toBe('')
  })
})

// =========================================================================
// Transform: lowercase
// =========================================================================

describe('transform: lowercase', () => {
  it('converts to lowercase', () => {
    expect(applyTransform('HELLO', 'lowercase')).toBe('hello')
    expect(applyTransform('Active', 'lowercase')).toBe('active')
  })
})

// =========================================================================
// Transform: uppercase
// =========================================================================

describe('transform: uppercase', () => {
  it('converts to uppercase', () => {
    expect(applyTransform('hello', 'uppercase')).toBe('HELLO')
  })
})

// =========================================================================
// Transform: date
// =========================================================================

describe('transform: date', () => {
  it('parses ISO date strings', () => {
    const result = applyTransform('2024-01-15', 'date') as string
    expect(result).toContain('2024-01-15')
  })

  it('parses MM/DD/YYYY format', () => {
    const result = applyTransform('01/15/2024', 'date') as string
    expect(result).toContain('2024')
  })

  it('parses 2-digit year format', () => {
    const result = applyTransform('01/15/24', 'date') as string
    expect(result).toContain('2024')
  })

  it('returns date_only format when configured', () => {
    const result = applyTransform('2024-01-15T10:30:00Z', 'date', { format: 'date_only' }) as string
    expect(result).toBe('2024-01-15')
  })

  it('returns null for empty value', () => {
    expect(applyTransform('', 'date')).toBeNull()
  })

  it('returns null for whitespace-only', () => {
    expect(applyTransform('   ', 'date')).toBeNull()
  })

  it('returns null for unparseable date', () => {
    expect(applyTransform('not-a-date', 'date')).toBeNull()
  })
})

// =========================================================================
// Transform: currency
// =========================================================================

describe('transform: currency', () => {
  it('parses dollar amounts', () => {
    expect(applyTransform('$1,234.56', 'currency')).toBe(1234.56)
  })

  it('handles no currency symbol', () => {
    expect(applyTransform('1234.56', 'currency')).toBe(1234.56)
  })

  it('handles euro and pound symbols', () => {
    expect(applyTransform('£50.00', 'currency')).toBe(50)
    expect(applyTransform('€99.99', 'currency')).toBe(99.99)
  })

  it('converts to cents when configured', () => {
    expect(applyTransform('$12.34', 'currency', { asCents: true })).toBe(1234)
  })

  it('rounds cents correctly', () => {
    expect(applyTransform('$9.999', 'currency', { asCents: true })).toBe(1000)
  })

  it('returns null for empty value', () => {
    expect(applyTransform('', 'currency')).toBeNull()
  })

  it('returns null for non-numeric string', () => {
    expect(applyTransform('abc', 'currency')).toBeNull()
  })
})

// =========================================================================
// Transform: boolean
// =========================================================================

describe('transform: boolean', () => {
  it('converts truthy strings to true', () => {
    const truthyValues = ['true', 'yes', 'y', '1', 'on', 'active', 'enabled']
    for (const v of truthyValues) {
      expect(applyTransform(v, 'boolean')).toBe(true)
    }
  })

  it('converts falsy strings to false', () => {
    const falsyValues = ['false', 'no', 'n', '0', 'off', 'inactive', 'disabled']
    for (const v of falsyValues) {
      expect(applyTransform(v, 'boolean')).toBe(false)
    }
  })

  it('is case-insensitive', () => {
    expect(applyTransform('TRUE', 'boolean')).toBe(true)
    expect(applyTransform('Yes', 'boolean')).toBe(true)
    expect(applyTransform('FALSE', 'boolean')).toBe(false)
  })

  it('trims whitespace', () => {
    expect(applyTransform('  yes  ', 'boolean')).toBe(true)
  })

  it('returns null for unknown values', () => {
    expect(applyTransform('maybe', 'boolean')).toBeNull()
  })

  it('uses defaultValue from config', () => {
    expect(applyTransform('maybe', 'boolean', { defaultValue: false })).toBe(false)
    expect(applyTransform('', 'boolean', { defaultValue: true })).toBe(true)
  })
})

// =========================================================================
// Transform: number
// =========================================================================

describe('transform: number', () => {
  it('parses integers', () => {
    expect(applyTransform('42', 'number')).toBe(42)
  })

  it('parses floats', () => {
    expect(applyTransform('3.14', 'number')).toBe(3.14)
  })

  it('removes commas', () => {
    expect(applyTransform('1,234,567', 'number')).toBe(1234567)
  })

  it('parses as integer when configured', () => {
    expect(applyTransform('3.14', 'number', { integer: true })).toBe(3)
  })

  it('returns null for empty value', () => {
    expect(applyTransform('', 'number')).toBeNull()
  })

  it('returns null for non-numeric', () => {
    expect(applyTransform('abc', 'number')).toBeNull()
  })
})

// =========================================================================
// Transform: json
// =========================================================================

describe('transform: json', () => {
  it('parses valid JSON', () => {
    expect(applyTransform('{"key":"value"}', 'json')).toEqual({ key: 'value' })
  })

  it('parses JSON arrays', () => {
    expect(applyTransform('[1,2,3]', 'json')).toEqual([1, 2, 3])
  })

  it('returns null for invalid JSON', () => {
    expect(applyTransform('not json', 'json')).toBeNull()
  })

  it('returns null for empty value', () => {
    expect(applyTransform('', 'json')).toBeNull()
  })
})

// =========================================================================
// Transform: value_mapping
// =========================================================================

describe('transform: value_mapping', () => {
  const mappings = {
    mappings: {
      'Active': 'active',
      'Churned': 'churned',
      'Paused': 'paused',
    },
    default: 'unknown',
  }

  it('maps exact match', () => {
    expect(applyTransform('Active', 'value_mapping', mappings)).toBe('active')
    expect(applyTransform('Churned', 'value_mapping', mappings)).toBe('churned')
  })

  it('maps case-insensitive', () => {
    expect(applyTransform('active', 'value_mapping', mappings)).toBe('active')
    expect(applyTransform('ACTIVE', 'value_mapping', mappings)).toBe('active')
  })

  it('returns default for unmapped value', () => {
    expect(applyTransform('Inactive', 'value_mapping', mappings)).toBe('unknown')
  })

  it('returns null when no default set', () => {
    expect(applyTransform('Unknown', 'value_mapping', { mappings: { 'A': 'a' } })).toBeNull()
  })

  it('trims whitespace before matching', () => {
    expect(applyTransform('  Active  ', 'value_mapping', mappings)).toBe('active')
  })

  it('returns default for empty value', () => {
    expect(applyTransform('', 'value_mapping', mappings)).toBe('unknown')
  })
})
