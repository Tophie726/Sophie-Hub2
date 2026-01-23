import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST - Confirm header row selection for a tab
// Creates tab_mapping if it doesn't exist, or updates header_confirmed = true
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { data_source_id, tab_name, header_row } = body

    if (!data_source_id || !tab_name || header_row === undefined) {
      return NextResponse.json(
        { error: 'data_source_id, tab_name, and header_row are required' },
        { status: 400 }
      )
    }

    // Check if tab mapping already exists
    const { data: existing } = await supabase
      .from('tab_mappings')
      .select('id')
      .eq('data_source_id', data_source_id)
      .eq('tab_name', tab_name)
      .single()

    if (existing) {
      // Update existing tab mapping
      const { data, error } = await supabase
        .from('tab_mappings')
        .update({
          header_row,
          header_confirmed: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single()

      if (error) throw error
      return NextResponse.json({ tabMapping: data, created: false })
    }

    // Create new tab mapping with header confirmed
    const { data: tabMapping, error } = await supabase
      .from('tab_mappings')
      .insert({
        data_source_id,
        tab_name,
        header_row,
        header_confirmed: true,
        primary_entity: 'partners', // Default, will be updated when mapping columns
        status: 'active',
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating tab mapping:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ tabMapping, created: true })
  } catch (error) {
    console.error('Error in POST /api/tab-mappings/confirm-header:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
