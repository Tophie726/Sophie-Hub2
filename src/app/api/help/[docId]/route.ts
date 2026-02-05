import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth/api-auth'
import { apiSuccess, ApiErrors } from '@/lib/api/response'
import { getAdminClient } from '@/lib/supabase/admin'

const supabase = getAdminClient()

/**
 * GET /api/help/[docId]
 *
 * Fetches a help document by its doc_id.
 * Returns the document with its content (steps, tips, etc.)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { docId: string } }
) {
  const auth = await requireAuth()
  if (!auth.authenticated) return auth.response

  const { docId } = params

  try {
    const { data, error } = await supabase
      .from('help_docs')
      .select('*')
      .eq('doc_id', docId)
      .not('published_at', 'is', null) // Only return published docs
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return ApiErrors.notFound('Help document')
      }
      console.error('Error fetching help doc:', error)
      return ApiErrors.database(error.message)
    }

    return apiSuccess({
      doc: {
        id: data.id,
        doc_id: data.doc_id,
        title: data.title,
        content: data.content,
        route_pattern: data.route_pattern,
        scope: data.scope,
        category: data.category,
        ai_generated: data.ai_generated,
        ai_confidence: data.ai_confidence,
        version: data.version,
        updated_at: data.updated_at,
      }
    })
  } catch (error) {
    console.error('Error in GET /api/help/[docId]:', error)
    return ApiErrors.internal()
  }
}
