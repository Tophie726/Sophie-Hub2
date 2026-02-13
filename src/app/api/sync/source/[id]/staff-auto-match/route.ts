import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { requirePermission } from '@/lib/auth/api-auth'
import { apiSuccess, ApiErrors } from '@/lib/api/response'
import { getAdminClient } from '@/lib/supabase/admin'
import { getSyncEngine } from '@/lib/sync'
import { mapSheetsAuthError, resolveSheetsAccessToken } from '@/lib/google/sheets-auth'

const supabase = getAdminClient()

const STAFF_AUTO_MATCH_TAB_SCOPED_PATTERNS: RegExp[] = [
  /^pod leader information$/i,
  /^ppc manager information$/i,
  /^content team information$/i,
  /^conversion team information$/i,
  /^content lite information$/i,
  /^sales executive information$/i,
  /^additional team members information$/i,
  /^marketing team$/i,
  /^contractor members information$/i,
]

const CONTRACTOR_TAB_PATTERN = /contractor|external|freelance/i

function isScopedStaffAutoMatchTab(tabName: string): boolean {
  const normalized = tabName.trim()
  return STAFF_AUTO_MATCH_TAB_SCOPED_PATTERNS.some(pattern => pattern.test(normalized))
}

/**
 * POST /api/sync/source/[id]/staff-auto-match
 *
 * Runs source-level staff auto-match by email for tabs configured as primary_entity=staff.
 * This uses "match-only-existing" mode so rows without an existing staff email match are skipped.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requirePermission('data-enrichment:write')
  if (!auth.authenticated) return auth.response

  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return ApiErrors.unauthorized('Not authenticated')
  }

  let accessToken: string
  try {
    const resolved = await resolveSheetsAccessToken(session.accessToken)
    accessToken = resolved.accessToken
  } catch (authError) {
    const mapped = mapSheetsAuthError(authError)
    if (mapped.status === 401) {
      return ApiErrors.unauthorized(mapped.message)
    }
    return ApiErrors.internal(mapped.message)
  }

  try {
    const sourceId = params.id
    const body = await request.json().catch(() => ({})) as {
      create_unmatched_contractors?: boolean
    }
    const createUnmatchedContractors = body.create_unmatched_contractors === true

    const { data: staffTabs, error: tabsError } = await supabase
      .from('tab_mappings')
      .select('id, tab_name, status')
      .eq('data_source_id', sourceId)
      .eq('primary_entity', 'staff')

    if (tabsError) {
      console.error('Failed to fetch staff tabs for auto-match:', tabsError)
      return ApiErrors.database(tabsError.message)
    }

    if (!staffTabs || staffTabs.length === 0) {
      return apiSuccess({
        source_id: sourceId,
        tabs_considered: 0,
        tabs_synced: 0,
        matched: 0,
        skipped: 0,
        message: 'No staff tabs found for this source.',
      })
    }

    const activeOrReferenceTabs = staffTabs.filter(
      tab => !tab.status || tab.status === 'active' || tab.status === 'reference'
    )

    if (activeOrReferenceTabs.length === 0) {
      return apiSuccess({
        source_id: sourceId,
        tabs_considered: staffTabs.length,
        tabs_synced: 0,
        matched: 0,
        skipped: 0,
        message: 'No active/reference staff tabs available for auto-match.',
      })
    }

    // Scope to the intended master dashboard staff tabs only.
    const scopedStaffTabs = activeOrReferenceTabs.filter(tab => isScopedStaffAutoMatchTab(tab.tab_name))
    const tabsForAutoMatch = scopedStaffTabs

    if (tabsForAutoMatch.length === 0) {
      return apiSuccess({
        source_id: sourceId,
        tabs_considered: staffTabs.length,
        tabs_scoped: 0,
        tabs_synced: 0,
        matched: 0,
        skipped: 0,
        message: 'No scoped staff tabs found for auto-match in this source.',
      })
    }

    const tabIds = tabsForAutoMatch.map(t => t.id)
    const { data: keyMappings, error: keyError } = await supabase
      .from('column_mappings')
      .select('tab_mapping_id, target_field, is_key')
      .in('tab_mapping_id', tabIds)
      .eq('is_key', true)

    if (keyError) {
      console.error('Failed to fetch key mappings for auto-match:', keyError)
      return ApiErrors.database(keyError.message)
    }

    const emailKeyTabIds = new Set(
      (keyMappings || [])
        .filter(m => (m.target_field || '').toLowerCase() === 'email')
        .map(m => m.tab_mapping_id)
    )

    const eligibleTabs = tabsForAutoMatch.filter(tab => emailKeyTabIds.has(tab.id))

    if (eligibleTabs.length === 0) {
      return apiSuccess({
        source_id: sourceId,
        tabs_considered: staffTabs.length,
        tabs_scoped: tabsForAutoMatch.length,
        tabs_with_email_key: 0,
        tabs_synced: 0,
        matched: 0,
        skipped: 0,
        message: 'No staff tabs are configured with email as the key field.',
      })
    }

    const engine = getSyncEngine()
    const tabResults: Array<{
      tab_mapping_id: string
      tab_name: string
      success: boolean
      rows_processed: number
      rows_matched: number
      rows_skipped: number
      error: string | null
    }> = []

    let matched = 0
    let skipped = 0
    let processed = 0
    let tabsSynced = 0
    let contractorsCreated = 0
    let contractorTabsSynced = 0
    let contractorRowsSkipped = 0

    for (const tab of eligibleTabs) {
      try {
        const result = await engine.syncTab(tab.id, accessToken, {
          dryRun: false,
          forceOverwrite: false,
          matchOnlyExisting: true,
          triggeredBy: auth.user.id,
        })

        processed += result.stats.rowsProcessed
        matched += result.stats.rowsUpdated
        skipped += result.stats.rowsSkipped
        if (result.success) {
          tabsSynced++
        }

        tabResults.push({
          tab_mapping_id: tab.id,
          tab_name: tab.tab_name,
          success: result.success,
          rows_processed: result.stats.rowsProcessed,
          rows_matched: result.stats.rowsUpdated,
          rows_skipped: result.stats.rowsSkipped,
          error: result.stats.errors.find(e => e.severity === 'error')?.message || null,
        })
      } catch (error) {
        tabResults.push({
          tab_mapping_id: tab.id,
          tab_name: tab.tab_name,
          success: false,
          rows_processed: 0,
          rows_matched: 0,
          rows_skipped: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    if (createUnmatchedContractors) {
      const contractorTabs = eligibleTabs.filter(tab => CONTRACTOR_TAB_PATTERN.test(tab.tab_name))

      for (const tab of contractorTabs) {
        try {
          const result = await engine.syncTab(tab.id, accessToken, {
            dryRun: false,
            forceOverwrite: false,
            matchOnlyExisting: false,
            createMissingAsContractor: true,
            triggeredBy: auth.user.id,
          })

          if (result.success) {
            contractorTabsSynced++
          }
          contractorsCreated += result.stats.rowsCreated
          contractorRowsSkipped += result.stats.rowsSkipped
        } catch (error) {
          console.error(`Contractor creation pass failed for tab ${tab.tab_name}:`, error)
        }
      }
    }

    return apiSuccess({
      source_id: sourceId,
      tabs_considered: staffTabs.length,
      tabs_scoped: tabsForAutoMatch.length,
      tabs_with_email_key: eligibleTabs.length,
      tabs_synced: tabsSynced,
      tabs_failed: eligibleTabs.length - tabsSynced,
      processed,
      matched,
      skipped,
      contractor_creation_enabled: createUnmatchedContractors,
      contractor_tabs_synced: contractorTabsSynced,
      contractors_created: contractorsCreated,
      contractor_rows_skipped: contractorRowsSkipped,
      message: createUnmatchedContractors
        ? 'Rows skipped include unmatched emails and rows with no authorized updates. Contractor tabs were also processed for unmatched contractor creates.'
        : 'Rows skipped include unmatched emails and rows with no authorized updates.',
      results: tabResults,
    })
  } catch (error) {
    console.error('Error in POST /api/sync/source/[id]/staff-auto-match:', error)
    return ApiErrors.internal()
  }
}
