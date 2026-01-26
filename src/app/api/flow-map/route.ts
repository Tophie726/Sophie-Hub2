import { getAdminClient } from '@/lib/supabase/admin'
import { requirePermission } from '@/lib/auth/api-auth'
import { apiSuccess, ApiErrors } from '@/lib/api/response'
import { getFieldsForEntity, getReferenceFields } from '@/lib/entity-fields'
import type { EntityType } from '@/types/entities'
import type { FieldGroup } from '@/lib/entity-fields/types'

const supabase = getAdminClient()

const ALL_ENTITIES: EntityType[] = ['partners', 'staff', 'asins']

/**
 * GET /api/flow-map
 *
 * Aggregated endpoint for the Data Flow Map visualization.
 * Uses the same 3-query optimization pattern as /api/data-sources:
 * 1. Query data_sources with joined tab_mappings
 * 2. Query column_mappings for those tabs
 * 3. Merge with entity field registry in-memory
 */
export async function GET() {
  const auth = await requirePermission('data-enrichment:read')
  if (!auth.authenticated) return auth.response

  try {
    // Query 1: Fetch all data sources
    const { data: sources, error: sourcesError } = await supabase
      .from('data_sources')
      .select('id, name, type')
      .eq('status', 'active')
      .order('created_at', { ascending: true })

    if (sourcesError) throw sourcesError

    if (!sources || sources.length === 0) {
      return apiSuccess(buildEmptyResponse())
    }

    const sourceIds = sources.map((s) => s.id)

    // Query 2: Fetch all tab mappings for those sources
    const { data: allTabs, error: tabsError } = await supabase
      .from('tab_mappings')
      .select('id, data_source_id, tab_name, primary_entity, status')
      .in('data_source_id', sourceIds)

    if (tabsError) throw tabsError

    const tabIds = (allTabs || []).map((t) => t.id)

    // Query 3: Fetch all column mappings for those tabs
    const { data: allColumns, error: columnsError } =
      tabIds.length > 0
        ? await supabase
            .from('column_mappings')
            .select('tab_mapping_id, source_column, category, target_field, authority, is_key')
            .in('tab_mapping_id', tabIds)
        : { data: [], error: null }

    if (columnsError) throw columnsError

    // Build lookup maps
    const tabsBySource = new Map<string, typeof allTabs>()
    for (const tab of allTabs || []) {
      const existing = tabsBySource.get(tab.data_source_id) || []
      existing.push(tab)
      tabsBySource.set(tab.data_source_id, existing)
    }

    const columnsByTab = new Map<string, (typeof allColumns)>()
    for (const col of allColumns || []) {
      const existing = columnsByTab.get(col.tab_mapping_id) || []
      existing.push(col)
      columnsByTab.set(col.tab_mapping_id, existing)
    }

    // Build entity data from field registry + column mappings
    const mappedFieldsByEntity = new Map<EntityType, Set<string>>()
    const fieldSourceMap = new Map<string, Array<{
      sourceId: string
      sourceName: string
      tabName: string
      sourceColumn: string
      authority: string
    }>>()

    // Track which sources connect to which entities
    const sourceEntityConnections = new Map<string, Set<EntityType>>()

    for (const source of sources) {
      const tabs = tabsBySource.get(source.id) || []
      sourceEntityConnections.set(source.id, new Set())

      for (const tab of tabs) {
        const columns = columnsByTab.get(tab.id) || []
        const entityFromTab = tab.primary_entity as EntityType | null

        for (const col of columns) {
          if (!col.target_field || col.category === 'skip' || col.category === 'weekly' || col.category === 'computed') continue

          // Determine which entity this column maps to
          let targetEntity: EntityType | null = null
          if (col.category === 'partner') targetEntity = 'partners'
          else if (col.category === 'staff') targetEntity = 'staff'
          else if (col.category === 'asin') targetEntity = 'asins'
          else if (entityFromTab) targetEntity = entityFromTab

          if (!targetEntity) continue

          // Track mapped fields per entity
          if (!mappedFieldsByEntity.has(targetEntity)) {
            mappedFieldsByEntity.set(targetEntity, new Set())
          }
          mappedFieldsByEntity.get(targetEntity)!.add(col.target_field)

          // Track source connections
          sourceEntityConnections.get(source.id)!.add(targetEntity)

          // Track field source info
          const fieldKey = `${targetEntity}:${col.target_field}`
          if (!fieldSourceMap.has(fieldKey)) {
            fieldSourceMap.set(fieldKey, [])
          }
          fieldSourceMap.get(fieldKey)!.push({
            sourceId: source.id,
            sourceName: source.name,
            tabName: tab.tab_name,
            sourceColumn: col.source_column,
            authority: col.authority,
          })
        }
      }
    }

    // Build entities response with field registry data
    const entities = ALL_ENTITIES.map((entityType) => {
      const fields = getFieldsForEntity(entityType)
      const mappedFields = mappedFieldsByEntity.get(entityType) || new Set<string>()

      // Group fields
      const groupMap = new Map<FieldGroup, {
        fields: Array<{
          name: string
          label: string
          type: string
          isMapped: boolean
          isKey: boolean
          reference?: {
            entity: string
            matchField: string
            storage: string
            junctionTable?: string
            junctionRole?: string
          }
          sources: Array<{
            sourceId: string
            sourceName: string
            tabName: string
            sourceColumn: string
            authority: string
          }>
        }>
      }>()

      for (const field of fields) {
        if (!groupMap.has(field.group)) {
          groupMap.set(field.group, { fields: [] })
        }

        const fieldKey = `${entityType}:${field.name}`
        const fieldSources = fieldSourceMap.get(fieldKey) || []

        groupMap.get(field.group)!.fields.push({
          name: field.name,
          label: field.label,
          type: field.type,
          isMapped: mappedFields.has(field.name),
          isKey: field.isKey || false,
          reference: field.reference
            ? {
                entity: field.reference.entity,
                matchField: field.reference.matchField,
                storage: field.reference.storage,
                junctionTable: field.reference.junctionTable,
                junctionRole: field.reference.junctionRole,
              }
            : undefined,
          sources: fieldSources,
        })
      }

      const groups = Array.from(groupMap.entries()).map(([name, data]) => ({
        name,
        fields: data.fields,
      }))

      return {
        type: entityType,
        fieldCount: fields.length,
        mappedFieldCount: mappedFields.size,
        groups,
      }
    })

    // Build sources response
    const sourcesResponse = sources.map((source) => {
      const tabs = tabsBySource.get(source.id) || []

      return {
        id: source.id,
        name: source.name,
        type: source.type,
        tabs: tabs.map((tab) => {
          const columns = columnsByTab.get(tab.id) || []
          const mappedCount = columns.filter(
            (c) => c.target_field && c.category !== 'skip'
          ).length

          return {
            id: tab.id,
            tabName: tab.tab_name,
            primaryEntity: tab.primary_entity,
            columnCount: columns.length,
            mappedCount,
          }
        }),
      }
    })

    // Build relationships from reference fields
    const relationships: Array<{
      from: { entity: string; field: string }
      to: { entity: string; field: string }
      type: 'reference' | 'junction'
      junctionTable?: string
      junctionRole?: string
    }> = []

    for (const entityType of ALL_ENTITIES) {
      const refFields = getReferenceFields(entityType)
      for (const field of refFields) {
        if (!field.reference) continue
        relationships.push({
          from: { entity: entityType, field: field.name },
          to: { entity: field.reference.entity, field: field.reference.matchField },
          type: field.reference.storage === 'junction' ? 'junction' : 'reference',
          junctionTable: field.reference.junctionTable,
          junctionRole: field.reference.junctionRole,
        })
      }
    }

    // Build stats
    let totalMapped = 0
    let totalFields = 0
    for (const entity of entities) {
      totalFields += entity.fieldCount
      totalMapped += entity.mappedFieldCount
    }

    const totalTabs = (allTabs || []).length

    return apiSuccess({
      entities,
      sources: sourcesResponse,
      relationships,
      stats: {
        totalFields,
        mappedFields: totalMapped,
        totalSources: sources.length,
        totalTabs,
      },
    })
  } catch (error) {
    console.error('Error in GET /api/flow-map:', error)
    return ApiErrors.database(error instanceof Error ? error.message : 'Database error')
  }
}

function buildEmptyResponse() {
  const entities = ALL_ENTITIES.map((entityType) => {
    const fields = getFieldsForEntity(entityType)
    const groupMap = new Map<FieldGroup, Array<{
      name: string
      label: string
      type: string
      isMapped: boolean
      isKey: boolean
      reference?: {
        entity: string
        matchField: string
        storage: string
        junctionTable?: string
        junctionRole?: string
      }
      sources: never[]
    }>>()

    for (const field of fields) {
      if (!groupMap.has(field.group)) {
        groupMap.set(field.group, [])
      }
      groupMap.get(field.group)!.push({
        name: field.name,
        label: field.label,
        type: field.type,
        isMapped: false,
        isKey: field.isKey || false,
        reference: field.reference
          ? {
              entity: field.reference.entity,
              matchField: field.reference.matchField,
              storage: field.reference.storage,
              junctionTable: field.reference.junctionTable,
              junctionRole: field.reference.junctionRole,
            }
          : undefined,
        sources: [],
      })
    }

    const groups = Array.from(groupMap.entries()).map(([name, fieldList]) => ({
      name,
      fields: fieldList,
    }))

    return {
      type: entityType,
      fieldCount: fields.length,
      mappedFieldCount: 0,
      groups,
    }
  })

  // Build relationships from field registry
  const relationships: Array<{
    from: { entity: string; field: string }
    to: { entity: string; field: string }
    type: 'reference' | 'junction'
    junctionTable?: string
    junctionRole?: string
  }> = []

  for (const entityType of ALL_ENTITIES) {
    const refFields = getReferenceFields(entityType)
    for (const field of refFields) {
      if (!field.reference) continue
      relationships.push({
        from: { entity: entityType, field: field.name },
        to: { entity: field.reference.entity, field: field.reference.matchField },
        type: field.reference.storage === 'junction' ? 'junction' : 'reference',
        junctionTable: field.reference.junctionTable,
        junctionRole: field.reference.junctionRole,
      })
    }
  }

  let totalFields = 0
  for (const e of entities) totalFields += e.fieldCount

  return {
    entities,
    sources: [],
    relationships,
    stats: {
      totalFields,
      mappedFields: 0,
      totalSources: 0,
      totalTabs: 0,
    },
  }
}
