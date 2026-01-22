import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth/config'
import { getSheetRawRows, detectHeaderRow } from '@/lib/google/sheets'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.accessToken) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
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
    })
  } catch (error) {
    console.error('Error getting raw rows:', error)
    return NextResponse.json(
      { error: 'Failed to get raw rows' },
      { status: 500 }
    )
  }
}
