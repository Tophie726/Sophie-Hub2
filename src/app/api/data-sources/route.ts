import { getAdminClient } from '@/lib/supabase/admin'
import { requirePermission } from '@/lib/auth/api-auth'
import { apiSuccess, apiError, apiValidationError, ApiErrors } from '@/lib/api/response'
import { DataSourceSchemaV2 } from '@/lib/validations/schemas'
import { getConnectorRegistry } from '@/lib/connectors'
import {
  CategoryStats,
  DataSourceWithStats,
} from '@/types/entities'

// Use singleton Supabase client
const supabase = getAdminClient()

// Re-export types for backwards compatibility
export type { CategoryStats, DataSourceWithStats }

// POST - Create a new data source (admin only)
// Supports both legacy format { spreadsheet_id } and new format { type, connection_config }
export async function POST(request: Request) {
  const auth = await requirePermission('data-enrichment:write')
  if (!auth.authenticated) return auth.response

  try {
    const body = await request.json()

    // Validate input with V2 schema (supports both formats)
    const validation = DataSourceSchemaV2.create.safeParse(body)
    if (!validation.success) {
      return apiValidationError(validation.error)
    }

    const { name, spreadsheet_id, spreadsheet_url, type, connection_config } = validation.data

    // Determine the connector type and config
    let connectorType: string
    let connectionConfigObj: Record<string, unknown>
    let legacySpreadsheetId: string | null = null
    let legacySpreadsheetUrl: string | null = null

    if (connection_config) {
      // New format: use provided connection_config
      connectorType = connection_config.type
      connectionConfigObj = connection_config as Record<string, unknown>

      // Extract legacy fields for backward compatibility (dual-write)
      if (connection_config.type === 'google_sheet') {
        legacySpreadsheetId = connection_config.spreadsheet_id
        legacySpreadsheetUrl = connection_config.spreadsheet_url ?? null
      }

      // Validate config using the connector registry
      if (getConnectorRegistry().has(connectorType as 'google_sheet')) {
        const connector = getConnectorRegistry().get(connectorType as 'google_sheet')
        const configValidation = connector.validateConfig(connection_config)
        if (configValidation !== true) {
          return apiError('VALIDATION_ERROR', configValidation, 400)
        }
      }
    } else if (spreadsheet_id) {
      // Legacy format: construct connection_config from spreadsheet_id
      connectorType = type || 'google_sheet'
      legacySpreadsheetId = spreadsheet_id
      legacySpreadsheetUrl = spreadsheet_url ?? null
      connectionConfigObj = {
        type: 'google_sheet',
        spreadsheet_id,
        spreadsheet_url: spreadsheet_url ?? null,
      }
    } else {
      return apiError('VALIDATION_ERROR', 'Either spreadsheet_id or connection_config is required', 400)
    }

    // Check if this source is already connected (by spreadsheet_id for sheets)
    if (legacySpreadsheetId) {
      const { data: existing } = await supabase
        .from('data_sources')
        .select('id')
        .eq('spreadsheet_id', legacySpreadsheetId)
        .single()

      if (existing) {
        return apiError(
          'CONFLICT',
          'This spreadsheet is already connected',
          409,
          { existingId: existing.id }
        )
      }
    }

    // Create the data source with both legacy and new fields (dual-write)
    const { data: source, error } = await supabase
      .from('data_sources')
      .insert({
        name,
        type: connectorType,
        // Legacy columns (for backward compatibility)
        spreadsheet_id: legacySpreadsheetId,
        spreadsheet_url: legacySpreadsheetUrl,
        // New connection_config column
        connection_config: connectionConfigObj,
        status: 'active',
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating data source:', error)
      return ApiErrors.database(error.message)
    }

    return apiSuccess({ source }, 201)
  } catch (error) {
    console.error('Error in POST /api/data-sources:', error)
    return ApiErrors.internal()
  }
}

// GET - Fetch all data sources with stats (admin only)
// Optimized: Uses 3 queries total instead of N+1 pattern (was 1 + N + N*M queries)
export async function GET() {
  const auth = await requirePermission('data-enrichment:read')
  if (!auth.authenticated) return auth.response

  try {
    // Query 1: Fetch all data sources
    let sources, sourcesError

    const result = await supabase
      .from('data_sources')
      .select('*')
      .order('display_order', { ascending: true })

    if (result.error?.code === '42703') {
      // Column doesn't exist, fall back to created_at
      const fallback = await supabase
        .from('data_sources')
        .select('*')
        .order('created_at', { ascending: true })
      sources = fallback.data
      sourcesError = fallback.error
    } else {
      sources = result.data
      sourcesError = result.error
    }

    if (sourcesError) throw sourcesError

    if (!sources || sources.length === 0) {
      return apiSuccess({ sources: [] })
    }

    const sourceIds = sources.map(s => s.id)

    // Query 2: Fetch ALL tab mappings for all sources in one query
    const { data: allTabs, error: tabsError } = await supabase
      .from('tab_mappings')
      .select('id, data_source_id, tab_name, primary_entity, header_row, header_confirmed, status, notes, updated_at')
      .in('data_source_id', sourceIds)
      .order('tab_name')

    if (tabsError) throw tabsError

    const tabIds = (allTabs || []).map(t => t.id)

    // Query 3: Fetch ALL column mappings for all tabs in one query
    const { data: allColumns, error: columnsError } = tabIds.length > 0
      ? await supabase
          .from('column_mappings')
          .select('tab_mapping_id, category')
          .in('tab_mapping_id', tabIds)
      : { data: [], error: null }

    if (columnsError) throw columnsError

    // Build lookup maps for O(1) access
    const tabsBySource = new Map<string, typeof allTabs>()
    for (const tab of allTabs || []) {
      const existing = tabsBySource.get(tab.data_source_id) || []
      existing.push(tab)
      tabsBySource.set(tab.data_source_id, existing)
    }

    const columnsByTab = new Map<string, typeof allColumns>()
    for (const col of allColumns || []) {
      const existing = columnsByTab.get(col.tab_mapping_id) || []
      existing.push(col)
      columnsByTab.set(col.tab_mapping_id, existing)
    }

    // Assemble the response with stats (all in-memory, no more queries)
    const sourcesWithStats: DataSourceWithStats[] = sources.map((source) => {
      const tabs = tabsBySource.get(source.id) || []

      let totalColumns = 0
      let mappedFieldsCount = 0
      const sourceCategoryStats: CategoryStats = {
        partner: 0, staff: 0, asin: 0, weekly: 0, computed: 0, skip: 0, unmapped: 0,
      }

      const tabsWithCounts = tabs.map((tab) => {
        const columns = columnsByTab.get(tab.id) || []
        const tabCategoryStats: CategoryStats = {
          partner: 0, staff: 0, asin: 0, weekly: 0, computed: 0, skip: 0, unmapped: 0,
        }

        const columnCount = columns.length
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

    return apiSuccess({ sources: sourcesWithStats })
  } catch (error) {
    console.error('Error fetching data sources:', error)
    return ApiErrors.database(error instanceof Error ? error.message : 'Database error')
  }
}
