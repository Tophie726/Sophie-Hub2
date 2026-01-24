import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/api-auth'

/**
 * GET /api/auth/me
 * Returns the current authenticated user's info
 * Used for debugging auth and role assignment
 */
export async function GET() {
  const auth = await requireAuth()

  if (!auth.authenticated) {
    return auth.response
  }

  // Return the authenticated user info
  // auth.user has all the info we need (email, name, role)
  return NextResponse.json({
    user: auth.user,
    session: {
      email: auth.user.email,
      name: auth.user.name,
    },
  })
}
