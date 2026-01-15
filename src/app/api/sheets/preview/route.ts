import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth/config'
import { getSheetPreview } from '@/lib/google/sheets'

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

    if (!spreadsheetId) {
      return NextResponse.json(
        { error: 'Missing spreadsheet ID' },
        { status: 400 }
      )
    }

    const preview = await getSheetPreview(session.accessToken, spreadsheetId)

    return NextResponse.json({ preview })
  } catch (error) {
    console.error('Error getting sheet preview:', error)
    return NextResponse.json(
      { error: 'Failed to get sheet preview' },
      { status: 500 }
    )
  }
}
