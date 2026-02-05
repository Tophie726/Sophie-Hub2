import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth/api-auth'
import { apiSuccess, apiError, apiValidationError } from '@/lib/api/response'
import { getAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

const CommentSchema = z.object({
  content: z.string().min(1, 'Comment cannot be empty').max(2000),
})

/**
 * GET /api/feedback/[id]/comments
 * Get all comments for a feedback item
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth()
  if (!auth.authenticated) {
    return auth.response
  }

  const { id } = await params
  const supabase = getAdminClient()

  const { data: comments, error } = await supabase
    .from('feedback_comments')
    .select('*')
    .eq('feedback_id', id)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Failed to fetch comments:', error)
    return apiError('DATABASE_ERROR', 'Failed to fetch comments', 500)
  }

  return apiSuccess({ comments })
}

/**
 * POST /api/feedback/[id]/comments
 * Add a comment to a feedback item
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth()
  if (!auth.authenticated) {
    return auth.response
  }

  const { id } = await params

  // Parse and validate request
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError('INVALID_JSON', 'Invalid JSON in request body', 400)
  }

  const validation = CommentSchema.safeParse(body)
  if (!validation.success) {
    return apiValidationError(validation.error)
  }

  const { content } = validation.data
  const supabase = getAdminClient()

  // Check if this user is the original submitter
  const { data: feedback } = await supabase
    .from('feedback')
    .select('submitted_by_email')
    .eq('id', id)
    .single()

  const isFromSubmitter = feedback?.submitted_by_email === auth.user.email

  // Insert comment
  const { data: comment, error } = await supabase
    .from('feedback_comments')
    .insert({
      feedback_id: id,
      user_email: auth.user.email,
      content,
      is_from_submitter: isFromSubmitter,
    })
    .select()
    .single()

  if (error) {
    console.error('Failed to add comment:', error)
    return apiError('DATABASE_ERROR', 'Failed to add comment', 500)
  }

  return apiSuccess({ comment }, 201)
}
