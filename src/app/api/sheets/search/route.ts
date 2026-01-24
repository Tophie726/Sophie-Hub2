import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth/config'
import { searchSheets } from '@/lib/google/sheets'
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

    // Check rate limit
    const userId = session.user?.email || 'anonymous'
    const rateLimitResult = checkSheetsRateLimit(userId)
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: `Rate limit exceeded. Please wait ${Math.ceil(rateLimitResult.resetIn / 1000)} seconds.` },
        { status: 429, headers: rateLimitHeaders(rateLimitResult) }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q') || ''

    const sheets = await searchSheets(session.accessToken, query)

    return NextResponse.json({ sheets })
  } catch (error) {
    console.error('Error searching sheets:', error)
    return NextResponse.json(
      { error: 'Failed to search sheets' },
      { status: 500 }
    )
  }
}
