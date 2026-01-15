import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface DataSourceWithStats {
  id: string
  name: string
  type: string
  spreadsheet_id: string
  spreadsheet_url: string
  created_at: string
  updated_at: string
  tabCount: number
  mappedFieldsCount: number
  tabs: {
    id: string
    tab_name: string
    primary_entity: string
    header_row: number
    columnCount: number
  }[]
}

export async function GET() {
  try {
    // Fetch all data sources
    const { data: sources, error: sourcesError } = await supabase
      .from('data_sources')
      .select('*')
      .order('updated_at', { ascending: false })

    if (sourcesError) throw sourcesError

    if (!sources || sources.length === 0) {
      return NextResponse.json({ sources: [] })
    }

    // For each source, get tab mappings with column counts
    const sourcesWithStats: DataSourceWithStats[] = await Promise.all(
      sources.map(async (source) => {
        // Get tab mappings
        const { data: tabs, error: tabsError } = await supabase
          .from('tab_mappings')
          .select('id, tab_name, primary_entity, header_row')
          .eq('data_source_id', source.id)
          .eq('is_active', true)
          .order('tab_name')

        if (tabsError) {
          console.error('Error fetching tabs:', tabsError)
          return {
            ...source,
            tabCount: 0,
            mappedFieldsCount: 0,
            tabs: [],
          }
        }

        // Get total column mappings across all tabs
        let mappedFieldsCount = 0
        const tabsWithCounts = await Promise.all(
          (tabs || []).map(async (tab) => {
            const { count } = await supabase
              .from('column_mappings')
              .select('*', { count: 'exact', head: true })
              .eq('tab_mapping_id', tab.id)

            const columnCount = count || 0
            mappedFieldsCount += columnCount

            return {
              ...tab,
              columnCount,
            }
          })
        )

        return {
          ...source,
          tabCount: tabs?.length || 0,
          mappedFieldsCount,
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
