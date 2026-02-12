/**
 * Partners API Route
 *
 * Thin controller layer - handles HTTP concerns only.
 * Business logic delegated to service layer.
 * Database operations delegated to repository layer.
 */

import { NextResponse } from 'next/server'
import { requireAuth, requireRole } from '@/lib/auth/api-auth'
import { ROLES } from '@/lib/auth/roles'
import {
  apiSuccess,
  apiError,
  apiValidationError,
  ApiErrors,
  ErrorCodes,
} from '@/lib/api/response'
import { checkRateLimit, RATE_LIMITS, rateLimitHeaders } from '@/lib/rate-limit'
import { createLogger } from '@/lib/logger'
import { z } from 'zod'
import * as partnerService from '@/lib/services/partner.service'

const log = createLogger('api:partners')

const QuerySchema = z.object({
  search: z.string().max(200).optional(),
  status: z.string().optional(),
  tier: z.string().optional(),
  sort: z.enum(['brand_name', 'created_at', 'tier', 'onboarding_date', 'partner_code', 'client_name', 'pod_leader_name']).optional().default('brand_name'),
  order: z.enum(['asc', 'desc']).optional().default('asc'),
  limit: z.coerce.number().int().min(1).max(5000).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
})

const CreatePartnerSchema = z.object({
  brand_name: z.string().min(1, 'Brand name is required').max(200),
  client_name: z.string().max(200).optional(),
  client_email: z.string().email().optional().or(z.literal('')),
  status: z.enum(['active', 'onboarding', 'paused', 'churned']).optional().default('onboarding'),
  tier: z.enum(['tier_1', 'tier_2', 'tier_3']).optional(),
})

/**
 * GET /api/partners
 * List partners with search, filter, sort, and pagination.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireAuth()
  if (!auth.authenticated) return auth.response

  const rateLimit = checkRateLimit(auth.user.id, 'partners:list', RATE_LIMITS.PARTNERS_LIST)
  if (!rateLimit.allowed) {
    return ApiErrors.rateLimited('Too many requests. Please wait before fetching partners again.')
  }

  try {
    const { searchParams } = new URL(request.url)
    const params = {
      search: searchParams.get('search') || undefined,
      status: searchParams.get('status') || undefined,
      tier: searchParams.get('tier') || undefined,
      sort: searchParams.get('sort') || undefined,
      order: searchParams.get('order') || undefined,
      limit: searchParams.get('limit') || undefined,
      offset: searchParams.get('offset') || undefined,
    }

    const validation = QuerySchema.safeParse(params)
    if (!validation.success) {
      return apiValidationError(validation.error)
    }

    const result = await partnerService.listPartners(validation.data)

    return apiSuccess(result, 200, {
      'Cache-Control': 'private, max-age=60, stale-while-revalidate=300',
      ...rateLimitHeaders(rateLimit),
    })
  } catch (error: unknown) {
    log.error('Error in GET /api/partners', error)
    return ApiErrors.internal()
  }
}

/**
 * POST /api/partners
 * Create a new partner (admin only).
 */
export async function POST(request: Request): Promise<NextResponse> {
  const auth = await requireRole(ROLES.ADMIN)
  if (!auth.authenticated) return auth.response

  try {
    const body = await request.json()
    const validation = CreatePartnerSchema.safeParse(body)

    if (!validation.success) {
      return apiValidationError(validation.error)
    }

    const { brand_name, client_name, client_email, status, tier } = validation.data

    const result = await partnerService.createPartner({
      brand_name,
      client_name: client_name || null,
      client_email: client_email || null,
      status,
      tier: tier || null,
    })

    if (result.isConflict) {
      return apiError(
        ErrorCodes.CONFLICT,
        `Partner "${result.brandName}" already exists`,
        409
      )
    }

    return apiSuccess({ partner: result.partner }, 201)
  } catch (error: unknown) {
    log.error('Error in POST /api/partners', error)
    return ApiErrors.internal()
  }
}
