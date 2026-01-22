import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  SaveMappingRequest,
  SaveMappingResponse,
  DEFAULT_WEEKLY_PATTERN,
} from '@/types/enrichment'

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const body: SaveMappingRequest = await request.json()
    const { dataSource, tabMapping, columnMappings, weeklyPattern, computedFields } = body

    // 1. Create or update data_source
    const { data: existingSource } = await supabase
      .from('data_sources')
      .select('id')
      .eq('spreadsheet_id', dataSource.spreadsheet_id)
      .single()

    let dataSourceId: string

    if (existingSource) {
      // Update existing
      const { data, error } = await supabase
        .from('data_sources')
        .update({
          name: dataSource.name,
          spreadsheet_url: dataSource.spreadsheet_url,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingSource.id)
        .select('id')
        .single()

      if (error) throw error
      dataSourceId = data.id
    } else {
      // Create new
      const { data, error } = await supabase
        .from('data_sources')
        .insert({
          name: dataSource.name,
          type: 'google_sheet',
          spreadsheet_id: dataSource.spreadsheet_id,
          spreadsheet_url: dataSource.spreadsheet_url,
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
        })
        .select('id')
        .single()

      if (error) throw error
      tabMappingId = data.id
    }

    // 3. Save column_mappings (for non-weekly and non-computed columns only)
    const regularMappings = columnMappings.filter(cm =>
      cm.category !== 'weekly' && cm.category !== 'computed'
    )

    if (regularMappings.length > 0) {
      // Insert column mappings and get back the IDs
      const { data: insertedMappings, error } = await supabase
        .from('column_mappings')
        .insert(
          regularMappings.map(cm => ({
            tab_mapping_id: tabMappingId,
            source_column: cm.source_column,
            source_column_index: cm.source_column_index,
            category: cm.category,
            target_field: cm.target_field,
            authority: cm.authority,
            is_key: cm.is_key,
          }))
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

    const response: SaveMappingResponse = {
      success: true,
      data_source_id: dataSourceId,
      tab_mapping_id: tabMappingId,
      column_mappings_count: regularMappings.length,
      patterns_count: patternsCount,
      computed_fields_count: computedFieldsCount,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error saving mapping:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
