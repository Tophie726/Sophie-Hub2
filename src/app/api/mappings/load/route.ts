import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requirePermission } from '@/lib/auth/api-auth'
import { LoadMappingResponse } from '@/types/enrichment'

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET - Load field mappings (admin only)
export async function GET(request: NextRequest) {
  const auth = await requirePermission('data-enrichment:read')
  if (!auth.authenticated) return auth.response

  try {
    const { searchParams } = new URL(request.url)
    const spreadsheetId = searchParams.get('spreadsheet_id')
    const dataSourceId = searchParams.get('data_source_id')

    if (!spreadsheetId && !dataSourceId) {
      return NextResponse.json(
        { error: 'Either spreadsheet_id or data_source_id is required' },
        { status: 400 }
      )
    }

    // Find the data source
    let query = supabase.from('data_sources').select('*')

    if (dataSourceId) {
      query = query.eq('id', dataSourceId)
    } else {
      query = query.eq('spreadsheet_id', spreadsheetId)
    }

    const { data: dataSource, error: sourceError } = await query.single()

    if (sourceError || !dataSource) {
      return NextResponse.json(
        { error: 'Data source not found', found: false },
        { status: 404 }
      )
    }

    // Load tab mappings with their column mappings and patterns
    const { data: tabMappings, error: tabError } = await supabase
      .from('tab_mappings')
      .select('*')
      .eq('data_source_id', dataSource.id)
      .eq('is_active', true)
      .order('tab_name')

    if (tabError) throw tabError

    // For each tab, load column mappings and patterns
    const tabsWithDetails = await Promise.all(
      (tabMappings || []).map(async (tab) => {
        const [columnMappingsResult, patternsResult] = await Promise.all([
          supabase
            .from('column_mappings')
            .select('*')
            .eq('tab_mapping_id', tab.id)
            .order('source_column_index'),
          supabase
            .from('column_patterns')
            .select('*')
            .eq('tab_mapping_id', tab.id)
            .eq('is_active', true)
            .order('priority', { ascending: false }),
        ])

        return {
          ...tab,
          columnMappings: columnMappingsResult.data || [],
          patterns: patternsResult.data || [],
        }
      })
    )

    const response: LoadMappingResponse = {
      dataSource,
      tabMappings: tabsWithDetails,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error loading mapping:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
