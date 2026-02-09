import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { requireAuth, canAccessPartner } from '@/lib/auth/api-auth'
import { apiSuccess, ApiErrors } from '@/lib/api/response'
import { getAdminClient } from '@/lib/supabase/admin'
import { getConnector, hasConnector, type GoogleSheetConnectorConfig, type ConnectorTypeId } from '@/lib/connectors'
import { buildPartnerTypePersistenceFields } from '@/lib/partners/computed-partner-type'
import { applyTransform } from '@/lib/sync/transforms'
import type { TransformType } from '@/lib/sync/types'

const supabase = getAdminClient()

interface SyncSourceResult {
  sourceName: string
  sourceType: string
  tabName: string
  success: boolean
  fieldsUpdated: string[]
  error?: string
}

function asNullableString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

/**
 * POST /api/partners/[id]/sync
 *
 * Sync a single partner's data from ALL configured data sources.
 * This is a universal sync that pulls from any connected source
 * (Google Sheets, forms, APIs, etc.) where the partner entity is mapped.
 *
 * For each configured source:
 * 1. Fetches the source data using the appropriate connector
 * 2. Finds the row/record for this partner
 * 3. Updates the partner's source_data and mapped fields
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth()
  if (!auth.authenticated) return auth.response

  // Get session for access token (needed for OAuth-based connectors)
  const session = await getServerSession(authOptions)
  if (!session?.accessToken) {
    return ApiErrors.unauthorized('No access token available. Please re-authenticate.')
  }

  try {
    const { id } = await params

    // Verify the user has access to this specific partner
    const hasAccess = await canAccessPartner(auth.user.id, auth.user.role, id)
    if (!hasAccess) {
      return ApiErrors.forbidden('You do not have access to this partner')
    }

    // 1. Get the partner with current source_data
    const { data: partner, error: partnerError } = await supabase
      .from('partners')
      .select('id, brand_name, partner_code, source_data, pod_leader_name, brand_manager_name')
      .eq('id', id)
      .single()

    if (partnerError || !partner) {
      return ApiErrors.notFound('Partner')
    }

    // 2. Find ALL active tab_mappings for partners entity
    const { data: tabMappings, error: tabError } = await supabase
      .from('tab_mappings')
      .select(`
        id,
        tab_name,
        header_row,
        primary_entity,
        data_sources (
          id,
          name,
          type,
          connection_config
        )
      `)
      .eq('primary_entity', 'partners')
      .eq('status', 'active')

    if (tabError) {
      console.error('Error fetching tab mappings:', tabError)
      return ApiErrors.database()
    }

    if (!tabMappings || tabMappings.length === 0) {
      return ApiErrors.notFound('No active partner data sources found. Please configure Data Enrichment first.')
    }

    // 3. Sync from each data source
    const syncResults: SyncSourceResult[] = []
    const mergedSourceData: Record<string, Record<string, Record<string, string>>> =
      (partner.source_data as Record<string, Record<string, Record<string, string>>>) || {}
    const mergedFields: Record<string, unknown> = {}

    for (const tabMapping of tabMappings) {
      const dataSource = tabMapping.data_sources as unknown as {
        id: string
        name: string
        type: string
        connection_config: Record<string, unknown>
      }

      // Check if we have a connector for this source type
      const connectorType = (dataSource.type === 'google_sheet' ? 'google_sheet' : dataSource.type) as ConnectorTypeId
      if (!hasConnector(connectorType)) {
        syncResults.push({
          sourceName: dataSource.name,
          sourceType: dataSource.type,
          tabName: tabMapping.tab_name,
          success: false,
          fieldsUpdated: [],
          error: `No connector available for source type: ${dataSource.type}`,
        })
        continue
      }

      try {
        // Load column mappings for this tab
        const { data: columnMappings } = await supabase
          .from('column_mappings')
          .select('*')
          .eq('tab_mapping_id', tabMapping.id)

        if (!columnMappings || columnMappings.length === 0) {
          syncResults.push({
            sourceName: dataSource.name,
            sourceType: dataSource.type,
            tabName: tabMapping.tab_name,
            success: false,
            fieldsUpdated: [],
            error: 'No column mappings found',
          })
          continue
        }

        // Find the key mapping
        const keyMapping = columnMappings.find(m => m.is_key)
        if (!keyMapping || !keyMapping.target_field) {
          syncResults.push({
            sourceName: dataSource.name,
            sourceType: dataSource.type,
            tabName: tabMapping.tab_name,
            success: false,
            fieldsUpdated: [],
            error: 'No key column defined',
          })
          continue
        }

        // Get the key value from the partner
        const keyValue = partner[keyMapping.target_field as keyof typeof partner] as string | null
        if (!keyValue) {
          syncResults.push({
            sourceName: dataSource.name,
            sourceType: dataSource.type,
            tabName: tabMapping.tab_name,
            success: false,
            fieldsUpdated: [],
            error: `Partner has no value for key field '${keyMapping.target_field}'`,
          })
          continue
        }

        // Fetch source data using the appropriate connector
        const connector = getConnector<GoogleSheetConnectorConfig>(connectorType)
        const sourceData = await connector.getData(
          session.accessToken,
          dataSource.connection_config as unknown as GoogleSheetConnectorConfig,
          tabMapping.tab_name,
          tabMapping.header_row
        )

        // Find key column index
        const keyColumnIndex = sourceData.headers.findIndex(
          h => h === keyMapping.source_column
        )
        if (keyColumnIndex === -1) {
          syncResults.push({
            sourceName: dataSource.name,
            sourceType: dataSource.type,
            tabName: tabMapping.tab_name,
            success: false,
            fieldsUpdated: [],
            error: `Key column '${keyMapping.source_column}' not found in source`,
          })
          continue
        }

        // Find the row for this partner
        const matchingRowIndex = sourceData.rows.findIndex(row => {
          const cellValue = row[keyColumnIndex]?.trim()
          return cellValue?.toLowerCase() === keyValue.toLowerCase()
        })

        if (matchingRowIndex === -1) {
          syncResults.push({
            sourceName: dataSource.name,
            sourceType: dataSource.type,
            tabName: tabMapping.tab_name,
            success: false,
            fieldsUpdated: [],
            error: `Partner "${keyValue}" not found in this source`,
          })
          continue
        }

        const row = sourceData.rows[matchingRowIndex]

        // Build source_data for this tab (raw capture)
        const tabData: Record<string, string> = {}
        for (let i = 0; i < sourceData.headers.length; i++) {
          const header = sourceData.headers[i]
          if (!header) continue
          tabData[header] = row[i] ?? ''
        }

        // Merge into source_data structure
        // Connector type key (e.g., 'gsheets', 'close', 'forms')
        const connectorKey = dataSource.type === 'google_sheet' ? 'gsheets' : dataSource.type
        if (!mergedSourceData[connectorKey]) {
          mergedSourceData[connectorKey] = {}
        }
        mergedSourceData[connectorKey][tabMapping.tab_name] = tabData

        // Build mapped fields with transforms
        const fieldsFromThisSource: string[] = []

        for (const mapping of columnMappings) {
          if (!mapping.target_field) continue
          if (mapping.is_key) continue
          if (mapping.category === 'weekly' || mapping.category === 'computed' || mapping.category === 'skip') continue

          const colIndex = sourceData.headers.findIndex(h => h === mapping.source_column)
          if (colIndex === -1) continue

          const rawValue = row[colIndex] || ''

          try {
            const transformedValue = applyTransform(
              rawValue,
              mapping.transform_type as TransformType | null,
              mapping.transform_config || undefined
            )

            if (transformedValue !== null && transformedValue !== undefined) {
              mergedFields[mapping.target_field] = transformedValue
              fieldsFromThisSource.push(mapping.target_field)
            }
          } catch (error) {
            console.error(`Transform failed for ${mapping.source_column}:`, error)
          }
        }

        syncResults.push({
          sourceName: dataSource.name,
          sourceType: dataSource.type,
          tabName: tabMapping.tab_name,
          success: true,
          fieldsUpdated: fieldsFromThisSource,
        })

      } catch (error) {
        console.error(`Error syncing from ${dataSource.name}:`, error)
        syncResults.push({
          sourceName: dataSource.name,
          sourceType: dataSource.type,
          tabName: tabMapping.tab_name,
          success: false,
          fieldsUpdated: [],
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    // 4. Update the partner record with merged data
    const successfulSyncs = syncResults.filter(r => r.success)

    if (successfulSyncs.length === 0) {
      return apiSuccess({
        synced: false,
        message: 'No data sources could be synced',
        sources: syncResults,
      })
    }

    const computedPartnerTypeFields = buildPartnerTypePersistenceFields({
      sourceData: mergedSourceData,
      podLeaderName: asNullableString(mergedFields.pod_leader_name ?? partner.pod_leader_name),
      brandManagerName: asNullableString(mergedFields.brand_manager_name ?? partner.brand_manager_name),
    })

    const { error: updateError } = await supabase
      .from('partners')
      .update({
        ...mergedFields,
        source_data: mergedSourceData,
        ...computedPartnerTypeFields,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (updateError) {
      console.error('Error updating partner:', updateError)
      return ApiErrors.database()
    }

    const totalFieldsUpdated = Array.from(new Set(syncResults.flatMap(r => r.fieldsUpdated)))

    return apiSuccess({
      synced: true,
      message: `Partner "${partner.brand_name}" synced from ${successfulSyncs.length} source(s)`,
      fieldsUpdated: totalFieldsUpdated,
      sources: syncResults,
    })

  } catch (error) {
    console.error('Error in POST /api/partners/[id]/sync:', error)

    if (error instanceof Error) {
      if (error.message.includes('invalid_grant') || error.message.includes('Token has been expired')) {
        return ApiErrors.unauthorized('Google token expired. Please refresh the page and try again.')
      }
    }

    return ApiErrors.internal()
  }
}
