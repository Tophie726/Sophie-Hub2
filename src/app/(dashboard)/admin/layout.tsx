import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { getAdminClient } from '@/lib/supabase/admin'
import { isAdminEmail } from '@/lib/auth/admin-access'

// Server-side Supabase client for auth lookups
const supabase = getAdminClient()

/**
 * Admin layout - protects all /admin/* routes
 * Redirects non-admin users to dashboard with error message
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.email) {
    redirect('/login.html')
  }

  // Check if user is admin
  const isAdmin = await checkIsAdmin(session.user.email)

  if (!isAdmin) {
    // Redirect non-admins to dashboard
    redirect('/dashboard?error=unauthorized')
  }

  return <>{children}</>
}

/**
 * Check if user has admin role
 * Uses same logic as api-auth.ts mapRoleToAccessLevel
 */
async function checkIsAdmin(email: string): Promise<boolean> {
  // Check configured admin emails first (static allowlist + ADMIN_EMAILS env var)
  if (isAdminEmail(email)) {
    return true
  }

  // Look up user in staff table
  const { data: staffUser } = await supabase
    .from('staff')
    .select('role')
    .eq('email', email)
    .single()

  if (staffUser?.role) {
    const role = staffUser.role.toLowerCase()
    return role === 'admin' || role === 'operations_admin'
  }

  return false
}
