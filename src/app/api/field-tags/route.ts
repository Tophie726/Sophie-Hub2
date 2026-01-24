import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { authOptions } from '@/lib/auth/config'

// Use singleton Supabase client
const supabase = getAdminClient()

// GET /api/field-tags - Get all available field tags
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { data: tags, error } = await supabase
      .from('field_tags')
      .select('id, name, color, description')
      .order('name')

    if (error) {
      console.error('Error fetching field tags:', error)
      return NextResponse.json({ error: 'Failed to fetch tags' }, { status: 500 })
    }

    return NextResponse.json({ tags })
  } catch (error) {
    console.error('Error in field-tags GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
