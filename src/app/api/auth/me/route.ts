import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/api-auth'
import { ROLES } from '@/lib/auth/roles'

interface SessionUser {
  name?: string | null
  email?: string | null
  image?: string | null
}

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

  // Get image from NextAuth session (cast to expected shape)
  const session = auth.session as { user?: SessionUser } | null
  const sessionImage = session?.user?.image

  return NextResponse.json({
    user: {
      ...auth.user,
      isAdmin: auth.user.role === ROLES.ADMIN,
    },
    session: {
      email: auth.user.email,
      name: auth.user.name,
      image: sessionImage,
    },
  })
}
