import { getAdminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth/api-auth'
import { apiSuccess, ApiErrors } from '@/lib/api/response'
import { z } from 'zod'

const supabase = getAdminClient()

const FeedbackSchema = z.object({
  type: z.enum(['bug', 'feature', 'question']),
  title: z.string().nullable().optional(),
  description: z.string().min(1, 'Description is required'),
  page_url: z.string().optional(),
  posthog_session_id: z.string().nullable().optional(),
  browser_info: z.record(z.unknown()).optional(),
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
      return ApiErrors.validation(validation.error.errors.map(e => e.message).join(', '))
    }

    const { type, title, description, page_url, posthog_session_id, browser_info } = validation.data

    const { data, error } = await supabase
      .from('feedback')
      .insert({
        type,
        title,
        description,
        page_url,
        posthog_session_id,
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
 * List feedback - admins see all, users see their own
 */
export async function GET(request: Request) {
  const auth = await requireAuth()
  if (!auth.authenticated) return auth.response

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')
  const status = searchParams.get('status')
  const mine = searchParams.get('mine') === 'true'

  try {
    let query = supabase
      .from('feedback')
      .select('*')
      .order('created_at', { ascending: false })

    // Filter by type if provided
    if (type && ['bug', 'feature', 'question'].includes(type)) {
      query = query.eq('type', type)
    }

    // Filter by status if provided
    if (status) {
      query = query.eq('status', status)
    }

    // If not admin, only show user's own feedback
    const isAdmin = auth.user.role === 'admin'
    if (mine || !isAdmin) {
      query = query.eq('submitted_by_email', auth.user.email)
    }

    const { data, error } = await query.limit(100)

    if (error) {
      console.error('Error fetching feedback:', error)
      return ApiErrors.database(error.message)
    }

    return apiSuccess({ feedback: data || [] })
  } catch (error) {
    console.error('Error in GET /api/feedback:', error)
    return ApiErrors.internal()
  }
}
