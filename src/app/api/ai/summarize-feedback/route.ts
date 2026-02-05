import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { requireRole } from '@/lib/auth/api-auth'
import { ROLES } from '@/lib/auth/roles'
import { apiSuccess, apiError, apiValidationError } from '@/lib/api/response'
import { getAnthropicApiKey } from '@/lib/settings'
import { getAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

const RequestSchema = z.object({
  feedbackId: z.string().uuid('Invalid feedback ID'),
  forceRefresh: z.boolean().optional(),
})

/**
 * POST /api/ai/summarize-feedback
 * Quick, cheap summarization of a feedback item using Haiku
 * Returns a brief summary of the problem without detailed analysis
 */
export async function POST(request: NextRequest) {
  // Auth check - admin only
  const auth = await requireRole(ROLES.ADMIN)
  if (!auth.authenticated) {
    return auth.response
  }

  // Parse and validate request
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError('INVALID_JSON', 'Invalid JSON in request body', 400)
  }

  const validation = RequestSchema.safeParse(body)
  if (!validation.success) {
    return apiValidationError(validation.error)
  }

  const { feedbackId, forceRefresh } = validation.data

  // Get the feedback item first
  const supabase = getAdminClient()
  const { data: feedback, error: feedbackError } = await supabase
    .from('feedback')
    .select('*')
    .eq('id', feedbackId)
    .single()

  if (feedbackError || !feedback) {
    return apiError('NOT_FOUND', 'Feedback item not found', 404)
  }

  // Check for cached summary (unless force refresh)
  if (!forceRefresh && feedback.ai_summary) {
    const isOutOfDate = feedback.content_updated_at &&
      feedback.ai_summary_at &&
      new Date(feedback.content_updated_at) > new Date(feedback.ai_summary_at)

    return apiSuccess({
      summary: feedback.ai_summary,
      feedbackId,
      cached: true,
      outOfDate: isOutOfDate,
      analyzedAt: feedback.ai_summary_at,
    })
  }

  // Check for Anthropic API key
  let anthropicKey: string
  try {
    anthropicKey = await getAnthropicApiKey()
    console.log('Got Anthropic API key:', anthropicKey ? `${anthropicKey.slice(0, 10)}...` : 'EMPTY')
  } catch (keyError) {
    console.error('Failed to get Anthropic API key:', keyError)
    return apiError(
      'SERVICE_UNAVAILABLE',
      'AI is not configured. Add your Anthropic API key in Settings → API Keys.',
      503
    )
  }

  // Build context
  const context = `Type: ${feedback.type}
Title: ${feedback.title || 'No title'}
Description: ${feedback.description}
Page: ${feedback.page_url || 'Not specified'}
Reported by: ${feedback.submitted_by_email}`

  // Call Claude Haiku for quick summary (much cheaper)
  const anthropic = new Anthropic({ apiKey: anthropicKey })

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 200,
      messages: [
        {
          role: 'user',
          content: `Summarize this ${feedback.type} report in 1-2 sentences. Be concise and focus on what the user is experiencing:\n\n${context}`,
        },
      ],
    })

    // Extract the response text
    const summary = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map(block => block.text)
      .join('')
      .trim()

    // Save to database
    const now = new Date().toISOString()
    await supabase
      .from('feedback')
      .update({
        ai_summary: summary,
        ai_summary_at: now,
      })
      .eq('id', feedbackId)

    return apiSuccess({
      summary,
      feedbackId,
      cached: false,
      outOfDate: false,
      analyzedAt: now,
    })
  } catch (error) {
    console.error('Claude API error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return apiError('AI_ERROR', `Failed to summarize: ${message}`, 500)
  }
}
