import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/auth/api-auth'

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST - Create a new tab mapping (minimal, for status tracking before full mapping)
export async function POST(request: Request) {
  const auth = await requireAuth()
  if (!auth.authenticated) return auth.response

  try {
    const body = await request.json()
    const { data_source_id, tab_name, status, notes } = body

    if (!data_source_id || !tab_name) {
      return NextResponse.json(
        { error: 'data_source_id and tab_name are required' },
        { status: 400 }
      )
    }

    // Check if this tab mapping already exists
    const { data: existing } = await supabase
      .from('tab_mappings')
      .select('id')
      .eq('data_source_id', data_source_id)
      .eq('tab_name', tab_name)
      .single()

    if (existing) {
      // Update existing
      const { data, error } = await supabase
        .from('tab_mappings')
        .update({
          status: status || 'active',
          notes: notes || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single()

      if (error) throw error
      return NextResponse.json({ tabMapping: data })
    }

    // Create new tab mapping
    const { data: tabMapping, error } = await supabase
      .from('tab_mappings')
      .insert({
        data_source_id,
        tab_name,
        header_row: 0,
        primary_entity: 'partners', // Default, will be updated when mapping columns
        status: status || 'active',
        notes: notes || null,
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

    return NextResponse.json({ tabMapping })
  } catch (error) {
    console.error('Error in POST /api/tab-mappings:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
