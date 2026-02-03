import { NextRequest } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { requirePermission } from '@/lib/auth/api-auth'
import { apiSuccess, apiValidationError, ApiErrors } from '@/lib/api/response'
import { SaveMappingSchemaV2 } from '@/lib/validations/schemas'
import { DEFAULT_WEEKLY_PATTERN } from '@/types/enrichment'
import { getConnectorRegistry } from '@/lib/connectors'
import { audit } from '@/lib/audit'

// Use singleton Supabase client
const supabase = getAdminClient()

// POST - Save field mappings (admin only)
// Supports both legacy format { spreadsheet_id } and new format { type, connection_config }
export async function POST(request: NextRequest) {
  const auth = await requirePermission('data-enrichment:write')
  if (!auth.authenticated) return auth.response

  try {
    const body = await request.json()

    // Validate input with V2 schema (supports both formats)
    const validation = SaveMappingSchemaV2.safeParse(body)
    if (!validation.success) {
      return apiValidationError(validation.error)
    }

    const { dataSource, tabMapping, columnMappings, weeklyPattern, computedFields } = validation.data

    // Determine the connector type and config
    let connectorType: string
    let connectionConfigObj: Record<string, unknown>
    let legacySpreadsheetId: string | null = null
    let legacySpreadsheetUrl: string | null = null

    if (dataSource.connection_config) {
      // New format: use provided connection_config
      connectorType = dataSource.connection_config.type
      connectionConfigObj = dataSource.connection_config as Record<string, unknown>

      // Extract legacy fields for backward compatibility (dual-write)
      if (dataSource.connection_config.type === 'google_sheet') {
        legacySpreadsheetId = dataSource.connection_config.spreadsheet_id
        legacySpreadsheetUrl = dataSource.connection_config.spreadsheet_url ?? null
      }

      // Validate config using the connector registry
      if (getConnectorRegistry().has(connectorType as 'google_sheet')) {
        const connector = getConnectorRegistry().get(connectorType as 'google_sheet')
        const configValidation = connector.validateConfig(dataSource.connection_config)
        if (configValidation !== true) {
          throw new Error(configValidation)
        }
      }
    } else if (dataSource.spreadsheet_id) {
      // Legacy format: construct connection_config from spreadsheet_id
      connectorType = dataSource.type || 'google_sheet'
      legacySpreadsheetId = dataSource.spreadsheet_id
      legacySpreadsheetUrl = dataSource.spreadsheet_url ?? null
      connectionConfigObj = {
        type: 'google_sheet',
        spreadsheet_id: dataSource.spreadsheet_id,
        spreadsheet_url: dataSource.spreadsheet_url ?? null,
      }
    } else {
      throw new Error('Either spreadsheet_id or connection_config is required')
    }

    // 1. Create or update data_source
    // Look up by spreadsheet_id for backward compatibility
    const { data: existingSource } = legacySpreadsheetId
      ? await supabase
          .from('data_sources')
          .select('id')
          .eq('spreadsheet_id', legacySpreadsheetId)
          .single()
      : { data: null }

    let dataSourceId: string

    if (existingSource) {
      // Update existing
      const { data, error } = await supabase
        .from('data_sources')
        .update({
          name: dataSource.name,
          spreadsheet_url: legacySpreadsheetUrl,
          connection_config: connectionConfigObj,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingSource.id)
        .select('id')
        .single()

      if (error) throw error
      dataSourceId = data.id
    } else {
      // Create new with both legacy and new fields (dual-write)
      const { data, error } = await supabase
        .from('data_sources')
        .insert({
          name: dataSource.name,
          type: connectorType,
          // Legacy columns (for backward compatibility)
          spreadsheet_id: legacySpreadsheetId,
          spreadsheet_url: legacySpreadsheetUrl,
          // New connection_config column
          connection_config: connectionConfigObj,
        })
        .select('id')
        .single()

      if (error) throw error
      dataSourceId = data.id
    }

    // 2. Create or update tab_mapping
    const { data: existingTab } = await supabase
      .from('tab_mappings')
      .select('id')
      .eq('data_source_id', dataSourceId)
      .eq('tab_name', tabMapping.tab_name)
      .single()

    let tabMappingId: string

    if (existingTab) {
      // Update existing
      const { data, error } = await supabase
        .from('tab_mappings')
        .update({
          header_row: tabMapping.header_row,
          primary_entity: tabMapping.primary_entity,
          ...(tabMapping.total_columns != null && { total_columns: tabMapping.total_columns }),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingTab.id)
        .select('id')
        .single()

      if (error) throw error
      tabMappingId = data.id

      // Delete existing column mappings and patterns for this tab
      await supabase
        .from('column_mappings')
        .delete()
        .eq('tab_mapping_id', tabMappingId)

      await supabase
        .from('column_patterns')
        .delete()
        .eq('tab_mapping_id', tabMappingId)
    } else {
      // Create new
      const { data, error } = await supabase
        .from('tab_mappings')
        .insert({
          data_source_id: dataSourceId,
          tab_name: tabMapping.tab_name,
          header_row: tabMapping.header_row,
          primary_entity: tabMapping.primary_entity,
          ...(tabMapping.total_columns != null && { total_columns: tabMapping.total_columns }),
        })
        .select('id')
        .single()

      if (error) throw error
      tabMappingId = data.id
    }

    // 3. Save column_mappings (all classified columns, including weekly for accurate stats)
    // Weekly and computed columns are also saved separately (pattern/computed_fields) for sync processing
    const regularMappings = columnMappings.filter(cm =>
      cm.category !== 'computed'
    )

    // Auto-detect transforms for fields that need special handling
    // This ensures proper value conversion even if the UI doesn't set transforms explicitly
    const getAutoTransform = (targetField: string | null): { type: string; config: Record<string, unknown> | null } => {
      if (!targetField) return { type: 'none', config: null }

      // Status field needs value_mapping to normalize values
      // Valid partners.status values: 'onboarding', 'active', 'paused', 'at_risk', 'offboarding', 'churned'
      if (targetField === 'status') {
        return {
          type: 'value_mapping',
          config: {
            mappings: {
              'Active': 'active',
              'Paused': 'paused',
              'Discontinued': 'churned',
              'Churned': 'churned',
              'Onboarding': 'onboarding',
              'At Risk': 'at_risk',
              'Offboarding': 'offboarding',
              'active': 'active',
              'paused': 'paused',
              'churned': 'churned',
              'onboarding': 'onboarding',
              'at_risk': 'at_risk',
              'offboarding': 'offboarding',
            },
            default: 'active'
          }
        }
      }

      // Tier field needs value_mapping to normalize
      if (targetField === 'tier') {
        return {
          type: 'value_mapping',
          config: {
            mappings: {
              'Tier 1': 'tier_1',
              'Tier 2': 'tier_2',
              'Tier 3': 'tier_3',
              'tier_1': 'tier_1',
              'tier_2': 'tier_2',
              'tier_3': 'tier_3',
              '1': 'tier_1',
              '2': 'tier_2',
              '3': 'tier_3',
            },
            default: 'tier_2'
          }
        }
      }

      return { type: 'none', config: null }
    }

    if (regularMappings.length > 0) {
      // Insert column mappings and get back the IDs
      const { data: insertedMappings, error } = await supabase
        .from('column_mappings')
        .insert(
          regularMappings.map(cm => {
            // Use explicit transform if provided, otherwise auto-detect
            const hasExplicitTransform = cm.transform_type && cm.transform_type !== 'none'
            const autoTransform = getAutoTransform(cm.target_field)

            return {
              tab_mapping_id: tabMappingId,
              source_column: cm.source_column,
              source_column_index: cm.source_column_index,
              category: cm.category,
              target_field: cm.target_field,
              authority: cm.authority,
              is_key: cm.is_key,
              transform_type: hasExplicitTransform ? cm.transform_type : autoTransform.type,
              transform_config: hasExplicitTransform ? cm.transform_config : autoTransform.config,
            }
          })
        )
        .select('id, source_column_index')

      if (error) throw error

      // 3b. Save column_mapping_tags for each mapping with tags
      if (insertedMappings) {
        const tagInserts: Array<{ column_mapping_id: string; tag_id: string }> = []

        for (const mapping of insertedMappings) {
          // Find the original mapping with tag_ids
          const originalMapping = regularMappings.find(
            cm => cm.source_column_index === mapping.source_column_index
          )
          if (originalMapping?.tag_ids?.length) {
            for (const tagId of originalMapping.tag_ids) {
              tagInserts.push({
                column_mapping_id: mapping.id,
                tag_id: tagId,
              })
            }
          }
        }

        if (tagInserts.length > 0) {
          const { error: tagError } = await supabase
            .from('column_mapping_tags')
            .insert(tagInserts)

          if (tagError) {
            console.error('Error saving column mapping tags:', tagError)
            // Don't fail the whole save for tags
          }
        }
      }
    }

    // 4. Save weekly pattern (instead of individual weekly column mappings)
    const hasWeeklyColumns = columnMappings.some(cm => cm.category === 'weekly')

    if (hasWeeklyColumns) {
      const patternConfig = weeklyPattern?.match_config || DEFAULT_WEEKLY_PATTERN
      const patternName = weeklyPattern?.pattern_name || 'Weekly Status Columns'

      const { error } = await supabase
        .from('column_patterns')
        .insert({
          tab_mapping_id: tabMappingId,
          pattern_name: patternName,
          category: 'weekly',
          match_config: patternConfig,
          target_table: 'weekly_statuses',
        })

      if (error) throw error
    }

    // 5. Save computed fields
    let computedFieldsCount = 0

    if (computedFields && computedFields.length > 0) {
      for (const cf of computedFields) {
        // Upsert computed field (unique on target_table + target_field)
        const { error } = await supabase
          .from('computed_fields')
          .upsert({
            target_table: cf.target_table,
            target_field: cf.target_field,
            display_name: cf.display_name,
            computation_type: cf.computation_type,
            config: cf.config,
            discovered_in_source_id: dataSourceId,
            discovered_in_tab: tabMapping.tab_name,
            discovered_in_column: cf.source_column,
            description: cf.description || null,
            is_implemented: false,
          }, {
            onConflict: 'target_table,target_field',
          })

        if (error) {
          console.error('Error saving computed field:', error)
        } else {
          computedFieldsCount++
        }
      }
    }

    // Count what was saved
    const patternsCount = hasWeeklyColumns ? 1 : 0

    // Audit log the mapping save
    await audit.logMappingSave(
      tabMappingId,
      `${dataSource.name} → ${tabMapping.tab_name}`,
      auth.user?.id,
      auth.user?.email || undefined,
      {
        column_mappings_count: regularMappings.length,
        patterns_count: patternsCount,
        computed_fields_count: computedFieldsCount,
      }
    )

    return apiSuccess({
      data_source_id: dataSourceId,
      tab_mapping_id: tabMappingId,
      column_mappings_count: regularMappings.length,
      patterns_count: patternsCount,
      computed_fields_count: computedFieldsCount,
    })
  } catch (error) {
    console.error('Error saving mapping:', error)
    return ApiErrors.database(error instanceof Error ? error.message : 'Failed to save mapping')
  }
}
