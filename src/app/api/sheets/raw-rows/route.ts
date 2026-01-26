import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth/config'
import { getSheetRawRows, detectHeaderRow } from '@/lib/google/sheets'
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

    // Check if token refresh failed - user needs to re-authenticate
    if (session.error === 'RefreshAccessTokenError') {
      return NextResponse.json(
        { error: 'Session expired. Please sign out and sign back in.' },
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
    const spreadsheetId = searchParams.get('id')
    const tabName = searchParams.get('tab')

    if (!spreadsheetId || !tabName) {
      return NextResponse.json(
        { error: 'Missing spreadsheet ID or tab name' },
        { status: 400 }
      )
    }

    const data = await getSheetRawRows(session.accessToken, spreadsheetId, tabName)
    const headerDetection = detectHeaderRow(data.rows)

    return NextResponse.json({
      rows: data.rows,
      totalRows: data.totalRows,
      detectedHeaderRow: headerDetection.rowIndex,
      headerConfidence: headerDetection.confidence,
      headerReasons: headerDetection.reasons,
    }, {
      headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' },
    })
  } catch (error) {
    console.error('Error getting raw rows:', error)
    return NextResponse.json(
      { error: 'Failed to get raw rows' },
      { status: 500 }
    )
  }
}
