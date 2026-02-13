import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth/config'
import { getSheetData } from '@/lib/google/sheets'
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
    const headerRowParam = searchParams.get('headerRow')
    const headerRow = headerRowParam ? parseInt(headerRowParam, 10) : 0

    if (!spreadsheetId || !tabName) {
      return NextResponse.json(
        { error: 'Missing spreadsheet ID or tab name' },
        { status: 400 }
      )
    }

    const data = await getSheetData(accessToken, spreadsheetId, tabName, headerRow)

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error getting tab data:', error)
    return NextResponse.json(
      { error: 'Failed to get tab data' },
      { status: 500 }
    )
  }
}
