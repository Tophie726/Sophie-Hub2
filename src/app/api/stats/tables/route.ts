import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  try {
    // Get counts from partners and staff tables
    const [partnersResult, staffResult] = await Promise.all([
      supabase.from('partners').select('*', { count: 'exact', head: true }),
      supabase.from('staff').select('*', { count: 'exact', head: true }),
    ])

    return NextResponse.json({
      partners: {
        count: partnersResult.count || 0,
        fields: [
          'brand_name', 'client_name', 'status', 'tier', 'base_fee',
          'start_date', 'pod_leader', 'am_name', 'contract_type',
          'billing_cycle', 'payment_terms', 'notes', 'sophie_code'
        ]
      },
      staff: {
        count: staffResult.count || 0,
        fields: [
          'full_name', 'email', 'role', 'department', 'status',
          'hire_date', 'manager_id', 'capacity', 'timezone',
          'slack_id', 'staff_code'
        ]
      }
    })
  } catch (error) {
    console.error('Error fetching table stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    )
  }
}
