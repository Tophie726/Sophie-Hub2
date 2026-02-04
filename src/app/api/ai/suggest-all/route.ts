import { NextRequest } from 'next/server'
import { requirePermission } from '@/lib/auth/api-auth'
import { apiSuccess, apiError, apiValidationError, ApiErrors } from '@/lib/api/response'
import { getMappingAssistant, type ColumnInput } from '@/lib/ai/mapping-sdk'
import { checkRateLimit, rateLimitHeaders } from '@/lib/rate-limit'
import { hasSystemSetting } from '@/lib/settings'
import { audit } from '@/lib/audit'
import { z } from 'zod'

// =============================================================================
// Validation Schema
// =============================================================================

const SuggestAllSchema = z.object({
  columns: z
    .array(
      z.object({
        name: z.string().min(1),
        sample_values: z.array(z.coerce.string()).max(10).transform(arr => arr.filter(v => v && v.trim())),
        position: z.number().int().min(0),
      })
    )
    .min(1, 'At least one column required')
    .max(50, 'Max 50 columns at a time'),
  tab_name: z.string().optional(),
  data_source_id: z.string().uuid().optional(),
})

// =============================================================================
// Rate Limit Config for Bulk AI
// =============================================================================

const AI_BULK_RATE_LIMIT = {
  maxRequests: 5, // 5 bulk requests per hour
  windowMs: 60 * 60 * 1000,
}

// =============================================================================
// POST /api/ai/suggest-all
// =============================================================================

/**
 * Get AI suggestions for all columns in a tab.
 *
 * Request body:
 * {
 *   columns: Array<{ name: string; sample_values: string[]; position: number }>
 *   tab_name?: string
 *   data_source_id?: string
 * }
 *
 * Response:
 * {
 *   suggestions: Array<{
 *     position: number
 *     category: string
 *     target_field: string | null
 *     confidence: number
 *     reasoning: string
 *     is_key: boolean
 *     authority: string
 *   }>
 *   stats: {
 *     total: number
 *     high_confidence: number
 *     medium_confidence: number
 *     low_confidence: number
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  // Require data-enrichment:write permission
  const auth = await requirePermission('data-enrichment:write')
  if (!auth.authenticated) return auth.response

  // Check rate limit for bulk operations
  const rateLimitResult = checkRateLimit(auth.user.id, 'ai-bulk', AI_BULK_RATE_LIMIT)
  if (!rateLimitResult.allowed) {
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `Too many bulk AI requests. Please wait ${Math.ceil(rateLimitResult.resetIn / 1000)} seconds.`,
        },
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          ...rateLimitHeaders(rateLimitResult),
        },
      }
    )
  }

  try {
    const body = await request.json()

    // Validate input
    const validation = SuggestAllSchema.safeParse(body)
    if (!validation.success) {
      return apiValidationError(validation.error)
    }

    const { columns, tab_name, data_source_id } = validation.data

    // Check if API key is configured (database or env fallback)
    const hasDbKey = await hasSystemSetting('anthropic_api_key')
    if (!hasDbKey && !process.env.ANTHROPIC_API_KEY) {
      return apiError(
        'SERVICE_UNAVAILABLE',
        'AI mapping assistant is not configured. Add your Anthropic API key in Settings → API Keys.',
        503
      )
    }

    // Convert to ColumnInput format
    const columnInputs: ColumnInput[] = columns.map((c) => ({
      name: c.name,
      sampleValues: c.sample_values,
      position: c.position,
    }))

    // Get AI suggestions
    const assistant = getMappingAssistant()
    const suggestionsMap = await assistant.suggestAllMappings(columnInputs)

    // Convert Map to array for response
    const suggestions: Array<{
      position: number
      category: string
      target_field: string | null
      confidence: number
      reasoning: string
      is_key: boolean
      authority: string
    }> = []

    suggestionsMap.forEach((suggestion, position) => {
      suggestions.push({
        position,
        category: suggestion.category,
        target_field: suggestion.targetField,
        confidence: suggestion.confidence,
        reasoning: suggestion.reasoning,
        is_key: suggestion.isKey,
        authority: suggestion.authority,
      })
    })

    // Sort by position
    suggestions.sort((a, b) => a.position - b.position)

    // Calculate stats
    const stats = {
      total: suggestions.length,
      high_confidence: suggestions.filter((s) => s.confidence >= 0.8).length,
      medium_confidence: suggestions.filter((s) => s.confidence >= 0.5 && s.confidence < 0.8)
        .length,
      low_confidence: suggestions.filter((s) => s.confidence < 0.5).length,
    }

    // Audit log the bulk suggestion
    await audit.log({
      userId: auth.user.id,
      userEmail: auth.user.email || undefined,
      action: 'create',
      resourceType: 'tab_mapping',
      resourceId: data_source_id || undefined,
      resourceName: `AI Bulk Suggestion: ${tab_name || 'Unknown Tab'}`,
      metadata: {
        columns_analyzed: columns.length,
        suggestions_returned: suggestions.length,
        high_confidence_count: stats.high_confidence,
        medium_confidence_count: stats.medium_confidence,
        low_confidence_count: stats.low_confidence,
      },
    })

    return apiSuccess({ suggestions, stats })
  } catch (error) {
    console.error('AI bulk suggestion error:', error)

    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        return apiError('SERVICE_UNAVAILABLE', 'AI service authentication failed', 503)
      }
      if (error.message.includes('rate limit')) {
        return apiError('RATE_LIMIT_EXCEEDED', 'AI service rate limit exceeded', 429)
      }
    }

    return ApiErrors.internal()
  }
}
