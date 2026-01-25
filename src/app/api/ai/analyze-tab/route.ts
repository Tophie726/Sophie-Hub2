import { NextRequest } from 'next/server'
import { requirePermission } from '@/lib/auth/api-auth'
import { apiSuccess, apiError, apiValidationError, ApiErrors } from '@/lib/api/response'
import { hasSystemSetting, getAnthropicApiKey } from '@/lib/settings'
import { checkRateLimit, rateLimitHeaders } from '@/lib/rate-limit'
import { z } from 'zod'
import Anthropic from '@anthropic-ai/sdk'

// =============================================================================
// Validation Schema
// =============================================================================

const AnalyzeTabSchema = z.object({
  tab_name: z.string().min(1, 'Tab name is required'),
  source_name: z.string().optional(),
  column_names: z.array(z.coerce.string()).max(300),
  sample_rows: z.array(z.array(z.coerce.string())).max(5),
  existing_mappings: z.array(z.object({
    column_name: z.string(),
    category: z.string().nullable(),
    target_field: z.string().nullable(),
  })).optional(),
})

// =============================================================================
// Rate Limit Config
// =============================================================================

const AI_TAB_RATE_LIMIT = {
  maxRequests: 20, // 20 tab analyses per hour
  windowMs: 60 * 60 * 1000,
}

// =============================================================================
// Tool Definition
// =============================================================================

const ANALYZE_TAB_TOOL: Anthropic.Tool = {
  name: 'summarize_tab',
  description: 'Provide a high-level summary of what this tab is about and its purpose',
  input_schema: {
    type: 'object' as const,
    properties: {
      primary_entity: {
        type: 'string',
        enum: ['partner', 'staff', 'asin', 'weekly', 'mixed', 'unknown'],
        description: 'The primary entity type this tab contains data about',
      },
      confidence: {
        type: 'number',
        minimum: 0,
        maximum: 1,
        description: 'Confidence score for the entity detection (0-1)',
      },
      summary: {
        type: 'string',
        description: 'A 1-2 sentence summary of what this tab is for and what data it contains',
      },
      purpose: {
        type: 'string',
        description: 'The business purpose of this tab (e.g., "Track partner onboarding status", "Manage staff assignments")',
      },
      key_column: {
        type: 'string',
        description: 'The column name that serves as the primary identifier/key',
      },
      column_categories: {
        type: 'object',
        properties: {
          core_fields: {
            type: 'array',
            items: { type: 'string' },
            description: 'Important columns that map to core entity fields (limit 5)',
          },
          relationship_fields: {
            type: 'array',
            items: { type: 'string' },
            description: 'Columns that link to other entities (staff assignments, partner refs)',
          },
          weekly_date_fields: {
            type: 'array',
            items: { type: 'string' },
            description: 'Columns with date patterns (weekly status tracking)',
          },
          skip_candidates: {
            type: 'number',
            description: 'Approximate count of columns that appear empty or irrelevant',
          },
        },
        description: 'High-level categorization of column types found',
      },
      data_quality_notes: {
        type: 'array',
        items: { type: 'string' },
        description: 'Notable data quality issues or patterns (limit 3-4)',
      },
    },
    required: ['primary_entity', 'confidence', 'summary', 'purpose', 'key_column', 'column_categories'],
  },
}

// =============================================================================
// POST /api/ai/analyze-tab
// =============================================================================

export async function POST(request: NextRequest) {
  const auth = await requirePermission('data-enrichment:write')
  if (!auth.authenticated) return auth.response

  // Rate limit
  const rateLimitResult = checkRateLimit(auth.user.id, 'ai-analyze-tab', AI_TAB_RATE_LIMIT)
  if (!rateLimitResult.allowed) {
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `Too many analysis requests. Please wait ${Math.ceil(rateLimitResult.resetIn / 1000)} seconds.`,
        },
      }),
      {
        status: 429,
        headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rateLimitResult) },
      }
    )
  }

  try {
    const body = await request.json()
    const validation = AnalyzeTabSchema.safeParse(body)
    if (!validation.success) {
      return apiValidationError(validation.error)
    }

    const { tab_name, source_name, column_names, sample_rows, existing_mappings } = validation.data

    // Check API key
    const hasDbKey = await hasSystemSetting('anthropic_api_key')
    if (!hasDbKey && !process.env.ANTHROPIC_API_KEY) {
      return apiError(
        'SERVICE_UNAVAILABLE',
        'AI not configured. Add Anthropic API key in Settings → API Keys.',
        503
      )
    }

    const apiKey = await getAnthropicApiKey()
    const anthropic = new Anthropic({ apiKey })

    // Build column summary (limit to first 50 columns for prompt size)
    const columnsToAnalyze = column_names.slice(0, 50)
    const columnSummary = columnsToAnalyze.map((col, i) => {
      const samples = sample_rows
        .map(row => row[i])
        .filter(v => v && String(v).trim())
        .slice(0, 3)
      const existing = existing_mappings?.find(m => m.column_name === col)
      const mappingInfo = existing?.category ? ` [Currently: ${existing.category}${existing.target_field ? ` → ${existing.target_field}` : ''}]` : ''
      return `- "${col}"${mappingInfo}: ${samples.length > 0 ? samples.join(', ') : '(empty)'}`
    }).join('\n')

    const systemPrompt = `You are analyzing a data tab for Sophie Hub, an operations platform for Sophie Society (Amazon brand management agency with 120+ staff managing 700+ partner brands).

## Core Entities

### partners (Client brands we manage)
**PRIMARY KEY: brand_name**
Tracks: client info, subscription status, staff assignments, onboarding dates

### staff (Team members)
**PRIMARY KEY: full_name**
Tracks: contact info, role, department, capacity, manager

### asins (Amazon products per partner)
**PRIMARY KEY: asin_code**
Tracks: product info, pricing, status, linked to partner via brand_name

### weekly (Time-series status data)
Date-formatted columns like "1/6", "Week 1", "2024-01-06" containing status values

## Relationship Fields Pattern
Staff names on a partner sheet (POD Leader, Account Manager) are PARTNER fields - they store staff assignments ON the partner record.

## Your Task
Provide a HIGH-LEVEL SUMMARY of this tab:
1. What entity does it primarily track?
2. What is its business purpose?
3. Which column is the key identifier?
4. What categories of columns exist? (core fields, relationships, weekly dates, skippable)
5. Any notable data quality issues?

DO NOT provide individual column mapping suggestions - just summarize the tab's purpose and structure.`

    const userPrompt = `Summarize this tab:

**Tab Name:** "${tab_name}"${source_name ? `\n**Source:** "${source_name}"` : ''}
**Total Columns:** ${column_names.length}

**Column Names and Samples:**
${columnSummary}

${column_names.length > 50 ? `\n(Showing first 50 of ${column_names.length} columns)` : ''}

Provide a high-level summary using the summarize_tab tool. Focus on WHAT this tab is for, not individual column mappings.`

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      tools: [ANALYZE_TAB_TOOL],
      tool_choice: { type: 'tool', name: 'summarize_tab' },
      messages: [{ role: 'user', content: userPrompt }],
    })

    // Parse response
    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
    )

    if (!toolUse || toolUse.name !== 'summarize_tab') {
      return apiError('INTERNAL_ERROR', 'AI did not provide valid summary', 500)
    }

    const summary = toolUse.input as {
      primary_entity: string
      confidence: number
      summary: string
      purpose: string
      key_column: string
      column_categories: {
        core_fields?: string[]
        relationship_fields?: string[]
        weekly_date_fields?: string[]
        skip_candidates?: number
      }
      data_quality_notes?: string[]
    }

    return apiSuccess({ summary })
  } catch (error) {
    console.error('AI tab analysis error:', error)
    if (error instanceof Error && error.message.includes('API key')) {
      return apiError('SERVICE_UNAVAILABLE', 'AI service authentication failed', 503)
    }
    return ApiErrors.internal()
  }
}
