/**
 * GET /api/bigquery/partner-data/[id]
 *
 * Fetches BigQuery advertising/sales data for a specific partner.
 * Looks up the partner's mapped BigQuery identifiers from entity_external_ids,
 * then queries the unified views using all mapped identifiers.
 *
 * Query params:
 *   view - specific view to query (default: sales)
 *   startDate - filter start date (YYYY-MM-DD)
 *   endDate - filter end date (YYYY-MM-DD)
 *   limit - max rows to return (default: 100)
 */

import { NextRequest } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'
import { requireAuth, canAccessPartner } from '@/lib/auth/api-auth'
import { apiSuccess, ApiErrors } from '@/lib/api/response'
import { UNIFIED_VIEWS } from '@/lib/connectors/bigquery'
import { getAdminClient } from '@/lib/supabase/admin'
import { BIGQUERY } from '@/lib/constants'
import {
  inferMarketplaceCodeFromText,
  normalizeMarketplaceCode,
  normalizeMarketplaceCodes,
} from '@/lib/amazon/marketplaces'

const supabase = getAdminClient()

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

const PARTNER_FIELD_PER_VIEW: Record<string, string> = {
  pbi_sellingpartner_sales_unified_latest: 'client_id',
  pbi_sellingpartner_refunds_unified_latest: 'client_id',
  pbi_sp_par_unified_latest: 'client_name',
  pbi_sd_par_unified_latest: 'client_name',
  pbi_sb_str_unified_latest: 'client_id',
  pbi_dim_products_unified_latest: 'client_id',
  pbi_match_unified_latest: 'client_name',
}

function getPartnerFilterCondition(partnerField: string): string {
  return `CAST(${partnerField} AS STRING) IN UNNEST(@clientIds)`
}

function extractMarketplaceCodeFromMapping(mapping: {
  external_id: string
  metadata: Record<string, unknown> | null
}): string | null {
  const root = mapping.metadata
  const fromRoot = typeof root?.marketplace_code === 'string'
    ? normalizeMarketplaceCode(root.marketplace_code)
    : null
  if (fromRoot) return fromRoot

  const referenceSheet = root?.reference_sheet
  if (referenceSheet && typeof referenceSheet === 'object') {
    const fromSheet = typeof (referenceSheet as Record<string, unknown>).marketplace_code === 'string'
      ? normalizeMarketplaceCode((referenceSheet as Record<string, unknown>).marketplace_code as string)
      : null
    if (fromSheet) return fromSheet
  }

  return inferMarketplaceCodeFromText(mapping.external_id)
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

    // Look up the partner's mapped client identifiers (supports many per partner).
    const { data: mappings, error: mappingError } = await supabase
      .from('entity_external_ids')
      .select('external_id, metadata')
      .eq('entity_type', 'partners')
      .eq('entity_id', partnerId)
      .eq('source', 'bigquery')
      .order('updated_at', { ascending: false })

    if (mappingError) {
      console.error('Error looking up BigQuery mapping:', mappingError)
      return ApiErrors.database()
    }

    if (!mappings || mappings.length === 0) {
      return apiSuccess({
        mapped: false,
        clientName: null,
        clientNames: [],
        data: null,
        message: 'This partner is not mapped to a BigQuery client'
      })
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const viewParam = searchParams.get('view') || 'sales'
    const startDate = searchParams.get('startDate') || undefined
    const endDate = searchParams.get('endDate') || undefined
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 1000)
    const marketplaceValues = [
      ...searchParams.getAll('marketplace'),
      ...(searchParams.get('marketplaces') || '')
        .split(',')
        .map(value => value.trim())
        .filter(Boolean),
    ]
    const requestedMarketplaceCodes = normalizeMarketplaceCodes(marketplaceValues)

    const filteredMappings = requestedMarketplaceCodes.length > 0
      ? mappings.filter((mapping) => {
          const mappedCode = extractMarketplaceCodeFromMapping(mapping as {
            external_id: string
            metadata: Record<string, unknown> | null
          })
          return !!mappedCode && requestedMarketplaceCodes.includes(mappedCode)
        })
      : mappings

    const clientIds = Array.from(
      new Set(
        filteredMappings
          .map(mapping => String(mapping.external_id || '').trim())
          .filter(value => value.length > 0)
      )
    )

    if (clientIds.length === 0) {
      return apiSuccess({
        mapped: true,
        clientName: null,
        clientNames: [],
        data: null,
        message: 'No mapped BigQuery identifiers found for the selected marketplaces',
      })
    }

    // Resolve view name from alias or direct name
    const viewName = VIEW_ALIASES[viewParam] || viewParam

    // Validate view name
    if (!UNIFIED_VIEWS.includes(viewName)) {
      return ApiErrors.notFound(`View "${viewParam}"`)
    }

    const partnerField = PARTNER_FIELD_PER_VIEW[viewName] || 'client_id'
    const fullTable = `\`${BIGQUERY.PROJECT_ID}.${BIGQUERY.DATASET}.${viewName}\``
    const queryParams: Record<string, string | string[]> = { clientIds }
    const conditions: string[] = [getPartnerFilterCondition(partnerField)]

    if (startDate) {
      conditions.push('date >= @startDate')
      queryParams.startDate = startDate
    }
    if (endDate) {
      conditions.push('date <= @endDate')
      queryParams.endDate = endDate
    }

    const whereClause = conditions.join(' AND ')
    const query = `SELECT * FROM ${fullTable} WHERE ${whereClause} LIMIT ${limit}`

    const bq = new BigQuery({ projectId: BIGQUERY.PROJECT_ID })
    const [job] = await bq.createQueryJob({
      query,
      params: queryParams,
      labels: { source: 'sophie-hub', feature: 'partner-data' },
    })
    const [rows] = await job.getQueryResults()

    const headers = rows.length > 0 ? Object.keys(rows[0]) : []
    const normalizedRows = rows.map(row =>
      headers.map((header) => String(row[header] ?? ''))
    )

    return apiSuccess({
      mapped: true,
      clientName: clientIds[0] || null,
      clientNames: clientIds,
      marketplaces: requestedMarketplaceCodes,
      view: viewParam,
      viewName,
      rowCount: normalizedRows.length,
      headers,
      rows: normalizedRows,
    })
  } catch (error) {
    console.error('BigQuery partner-data error:', error)
    return ApiErrors.internal(
      error instanceof Error ? error.message : 'Failed to fetch partner data'
    )
  }
}
