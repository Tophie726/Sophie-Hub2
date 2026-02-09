/**
 * POST /api/google-workspace/enrich-staff
 *
 * Pull profile data (title, phone, avatar, org unit) from the local directory snapshot
 * for all staff members that have a Google Workspace mapping.
 * Updates the staff table with enriched data.
 *
 * Enrichment rules (per approved plan):
 * - avatar_url: always evaluated with Slack-first fallback behavior (only fills if missing)
 * - title: only set if currently empty in DB
 * - phone: only set if currently empty in DB
 */

import { requireRole } from '@/lib/auth/api-auth'
import { ROLES } from '@/lib/auth/roles'
import { apiSuccess, ApiErrors } from '@/lib/api/response'
import { getAdminClient } from '@/lib/supabase/admin'
import type { DirectorySnapshotRow } from '@/lib/google-workspace/types'
import { z } from 'zod'

type JsonRecord = Record<string, unknown>
type EnrichField = 'avatar_url' | 'title' | 'phone' | 'directory_snapshot'

const EnrichRequestSchema = z.object({
  fields: z.array(z.enum(['avatar_url', 'title', 'phone', 'directory_snapshot'])).min(1).optional(),
})

function isObject(value: unknown): value is JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function deepMergeSourceData(base: JsonRecord, incoming: JsonRecord): JsonRecord {
  const result: JsonRecord = { ...base }

  for (const [key, value] of Object.entries(incoming)) {
    const current = result[key]
    if (isObject(current) && isObject(value)) {
      result[key] = deepMergeSourceData(current, value)
    } else {
      result[key] = value
    }
  }

  return result
}

function buildGoogleWorkspaceSourcePayload(snapshot: DirectorySnapshotRow): JsonRecord {
  return {
    directory_snapshot: {
      google_user_id: snapshot.google_user_id,
      primary_email: snapshot.primary_email,
      full_name: snapshot.full_name,
      given_name: snapshot.given_name,
      family_name: snapshot.family_name,
      org_unit_path: snapshot.org_unit_path,
      is_admin: snapshot.is_admin,
      is_delegated_admin: snapshot.is_delegated_admin,
      is_suspended: snapshot.is_suspended,
      is_deleted: snapshot.is_deleted,
      title: snapshot.title,
      phone: snapshot.phone,
      thumbnail_photo_url: snapshot.thumbnail_photo_url,
      aliases: snapshot.aliases,
      non_editable_aliases: snapshot.non_editable_aliases,
      creation_time: snapshot.creation_time,
      last_login_time: snapshot.last_login_time,
      department: snapshot.department,
      cost_center: snapshot.cost_center,
      location: snapshot.location,
      manager_email: snapshot.manager_email,
      last_seen_at: snapshot.last_seen_at,
      synced_at: new Date().toISOString(),
    },
  }
}

async function resolveEnrichConfig(request: Request): Promise<{
  selectedFields: Set<EnrichField>
}> {
  const defaults = new Set<EnrichField>(['title', 'phone', 'directory_snapshot'])
  const contentType = request.headers.get('content-type') || ''
  if (!contentType.toLowerCase().includes('application/json')) {
    return { selectedFields: defaults }
  }

  try {
    const raw = await request.json()
    const parsed = EnrichRequestSchema.safeParse(raw)
    if (!parsed.success || !parsed.data.fields || parsed.data.fields.length === 0) {
      return { selectedFields: defaults }
    }
    const selected = new Set(parsed.data.fields as EnrichField[])
    selected.delete('avatar_url')
    return { selectedFields: selected }
  } catch {
    return { selectedFields: defaults }
  }
}

export async function POST(request: Request) {
  const auth = await requireRole(ROLES.ADMIN)
  if (!auth.authenticated) {
    return auth.response
  }

  try {
    const { selectedFields } = await resolveEnrichConfig(request)
    const supabase = getAdminClient()

    // 1. Fetch all staff ↔ Google Workspace mappings
    const { data: mappings, error: mappingsError } = await supabase
      .from('entity_external_ids')
      .select('entity_id, external_id, metadata')
      .eq('entity_type', 'staff')
      .eq('source', 'google_workspace_user')

    if (mappingsError) {
      console.error('Failed to fetch GWS mappings:', mappingsError)
      return ApiErrors.database()
    }

    if (!mappings || mappings.length === 0) {
      return apiSuccess({
        enriched: 0,
        skipped: 0,
        total_mappings: 0,
        fields_updated: { title: 0, phone: 0, avatar_url: 0 },
        source_snapshot_updates: 0,
        selected_fields: Array.from(selectedFields),
        message: 'No staff-Google Workspace mappings found. Run auto-match first.',
      })
    }

    // 2. Fetch snapshot data for mapped Google users
    const googleUserIds = mappings.map(m => m.external_id)
    const { data: snapshotUsers, error: snapError } = await supabase
      .from('google_workspace_directory_snapshot')
      .select('*')
      .in('google_user_id', googleUserIds)

    if (snapError) {
      console.error('Failed to fetch directory snapshot:', snapError)
      return ApiErrors.database()
    }

    // Build lookup: google_user_id → snapshot row
    const snapshotById = new Map(
      (snapshotUsers as DirectorySnapshotRow[] || []).map(u => [u.google_user_id, u])
    )

    // 3. Enrich each mapped staff member
    let enriched = 0
    let skipped = 0
    const fieldsUpdated = { title: 0, phone: 0, avatar_url: 0 }
    let snapshotUpdates = 0
    const lineageRows: Array<{
      entity_type: 'staff'
      entity_id: string
      field_name: string
      source_type: 'api'
      source_ref: string
      previous_value: string | null
      new_value: string | null
      changed_at: string
    }> = []

    for (const mapping of mappings) {
      const snapshot = snapshotById.get(mapping.external_id)
      if (!snapshot) {
        skipped++
        continue
      }

      // Skip suspended users by default (don't enrich with stale data)
      if (snapshot.is_suspended || snapshot.is_deleted) {
        skipped++
        continue
      }

      const { data: existing, error: existingError } = await supabase
        .from('staff')
        .select('avatar_url, title, phone, source_data')
        .eq('id', mapping.entity_id)
        .single()

      if (existingError || !existing) {
        console.error(`Failed to load staff record ${mapping.entity_id}:`, existingError)
        skipped++
        continue
      }

      const dbFields: Record<string, unknown> = {}
      let sourceSnapshotChanged = false
      const localLineage: Array<{
        field: 'avatar_url' | 'title' | 'phone'
        previous: string | null
        next: string | null
        sourceRef: string
      }> = []

      if (snapshot.thumbnail_photo_url && !existing.avatar_url) {
        dbFields.avatar_url = snapshot.thumbnail_photo_url
        localLineage.push({
          field: 'avatar_url',
          previous: existing.avatar_url,
          next: snapshot.thumbnail_photo_url,
          sourceRef: 'Google Workspace → Directory Snapshot → thumbnail_photo_url',
        })
      }

      if (selectedFields.has('title') && !existing.title && snapshot.title) {
        dbFields.title = snapshot.title
        localLineage.push({
          field: 'title',
          previous: existing.title,
          next: snapshot.title,
          sourceRef: 'Google Workspace → Directory Snapshot → title',
        })
      }

      if (selectedFields.has('phone') && !existing.phone && snapshot.phone) {
        dbFields.phone = snapshot.phone
        localLineage.push({
          field: 'phone',
          previous: existing.phone,
          next: snapshot.phone,
          sourceRef: 'Google Workspace → Directory Snapshot → phone',
        })
      }

      if (selectedFields.has('directory_snapshot')) {
        const existingSourceData = (existing.source_data as JsonRecord | null) || {}
        const incomingSourceData: JsonRecord = {
          google_workspace: buildGoogleWorkspaceSourcePayload(snapshot),
        }
        const mergedSourceData = deepMergeSourceData(existingSourceData, incomingSourceData)
        if (JSON.stringify(existingSourceData) !== JSON.stringify(mergedSourceData)) {
          dbFields.source_data = mergedSourceData
          sourceSnapshotChanged = true
        }
      }

      if (Object.keys(dbFields).length === 0) {
        skipped++
        continue
      }

      const { error: updateError } = await supabase
        .from('staff')
        .update(dbFields)
        .eq('id', mapping.entity_id)

      if (updateError) {
        console.error(`Failed to enrich staff ${mapping.entity_id}:`, updateError)
        skipped++
        continue
      }

      enriched++
      if (sourceSnapshotChanged) {
        snapshotUpdates++
      }
      for (const change of localLineage) {
        if (change.field === 'avatar_url') fieldsUpdated.avatar_url++
        if (change.field === 'title') fieldsUpdated.title++
        if (change.field === 'phone') fieldsUpdated.phone++
        lineageRows.push({
          entity_type: 'staff',
          entity_id: mapping.entity_id,
          field_name: change.field,
          source_type: 'api',
          source_ref: change.sourceRef,
          previous_value: change.previous,
          new_value: change.next,
          changed_at: new Date().toISOString(),
        })
      }
    }

    if (lineageRows.length > 0) {
      const { error: lineageError } = await supabase
        .from('field_lineage')
        .insert(lineageRows)
      if (lineageError) {
        // Non-blocking: enrichment succeeded, but provenance write failed.
        console.error('Failed to write Google Workspace field lineage:', lineageError)
      }
    }

    return apiSuccess({
      enriched,
      skipped,
      total_mappings: mappings.length,
      fields_updated: fieldsUpdated,
      source_snapshot_updates: snapshotUpdates,
      selected_fields: ['avatar_url', ...Array.from(selectedFields)],
    })
  } catch (error) {
    console.error('GWS staff enrichment error:', error)
    return ApiErrors.internal()
  }
}
