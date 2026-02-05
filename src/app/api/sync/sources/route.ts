import { getAdminClient } from '@/lib/supabase/admin'
import { requirePermission } from '@/lib/auth/api-auth'
import { apiSuccess, ApiErrors } from '@/lib/api/response'

const supabase = getAdminClient()

/** Individual source feeding an entity */
export interface EntitySource {
  tabMappingId: string
  sourceName: string
  tabName: string
  fieldCount: number
  lastSyncedAt: string | null
  lastSyncStatus: 'completed' | 'failed' | 'running' | null
}

/** Entity-centric sync data */
export interface SyncableEntity {
  entity: string // 'partners' | 'staff' | 'asins'
  label: string // "Partners", "Staff", "ASINs"
  tabMappingIds: string[] // All tab IDs to sync for this entity
  sourceCount: number // How many different sources feed this entity
  fieldCount: number // Total mapped fields across all sources
  lastSyncedAt: string | null // Most recent sync across all tabs
  hasFailedSync: boolean // Any recent failed syncs
  sources: EntitySource[] // Expandable detail - which tabs/sources contribute
}

const ENTITY_LABELS: Record<string, string> = {
  partners: 'Partners',
  staff: 'Staff',
  asins: 'ASINs',
}

/**
 * GET /api/sync/sources
 *
 * Returns syncable data grouped by ENTITY (partners, staff, asins).
 * Entity-first approach: users sync "Partner data", not "Master Client Sheet".
 */
export async function GET() {
  const auth = await requirePermission('data-enrichment:read')
  if (!auth.authenticated) return auth.response

  try {
    // Get all ACTIVE tab mappings with a primary entity assigned
    const { data: tabMappings, error: tabError } = await supabase
      .from('tab_mappings')
      .select(`
        id,
        tab_name,
        primary_entity,
        data_source:data_sources (
          id,
          name
        )
      `)
      .not('primary_entity', 'is', null)
      .eq('is_active', true)

    if (tabError) {
      console.error('Error fetching tab mappings:', tabError)
      return ApiErrors.database(tabError.message)
    }

    if (!tabMappings || tabMappings.length === 0) {
      return apiSuccess({ entities: [] })
    }

    const tabIds = tabMappings.map(t => t.id)

    // Get key columns (required for syncing)
    const { data: keyColumns, error: keyError } = await supabase
      .from('column_mappings')
      .select('tab_mapping_id')
      .in('tab_mapping_id', tabIds)
      .eq('is_key', true)

    if (keyError) {
      console.error('Error fetching key columns:', keyError)
      return ApiErrors.database(keyError.message)
    }

    const tabsWithKey = new Set((keyColumns || []).map(k => k.tab_mapping_id))

    // Filter to only tabs that can actually sync (have key column)
    const syncableTabs = tabMappings.filter(t => tabsWithKey.has(t.id))

    if (syncableTabs.length === 0) {
      return apiSuccess({ entities: [] })
    }

    // Get field counts per tab
    const syncableIds = syncableTabs.map(t => t.id)
    const { data: fieldCounts, error: fieldError } = await supabase
      .from('column_mappings')
      .select('tab_mapping_id, target_field')
      .in('tab_mapping_id', syncableIds)
      .not('target_field', 'is', null)

    if (fieldError) {
      console.error('Error fetching field counts:', fieldError)
    }

    // Build field count map
    const fieldCountByTab = new Map<string, number>()
    for (const field of fieldCounts || []) {
      const count = fieldCountByTab.get(field.tab_mapping_id) || 0
      fieldCountByTab.set(field.tab_mapping_id, count + 1)
    }

    // Get last sync run for each tab
    const { data: lastRuns, error: runsError } = await supabase
      .from('sync_runs')
      .select('tab_mapping_id, status, started_at, rows_processed')
      .in('tab_mapping_id', syncableIds)
      .order('started_at', { ascending: false })

    if (runsError) {
      console.error('Error fetching sync runs:', runsError)
    }

    // Build last sync map (most recent per tab)
    const lastSyncByTab = new Map<string, {
      status: string
      started_at: string
      rows_processed: number
    }>()

    for (const run of lastRuns || []) {
      if (!lastSyncByTab.has(run.tab_mapping_id)) {
        lastSyncByTab.set(run.tab_mapping_id, {
          status: run.status,
          started_at: run.started_at,
          rows_processed: run.rows_processed,
        })
      }
    }

    // Define tab type for clarity
    type TabMapping = {
      id: string
      tab_name: string
      primary_entity: string
      data_source: unknown
    }

    // Group tabs by entity
    const tabsByEntity = new Map<string, TabMapping[]>()
    for (const tab of syncableTabs) {
      const entity = tab.primary_entity
      const existing = tabsByEntity.get(entity) || []
      existing.push(tab as TabMapping)
      tabsByEntity.set(entity, existing)
    }

    // Build entity-centric response
    const entities: SyncableEntity[] = []

    for (const [entity, tabs] of Array.from(tabsByEntity.entries())) {
      const sources: EntitySource[] = tabs.map((tab: TabMapping) => {
        const dataSource = tab.data_source as unknown as { id: string; name: string } | null
        const lastSync = lastSyncByTab.get(tab.id)

        return {
          tabMappingId: tab.id,
          sourceName: dataSource?.name || 'Unknown',
          tabName: tab.tab_name,
          fieldCount: fieldCountByTab.get(tab.id) || 0,
          lastSyncedAt: lastSync?.started_at || null,
          lastSyncStatus: lastSync?.status as 'completed' | 'failed' | 'running' | null,
        }
      })

      // Sort sources by name
      sources.sort((a, b) => a.sourceName.localeCompare(b.sourceName))

      // Calculate aggregate stats
      const tabMappingIds = tabs.map(t => t.id)
      const totalFields = sources.reduce((sum, s) => sum + s.fieldCount, 0)
      const uniqueSources = new Set(sources.map(s => s.sourceName)).size

      // Find most recent sync across all tabs for this entity
      const syncDates = sources
        .map(s => s.lastSyncedAt)
        .filter((d): d is string => d !== null)
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())

      const hasFailedSync = sources.some(s => s.lastSyncStatus === 'failed')

      entities.push({
        entity,
        label: ENTITY_LABELS[entity] || entity,
        tabMappingIds,
        sourceCount: uniqueSources,
        fieldCount: totalFields,
        lastSyncedAt: syncDates[0] || null,
        hasFailedSync,
        sources,
      })
    }

    // Sort entities: partners first, then staff, then asins
    const entityOrder = ['partners', 'staff', 'asins']
    entities.sort((a, b) => {
      const aIndex = entityOrder.indexOf(a.entity)
      const bIndex = entityOrder.indexOf(b.entity)
      return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex)
    })

    return apiSuccess({ entities })
  } catch (error) {
    console.error('Error in GET /api/sync/sources:', error)
    return ApiErrors.internal()
  }
}
