/**
 * Lineage types for field provenance tracking
 * Shows "where did this value come from?" for entity fields
 */

/** Source types for field values */
export type LineageSourceType = 'google_sheet' | 'api' | 'app' | 'manual'

/** Lineage info for a single field */
export interface FieldLineageInfo {
  fieldName: string
  sourceType: LineageSourceType
  sourceRef: string
  sheetName?: string
  tabName?: string
  columnName?: string
  previousValue: unknown | null
  newValue: unknown
  changedAt: string
  syncRunId?: string
}

/** Map of field names to their lineage */
export type FieldLineageMap = Record<string, FieldLineageInfo>

/** Raw lineage row from database */
export interface FieldLineageRow {
  field_name: string
  source_type: LineageSourceType
  source_ref: string
  previous_value: unknown | null
  new_value: unknown
  changed_at: string
  sync_run_id?: string
}

/**
 * Parse source_ref string into components
 * Format: "Sheet Name → Tab Name → Column Name"
 */
export function parseSourceRef(sourceRef: string): {
  sheetName?: string
  tabName?: string
  columnName?: string
} {
  if (!sourceRef) return {}

  const parts = sourceRef.split(' → ').map(s => s.trim())

  return {
    sheetName: parts[0] || undefined,
    tabName: parts[1] || undefined,
    columnName: parts[2] || undefined,
  }
}

/**
 * Convert raw lineage rows to a map, keeping only most recent per field
 */
export function deduplicateLineage(rows: FieldLineageRow[]): FieldLineageMap {
  const map: FieldLineageMap = {}

  for (const row of rows) {
    // Since rows are ordered by changed_at DESC, first occurrence is most recent
    if (!map[row.field_name]) {
      const parsed = parseSourceRef(row.source_ref)
      map[row.field_name] = {
        fieldName: row.field_name,
        sourceType: row.source_type,
        sourceRef: row.source_ref,
        sheetName: parsed.sheetName,
        tabName: parsed.tabName,
        columnName: parsed.columnName,
        previousValue: row.previous_value,
        newValue: row.new_value,
        changedAt: row.changed_at,
        syncRunId: row.sync_run_id,
      }
    }
  }

  return map
}
