import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { isValidStagingGateCookie } from '@/lib/security/staging-gate'

const COOKIE_NAME = 'sophie-hub-access'

// Paths that don't require the staging password
const PUBLIC_PATHS = [
  '/password',
  '/api/gate/verify',
  '/api/health',
  '/_next',
  '/favicon.ico',
  '/login.html',
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Check if STAGING_PASSWORD is set (via edge config or env)
  const stagingPassword = process.env.STAGING_PASSWORD

  // If no password configured, skip gate entirely
  if (!stagingPassword) {
    return NextResponse.next()
  }

  // Allow public paths
  if (PUBLIC_PATHS.some(path => pathname.startsWith(path))) {
    return NextResponse.next()
  }

  // Check for auth cookie
  const accessCookie = request.cookies.get(COOKIE_NAME)

  const hasValidGateCookie = await isValidStagingGateCookie(accessCookie?.value ?? '', stagingPassword)

  if (hasValidGateCookie) {
    return NextResponse.next()
  }

  // Redirect to password page
  const url = request.nextUrl.clone()
  url.pathname = '/password'
  return NextResponse.redirect(url)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
