/**
 * Data Source Repository
 *
 * Handles all database operations for data_sources table.
 * Enforces strict separation of concerns - no business logic here.
 */

import { getAdminClient } from '@/lib/supabase/admin'
import type {
  DataSourceWithStats,
  TabWithStats,
  CategoryStats
} from '@/types/entities'

const supabase = getAdminClient()

export interface CreateDataSourceInput {
  name: string
  type: string
  spreadsheet_id: string | null
  spreadsheet_url: string | null
  connection_config: Record<string, unknown>
  status: 'active' | 'inactive'
}

export interface DataSourceRecord {
  id: string
  name: string
  type: string
  spreadsheet_id: string | null
  spreadsheet_url: string | null
  connection_config: Record<string, unknown> | null
  status: string
  created_at: string
  updated_at: string
  display_order: number | null
}

export interface TabMappingRecord {
  id: string
  data_source_id: string
  tab_name: string
  primary_entity: 'partners' | 'staff' | 'asins' | null
  header_row: number
  header_confirmed: boolean | null
  status: string | null
  notes: string | null
  updated_at: string | null
  total_columns: number | null
}

export interface ColumnMappingRecord {
  tab_mapping_id: string
  category: string
}

/**
 * Check if a data source with the given spreadsheet_id already exists
 */
export async function findDataSourceBySpreadsheetId(
  spreadsheetId: string
): Promise<{ id: string } | null> {
  const { data, error } = await supabase
    .from('data_sources')
    .select('id')
    .eq('spreadsheet_id', spreadsheetId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to check existing data source: ${error.message}`)
  }

  return data
}

/**
 * Create a new data source
 */
export async function createDataSource(
  input: CreateDataSourceInput
): Promise<DataSourceRecord> {
  const { data, error } = await supabase
    .from('data_sources')
    .insert({
      name: input.name,
      type: input.type,
      spreadsheet_id: input.spreadsheet_id,
      spreadsheet_url: input.spreadsheet_url,
      connection_config: input.connection_config,
      status: input.status,
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create data source: ${error.message}`)
  }

  if (!data) {
    throw new Error('Data source creation returned no data')
  }

  return data as DataSourceRecord
}

/**
 * Fetch all data sources ordered by display_order or created_at
 */
export async function getAllDataSources(): Promise<DataSourceRecord[]> {
  // Try to order by display_order first
  const result = await supabase
    .from('data_sources')
    .select('*')
    .order('display_order', { ascending: true })

  // If display_order column doesn't exist, fall back to created_at
  if (result.error?.code === '42703') {
    const fallback = await supabase
      .from('data_sources')
      .select('*')
      .order('created_at', { ascending: true })

    if (fallback.error) {
      throw new Error(`Failed to fetch data sources: ${fallback.error.message}`)
    }

    return (fallback.data || []) as DataSourceRecord[]
  }

  if (result.error) {
    throw new Error(`Failed to fetch data sources: ${result.error.message}`)
  }

  return (result.data || []) as DataSourceRecord[]
}

/**
 * Fetch all tab mappings for given data source IDs
 */
export async function getTabMappingsBySourceIds(
  sourceIds: string[]
): Promise<TabMappingRecord[]> {
  if (sourceIds.length === 0) {
    return []
  }

  const { data, error } = await supabase
    .from('tab_mappings')
    .select('id, data_source_id, tab_name, primary_entity, header_row, header_confirmed, status, notes, updated_at, total_columns')
    .in('data_source_id', sourceIds)
    .order('tab_name')

  if (error) {
    throw new Error(`Failed to fetch tab mappings: ${error.message}`)
  }

  return (data || []) as TabMappingRecord[]
}

/**
 * Fetch all column mappings for given tab mapping IDs
 */
export async function getColumnMappingsByTabIds(
  tabIds: string[]
): Promise<ColumnMappingRecord[]> {
  if (tabIds.length === 0) {
    return []
  }

  const { data, error } = await supabase
    .from('column_mappings')
    .select('tab_mapping_id, category')
    .in('tab_mapping_id', tabIds)

  if (error) {
    throw new Error(`Failed to fetch column mappings: ${error.message}`)
  }

  return (data || []) as ColumnMappingRecord[]
}

/**
 * Assemble data sources with statistics from raw records
 * This is a pure transformation function - no database calls
 */
export function assembleDataSourcesWithStats(
  sources: DataSourceRecord[],
  allTabs: TabMappingRecord[],
  allColumns: ColumnMappingRecord[]
): DataSourceWithStats[] {
  // Build lookup maps for O(1) access
  const tabsBySource = new Map<string, TabMappingRecord[]>()
  for (const tab of allTabs) {
    const existing = tabsBySource.get(tab.data_source_id) || []
    existing.push(tab)
    tabsBySource.set(tab.data_source_id, existing)
  }

  const columnsByTab = new Map<string, ColumnMappingRecord[]>()
  for (const col of allColumns) {
    const existing = columnsByTab.get(col.tab_mapping_id) || []
    existing.push(col)
    columnsByTab.set(col.tab_mapping_id, existing)
  }

  // Assemble the response with stats (all in-memory)
  return sources.map((source) => {
    const tabs = tabsBySource.get(source.id) || []

    let totalColumns = 0
    let mappedFieldsCount = 0
    const sourceCategoryStats: CategoryStats = {
      partner: 0,
      staff: 0,
      asin: 0,
      weekly: 0,
      computed: 0,
      skip: 0,
      unmapped: 0,
    }

    const tabsWithCounts: TabWithStats[] = tabs.map((tab) => {
      const columns = columnsByTab.get(tab.id) || []
      const tabCategoryStats: CategoryStats = {
        partner: 0,
        staff: 0,
        asin: 0,
        weekly: 0,
        computed: 0,
        skip: 0,
        unmapped: 0,
      }

      const savedCount = columns.length
      const columnCount = tab.total_columns || savedCount
      totalColumns += columnCount

      for (const col of columns) {
        const cat = col.category as keyof CategoryStats
        if (cat && cat in tabCategoryStats) {
          tabCategoryStats[cat]++
          sourceCategoryStats[cat]++
          if (cat !== 'skip') {
            mappedFieldsCount++
          }
        } else {
          tabCategoryStats.unmapped++
          sourceCategoryStats.unmapped++
        }
      }

      // Columns not yet saved to column_mappings are unmapped
      const unsavedCount = Math.max(0, columnCount - savedCount)
      tabCategoryStats.unmapped += unsavedCount
      sourceCategoryStats.unmapped += unsavedCount

      return {
        id: tab.id,
        tab_name: tab.tab_name,
        primary_entity: tab.primary_entity,
        header_row: tab.header_row,
        header_confirmed: tab.header_confirmed || false,
        status: (tab.status || 'active') as 'active' | 'reference' | 'hidden' | 'flagged',
        notes: tab.notes || null,
        updated_at: tab.updated_at || null,
        columnCount,
        categoryStats: tabCategoryStats,
      }
    })

    return {
      ...source,
      tabCount: tabs.length,
      totalColumns,
      mappedFieldsCount,
      categoryStats: sourceCategoryStats,
      tabs: tabsWithCounts,
    }
  })
}
