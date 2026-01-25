/**
 * AI Mapping Assistant SDK
 *
 * Claude-powered intelligent column mapping for SmartMapper.
 * Uses tool-use for structured suggestions with confidence scores.
 */

import Anthropic from '@anthropic-ai/sdk'
import { getAdminClient } from '@/lib/supabase/admin'
import { getAnthropicApiKey } from '@/lib/settings'

// =============================================================================
// Types
// =============================================================================

export type MappingCategory =
  | 'partner'
  | 'staff'
  | 'asin'
  | 'weekly'
  | 'computed'
  | 'skip'

export type MappingAuthority = 'source_of_truth' | 'reference'

export interface ColumnSuggestion {
  category: MappingCategory
  targetField: string | null
  confidence: number
  reasoning: string
  isKey: boolean
  authority: MappingAuthority
}

export interface ColumnInput {
  name: string
  sampleValues: string[]
  position: number
}

export interface MappingContext {
  tabName?: string
  sourceName?: string
  primaryEntity?: 'partner' | 'staff' | 'asin' | null
}

export interface ExistingMapping {
  sourceColumn: string
  targetEntity: string
  targetField: string
  authority: MappingAuthority
}

export interface EntitySchema {
  partners: string[]
  staff: string[]
  asins: string[]
}

// =============================================================================
// Tool Definition
// =============================================================================

const COLUMN_MAPPING_TOOL: Anthropic.Tool = {
  name: 'suggest_column_mapping',
  description: 'Suggest how a source column maps to Sophie Hub entities',
  input_schema: {
    type: 'object' as const,
    properties: {
      category: {
        type: 'string',
        enum: ['partner', 'staff', 'asin', 'weekly', 'computed', 'skip'],
        description: 'The entity category this column belongs to',
      },
      target_field: {
        type: 'string',
        description:
          'The specific field in the target entity (e.g., "brand_name"). Null if skip/weekly/computed.',
      },
      confidence: {
        type: 'number',
        minimum: 0,
        maximum: 1,
        description: 'Confidence score for this suggestion (0-1)',
      },
      reasoning: {
        type: 'string',
        description: 'Brief explanation of why this mapping was suggested',
      },
      is_key: {
        type: 'boolean',
        description: 'Whether this column is likely a key/identifier field',
      },
      authority: {
        type: 'string',
        enum: ['source_of_truth', 'reference'],
        description: 'Suggested authority level based on context',
      },
    },
    required: ['category', 'confidence', 'reasoning', 'is_key', 'authority'],
  },
}

// =============================================================================
// Entity Schema (hardcoded for now, could be dynamic later)
// =============================================================================

const ENTITY_SCHEMA: EntitySchema = {
  partners: [
    'brand_name',
    'client_name',
    'client_email',
    'client_phone',
    'status',
    'tier',
    'base_fee',
    'commission_rate',
    'billing_day',
    'onboarding_date',
    'contract_start_date',
    'contract_end_date',
    'parent_asin_count',
    'child_asin_count',
    'notes',
  ],
  staff: [
    'full_name',
    'email',
    'phone',
    'slack_id',
    'role',
    'department',
    'title',
    'status',
    'max_clients',
    'current_client_count',
    'services',
    'hire_date',
    'dashboard_url',
    'calendly_url',
  ],
  asins: [
    'asin_code',
    'parent_asin',
    'is_parent',
    'title',
    'sku',
    'category',
    'status',
    'cogs',
    'price',
  ],
}

// =============================================================================
// SDK Class
// =============================================================================

export class MappingAssistantSDK {
  private anthropic: Anthropic | null = null
  private existingMappings: ExistingMapping[] = []
  private initialized = false

  /**
   * Initialize the SDK (lazy - only when needed)
   * Loads API key from database (with env fallback)
   */
  private async ensureInitialized(): Promise<void> {
    if (this.anthropic) return

    const apiKey = await getAnthropicApiKey()
    this.anthropic = new Anthropic({ apiKey })
  }

  /**
   * Load existing mappings for context (improves suggestions)
   */
  async loadExistingMappings(): Promise<void> {
    if (this.initialized) return

    const supabase = getAdminClient()

    const { data: mappings } = await supabase
      .from('column_mappings')
      .select(`
        source_column,
        category,
        target_field,
        authority,
        tab_mappings (
          primary_entity
        )
      `)
      .not('target_field', 'is', null)
      .limit(100)

    if (mappings) {
      this.existingMappings = mappings
        .filter((m) => m.tab_mappings)
        .map((m) => {
          // Supabase returns joined records as arrays, get first item
          const tabMapping = Array.isArray(m.tab_mappings)
            ? m.tab_mappings[0]
            : m.tab_mappings
          return {
            sourceColumn: m.source_column,
            targetEntity: (tabMapping as { primary_entity: string })?.primary_entity || 'unknown',
            targetField: m.target_field!,
            authority: m.authority as MappingAuthority,
          }
        })
    }

    this.initialized = true
  }

  /**
   * Get AI suggestion for a single column
   */
  async suggestColumnMapping(
    column: ColumnInput,
    siblingColumns: string[],
    context?: MappingContext
  ): Promise<ColumnSuggestion> {
    await this.ensureInitialized()
    await this.loadExistingMappings()

    const response = await this.anthropic!.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: this.buildSystemPrompt(context),
      tools: [COLUMN_MAPPING_TOOL],
      tool_choice: { type: 'tool', name: 'suggest_column_mapping' },
      messages: [
        {
          role: 'user',
          content: this.buildColumnPrompt(column, siblingColumns, context),
        },
      ],
    })

    return this.parseToolResponse(response)
  }

  /**
   * Get AI suggestions for all columns in a tab
   */
  async suggestAllMappings(
    columns: ColumnInput[],
    onProgress?: (progress: number) => void
  ): Promise<Map<number, ColumnSuggestion>> {
    const suggestions = new Map<number, ColumnSuggestion>()
    const siblingNames = columns.map((c) => c.name)

    for (let i = 0; i < columns.length; i++) {
      const column = columns[i]

      try {
        const suggestion = await this.suggestColumnMapping(column, siblingNames)
        suggestions.set(column.position, suggestion)
      } catch (error) {
        console.error(`AI suggestion failed for column ${column.name}:`, error)
        // Continue with other columns
      }

      onProgress?.((i + 1) / columns.length)
    }

    return suggestions
  }

  /**
   * Build the system prompt with schema and existing mappings
   */
  private buildSystemPrompt(context?: MappingContext): string {
    const existingPatternsJson =
      this.existingMappings.length > 0
        ? JSON.stringify(this.existingMappings.slice(0, 20), null, 2)
        : 'No existing mappings yet'

    // Build context hint based on sheet/tab names
    let contextHint = ''
    if (context?.primaryEntity) {
      contextHint = `\n\n## IMPORTANT: Sheet Context\nThis tab has been identified as primarily containing **${context.primaryEntity}** data. Strongly prefer mapping columns to the ${context.primaryEntity} entity unless clearly unrelated.`
    } else if (context?.tabName || context?.sourceName) {
      const name = context.tabName || context.sourceName || ''
      // Infer primary entity from common naming patterns
      if (/client|partner|brand|account/i.test(name)) {
        contextHint = `\n\n## IMPORTANT: Sheet Context\nThe sheet/tab name "${name}" suggests this is primarily about **partners/clients**. Prefer mapping columns to the partner entity when reasonable. For example, "Client Count" on a client sheet likely refers to a partner metric, not staff.`
      } else if (/staff|team|employee|member/i.test(name)) {
        contextHint = `\n\n## IMPORTANT: Sheet Context\nThe sheet/tab name "${name}" suggests this is primarily about **staff/team members**. Prefer mapping columns to the staff entity when reasonable.`
      } else if (/asin|product|sku|inventory/i.test(name)) {
        contextHint = `\n\n## IMPORTANT: Sheet Context\nThe sheet/tab name "${name}" suggests this is primarily about **ASINs/products**. Prefer mapping columns to the asin entity when reasonable.`
      }
    }

    return `You are a data mapping assistant for Sophie Hub, an internal operations platform for Sophie Society (an Amazon brand management agency with 120+ staff managing 700+ partner brands).

## Your Role
Help admins map columns from external data sources (Google Sheets, CRMs, etc.) to Sophie Hub's core entities. Be accurate and conservative - if unsure, lower your confidence score.

## Core Entities & Fields

### partners (Client brands we manage)
Fields: ${ENTITY_SCHEMA.partners.join(', ')}
Key identifiers: brand_name, client_email

### staff (Team members)
Fields: ${ENTITY_SCHEMA.staff.join(', ')}
Key identifiers: email, full_name

### asins (Amazon products per partner)
Fields: ${ENTITY_SCHEMA.asins.join(', ')}
Key identifiers: asin_code

## Column Categories
- **partner**: Maps to partners entity
- **staff**: Maps to staff entity
- **asin**: Maps to asins entity
- **weekly**: Time-series status columns (look for date patterns like "1/6", "Week 1", "Jan 6")
- **computed**: Derived fields that need calculation (formulas, aggregates)
- **skip**: Columns to ignore (internal notes, blank columns, irrelevant data)

## Authority Levels
- **source_of_truth**: This source is authoritative for this field (can overwrite existing data)
- **reference**: Read-only reference, doesn't overwrite existing values

## Existing Mapping Patterns (learn from these)
${existingPatternsJson}${contextHint}

## Analysis Guidelines
1. Look at BOTH column names AND sample values
2. Consider context from sibling columns (e.g., if "Brand Name" exists, "Email" likely refers to client email)
3. **Pay close attention to the sheet/tab name** - it often indicates the primary entity type
4. Weekly columns often have date patterns in names
5. Key fields are unique identifiers - be careful marking something as is_key
6. When uncertain, use lower confidence and category="skip"
7. Default to authority="reference" unless clearly the primary source`
  }

  /**
   * Build the prompt for a specific column
   */
  private buildColumnPrompt(column: ColumnInput, siblingColumns: string[], context?: MappingContext): string {
    const nonEmptyValues = column.sampleValues.filter((v) => v && v.trim())
    const sampleDisplay =
      nonEmptyValues.length > 0
        ? nonEmptyValues.slice(0, 5).join('", "')
        : '(all empty values)'

    const contextLine = context?.tabName
      ? `**Sheet/Tab:** "${context.tabName}"${context.sourceName ? ` (from ${context.sourceName})` : ''}\n`
      : ''

    return `Analyze this column and suggest a mapping:

${contextLine}**Column Name:** "${column.name}"
**Sample Values:** "${sampleDisplay}"
**Position:** Column ${column.position + 1}
**Sibling Columns:** ${siblingColumns.slice(0, 10).join(', ')}

Use the suggest_column_mapping tool to provide your structured suggestion.`
  }

  /**
   * Parse the tool response into a ColumnSuggestion
   */
  private parseToolResponse(response: Anthropic.Message): ColumnSuggestion {
    const toolUse = response.content.find(
      (block: Anthropic.ContentBlock): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
    )

    if (!toolUse || toolUse.name !== 'suggest_column_mapping') {
      // Fallback to skip with low confidence
      return {
        category: 'skip',
        targetField: null,
        confidence: 0.1,
        reasoning: 'AI did not provide a valid suggestion',
        isKey: false,
        authority: 'reference',
      }
    }

    const input = toolUse.input as {
      category: MappingCategory
      target_field?: string
      confidence: number
      reasoning: string
      is_key: boolean
      authority: MappingAuthority
    }

    return {
      category: input.category,
      targetField: input.target_field || null,
      confidence: input.confidence,
      reasoning: input.reasoning,
      isKey: input.is_key,
      authority: input.authority,
    }
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

let sdkInstance: MappingAssistantSDK | null = null

export function getMappingAssistant(): MappingAssistantSDK {
  if (!sdkInstance) {
    sdkInstance = new MappingAssistantSDK()
  }
  return sdkInstance
}
