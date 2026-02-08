/**
 * Escape special characters in a search string for safe use in PostgREST
 * `.or()` filter expressions.
 *
 * Prevents query grammar injection by escaping characters that have
 * special meaning in PostgREST filter syntax or SQL ILIKE patterns.
 */
export function escapePostgrestValue(value: string): string {
  if (!value || !value.trim()) return ''
  // Escape backslash first (so we don't double-escape), then the rest
  return value
    .replace(/\\/g, '\\\\')
    .replace(/,/g, '\\,')
    .replace(/\./g, '\\.')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
}
