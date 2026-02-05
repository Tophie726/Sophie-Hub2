import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth/api-auth'
import { STATUS_BUCKETS } from '@/lib/status-colors'

const supabase = getAdminClient()

/**
 * Get the latest weekly status from partner source_data
 */
function getLatestWeeklyStatus(
  sourceData: Record<string, Record<string, Record<string, unknown>>> | null
): string | null {
  if (!sourceData) return null

  let latestDate: Date | null = null
  let latestStatus: string | null = null

  for (const connectorData of Object.values(sourceData)) {
    if (typeof connectorData !== 'object' || !connectorData) continue

    for (const tabData of Object.values(connectorData)) {
      if (typeof tabData !== 'object' || !tabData) continue

      for (const [columnName, value] of Object.entries(tabData)) {
        const match = columnName.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})[\s\n]+Week/i)
        if (!match) continue

        const month = parseInt(match[1], 10) - 1
        const day = parseInt(match[2], 10)
        const year = 2000 + parseInt(match[3], 10)
        const date = new Date(year, month, day)

        if (date > new Date()) continue

        if (typeof value === 'string' && value.trim()) {
          if (!latestDate || date > latestDate) {
            latestDate = date
            latestStatus = value.trim()
          }
        }
      }
    }
  }

  return latestStatus
}

/**
 * Check if a status maps to "healthy" (active) bucket
 */
function isHealthyStatus(status: string | null): boolean {
  if (!status) return false
  const s = status.toLowerCase().trim()

  // Check against healthy keywords
  const healthyKeywords = STATUS_BUCKETS.healthy || []
  return healthyKeywords.some(keyword => s.includes(keyword))
}

export async function GET() {
  const auth = await requireAuth()
  if (!auth.authenticated) return auth.response

  try {
    // Get all partners with source_data to calculate active count
    const [partnersResult, staffResult] = await Promise.all([
      supabase.from('partners').select('id, source_data'),
      supabase.from('staff').select('*', { count: 'exact', head: true }),
    ])

    // Calculate active partners (those with "healthy" status)
    let totalPartners = 0
    let activePartners = 0

    if (partnersResult.data) {
      totalPartners = partnersResult.data.length

      for (const partner of partnersResult.data) {
        const sourceData = partner.source_data as Record<string, Record<string, Record<string, unknown>>> | null
        const latestStatus = getLatestWeeklyStatus(sourceData)

        if (isHealthyStatus(latestStatus)) {
          activePartners++
        }
      }
    }

    return NextResponse.json({
      partners: {
        count: totalPartners,
        activeCount: activePartners,
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
