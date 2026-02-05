import { requireAuth } from '@/lib/auth/api-auth'
import { apiSuccess, apiError } from '@/lib/api/response'
import { getPostHogApiKey } from '@/lib/settings'

const PROJECT_ID = '306226'
const POSTHOG_HOST = 'https://us.posthog.com'

/**
 * POST /api/posthog/share-recording
 * Enable sharing for a PostHog session recording and return the embed URL
 *
 * Body:
 * - sessionId: The PostHog session ID
 */
export async function POST(request: Request) {
  const auth = await requireAuth()
  if (!auth.authenticated) return auth.response

  let body: { sessionId?: string }
  try {
    body = await request.json()
  } catch {
    return apiError('INVALID_JSON', 'Invalid JSON', 400)
  }

  const { sessionId } = body

  if (!sessionId) {
    return apiError('VALIDATION_ERROR', 'Session ID is required', 400)
  }

  try {
    const apiKey = await getPostHogApiKey()
    if (!apiKey) {
      return apiError('SERVICE_UNAVAILABLE', 'PostHog API key not configured', 503)
    }

    // First, check if sharing is already enabled for this recording
    const checkUrl = `${POSTHOG_HOST}/api/projects/${PROJECT_ID}/session_recordings/${sessionId}/sharing`

    const checkRes = await fetch(checkUrl, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    })

    if (checkRes.ok) {
      const existing = await checkRes.json()
      // Look for an existing enabled sharing token
      const enabledShare = existing.results?.find((s: { enabled: boolean }) => s.enabled)
      if (enabledShare?.access_token) {
        return apiSuccess({
          embedUrl: `${POSTHOG_HOST}/embedded/${enabledShare.access_token}`,
          accessToken: enabledShare.access_token,
          cached: true,
        })
      }
    }

    // Create a new sharing token
    const createRes = await fetch(checkUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ enabled: true }),
    })

    if (!createRes.ok) {
      const errorText = await createRes.text()
      console.error('PostHog sharing API error:', createRes.status, errorText)
      return apiError('EXTERNAL_API_ERROR', 'Failed to enable sharing for this recording', 502)
    }

    const shareData = await createRes.json()

    if (!shareData.access_token) {
      console.error('No access_token in PostHog response:', shareData)
      return apiError('EXTERNAL_API_ERROR', 'PostHog did not return an access token', 502)
    }

    return apiSuccess({
      embedUrl: `${POSTHOG_HOST}/embedded/${shareData.access_token}`,
      accessToken: shareData.access_token,
      cached: false,
    })
  } catch (error) {
    console.error('Error enabling PostHog sharing:', error)
    return apiError('INTERNAL_ERROR', 'Failed to enable sharing', 500)
  }
}
