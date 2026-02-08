import { z } from 'zod'
import { requireRole } from '@/lib/auth/api-auth'
import { ROLES } from '@/lib/auth/roles'
import { apiSuccess, apiValidationError, apiError, ApiErrors, ErrorCodes } from '@/lib/api/response'
import { getAdminClient } from '@/lib/supabase/admin'

const QuerySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'ignored', 'resolved']).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
})

const BodySchema = z.object({
  source_user_id: z.string().min(1),
  action: z.enum(['skip', 'unskip']),
  email: z.string().email().optional(),
  full_name: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  org_unit_path: z.string().nullable().optional(),
  note: z.string().max(500).optional(),
})

function isMissingTableError(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code
  return code === '42P01' || code === '42703' || code === 'PGRST204' || code === 'PGRST205'
}

export async function GET(request: Request) {
  const auth = await requireRole(ROLES.ADMIN)
  if (!auth.authenticated) {
    return auth.response
  }

  try {
    const { searchParams } = new URL(request.url)
    const parsed = QuerySchema.safeParse({
      status: searchParams.get('status') || undefined,
      limit: searchParams.get('limit') || undefined,
    })

    if (!parsed.success) {
      return apiValidationError(parsed.error)
    }

    const { status, limit } = parsed.data
    const supabase = getAdminClient()

    let query = supabase
      .from('staff_approval_queue')
      .select('id, source_user_id, email, full_name, title, org_unit_path, status, reason, suggested_at, last_seen_at, resolved_at')
      .eq('source', 'google_workspace')
      .order('last_seen_at', { ascending: false })
      .limit(limit)

    if (status) {
      query = query.eq('status', status)
    }

    const { data: rows, error } = await query
    if (error) {
      if (isMissingTableError(error)) {
        return apiSuccess({
          approvals: [],
          counts: {
            pending: 0,
            approved: 0,
            rejected: 0,
            ignored: 0,
            resolved: 0,
          },
          setup_required: true,
        })
      }
      console.error('Failed to fetch staff approval queue:', error)
      return ApiErrors.database()
    }

    const { data: allRows, error: countError } = await supabase
      .from('staff_approval_queue')
      .select('status')
      .eq('source', 'google_workspace')

    if (countError) {
      if (!isMissingTableError(countError)) {
        console.error('Failed to fetch staff approval queue counts:', countError)
      }
      return apiSuccess({
        approvals: rows || [],
        counts: {
          pending: 0,
          approved: 0,
          rejected: 0,
          ignored: 0,
          resolved: 0,
        },
      })
    }

    const counts = {
      pending: 0,
      approved: 0,
      rejected: 0,
      ignored: 0,
      resolved: 0,
    }

    for (const row of allRows || []) {
      if (row.status in counts) {
        counts[row.status as keyof typeof counts] += 1
      }
    }

    return apiSuccess({
      approvals: rows || [],
      counts,
    })
  } catch (error) {
    console.error('GET /api/google-workspace/staff-approvals error:', error)
    return ApiErrors.internal()
  }
}

export async function POST(request: Request) {
  const auth = await requireRole(ROLES.ADMIN)
  if (!auth.authenticated) {
    return auth.response
  }

  try {
    const body = await request.json()
    const parsed = BodySchema.safeParse(body)
    if (!parsed.success) {
      return apiValidationError(parsed.error)
    }

    const { source_user_id, action, note } = parsed.data
    const supabase = getAdminClient()

    const { data: existing, error: existingError } = await supabase
      .from('staff_approval_queue')
      .select('id, email, full_name, title, org_unit_path, reason, status')
      .eq('source', 'google_workspace')
      .eq('source_user_id', source_user_id)
      .maybeSingle()

    if (existingError && !isMissingTableError(existingError)) {
      console.error('Failed to load existing approval row:', existingError)
      return ApiErrors.database()
    }

    if (action === 'skip') {
      const email = existing?.email || parsed.data.email
      if (!email) {
        return apiError(
          ErrorCodes.VALIDATION_ERROR,
          'Email is required to skip a user',
          400
        )
      }

      const fullName = existing?.full_name ?? parsed.data.full_name ?? null
      const title = existing?.title ?? parsed.data.title ?? null
      const orgUnitPath = existing?.org_unit_path ?? parsed.data.org_unit_path ?? null

      const { error } = await supabase
        .from('staff_approval_queue')
        .upsert(
          {
            source: 'google_workspace',
            source_user_id,
            email,
            full_name: fullName,
            title,
            org_unit_path: orgUnitPath,
            account_type: 'person',
            reason: existing?.reason || 'operator_skipped',
            status: 'ignored',
            resolved_at: new Date().toISOString(),
            reviewed_by: auth.user.email,
            review_note: note || 'Skipped by operator from mapping UI',
            last_seen_at: new Date().toISOString(),
          },
          { onConflict: 'source,source_user_id' }
        )

      if (error) {
        if (isMissingTableError(error)) {
          return apiSuccess({
            source_user_id,
            status: 'ignored',
            setup_required: true,
          })
        }
        console.error('Failed to skip approval row:', error)
        return ApiErrors.database()
      }

      return apiSuccess({
        source_user_id,
        status: 'ignored',
      })
    }

    const now = new Date().toISOString()
    const { data: updatedRows, error: updateError } = await supabase
      .from('staff_approval_queue')
      .update({
        status: 'pending',
        resolved_at: null,
        reviewed_by: auth.user.email,
        review_note: note || null,
        last_seen_at: now,
      })
      .eq('source', 'google_workspace')
      .eq('source_user_id', source_user_id)
      .select('id')

    if (updateError) {
      if (!isMissingTableError(updateError)) {
        console.error('Failed to unskip approval row:', updateError)
        return ApiErrors.database()
      }
    }

    const updatedCount = updatedRows?.length || 0
    if (updatedCount === 0) {
      const email = parsed.data.email
      if (!email) {
        return apiError(
          ErrorCodes.VALIDATION_ERROR,
          'Email is required to re-open a skipped user',
          400
        )
      }

      const { error: insertError } = await supabase
        .from('staff_approval_queue')
        .insert({
          source: 'google_workspace',
          source_user_id,
          email,
          full_name: parsed.data.full_name ?? null,
          title: parsed.data.title ?? null,
          org_unit_path: parsed.data.org_unit_path ?? null,
          account_type: 'person',
          reason: 'unmatched_person_google_account',
          status: 'pending',
          resolved_at: null,
          reviewed_by: auth.user.email,
          review_note: note || null,
          last_seen_at: now,
        })

      if (insertError) {
        if (!isMissingTableError(insertError)) {
          console.error('Failed to insert unskipped approval row:', insertError)
          return ApiErrors.database()
        }
      }
    }

    return apiSuccess({
      source_user_id,
      status: 'pending',
    })
  } catch (error) {
    console.error('POST /api/google-workspace/staff-approvals error:', error)
    return ApiErrors.internal()
  }
}
