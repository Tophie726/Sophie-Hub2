import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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
    columnCount: number
    categoryStats: CategoryStats
    status: 'active' | 'reference' | 'hidden' | 'flagged'
    notes: string | null
    updated_at: string | null  // When this tab mapping was last modified
  }[]
}

// POST - Create a new data source
export async function POST(request: Request) {
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

// GET - Fetch all data sources with stats
export async function GET() {
  try {
    // Fetch all data sources, ordered by display_order (fallback to created_at if column doesn't exist)
    let sources, sourcesError

    // Try with display_order first
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

    // For each source, get tab mappings with column counts
    const sourcesWithStats: DataSourceWithStats[] = await Promise.all(
      sources.map(async (source) => {
        // Get tab mappings (include all tabs, not just active - filter in UI)
        const { data: tabs, error: tabsError } = await supabase
          .from('tab_mappings')
          .select('id, tab_name, primary_entity, header_row, status, notes, updated_at')
          .eq('data_source_id', source.id)
          .order('tab_name')

        if (tabsError) {
          console.error('Error fetching tabs:', tabsError)
          return {
            ...source,
            tabCount: 0,
            totalColumns: 0,
            mappedFieldsCount: 0,
            categoryStats: { partner: 0, staff: 0, asin: 0, weekly: 0, computed: 0, skip: 0, unmapped: 0 },
            tabs: [],
          }
        }

        // Get column mappings with category breakdown for each tab
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

        const tabsWithCounts = await Promise.all(
          (tabs || []).map(async (tab) => {
            // Get all column mappings for this tab with their categories
            const { data: columns, error: columnsError } = await supabase
              .from('column_mappings')
              .select('category')
              .eq('tab_mapping_id', tab.id)

            if (columnsError) {
              console.error('Error fetching columns:', columnsError)
              return {
                ...tab,
                columnCount: 0,
                categoryStats: { partner: 0, staff: 0, asin: 0, weekly: 0, computed: 0, skip: 0, unmapped: 0 },
              }
            }

            // Count categories for this tab
            const tabCategoryStats: CategoryStats = {
              partner: 0,
              staff: 0,
              asin: 0,
              weekly: 0,
              computed: 0,
              skip: 0,
              unmapped: 0,
            }

            const columnCount = columns?.length || 0
            totalColumns += columnCount

            columns?.forEach((col) => {
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
            })

            return {
              ...tab,
              columnCount,
              categoryStats: tabCategoryStats,
              status: tab.status || 'active',
              notes: tab.notes || null,
              updated_at: tab.updated_at || null,
            }
          })
        )

        return {
          ...source,
          tabCount: tabs?.length || 0,
          totalColumns,
          mappedFieldsCount,
          categoryStats: sourceCategoryStats,
          tabs: tabsWithCounts,
        }
      })
    )

    return NextResponse.json({ sources: sourcesWithStats })
  } catch (error) {
    console.error('Error fetching data sources:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
