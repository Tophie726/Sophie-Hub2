/**
 * Data formatting utilities for dashboard widgets.
 *
 * Patterns extracted from bigquery-data-panel.tsx and enhanced
 * for use across metric, chart, and table widgets.
 */

import { getColumnLabel } from '@/lib/bigquery/column-metadata'

/**
 * Format a number as USD currency: "$45,230.00"
 */
export function formatCurrency(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return '-'
  return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * Format a number with thousands separators: "1,234"
 */
export function formatNumber(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return '-'
  if (Number.isInteger(num)) {
    return num.toLocaleString('en-US')
  }
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * Format a number as a percentage: "12.5%"
 */
export function formatPercentage(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return '-'
  // If the value looks like a decimal ratio (< 1), multiply by 100
  if (Math.abs(num) < 1) {
    return `${(num * 100).toFixed(2)}%`
  }
  return `${num.toFixed(2)}%`
}

/**
 * Format a date string: "Jan 15, 2026"
 */
export function formatDate(value: string): string {
  if (!value) return '-'
  try {
    const date = new Date(value)
    if (isNaN(date.getTime())) return value
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return value
  }
}

/**
 * Format a date string as short: "Jan 15"
 */
export function formatDateShort(value: string): string {
  if (!value) return '-'
  try {
    const date = new Date(value)
    if (isNaN(date.getTime())) return value
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch {
    return value
  }
}

/**
 * Format a number in compact notation: 1234 -> "1.2K", 1234567 -> "1.2M"
 */
export function formatCompact(value: number): string {
  if (isNaN(value)) return '-'
  const abs = Math.abs(value)
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  if (Number.isInteger(value)) return value.toString()
  return value.toFixed(1)
}

/**
 * Format a BigQuery column header for display.
 * "sales_amount" -> "Sales Amount"
 */
export function formatHeader(raw: string): string {
  return raw
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

// Header keywords for auto-detecting format
const CURRENCY_KEYWORDS = ['spend', 'sales', 'cost', 'revenue', 'amount', 'fee', 'price', 'budget']
const PERCENT_KEYWORDS = ['rate', 'acos', 'roas', 'ctr', 'cvr', 'percent', 'ratio']
const INTEGER_KEYWORDS = ['impressions', 'clicks', 'orders', 'units', 'quantity', 'count']
const DATE_KEYWORDS = ['date', 'day', 'week', 'month', 'year', 'created', 'updated']

/**
 * Auto-detect format from header name and format cell value accordingly.
 */
export function formatCell(value: string, header: string): string {
  if (!value || value === 'null' || value === 'undefined') return '-'

  const lower = header.toLowerCase()

  if (CURRENCY_KEYWORDS.some(k => lower.includes(k))) {
    const num = parseFloat(value)
    if (!isNaN(num)) return formatCurrency(num)
  }

  if (PERCENT_KEYWORDS.some(k => lower.includes(k))) {
    const num = parseFloat(value)
    if (!isNaN(num)) return formatPercentage(num)
  }

  if (INTEGER_KEYWORDS.some(k => lower.includes(k))) {
    const num = parseInt(value, 10)
    if (!isNaN(num)) return num.toLocaleString('en-US')
  }

  if (DATE_KEYWORDS.some(k => lower.includes(k))) {
    return formatDate(value)
  }

  return value
}

/**
 * Format a value according to a display format type.
 */
export function formatByType(value: number | string, format: 'number' | 'currency' | 'percent' | 'compact'): string {
  switch (format) {
    case 'currency': return formatCurrency(value)
    case 'percent': return formatPercentage(value)
    case 'compact': return formatCompact(typeof value === 'string' ? parseFloat(value) : value)
    case 'number':
    default: return formatNumber(value)
  }
}

/**
 * Resolve a column name to a friendly label using metadata.
 * Falls back to formatHeader() if no metadata entry exists.
 */
export function resolveColumnLabel(viewAlias: string, column: string): string {
  return getColumnLabel(viewAlias, column)
}
