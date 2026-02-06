import { requirePermission } from '@/lib/auth/api-auth'
import { apiSuccess, ApiErrors } from '@/lib/api/response'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { getAdminClient } from '@/lib/supabase/admin'
import { getSheetRawRows } from '@/lib/google/sheets'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'

const supabase = getAdminClient()

interface RepairResult {
  tabMappingId: string
  tabName: string
  sheetName: string
  columnsRepaired: number
  columnsTotal: number
  details: string[]
}

/**
 * POST /api/admin/repair-mappings
 *
 * Repairs column_mappings that have empty source_column values.
 * Fetches actual headers from Google Sheets and updates the database.
 *
 * This is a one-time fix for data that was saved before proper validation.
 */
export async function POST() {
  const auth = await requirePermission('data-enrichment:write')
  if (!auth.authenticated) return auth.response

  const rateLimit = checkRateLimit(auth.user.id, 'admin:repair-mappings:write', RATE_LIMITS.STRICT)
  if (!rateLimit.allowed) {
    return ApiErrors.rateLimited('Too many repair attempts. Please wait before trying again.')
  }

  try {
    // Get the user's Google access token
    const session = await getServerSession(authOptions)
    const accessToken = session?.accessToken as string | undefined

    if (!accessToken) {
      return ApiErrors.unauthorized('Google access token required - please sign in again')
    }

    // Find all column_mappings with empty or null source_column
    const { data: brokenMappings, error: fetchError } = await supabase
      .from('column_mappings')
      .select(`
        id,
        source_column,
        source_column_index,
        target_field,
        tab_mapping_id,
        tab_mapping:tab_mapping_id (
          id,
          tab_name,
          header_row,
          data_source:data_source_id (
            id,
            name,
            spreadsheet_id
          )
        )
      `)
      .or('source_column.is.null,source_column.eq.')

    if (fetchError) {
      console.error('Error fetching broken mappings:', fetchError)
      return ApiErrors.database(fetchError.message)
    }

    if (!brokenMappings || brokenMappings.length === 0) {
      // Check if there are any mappings at all to verify query is correct
      const { count } = await supabase
        .from('column_mappings')
        .select('*', { count: 'exact', head: true })

      return apiSuccess({
        message: 'No broken mappings found',
        totalMappings: count,
        repaired: 0,
      })
    }

    console.log(`[repair-mappings] Found ${brokenMappings.length} mappings with empty source_column`)

    // Group by tab_mapping to minimize sheet fetches
    const byTabMapping = new Map<string, typeof brokenMappings>()
    for (const mapping of brokenMappings) {
      const tabId = mapping.tab_mapping_id
      const existing = byTabMapping.get(tabId) || []
      existing.push(mapping)
      byTabMapping.set(tabId, existing)
    }

    const results: RepairResult[] = []
    let totalRepaired = 0

    // Process each tab_mapping
    for (const [tabMappingId, mappings] of Array.from(byTabMapping.entries())) {
      const firstMapping = mappings[0]
      const tabMapping = firstMapping.tab_mapping as unknown as {
        id: string
        tab_name: string
        header_row: number
        data_source: { id: string; name: string; spreadsheet_id: string } | null
      } | null

      if (!tabMapping?.data_source?.spreadsheet_id) {
        console.log(`[repair-mappings] Skipping tab ${tabMappingId} - no spreadsheet_id`)
        results.push({
          tabMappingId,
          tabName: tabMapping?.tab_name || 'Unknown',
          sheetName: tabMapping?.data_source?.name || 'Unknown',
          columnsRepaired: 0,
          columnsTotal: mappings.length,
          details: ['Skipped - no spreadsheet_id found'],
        })
        continue
      }

      const { spreadsheet_id, name: sheetName } = tabMapping.data_source
      const tabName = tabMapping.tab_name
      const headerRow = tabMapping.header_row ?? 0

      console.log(`[repair-mappings] Fetching headers for ${sheetName} / ${tabName}`)

      try {
        // Fetch raw rows from the sheet (need enough rows to get to header row)
        const { rows: rawRows } = await getSheetRawRows(accessToken, spreadsheet_id, tabName, headerRow + 5)

        if (!rawRows || rawRows.length <= headerRow) {
          results.push({
            tabMappingId,
            tabName,
            sheetName,
            columnsRepaired: 0,
            columnsTotal: mappings.length,
            details: ['Could not fetch sheet headers'],
          })
          continue
        }

        const headers = rawRows[headerRow] as string[]
        const details: string[] = []
        let repairedCount = 0

        // Update each broken mapping
        for (const mapping of mappings) {
          const colIndex = mapping.source_column_index
          if (colIndex === null || colIndex === undefined) {
            details.push(`Column ${mapping.target_field}: no source_column_index`)
            continue
          }

          const header = headers[colIndex]
          if (!header) {
            details.push(`Column ${mapping.target_field}: header at index ${colIndex} is empty`)
            continue
          }

          // Update the column_mapping with the correct source_column
          const { error: updateError } = await supabase
            .from('column_mappings')
            .update({ source_column: header })
            .eq('id', mapping.id)

          if (updateError) {
            details.push(`Column ${mapping.target_field}: update failed - ${updateError.message}`)
          } else {
            details.push(`Column ${mapping.target_field}: repaired → "${header}"`)
            repairedCount++
            totalRepaired++
          }
        }

        results.push({
          tabMappingId,
          tabName,
          sheetName,
          columnsRepaired: repairedCount,
          columnsTotal: mappings.length,
          details,
        })
      } catch (sheetError) {
        console.error(`[repair-mappings] Error fetching sheet ${tabName}:`, sheetError)
        results.push({
          tabMappingId,
          tabName,
          sheetName,
          columnsRepaired: 0,
          columnsTotal: mappings.length,
          details: [`Sheet fetch error: ${sheetError instanceof Error ? sheetError.message : 'Unknown'}`],
        })
      }
    }

    return apiSuccess({
      message: `Repaired ${totalRepaired} column mappings`,
      totalBroken: brokenMappings.length,
      totalRepaired,
      results,
    })
  } catch (error) {
    console.error('[repair-mappings] Error:', error)
    return ApiErrors.internal()
  }
}

/**
 * GET /api/admin/repair-mappings
 *
 * Check how many mappings need repair without fixing them.
 */
export async function GET() {
  const auth = await requirePermission('data-enrichment:read')
  if (!auth.authenticated) return auth.response

  try {
    // Count mappings with empty source_column
    const { data: brokenMappings, error: fetchError } = await supabase
      .from('column_mappings')
      .select(`
        id,
        source_column,
        source_column_index,
        target_field,
        tab_mapping:tab_mapping_id (
          tab_name,
          data_source:data_source_id (
            name
          )
        )
      `)
      .or('source_column.is.null,source_column.eq.')

    if (fetchError) {
      return ApiErrors.database(fetchError.message)
    }

    // Also check tab_mappings with empty tab_name
    const { data: brokenTabs, error: tabError } = await supabase
      .from('tab_mappings')
      .select('id, tab_name, data_source_id')
      .or('tab_name.is.null,tab_name.eq.')

    if (tabError) {
      console.error('Error checking tab_mappings:', tabError)
    }

    // Get total counts for context
    const { count: totalMappings } = await supabase
      .from('column_mappings')
      .select('*', { count: 'exact', head: true })

    const { count: totalTabs } = await supabase
      .from('tab_mappings')
      .select('*', { count: 'exact', head: true })

    // Group broken mappings by sheet for readability
    const bySheet = new Map<string, { tabName: string; count: number; fields: string[] }>()
    for (const mapping of brokenMappings || []) {
      const tabMapping = mapping.tab_mapping as unknown as {
        tab_name: string
        data_source: { name: string } | null
      } | null
      const sheetName = tabMapping?.data_source?.name || 'Unknown'
      const tabName = tabMapping?.tab_name || 'Unknown'
      const key = `${sheetName} / ${tabName}`

      const existing = bySheet.get(key) || { tabName, count: 0, fields: [] }
      existing.count++
      if (mapping.target_field) {
        existing.fields.push(mapping.target_field)
      }
      bySheet.set(key, existing)
    }

    return apiSuccess({
      needsRepair: (brokenMappings?.length || 0) > 0 || (brokenTabs?.length || 0) > 0,
      brokenColumnMappings: brokenMappings?.length || 0,
      brokenTabMappings: brokenTabs?.length || 0,
      totalColumnMappings: totalMappings || 0,
      totalTabMappings: totalTabs || 0,
      bySheet: Object.fromEntries(bySheet),
      brokenTabs: brokenTabs?.map(t => ({ id: t.id, tab_name: t.tab_name })) || [],
    })
  } catch (error) {
    console.error('[repair-mappings] GET error:', error)
    return ApiErrors.internal()
  }
}
