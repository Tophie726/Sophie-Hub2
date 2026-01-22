import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { sourceIds } = await request.json()

    if (!Array.isArray(sourceIds) || sourceIds.length === 0) {
      return NextResponse.json(
        { error: 'sourceIds must be a non-empty array' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Update each source with its new display_order
    const updates = sourceIds.map((id, index) =>
      supabase
        .from('data_sources')
        .update({ display_order: index })
        .eq('id', id)
    )

    await Promise.all(updates)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error reordering sources:', error)
    return NextResponse.json(
      { error: 'Failed to reorder sources' },
      { status: 500 }
    )
  }
}
