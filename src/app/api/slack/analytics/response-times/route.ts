/**
 * GET /api/slack/analytics/response-times
 *
 * Query response time metrics from slack_response_metrics.
 * Filterable by partner_id, pod_leader_id, and date range.
 * Returns metrics joined with partner/staff names.
 */

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/auth/api-auth'
import { ROLES } from '@/lib/auth/roles'
import { apiSuccess, apiValidationError, ApiErrors } from '@/lib/api/response'
import { getAdminClient } from '@/lib/supabase/admin'

const QuerySchema = z.object({
  partner_id: z.string().uuid().optional(),
  pod_leader_id: z.string().uuid().optional(),
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date_from must be YYYY-MM-DD'),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date_to must be YYYY-MM-DD'),
})

export async function GET(request: NextRequest) {
  const auth = await requireRole(ROLES.ADMIN)
  if (!auth.authenticated) return auth.response

  try {
    const { searchParams } = new URL(request.url)
    const validation = QuerySchema.safeParse({
      partner_id: searchParams.get('partner_id') || undefined,
      pod_leader_id: searchParams.get('pod_leader_id') || undefined,
      date_from: searchParams.get('date_from'),
      date_to: searchParams.get('date_to'),
    })

    if (!validation.success) {
      return apiValidationError(validation.error)
    }

    const { partner_id, pod_leader_id, date_from, date_to } = validation.data
    const supabase = getAdminClient()

    let query = supabase
      .from('slack_response_metrics')
      .select('*')
      .gte('date', date_from)
      .lte('date', date_to)
      .order('date', { ascending: true })

    if (partner_id) {
      query = query.eq('partner_id', partner_id)
    }
    if (pod_leader_id) {
      query = query.eq('pod_leader_id', pod_leader_id)
    }

    const { data: metrics, error } = await query

    if (error) {
      console.error('Error fetching response time metrics:', error)
      return ApiErrors.database()
    }

    // Collect unique partner_ids and pod_leader_ids for name enrichment
    const partnerIds = Array.from(new Set((metrics || []).map(m => m.partner_id).filter(Boolean)))
    const podLeaderIds = Array.from(new Set((metrics || []).map(m => m.pod_leader_id).filter(Boolean)))

    // Fetch partner names
    let partnerNames: Record<string, string> = {}
    if (partnerIds.length > 0) {
      const { data: partners } = await supabase
        .from('partners')
        .select('id, brand_name')
        .in('id', partnerIds)
      if (partners) {
        partnerNames = Object.fromEntries(partners.map(p => [p.id, p.brand_name]))
      }
    }

    // Fetch pod leader names
    let podLeaderNames: Record<string, string> = {}
    if (podLeaderIds.length > 0) {
      const { data: staff } = await supabase
        .from('staff')
        .select('id, full_name')
        .in('id', podLeaderIds)
      if (staff) {
        podLeaderNames = Object.fromEntries(staff.map(s => [s.id, s.full_name]))
      }
    }

    // Enrich metrics with names
    const enriched = (metrics || []).map(m => ({
      ...m,
      partner_name: partnerNames[m.partner_id] || null,
      pod_leader_name: m.pod_leader_id ? podLeaderNames[m.pod_leader_id] || null : null,
    }))

    return apiSuccess({
      metrics: enriched,
      count: enriched.length,
      date_range: { from: date_from, to: date_to },
    })
  } catch (error) {
    console.error('GET analytics/response-times error:', error)
    return ApiErrors.internal()
  }
}
