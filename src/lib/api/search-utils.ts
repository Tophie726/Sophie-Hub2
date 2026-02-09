/**
 * Wrap a search term for safe use in PostgREST `.or()` ILIKE patterns.
 *
 * PostgREST uses commas, dots, and parentheses as grammar delimiters
 * inside `.or()` filter strings. Backslash-escaping is NOT supported.
 * Instead, PostgREST uses double-quoting to protect values.
 *
 * This function:
 * 1. Escapes SQL ILIKE wildcards (`%` → `\%`, `_` → `\_`) so user input
 *    is matched literally.
 * 2. Wraps the result in PostgREST double-quotes with `%` wildcards for
 *    substring matching: `"%value%"`.
 *
 * Callers should NOT add their own `%` wildcards:
 * ```ts
 * const pattern = escapePostgrestValue(search)
 * query.or(`full_name.ilike.${pattern},email.ilike.${pattern}`)
 * ```
 */
export function escapePostgrestValue(value: string): string {
  if (!value || !value.trim()) return ''
  // Step 1: Escape SQL ILIKE wildcards so user input is literal
  let sanitized = value
    .replace(/\\/g, '\\\\') // Backslash first to avoid double-escape
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
  // Step 2: Escape PostgREST double-quote delimiter
  sanitized = sanitized.replace(/"/g, '""')
  // Step 3: Wrap with ILIKE wildcards inside PostgREST double-quotes
  return `"%${sanitized}%"`
}
