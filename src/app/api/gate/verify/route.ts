import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const STAGING_PASSWORD = process.env.STAGING_PASSWORD || ''
const COOKIE_NAME = 'sophie-hub-access'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

export async function POST(request: NextRequest) {
  // If no password is configured, allow access
  if (!STAGING_PASSWORD) {
    return NextResponse.json({ success: true })
  }

  try {
    const body = await request.json()
    const { password } = body

    if (password === STAGING_PASSWORD) {
      // Set auth cookie
      const cookieStore = await cookies()
      cookieStore.set(COOKIE_NAME, 'authenticated', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: COOKIE_MAX_AGE,
        path: '/',
      })

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
