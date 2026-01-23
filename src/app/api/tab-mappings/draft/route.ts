import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/auth/api-auth'

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface DraftState {
  phase: 'preview' | 'classify' | 'map'
  headerRow: number
  columns: Array<{
    sourceIndex: number
    sourceColumn: string
    category: string | null
    targetField: string | null
    authority: string
    isKey: boolean
    computedConfig?: Record<string, unknown>
  }>
  timestamp: number
}

// GET - Load draft state for a tab
export async function GET(request: Request) {
  const auth = await requireAuth()
  if (!auth.authenticated) return auth.response

  try {
    const { searchParams } = new URL(request.url)
    const dataSourceId = searchParams.get('data_source_id')
    const tabName = searchParams.get('tab_name')

    if (!dataSourceId || !tabName) {
      return NextResponse.json(
        { error: 'data_source_id and tab_name are required' },
        { status: 400 }
      )
    }

    // Look up the tab mapping
    const { data: tabMapping, error } = await supabase
      .from('tab_mappings')
      .select('id, draft_state, draft_updated_by, draft_updated_at')
      .eq('data_source_id', dataSourceId)
      .eq('tab_name', tabName)
      .single()

    if (error && error.code !== 'PGRST116') {
      // PGRST116 is "not found" which is OK
      console.error('Error loading draft:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    if (!tabMapping || !tabMapping.draft_state) {
      return NextResponse.json({ draft: null })
    }

    return NextResponse.json({
      draft: tabMapping.draft_state,
      updatedBy: tabMapping.draft_updated_by,
      updatedAt: tabMapping.draft_updated_at,
    })
  } catch (error) {
    console.error('Error in GET /api/tab-mappings/draft:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Save draft state for a tab
export async function POST(request: Request) {
  const auth = await requireAuth()
  if (!auth.authenticated) return auth.response

  try {
    const body = await request.json()
    const { data_source_id, tab_name, draft_state, updated_by } = body as {
      data_source_id: string
      tab_name: string
      draft_state: DraftState
      updated_by?: string
    }

    if (!data_source_id || !tab_name || !draft_state) {
      return NextResponse.json(
        { error: 'data_source_id, tab_name, and draft_state are required' },
        { status: 400 }
      )
    }

    // Check if tab mapping exists
    const { data: existing } = await supabase
      .from('tab_mappings')
      .select('id')
      .eq('data_source_id', data_source_id)
      .eq('tab_name', tab_name)
      .single()

    if (existing) {
      // Update existing tab mapping with draft
      const { error } = await supabase
        .from('tab_mappings')
        .update({
          draft_state,
          draft_updated_by: updated_by || null,
          draft_updated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)

      if (error) throw error
    } else {
      // Create new tab mapping with draft
      const { error } = await supabase
        .from('tab_mappings')
        .insert({
          data_source_id,
          tab_name,
          header_row: draft_state.headerRow || 0,
          primary_entity: 'partners', // Default, will be updated when mapping completes
          draft_state,
          draft_updated_by: updated_by || null,
          draft_updated_at: new Date().toISOString(),
        })

      if (error) throw error
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in POST /api/tab-mappings/draft:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Clear draft state for a tab
export async function DELETE(request: Request) {
  const auth = await requireAuth()
  if (!auth.authenticated) return auth.response

  try {
    const { searchParams } = new URL(request.url)
    const dataSourceId = searchParams.get('data_source_id')
    const tabName = searchParams.get('tab_name')

    if (!dataSourceId || !tabName) {
      return NextResponse.json(
        { error: 'data_source_id and tab_name are required' },
        { status: 400 }
      )
    }

    // Clear draft state (don't delete the tab mapping, just the draft)
    const { error } = await supabase
      .from('tab_mappings')
      .update({
        draft_state: null,
        draft_updated_by: null,
        draft_updated_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('data_source_id', dataSourceId)
      .eq('tab_name', tabName)

    if (error && error.code !== 'PGRST116') {
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/tab-mappings/draft:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
