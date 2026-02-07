import { getAdminClient } from '@/lib/supabase/admin'
import { classifyGoogleAccountEmail } from '@/lib/google-workspace/account-classification'

type QueueStatus = 'pending' | 'approved' | 'rejected' | 'ignored' | 'resolved'

type SnapshotRow = {
  google_user_id: string
  primary_email: string
  full_name: string | null
  title: string | null
  org_unit_path: string | null
  is_suspended: boolean
  is_deleted: boolean
}

type QueueRow = {
  source_user_id: string
  status: QueueStatus
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size))
  }
  return out
}

function isMissingTableError(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code
  return code === '42P01' || code === '42703' || code === 'PGRST204' || code === 'PGRST205'
}

export async function refreshGoogleWorkspaceStaffApprovalQueue() {
  const supabase = getAdminClient()

  const [{ data: snapshot, error: snapshotError }, { data: mappings }, { data: staff, error: staffError }] = await Promise.all([
    supabase
      .from('google_workspace_directory_snapshot')
      .select('google_user_id, primary_email, full_name, title, org_unit_path, is_suspended, is_deleted'),
    supabase
      .from('entity_external_ids')
      .select('external_id')
      .eq('entity_type', 'staff')
      .eq('source', 'google_workspace_user'),
    supabase
      .from('staff')
      .select('email')
      .not('email', 'is', null),
  ])

  if (snapshotError) {
    if (isMissingTableError(snapshotError)) {
      return {
        upserted: 0,
        resolved: 0,
        pending: 0,
        skipped: true,
      }
    }
    throw snapshotError
  }

  if (staffError) {
    throw staffError
  }

  const rows = (snapshot || []) as SnapshotRow[]
  const mappedGoogleUsers = new Set((mappings || []).map(m => m.external_id))
  const existingStaffEmails = new Set(
    (staff || [])
      .map(s => (s.email || '').trim().toLowerCase())
      .filter(Boolean)
  )

  const candidates = rows
    .filter((u) => {
      if (u.is_suspended || u.is_deleted) return false
      if (mappedGoogleUsers.has(u.google_user_id)) return false

      const classification = classifyGoogleAccountEmail(u.primary_email)
      if (classification.type !== 'person') return false

      return !existingStaffEmails.has(u.primary_email.toLowerCase())
    })
    .map(u => ({
      source: 'google_workspace',
      source_user_id: u.google_user_id,
      email: u.primary_email,
      full_name: u.full_name,
      title: u.title,
      org_unit_path: u.org_unit_path,
      account_type: 'person',
      reason: 'unmatched_person_google_account',
      metadata: {},
      last_seen_at: new Date().toISOString(),
    }))

  const { data: queueRows, error: queueError } = await supabase
    .from('staff_approval_queue')
    .select('source_user_id, status')
    .eq('source', 'google_workspace')

  if (queueError) {
    if (isMissingTableError(queueError)) {
      return {
        upserted: 0,
        resolved: 0,
        pending: candidates.length,
        skipped: true,
      }
    }
    throw queueError
  }

  const existingByUserId = new Map(
    ((queueRows || []) as QueueRow[]).map(row => [row.source_user_id, row])
  )

  const upserts = candidates.map(candidate => {
    const existing = existingByUserId.get(candidate.source_user_id)
    return {
      ...candidate,
      status: existing?.status === 'resolved' ? 'pending' : existing?.status || 'pending',
      resolved_at: existing?.status === 'resolved' ? null : undefined,
    }
  })

  for (const group of chunk(upserts, 100)) {
    const { error } = await supabase
      .from('staff_approval_queue')
      .upsert(group, { onConflict: 'source,source_user_id' })

    if (error) {
      throw error
    }
  }

  const candidateIds = new Set(candidates.map(c => c.source_user_id))
  const toResolve = ((queueRows || []) as QueueRow[])
    .filter(row => row.status === 'pending' && !candidateIds.has(row.source_user_id))
    .map(row => row.source_user_id)

  for (const group of chunk(toResolve, 100)) {
    const { error } = await supabase
      .from('staff_approval_queue')
      .update({ status: 'resolved', resolved_at: new Date().toISOString() })
      .eq('source', 'google_workspace')
      .in('source_user_id', group)
      .eq('status', 'pending')

    if (error) {
      throw error
    }
  }

  return {
    upserted: upserts.length,
    resolved: toResolve.length,
    pending: candidates.length,
    skipped: false,
  }
}

export async function resolveGoogleWorkspaceApprovalByUserId(googleUserId: string) {
  const supabase = getAdminClient()
  const { error } = await supabase
    .from('staff_approval_queue')
    .update({ status: 'resolved', resolved_at: new Date().toISOString() })
    .eq('source', 'google_workspace')
    .eq('source_user_id', googleUserId)
    .eq('status', 'pending')

  if (error && !isMissingTableError(error)) {
    throw error
  }
}
