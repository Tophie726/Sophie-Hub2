import { requireAuth } from '@/lib/auth/api-auth'
import { apiSuccess, apiError, ApiErrors, ErrorCodes } from '@/lib/api/response'
import { getAdminClient } from '@/lib/supabase/admin'

const PROJECT_ID = '306226'
const POSTHOG_HOST = 'https://us.posthog.com'

/**
 * GET /api/posthog/session-events
 * Fetch events for a PostHog session replay
 *
 * Query params:
 * - sessionId: The PostHog session ID
 */
export async function GET(request: Request) {
  const auth = await requireAuth()
  if (!auth.authenticated) return auth.response

  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('sessionId')

  if (!sessionId) {
    return apiError(ErrorCodes.VALIDATION_ERROR, 'Session ID is required', 400)
  }

  try {
    // Get the PostHog API key from settings
    const supabase = getAdminClient()
    const { data: setting } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'posthog_api_key')
      .single()

    if (!setting?.value) {
      return apiError(ErrorCodes.VALIDATION_ERROR, 'PostHog API key not configured. Add it in Settings > Advanced.', 400)
    }

    // Decrypt the API key (it's stored encrypted)
    const { decrypt } = await import('@/lib/encryption')
    const apiKey = decrypt(setting.value)

    // Fetch events for the session from PostHog
    // Using the events endpoint with session_id filter
    const response = await fetch(
      `${POSTHOG_HOST}/api/projects/${PROJECT_ID}/events/?` +
        new URLSearchParams({
          properties: JSON.stringify([
            { key: '$session_id', value: sessionId, operator: 'exact', type: 'event' }
          ]),
          limit: '100',
          orderBy: JSON.stringify(['-timestamp']),
        }),
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('PostHog API error:', errorText)
      return ApiErrors.internal('Failed to fetch events from PostHog')
    }

    const data = await response.json()

    // Transform events to a simpler format
    const events = (data.results || []).map((event: Record<string, unknown>) => ({
      event: event.event,
      timestamp: event.timestamp,
      properties: event.properties || {},
    }))

    return apiSuccess({ events })
  } catch (error) {
    console.error('Error fetching PostHog session events:', error)
    return ApiErrors.internal()
  }
}
