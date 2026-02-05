import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { requireRole } from '@/lib/auth/api-auth'
import { ROLES } from '@/lib/auth/roles'
import { apiSuccess, apiError, apiValidationError } from '@/lib/api/response'
import { getAnthropicApiKey, getPostHogApiKey } from '@/lib/settings'
import { getAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

const POSTHOG_PROJECT_ID = '306226'
const POSTHOG_HOST = 'https://us.posthog.com'

const RequestSchema = z.object({
  feedbackId: z.string().uuid('Invalid feedback ID'),
  forceRefresh: z.boolean().optional(),
})

interface PostHogEvent {
  event: string
  timestamp: string
  properties?: Record<string, unknown>
}

interface BugAnalysis {
  summary: string
  likelyCause: string
  suggestedFix: string
  affectedFiles: string[]
  confidence: 'low' | 'medium' | 'high'
  additionalNotes?: string
}

/**
 * Fetch session events from PostHog API
 */
async function fetchPostHogSessionEvents(
  sessionId: string,
  apiKey: string
): Promise<PostHogEvent[]> {
  try {
    // Fetch events for the session
    const url = `${POSTHOG_HOST}/api/projects/${POSTHOG_PROJECT_ID}/events?session_id=${sessionId}&limit=100`

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      console.error('PostHog API error:', response.status, await response.text())
      return []
    }

    const data = await response.json()
    return data.results || []
  } catch (error) {
    console.error('Failed to fetch PostHog events:', error)
    return []
  }
}

/**
 * Extract error events from session events
 */
function extractErrors(events: PostHogEvent[]): Array<{
  message: string
  stack?: string
  url?: string
  timestamp: string
}> {
  const errors: Array<{
    message: string
    stack?: string
    url?: string
    timestamp: string
  }> = []

  for (const event of events) {
    if (event.event === '$exception' || event.event === '$error') {
      const props = event.properties || {}
      errors.push({
        message: String(props.$exception_message || props.message || 'Unknown error'),
        stack: props.$exception_stack_trace_raw as string | undefined,
        url: props.$current_url as string | undefined,
        timestamp: event.timestamp,
      })
    }
  }

  return errors
}

/**
 * Get relevant file paths from error stack traces
 */
function extractFilePathsFromStack(stack?: string): string[] {
  if (!stack) return []

  const paths: string[] = []
  // Match patterns like "at Component (src/components/Something.tsx:42:10)"
  const regex = /(?:src\/[^\s:)]+)/g
  const matches = stack.match(regex)

  if (matches) {
    // Dedupe and limit
    const unique = Array.from(new Set(matches))
    return unique.slice(0, 5)
  }

  return paths
}

/**
 * POST /api/ai/analyze-bug
 * Analyze a bug report using AI with PostHog session data
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

  // Check for cached analysis (unless force refresh)
  if (!forceRefresh && feedback.ai_analysis) {
    const isOutOfDate = feedback.content_updated_at &&
      feedback.ai_analysis_at &&
      new Date(feedback.content_updated_at) > new Date(feedback.ai_analysis_at)

    return apiSuccess({
      analysis: feedback.ai_analysis as BugAnalysis,
      sessionDataAvailable: !!feedback.posthog_session_id,
      errorsFound: 0,
      cached: true,
      outOfDate: isOutOfDate,
      analyzedAt: feedback.ai_analysis_at,
    })
  }

  // Check for Anthropic API key
  let anthropicKey: string
  try {
    anthropicKey = await getAnthropicApiKey()
  } catch {
    return apiError(
      'SERVICE_UNAVAILABLE',
      'AI analysis is not configured. Add your Anthropic API key in Settings → API Keys.',
      503
    )
  }

  // Gather context
  let sessionEvents: PostHogEvent[] = []
  let errors: Array<{ message: string; stack?: string; url?: string; timestamp: string }> = []
  let posthogAvailable = false

  // Try to fetch PostHog data if we have a session ID
  if (feedback.posthog_session_id) {
    const posthogKey = await getPostHogApiKey()
    if (posthogKey) {
      posthogAvailable = true
      sessionEvents = await fetchPostHogSessionEvents(feedback.posthog_session_id, posthogKey)
      errors = extractErrors(sessionEvents)
    }
  }

  // Extract file paths from error stacks
  const affectedFilesFromStack = errors.flatMap(e => extractFilePathsFromStack(e.stack))

  // Build context for Claude
  const contextParts: string[] = []

  contextParts.push(`## Bug Report Details
- **Type**: ${feedback.type}
- **Title**: ${feedback.title || 'No title'}
- **Description**: ${feedback.description}
- **Page URL**: ${feedback.page_url || 'Not provided'}
- **Reported by**: ${feedback.submitted_by_email}
- **Reported at**: ${feedback.created_at}`)

  if (feedback.browser_info) {
    contextParts.push(`\n## Browser Info
${JSON.stringify(feedback.browser_info, null, 2)}`)
  }

  if (errors.length > 0) {
    contextParts.push(`\n## Captured Errors from Session (${errors.length} errors)`)
    for (const error of errors.slice(0, 5)) {
      contextParts.push(`
### Error at ${error.timestamp}
- **Message**: ${error.message}
- **URL**: ${error.url || 'Unknown'}
${error.stack ? `- **Stack Trace**:\n\`\`\`\n${error.stack.slice(0, 2000)}\n\`\`\`` : ''}`)
    }
  }

  if (affectedFilesFromStack.length > 0) {
    contextParts.push(`\n## Potentially Affected Files (from stack traces)
${affectedFilesFromStack.map(f => `- ${f}`).join('\n')}`)
  }

  if (!posthogAvailable) {
    contextParts.push(`\n## Note
PostHog API key not configured, so session replay data is not available. Analysis is based solely on the bug report text.`)
  }

  // Call Claude for analysis
  const anthropic = new Anthropic({ apiKey: anthropicKey })

  const systemPrompt = `You are a senior software engineer analyzing bug reports for Sophie Hub, a Next.js application with:
- React Server Components and Client Components
- Supabase (PostgreSQL) database
- shadcn/ui component library
- Tailwind CSS for styling
- TypeScript throughout

Your job is to analyze the bug report and any captured error data to:
1. Understand what the user experienced
2. Identify the likely root cause
3. Suggest a concrete fix with code changes

Be specific and actionable. Reference actual file paths when you can infer them from the stack traces or page URLs.

Respond with a JSON object matching this structure:
{
  "summary": "Brief description of what went wrong",
  "likelyCause": "Technical explanation of the root cause",
  "suggestedFix": "Detailed fix with code snippets if possible",
  "affectedFiles": ["list", "of", "file", "paths"],
  "confidence": "low" | "medium" | "high",
  "additionalNotes": "Optional additional context or warnings"
}`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Please analyze this bug report and provide your analysis as JSON:\n\n${contextParts.join('\n')}`,
        },
      ],
    })

    // Extract the response text
    const responseText = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map(block => block.text)
      .join('')

    // Try to parse as JSON
    let analysis: BugAnalysis
    try {
      // Extract JSON from response (might be wrapped in markdown code block)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('No JSON found in response')
      }
      analysis = JSON.parse(jsonMatch[0])
    } catch {
      // Fallback: return raw text as summary
      analysis = {
        summary: responseText.slice(0, 500),
        likelyCause: 'Unable to parse structured analysis',
        suggestedFix: responseText,
        affectedFiles: affectedFilesFromStack,
        confidence: 'low',
      }
    }

    // Store the analysis in the feedback record
    const now = new Date().toISOString()
    await supabase
      .from('feedback')
      .update({
        ai_analysis: analysis,
        ai_analysis_at: now,
        internal_notes: `## AI Analysis (${now})\n\n**Summary:** ${analysis.summary}\n\n**Likely Cause:** ${analysis.likelyCause}\n\n**Suggested Fix:**\n${analysis.suggestedFix}\n\n**Affected Files:** ${analysis.affectedFiles.join(', ')}\n\n**Confidence:** ${analysis.confidence}`,
      })
      .eq('id', feedbackId)

    return apiSuccess({
      analysis,
      sessionDataAvailable: posthogAvailable,
      errorsFound: errors.length,
      cached: false,
      outOfDate: false,
      analyzedAt: now,
    })
  } catch (error) {
    console.error('Claude API error:', error)
    return apiError('AI_ERROR', 'Failed to analyze bug report. Please try again.', 500)
  }
}
