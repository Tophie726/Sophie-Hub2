import { NextRequest } from 'next/server'
import { requirePermission } from '@/lib/auth/api-auth'
import { apiSuccess, apiError, apiValidationError, ApiErrors } from '@/lib/api/response'
import { hasSystemSetting, getAnthropicApiKey } from '@/lib/settings'
import { checkRateLimit, rateLimitHeaders } from '@/lib/rate-limit'
import { z } from 'zod'
import Anthropic from '@anthropic-ai/sdk'
import { getSchemaDescription } from '@/lib/entity-fields'

// =============================================================================
// Validation Schema
// =============================================================================

const AnalyzeSourceSchema = z.object({
  source_name: z.string().min(1, 'Source name is required'),
  tabs: z.array(z.object({
    tab_name: z.string(),
    column_names: z.array(z.coerce.string()).max(300), // Some sheets have 240+ columns
    sample_values: z.array(z.array(z.coerce.string())).max(5), // Up to 5 rows of samples
  })).min(1).max(20),
})

// =============================================================================
// Rate Limit Config
// =============================================================================

const AI_ANALYZE_RATE_LIMIT = {
  maxRequests: 10, // 10 analyses per hour
  windowMs: 60 * 60 * 1000,
}

// =============================================================================
// Tool Definition
// =============================================================================

const ANALYZE_SOURCE_TOOL: Anthropic.Tool = {
  name: 'analyze_data_source',
  description: 'Analyze a data source and determine its primary entity type and structure',
  input_schema: {
    type: 'object' as const,
    properties: {
      primary_entity: {
        type: 'string',
        enum: ['partner', 'staff', 'asin', 'mixed', 'unknown'],
        description: 'The primary entity type this source contains data about',
      },
      confidence: {
        type: 'number',
        minimum: 0,
        maximum: 1,
        description: 'Confidence score for the primary entity detection (0-1)',
      },
      reasoning: {
        type: 'string',
        description: 'Brief explanation of why this entity type was detected',
      },
      key_column_candidates: {
        type: 'array',
        items: { type: 'string' },
        description: 'Column names that could serve as key/identifier fields',
      },
      weekly_columns_detected: {
        type: 'boolean',
        description: 'Whether date-patterned weekly status columns were detected',
      },
      suggested_strategy: {
        type: 'string',
        description: 'Brief suggestion for how to approach mapping this source',
      },
      tab_summaries: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            tab_name: { type: 'string' },
            entity_type: { type: 'string', enum: ['partner', 'staff', 'asin', 'weekly', 'mixed', 'unknown'] },
            confidence: { type: 'number' },
          },
          required: ['tab_name', 'entity_type', 'confidence'],
        },
        description: 'Per-tab entity type analysis',
      },
    },
    required: ['primary_entity', 'confidence', 'reasoning', 'key_column_candidates', 'weekly_columns_detected', 'suggested_strategy'],
  },
}

// =============================================================================
// POST /api/ai/analyze-source
// =============================================================================

export async function POST(request: NextRequest) {
  const auth = await requirePermission('data-enrichment:write')
  if (!auth.authenticated) return auth.response

  // Rate limit
  const rateLimitResult = checkRateLimit(auth.user.id, 'ai-analyze', AI_ANALYZE_RATE_LIMIT)
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
    const validation = AnalyzeSourceSchema.safeParse(body)
    if (!validation.success) {
      return apiValidationError(validation.error)
    }

    const { source_name, tabs } = validation.data

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

    // Build prompt
    const tabSummaries = tabs.map(tab => {
      const columns = tab.column_names.slice(0, 50).join(', ')
      const samples = tab.sample_values.slice(0, 3).map(row =>
        row.slice(0, 10).join(' | ')
      ).join('\n    ')
      return `Tab: "${tab.tab_name}"\n  Columns: ${columns}\n  Sample rows:\n    ${samples}`
    }).join('\n\n')

    const systemPrompt = `You are analyzing a data source for Sophie Hub, an operations platform for Sophie Society (Amazon brand management agency with 120+ staff managing 700+ partner brands).

## Core Entities & Key Fields

${getSchemaDescription()}

## Your Task
Analyze the source structure and determine:
1. Primary entity type (what is this source mainly about?)
2. Key identifier columns (brand_name for partners, full_name for staff, asin_code for ASINs)
3. Whether weekly/time-series columns exist (date patterns like "1/6", "Week 1")
4. Per-tab entity breakdown if tabs serve different purposes

Use the analyze_data_source tool to provide your structured analysis.`

    const userPrompt = `Analyze this data source:

**Source Name:** "${source_name}"

${tabSummaries}

Determine the primary entity type and provide a mapping strategy.`

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      tools: [ANALYZE_SOURCE_TOOL],
      tool_choice: { type: 'tool', name: 'analyze_data_source' },
      messages: [{ role: 'user', content: userPrompt }],
    })

    // Parse response
    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
    )

    if (!toolUse || toolUse.name !== 'analyze_data_source') {
      return apiError('INTERNAL_ERROR', 'AI did not provide valid analysis', 500)
    }

    const analysis = toolUse.input as {
      primary_entity: string
      confidence: number
      reasoning: string
      key_column_candidates: string[]
      weekly_columns_detected: boolean
      suggested_strategy: string
      tab_summaries?: Array<{ tab_name: string; entity_type: string; confidence: number }>
    }

    return apiSuccess({ analysis })
  } catch (error) {
    console.error('AI analysis error:', error)
    if (error instanceof Error && error.message.includes('API key')) {
      return apiError('SERVICE_UNAVAILABLE', 'AI service authentication failed', 503)
    }
    return ApiErrors.internal()
  }
}
