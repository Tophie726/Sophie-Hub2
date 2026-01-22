import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authOptions } from '@/lib/auth/config'

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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
