/**
 * GET /api/bigquery/partner-data/[id]
 *
 * Fetches BigQuery advertising/sales data for a specific partner.
 * Looks up the partner's mapped client_name from entity_external_ids,
 * then queries the unified views for that client's data.
 *
 * Query params:
 *   view - specific view to query (default: sales)
 *   startDate - filter start date (YYYY-MM-DD)
 *   endDate - filter end date (YYYY-MM-DD)
 *   limit - max rows to return (default: 100)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuth, canAccessPartner } from '@/lib/auth/api-auth'
import { apiSuccess, ApiErrors } from '@/lib/api/response'
import { bigQueryConnector, UNIFIED_VIEWS } from '@/lib/connectors/bigquery'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Map short names to full view names for convenience
const VIEW_ALIASES: Record<string, string> = {
  sales: 'pbi_sellingpartner_sales_unified_latest',
  refunds: 'pbi_sellingpartner_refunds_unified_latest',
  sp: 'pbi_sp_par_unified_latest',
  sd: 'pbi_sd_par_unified_latest',
  sb: 'pbi_sb_str_unified_latest',
  products: 'pbi_dim_products_unified_latest',
  match: 'pbi_match_unified_latest',
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth()
    if (!auth.authenticated) {
      return auth.response
    }

    const { id: partnerId } = await params

    // Check authorization - user must be able to access this partner
    const canAccess = await canAccessPartner(auth.user.id, auth.user.role, partnerId)
    if (!canAccess) {
      return ApiErrors.forbidden('You do not have access to this partner')
    }

    // Look up the partner's mapped client_name
    const { data: mapping, error: mappingError } = await supabase
      .from('entity_external_ids')
      .select('external_id')
      .eq('entity_type', 'partners')
      .eq('entity_id', partnerId)
      .eq('source', 'bigquery')
      .maybeSingle()

    if (mappingError) {
      console.error('Error looking up BigQuery mapping:', mappingError)
      return ApiErrors.database()
    }

    if (!mapping) {
      return apiSuccess({
        mapped: false,
        clientName: null,
        data: null,
        message: 'This partner is not mapped to a BigQuery client'
      })
    }

    const clientName = mapping.external_id

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const viewParam = searchParams.get('view') || 'sales'
    const startDate = searchParams.get('startDate') || undefined
    const endDate = searchParams.get('endDate') || undefined
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 1000)

    // Resolve view name from alias or direct name
    const viewName = VIEW_ALIASES[viewParam] || viewParam

    // Validate view name
    if (!UNIFIED_VIEWS.includes(viewName)) {
      return ApiErrors.notFound(`View "${viewParam}"`)
    }

    const config = {
      type: 'bigquery' as const,
      project_id: 'sophie-society-reporting',
      dataset_id: 'pbi',
    }

    const data = await bigQueryConnector.getPartnerData(config, viewName, clientName, {
      limit,
      startDate,
      endDate,
    })

    return apiSuccess({
      mapped: true,
      clientName,
      view: viewParam,
      viewName,
      rowCount: data.rows.length,
      headers: data.headers,
      rows: data.rows,
    })
  } catch (error) {
    console.error('BigQuery partner-data error:', error)
    return ApiErrors.internal(
      error instanceof Error ? error.message : 'Failed to fetch partner data'
    )
  }
}
