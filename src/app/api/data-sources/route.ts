import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { requirePermission } from '@/lib/auth/api-auth'

// Use singleton Supabase client
const supabase = getAdminClient()

export interface CategoryStats {
  partner: number
  staff: number
  asin: number
  weekly: number
  computed: number
  skip: number
  unmapped: number
}

export interface DataSourceWithStats {
  id: string
  name: string
  type: string
  spreadsheet_id: string
  spreadsheet_url: string
  created_at: string
  updated_at: string
  tabCount: number
  totalColumns: number
  mappedFieldsCount: number
  categoryStats: CategoryStats
  tabs: {
    id: string
    tab_name: string
    primary_entity: string
    header_row: number
    header_confirmed: boolean  // True when user explicitly confirmed header row
    columnCount: number
    categoryStats: CategoryStats
    status: 'active' | 'reference' | 'hidden' | 'flagged'
    notes: string | null
    updated_at: string | null  // When this tab mapping was last modified
  }[]
}

// POST - Create a new data source (admin only)
export async function POST(request: Request) {
  const auth = await requirePermission('data-enrichment:write')
  if (!auth.authenticated) return auth.response

  try {
    const body = await request.json()
    const { name, spreadsheet_id, spreadsheet_url } = body

    if (!name || !spreadsheet_id) {
      return NextResponse.json(
        { error: 'name and spreadsheet_id are required' },
        { status: 400 }
      )
    }

    // Check if this spreadsheet is already connected
    const { data: existing } = await supabase
      .from('data_sources')
      .select('id')
      .eq('spreadsheet_id', spreadsheet_id)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'This spreadsheet is already connected', existingId: existing.id },
        { status: 409 }
      )
    }

    // Create the data source
    const { data: source, error } = await supabase
      .from('data_sources')
      .insert({
        name,
        type: 'google_sheet',
        spreadsheet_id,
        spreadsheet_url: spreadsheet_url || null,
        status: 'active',
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating data source:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ source })
  } catch (error) {
    console.error('Error in POST /api/data-sources:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
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
      return NextResponse.json({ sources: [] })
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

    return NextResponse.json({ sources: sourcesWithStats })
  } catch (error) {
    console.error('Error fetching data sources:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
