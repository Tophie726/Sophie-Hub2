import { NextRequest } from 'next/server'
import { requireRole } from '@/lib/auth/api-auth'
import { ROLES } from '@/lib/auth/roles'
import { getTicketRange } from '@/lib/suptask/client'
import { sanitizeError } from '@/lib/suptask/client'
import { getAdminClient } from '@/lib/supabase/admin'
import { apiSuccess, apiError } from '@/lib/api/response'

const supabase = getAdminClient()

/**
 * POST /api/suptask/sync
 *
 * Runs a ticket ingestion sync against the SupTask API.
 * Upserts tickets by (team_id, ticket_number). Per-ticket failures
 * do not abort the run — they are logged in the sync run record.
 *
 * Systemic failures (auth, consecutive network errors) abort early
 * and mark the run as `failed`.
 *
 * Uses atomic single-active-run lock (matching Slack pattern).
 *
 * Body: { start?: number, end?: number }
 * Defaults: start = 1, end = 2100 (reasonable initial range)
 *
 * Admin only.
 */
export async function POST(request: NextRequest) {
  const auth = await requireRole(ROLES.ADMIN)
  if (!auth.authenticated) return auth.response

  let start = 1
  let end = 2100

  try {
    const body = await request.json()
    if (typeof body.start === 'number' && body.start > 0) start = body.start
    if (typeof body.end === 'number' && body.end > 0) end = body.end
  } catch {
    // Use defaults if body is missing or invalid JSON
  }

  if (end < start) {
    return apiError('VALIDATION_ERROR', 'end must be >= start', 400)
  }

  if (end - start > 5000) {
    return apiError('VALIDATION_ERROR', 'Range too large (max 5000 tickets per run)', 400)
  }

  // Atomic single-active-run creation via RPC (matches Slack pattern)
  const { data: syncRunId, error: rpcError } = await supabase.rpc(
    'create_suptask_sync_run_atomic',
    {
      p_ticket_range_start: start,
      p_ticket_range_end: end,
    }
  )

  if (rpcError) {
    // 23505 = unique_violation — another run is already active
    if (rpcError.code === '23505') {
      return apiError('SYNC_IN_PROGRESS', 'A SupTask sync is already running', 409)
    }
    return apiError('DATABASE_ERROR', `Failed to create sync run: ${rpcError.message}`, 500)
  }

  if (!syncRunId) {
    return apiError('DATABASE_ERROR', 'Failed to create sync run record', 500)
  }

  try {
    // Fetch tickets from SupTask API
    const { tickets, errors, abortReason } = await getTicketRange(start, end)

    // Upsert tickets to database
    let upsertedCount = 0
    for (const ticket of tickets) {
      const { error: upsertErr } = await supabase
        .from('suptask_tickets')
        .upsert(
          {
            team_id: ticket.teamId,
            ticket_number: ticket.ticketNumber,
            status: ticket.status,
            archived: ticket.archived,
            requester_id: ticket.requesterId,
            assignee: ticket.assignee,
            form_id: ticket.formId,
            queue_id: ticket.queueId,
            subject: ticket.subject,
            raw_payload: ticket.raw,
            ticket_created_at: ticket.createdAt,
            ticket_updated_at: ticket.updatedAt,
            last_synced_at: new Date().toISOString(),
          },
          { onConflict: 'team_id,ticket_number' }
        )

      if (!upsertErr) {
        upsertedCount++
      } else {
        errors.push({
          ticketNumber: ticket.ticketNumber,
          error: `Upsert failed: ${upsertErr.message}`,
        })
      }
    }

    // Determine final status:
    // - abortReason set → always failed (systemic issue)
    // - 0 fetched + errors → failed (nothing worked)
    // - otherwise → completed
    const isFailed = abortReason || (tickets.length === 0 && errors.length > 0)
    const finalStatus = isFailed ? 'failed' : 'completed'

    const trimmedErrors = errors.slice(0, 50) // Cap stored errors
    await supabase
      .from('suptask_sync_runs')
      .update({
        status: finalStatus,
        finished_at: new Date().toISOString(),
        tickets_fetched: tickets.length,
        tickets_upserted: upsertedCount,
        tickets_failed: errors.length,
        error_summary: trimmedErrors,
      })
      .eq('id', syncRunId)

    return apiSuccess({
      syncRunId,
      status: finalStatus,
      ticketsFetched: tickets.length,
      ticketsUpserted: upsertedCount,
      ticketsFailed: errors.length,
      abortReason: abortReason || undefined,
      errors: trimmedErrors.slice(0, 10), // Return first 10 in response
    })
  } catch (err) {
    // Mark sync run as failed
    const rawMessage = err instanceof Error ? err.message : 'Unknown error'
    const safeMessage = sanitizeError(rawMessage)
    await supabase
      .from('suptask_sync_runs')
      .update({
        status: 'failed',
        finished_at: new Date().toISOString(),
        error_summary: [{ ticketNumber: 0, error: safeMessage }],
      })
      .eq('id', syncRunId)

    return apiError('SYNC_FAILED', safeMessage, 500)
  }
}
