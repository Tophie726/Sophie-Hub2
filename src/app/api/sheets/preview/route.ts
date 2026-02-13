import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth/config'
import { getSheetPreview } from '@/lib/google/sheets'
import { mapSheetsAuthError, resolveSheetsAccessToken } from '@/lib/google/sheets-auth'
import { checkSheetsRateLimit, rateLimitHeaders } from '@/lib/rate-limit'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    let accessToken: string
    try {
      const resolved = await resolveSheetsAccessToken(session.accessToken)
      accessToken = resolved.accessToken
    } catch (authError) {
      const mapped = mapSheetsAuthError(authError)
      return NextResponse.json(
        { error: mapped.message },
        { status: mapped.status }
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

    const preview = await getSheetPreview(accessToken, spreadsheetId)

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
