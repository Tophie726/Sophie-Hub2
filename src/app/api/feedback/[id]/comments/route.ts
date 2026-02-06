import { NextRequest } from 'next/server'
import { requireAuth, requireRole } from '@/lib/auth/api-auth'
import { ROLES } from '@/lib/auth/roles'
import { apiSuccess, apiError, apiValidationError } from '@/lib/api/response'
import { getAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

const AttachmentSchema = z.object({
  type: z.enum(['image', 'drawing', 'file']),
  url: z.string().refine(
    (url) => {
      const lower = url.toLowerCase().trim()
      if (lower.startsWith('http://') || lower.startsWith('https://')) return true
      if (lower.startsWith('data:image/') || lower.startsWith('data:application/pdf')) return true
      return false
    },
    { message: 'URL must use http/https or be a data:image/data:pdf URI' }
  ),
  name: z.string().optional(),
})

const CommentSchema = z.object({
  content: z.string().max(2000).optional().default(''),
  is_internal: z.boolean().optional().default(false),
  parent_id: z.string().uuid().optional().nullable(),
  attachments: z.array(AttachmentSchema).optional().default([]),
}).refine(
  data => data.content.trim().length > 0 || (data.attachments && data.attachments.length > 0),
  { message: 'Comment must have content or attachments' }
)

/**
 * GET /api/feedback/[id]/comments
 * Get all comments for a feedback item
 * - Regular users only see non-internal comments
 * - Admins see all comments including internal ones
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

  // Check if user is admin
  const adminAuth = await requireRole(ROLES.ADMIN)
  const isAdmin = adminAuth.authenticated

  // Build query
  let query = supabase
    .from('feedback_comments')
    .select('*')
    .eq('feedback_id', id)
    .order('created_at', { ascending: true })

  // Non-admins only see non-internal comments
  if (!isAdmin) {
    query = query.eq('is_internal', false)
  }

  const { data: comments, error } = await query

  if (error) {
    console.error('Failed to fetch comments:', error)
    return apiError('DATABASE_ERROR', 'Failed to fetch comments', 500)
  }

  // Organize comments into threads (top-level and replies)
  const topLevel = comments?.filter(c => !c.parent_id) || []
  const replies = comments?.filter(c => c.parent_id) || []

  // Group replies by parent
  const repliesByParent: Record<string, typeof comments> = {}
  for (const reply of replies) {
    if (!repliesByParent[reply.parent_id]) {
      repliesByParent[reply.parent_id] = []
    }
    repliesByParent[reply.parent_id].push(reply)
  }

  // Attach replies to their parents
  const threaded = topLevel.map(comment => ({
    ...comment,
    replies: repliesByParent[comment.id] || [],
  }))

  return apiSuccess({ comments: threaded, isAdmin })
}

/**
 * POST /api/feedback/[id]/comments
 * Add a comment to a feedback item
 * - Regular users can only add non-internal comments
 * - Admins can add internal (admin-only) comments
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

  const { content, is_internal, parent_id, attachments } = validation.data

  // Check if user is admin (required for internal comments)
  const adminAuth = await requireRole(ROLES.ADMIN)
  const isAdmin = adminAuth.authenticated

  // Non-admins cannot create internal comments
  if (is_internal && !isAdmin) {
    return apiError('FORBIDDEN', 'Only admins can create internal comments', 403)
  }

  const supabase = getAdminClient()

  // Check if this user is the original submitter
  const { data: feedback } = await supabase
    .from('feedback')
    .select('submitted_by_email')
    .eq('id', id)
    .single()

  const isFromSubmitter = feedback?.submitted_by_email === auth.user.email

  // If replying, verify parent comment exists and belongs to same feedback
  if (parent_id) {
    const { data: parentComment } = await supabase
      .from('feedback_comments')
      .select('feedback_id')
      .eq('id', parent_id)
      .single()

    if (!parentComment || parentComment.feedback_id !== id) {
      return apiError('NOT_FOUND', 'Parent comment not found', 404)
    }
  }

  // Insert comment
  const { data: comment, error } = await supabase
    .from('feedback_comments')
    .insert({
      feedback_id: id,
      user_email: auth.user.email,
      content,
      is_from_submitter: isFromSubmitter,
      is_internal: is_internal || false,
      parent_id: parent_id || null,
      attachments: attachments.length > 0 ? attachments : null,
    })
    .select()
    .single()

  if (error) {
    console.error('Failed to add comment:', error)
    return apiError('DATABASE_ERROR', 'Failed to add comment', 500)
  }

  return apiSuccess({ comment }, 201)
}

/**
 * DELETE /api/feedback/[id]/comments
 * Delete a comment (admin only)
 */
export async function DELETE(
  request: NextRequest,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(ROLES.ADMIN)
  if (!auth.authenticated) {
    return auth.response
  }

  const url = new URL(request.url)
  const commentId = url.searchParams.get('commentId')

  if (!commentId) {
    return apiError('VALIDATION_ERROR', 'commentId is required', 400)
  }

  const supabase = getAdminClient()

  const { error } = await supabase
    .from('feedback_comments')
    .delete()
    .eq('id', commentId)

  if (error) {
    console.error('Failed to delete comment:', error)
    return apiError('DATABASE_ERROR', 'Failed to delete comment', 500)
  }

  return apiSuccess({ deleted: true })
}
