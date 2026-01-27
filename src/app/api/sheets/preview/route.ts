import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth/config'
import { getSheetPreview } from '@/lib/google/sheets'
import { checkSheetsRateLimit, rateLimitHeaders } from '@/lib/rate-limit'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.accessToken) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Check rate limit using user email as key
    const userId = session.user?.email || 'anonymous'
    const rateLimitResult = checkSheetsRateLimit(userId)
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: `Rate limit exceeded. Please wait ${Math.ceil(rateLimitResult.resetIn / 1000)} seconds.` },
        { status: 429, headers: rateLimitHeaders(rateLimitResult) }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const spreadsheetId = searchParams.get('id')

    if (!spreadsheetId) {
      return NextResponse.json(
        { error: 'Missing spreadsheet ID' },
        { status: 400 }
      )
    }

    const preview = await getSheetPreview(session.accessToken, spreadsheetId)

    return NextResponse.json({ preview }, {
      headers: {
        'Cache-Control': 'private, max-age=300, stale-while-revalidate=600',
      },
    })
  } catch (error) {
    console.error('Error getting sheet preview:', error)
    return NextResponse.json(
      { error: 'Failed to get sheet preview' },
      { status: 500 }
    )
  }
}
