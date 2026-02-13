import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth/config'

/**
 * Preview route group layout.
 *
 * - Verifies admin session exists (server-side)
 * - Does NOT render MainLayout — preview has its own shell
 * - Detailed admin/token checks happen in the preview page itself
 */
export default async function PreviewLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    redirect('/login.html')
  }

  return <>{children}</>
}
