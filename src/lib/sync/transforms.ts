/**
 * Value Transformers
 *
 * Transform functions for converting source values to target formats.
 */

import type { TransformFn, TransformType } from './types'

// =============================================================================
// Transform Registry
// =============================================================================

const transforms: Record<TransformType, TransformFn> = {
  none: (value) => value,

  trim: (value) => value.trim(),

  lowercase: (value) => value.toLowerCase(),

  uppercase: (value) => value.toUpperCase(),

  date: (value, config) => {
    if (!value) return null
    const trimmed = value.trim()
    if (!trimmed) return null

    // Try parsing with various formats
    const date = new Date(trimmed)
    if (!isNaN(date.getTime())) {
      // Return ISO format by default
      return config?.format === 'date_only'
        ? date.toISOString().split('T')[0]
        : date.toISOString()
    }

    // Handle MM/DD/YYYY format
    const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
    if (slashMatch) {
      const [, month, day, year] = slashMatch
      const fullYear = year.length === 2 ? `20${year}` : year
      const parsed = new Date(`${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`)
      if (!isNaN(parsed.getTime())) {
        return config?.format === 'date_only'
          ? parsed.toISOString().split('T')[0]
          : parsed.toISOString()
      }
    }

    return null // Could not parse
  },

  currency: (value, config) => {
    if (!value) return null
    const trimmed = value.trim()
    if (!trimmed) return null

    // Remove currency symbols and commas
    const cleaned = trimmed.replace(/[$£€,]/g, '')
    const num = parseFloat(cleaned)

    if (isNaN(num)) return null

    // Return as cents/pence if specified
    if (config?.asCents) {
      return Math.round(num * 100)
    }

    return num
  },

  boolean: (value, config) => {
    if (!value) return config?.defaultValue ?? null
    const lower = value.toLowerCase().trim()

    // Truthy values
    if (['true', 'yes', 'y', '1', 'on', 'active', 'enabled'].includes(lower)) {
      return true
    }

    // Falsy values
    if (['false', 'no', 'n', '0', 'off', 'inactive', 'disabled'].includes(lower)) {
      return false
    }

    return config?.defaultValue ?? null
  },

  number: (value, config) => {
    if (!value) return null
    const trimmed = value.trim()
    if (!trimmed) return null

    // Remove commas
    const cleaned = trimmed.replace(/,/g, '')

    // Parse as int or float
    const num = config?.integer
      ? parseInt(cleaned, 10)
      : parseFloat(cleaned)

    if (isNaN(num)) return null

    return num
  },

  json: (value) => {
    if (!value) return null
    const trimmed = value.trim()
    if (!trimmed) return null

    try {
      return JSON.parse(trimmed)
    } catch {
      return null
    }
  },

  value_mapping: (value, config) => {
    if (!value) return config?.default ?? null
    const trimmed = value.trim()
    if (!trimmed) return config?.default ?? null

    const mappings = (config?.mappings as Record<string, string>) || {}

    // Try exact match first
    if (trimmed in mappings) {
      return mappings[trimmed]
    }

    // Try case-insensitive match
    const lowerValue = trimmed.toLowerCase()
    for (const [key, mappedValue] of Object.entries(mappings)) {
      if (key.toLowerCase() === lowerValue) {
        return mappedValue
      }
    }

    // Return default if no match
    return config?.default ?? null
  },
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Get a transform function by type
 */
export function getTransform(type: TransformType | null): TransformFn {
  return transforms[type || 'none'] || transforms.none
}

/**
 * Apply a transform to a value
 */
export function applyTransform(
  value: string,
  type: TransformType | null,
  config?: Record<string, unknown>
): unknown {
  const transform = getTransform(type)
  return transform(value, config)
}

/**
 * Check if a transform type is valid
 */
export function isValidTransform(type: string): type is TransformType {
  return type in transforms
}
