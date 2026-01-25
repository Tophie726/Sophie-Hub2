import { NextRequest } from 'next/server'
import { requirePermission } from '@/lib/auth/api-auth'
import { apiSuccess, apiError, apiValidationError, ApiErrors } from '@/lib/api/response'
import { getMappingAssistant, type ColumnInput, type MappingContext } from '@/lib/ai/mapping-sdk'
import { checkRateLimit, RATE_LIMITS, rateLimitHeaders } from '@/lib/rate-limit'
import { hasSystemSetting } from '@/lib/settings'
import { audit } from '@/lib/audit'
import { z } from 'zod'

// =============================================================================
// Validation Schema
// =============================================================================

const SuggestMappingSchema = z.object({
  column_name: z.string().min(1, 'Column name is required'),
  // Coerce values to strings and filter empty ones
  sample_values: z.array(z.coerce.string()).max(20, 'Max 20 sample values').transform(arr => arr.filter(v => v && v.trim())),
  sibling_columns: z.array(z.coerce.string()).max(50, 'Max 50 sibling columns'),
  position: z.number().int().min(0).optional().default(0),
  // Context for better suggestions
  tab_name: z.string().optional(),
  source_name: z.string().optional(),
})

// =============================================================================
// Rate Limit Config for AI
// =============================================================================

const AI_RATE_LIMIT = {
  maxRequests: 20, // 20 suggestions per minute
  windowMs: 60 * 1000,
}

// =============================================================================
// POST /api/ai/suggest-mapping
// =============================================================================

/**
 * Get AI suggestion for a single column mapping.
 *
 * Request body:
 * {
 *   column_name: string
 *   sample_values: string[]
 *   sibling_columns: string[]
 *   position?: number
 * }
 *
 * Response:
 * {
 *   suggestion: {
 *     category: 'partner' | 'staff' | 'asin' | 'weekly' | 'computed' | 'skip'
 *     target_field: string | null
 *     confidence: number
 *     reasoning: string
 *     is_key: boolean
 *     authority: 'source_of_truth' | 'reference'
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  // Require data-enrichment:write permission
  const auth = await requirePermission('data-enrichment:write')
  if (!auth.authenticated) return auth.response

  // Check rate limit
  const rateLimitResult = checkRateLimit(auth.user.id, 'ai-suggest', AI_RATE_LIMIT)
  if (!rateLimitResult.allowed) {
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `Too many AI requests. Please wait ${Math.ceil(rateLimitResult.resetIn / 1000)} seconds.`,
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
    const validation = SuggestMappingSchema.safeParse(body)
    if (!validation.success) {
      return apiValidationError(validation.error)
    }

    const { column_name, sample_values, sibling_columns, position, tab_name, source_name } = validation.data

    // Check if API key is configured (database or env fallback)
    const hasDbKey = await hasSystemSetting('anthropic_api_key')
    if (!hasDbKey && !process.env.ANTHROPIC_API_KEY) {
      return apiError(
        'SERVICE_UNAVAILABLE',
        'AI mapping assistant is not configured. Add your Anthropic API key in Settings → API Keys.',
        503
      )
    }

    // Get AI suggestion
    const assistant = getMappingAssistant()
    const column: ColumnInput = {
      name: column_name,
      sampleValues: sample_values,
      position,
    }

    // Build context for better suggestions
    const context: MappingContext = {
      tabName: tab_name,
      sourceName: source_name,
    }

    const suggestion = await assistant.suggestColumnMapping(column, sibling_columns, context)

    // Audit log the AI suggestion
    await audit.log({
      userId: auth.user.id,
      userEmail: auth.user.email || undefined,
      action: 'create',
      resourceType: 'column_mapping',
      resourceName: `AI Suggestion: ${column_name}`,
      metadata: {
        column_name,
        suggestion_category: suggestion.category,
        suggestion_confidence: suggestion.confidence,
        suggestion_target: suggestion.targetField,
      },
    })

    return apiSuccess({
      suggestion: {
        category: suggestion.category,
        target_field: suggestion.targetField,
        confidence: suggestion.confidence,
        reasoning: suggestion.reasoning,
        is_key: suggestion.isKey,
        authority: suggestion.authority,
      },
    })
  } catch (error) {
    console.error('AI suggestion error:', error)

    // Check for specific Anthropic errors
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
