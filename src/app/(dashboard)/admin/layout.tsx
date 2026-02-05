import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { createClient } from '@supabase/supabase-js'
import { authOptions } from '@/lib/auth/config'

// Server-side Supabase client for auth lookups
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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
  // Check ADMIN_EMAILS env var first (highest priority)
  const adminEmails = process.env.ADMIN_EMAILS?.split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean) ?? []

  if (adminEmails.includes(email.toLowerCase())) {
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
