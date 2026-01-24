import { NextRequest } from 'next/server'
import { requirePermission } from '@/lib/auth/api-auth'
import { apiSuccess, ApiErrors } from '@/lib/api/response'
import { audit, type AuditAction, type AuditResourceType } from '@/lib/audit'

/**
 * GET /api/audit
 *
 * Retrieve audit logs with optional filtering.
 * Admin only.
 *
 * Query params:
 * - action: Filter by action type
 * - resource_type: Filter by resource type
 * - resource_id: Filter by specific resource
 * - user_id: Filter by user
 * - limit: Number of results (default 50, max 200)
 */
export async function GET(request: NextRequest) {
  const auth = await requirePermission('data-enrichment:read')
  if (!auth.authenticated) return auth.response

  try {
    const { searchParams } = new URL(request.url)

    const action = searchParams.get('action') as AuditAction | null
    const resourceType = searchParams.get('resource_type') as AuditResourceType | null
    const resourceId = searchParams.get('resource_id')
    const userId = searchParams.get('user_id')
    const limitParam = searchParams.get('limit')
    const limit = Math.min(parseInt(limitParam || '50', 10), 200)

    const logs = await audit.getRecent(limit, {
      action: action || undefined,
      resourceType: resourceType || undefined,
      resourceId: resourceId || undefined,
      userId: userId || undefined,
    })

    return apiSuccess({ logs, count: logs.length })
  } catch (error) {
    console.error('Error fetching audit logs:', error)
    return ApiErrors.database(error instanceof Error ? error.message : 'Failed to fetch audit logs')
  }
}
