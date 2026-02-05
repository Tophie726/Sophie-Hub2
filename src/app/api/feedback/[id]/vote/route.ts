import { getAdminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth/api-auth'
import { apiSuccess, ApiErrors } from '@/lib/api/response'

const supabase = getAdminClient()

/**
 * POST /api/feedback/[id]/vote
 * Add vote to feedback (current user)
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth()
  if (!auth.authenticated) return auth.response

  const { id } = await params

  try {
    // Check if feedback exists
    const { data: feedback, error: feedbackError } = await supabase
      .from('feedback')
      .select('id')
      .eq('id', id)
      .single()

    if (feedbackError || !feedback) {
      return ApiErrors.notFound('Feedback')
    }

    // Check if user already voted
    const { data: existingVote } = await supabase
      .from('feature_votes')
      .select('id')
      .eq('feedback_id', id)
      .eq('user_email', auth.user.email)
      .single()

    if (existingVote) {
      return ApiErrors.conflict('You have already voted on this idea')
    }

    // Add vote
    const { error: voteError } = await supabase
      .from('feature_votes')
      .insert({
        feedback_id: id,
        user_email: auth.user.email,
      })

    if (voteError) {
      console.error('Error adding vote:', voteError)
      return ApiErrors.database(voteError.message)
    }

    // Get updated vote count
    const { data: updated } = await supabase
      .from('feedback')
      .select('vote_count')
      .eq('id', id)
      .single()

    return apiSuccess({
      voted: true,
      vote_count: updated?.vote_count || 1
    }, 201)
  } catch (error) {
    console.error('Error in POST /api/feedback/[id]/vote:', error)
    return ApiErrors.internal()
  }
}

/**
 * DELETE /api/feedback/[id]/vote
 * Remove vote from feedback (current user)
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth()
  if (!auth.authenticated) return auth.response

  const { id } = await params

  try {
    // Check if user has voted
    const { data: existingVote } = await supabase
      .from('feature_votes')
      .select('id')
      .eq('feedback_id', id)
      .eq('user_email', auth.user.email)
      .single()

    if (!existingVote) {
      return ApiErrors.notFound('Vote')
    }

    // Remove vote
    const { error: deleteError } = await supabase
      .from('feature_votes')
      .delete()
      .eq('feedback_id', id)
      .eq('user_email', auth.user.email)

    if (deleteError) {
      console.error('Error removing vote:', deleteError)
      return ApiErrors.database(deleteError.message)
    }

    // Get updated vote count
    const { data: updated } = await supabase
      .from('feedback')
      .select('vote_count')
      .eq('id', id)
      .single()

    return apiSuccess({
      voted: false,
      vote_count: updated?.vote_count || 0
    })
  } catch (error) {
    console.error('Error in DELETE /api/feedback/[id]/vote:', error)
    return ApiErrors.internal()
  }
}

/**
 * GET /api/feedback/[id]/vote
 * Check if current user has voted
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth()
  if (!auth.authenticated) return auth.response

  const { id } = await params

  try {
    const { data: vote } = await supabase
      .from('feature_votes')
      .select('id')
      .eq('feedback_id', id)
      .eq('user_email', auth.user.email)
      .single()

    return apiSuccess({ voted: !!vote })
  } catch (error) {
    console.error('Error in GET /api/feedback/[id]/vote:', error)
    return ApiErrors.internal()
  }
}
