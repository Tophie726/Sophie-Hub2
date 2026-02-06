import { getAdminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth/api-auth'
import { apiSuccess, apiValidationError, ApiErrors } from '@/lib/api/response'
import { z } from 'zod'

const supabase = getAdminClient()

const FeedbackSchema = z.object({
  type: z.enum(['bug', 'feature', 'question']),
  title: z.string().nullable().optional(),
  description: z.string().min(1, 'Description is required'),
  page_url: z.string().optional(),
  posthog_session_id: z.string().nullable().optional(),
  screenshot_data: z.string().startsWith('data:image/').nullable().optional(), // base64 image data
  browser_info: z.record(z.string(), z.unknown()).optional(),
})

/**
 * POST /api/feedback
 * Submit new feedback (bug, feature request, or question)
 */
export async function POST(request: Request) {
  const auth = await requireAuth()
  if (!auth.authenticated) return auth.response

  try {
    const body = await request.json()
    const validation = FeedbackSchema.safeParse(body)

    if (!validation.success) {
      return apiValidationError(validation.error)
    }

    const { type, title, description, page_url, posthog_session_id, screenshot_data, browser_info } = validation.data

    const { data, error } = await supabase
      .from('feedback')
      .insert({
        type,
        title,
        description,
        page_url,
        posthog_session_id,
        screenshot_url: screenshot_data, // Store base64 directly for now
        browser_info,
        submitted_by_email: auth.user.email,
        status: 'new',
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating feedback:', error)
      return ApiErrors.database(error.message)
    }

    return apiSuccess({ feedback: data }, 201)
  } catch (error) {
    console.error('Error in POST /api/feedback:', error)
    return ApiErrors.internal()
  }
}

/**
 * GET /api/feedback
 * List feedback - all staff can see all feedback (Frill-style)
 *
 * Query params:
 * - type: bug | feature | question
 * - status: new | reviewed | in_progress | resolved | wont_fix
 * - mine: true - show only current user's feedback
 * - sort: votes | recent (default: recent)
 * - roadmap: true - show only roadmap items (reviewed, in_progress, resolved)
 */
export async function GET(request: Request) {
  const auth = await requireAuth()
  if (!auth.authenticated) return auth.response

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')
  const status = searchParams.get('status')
  const mine = searchParams.get('mine') === 'true'
  const sort = searchParams.get('sort') || 'recent'
  const roadmap = searchParams.get('roadmap') === 'true'

  try {
    // Build query with vote_count included
    let query = supabase
      .from('feedback')
      .select('*')

    // Filter by type if provided
    if (type && ['bug', 'feature', 'question'].includes(type)) {
      query = query.eq('type', type)
    }

    // Filter by status if provided
    if (status) {
      query = query.eq('status', status)
    }

    // Roadmap mode: only show items on the roadmap
    if (roadmap) {
      query = query.in('status', ['reviewed', 'in_progress', 'resolved'])
    }

    // Filter to user's own feedback if requested
    if (mine) {
      query = query.eq('submitted_by_email', auth.user.email)
    }

    // Sort by votes or recent
    if (sort === 'votes') {
      query = query.order('vote_count', { ascending: false })
        .order('created_at', { ascending: false })
    } else {
      query = query.order('created_at', { ascending: false })
    }

    const { data: feedback, error } = await query.limit(100)

    if (error) {
      console.error('Error fetching feedback:', error)
      return ApiErrors.database(error.message)
    }

    // Get current user's votes to mark which items they've voted on
    const feedbackIds = (feedback || []).map(f => f.id)
    let userVotes: Set<string> = new Set()

    if (feedbackIds.length > 0) {
      const { data: votes } = await supabase
        .from('feature_votes')
        .select('feedback_id')
        .eq('user_email', auth.user.email)
        .in('feedback_id', feedbackIds)

      if (votes) {
        userVotes = new Set(votes.map(v => v.feedback_id))
      }
    }

    // Add has_voted flag to each feedback item
    const feedbackWithVotes = (feedback || []).map(f => ({
      ...f,
      has_voted: userVotes.has(f.id),
    }))

    return apiSuccess({ feedback: feedbackWithVotes }, 200, {
      'Cache-Control': 'private, max-age=30, stale-while-revalidate=120',
    })
  } catch (error) {
    console.error('Error in GET /api/feedback:', error)
    return ApiErrors.internal()
  }
}
