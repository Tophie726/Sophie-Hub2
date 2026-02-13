import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth/config'
import { getSheetRawRows, detectHeaderRow } from '@/lib/google/sheets'
import { mapSheetsAuthError, resolveSheetsAccessToken } from '@/lib/google/sheets-auth'
import { checkSheetsRateLimit, rateLimitHeaders } from '@/lib/rate-limit'

interface GoogleApiError {
  message?: string
  response?: {
    status?: number
    data?: {
      error?: {
        message?: string
        status?: string
      }
    }
  }
}

function getGoogleApiErrorResponse(error: unknown): { status: number; message: string } {
  const e = (error ?? {}) as GoogleApiError
  const status = e.response?.status
  const apiMessage = e.response?.data?.error?.message || e.message || ''
  const normalizedMessage = apiMessage.toLowerCase()

  if (status === 401) {
    return {
      status: 401,
      message: 'Google session expired. Please sign out and sign back in.',
    }
  }

  if (status === 403) {
    return {
      status: 403,
      message: 'Your Google account does not have access to this spreadsheet/tab. Ask the sheet owner to share it with your email, then refresh and try again.',
    }
  }

  if (status === 404) {
    return {
      status: 404,
      message: 'Spreadsheet or tab not found. It may have been removed or renamed.',
    }
  }

  if (status === 400 && normalizedMessage.includes('unable to parse range')) {
    return {
      status: 400,
      message: 'This tab name is no longer valid in Google Sheets. Re-open the source and select the updated tab.',
    }
  }

  if (status === 429) {
    return {
      status: 429,
      message: 'Google Sheets API rate limit reached. Please wait and try again.',
    }
  }

  return {
    status: 500,
    message: 'Failed to get raw rows',
  }
}

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

    if (!spreadsheetId || !tabName) {
      return NextResponse.json(
        { error: 'Missing spreadsheet ID or tab name' },
        { status: 400 }
      )
    }

    const data = await getSheetRawRows(accessToken, spreadsheetId, tabName)
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
    const mappedError = getGoogleApiErrorResponse(error)
    return NextResponse.json(
      { error: mappedError.message },
      { status: mappedError.status }
    )
  }
}
