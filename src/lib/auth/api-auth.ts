import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from './config'

/**
 * Check if the request is authenticated.
 * Returns the session if authenticated, or a 401 response if not.
 */
export async function requireAuth() {
  const session = await getServerSession(authOptions)

  if (!session) {
    return {
      authenticated: false as const,
      response: NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      ),
    }
  }

  return {
    authenticated: true as const,
    session,
  }
}
