import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { MainLayout } from '@/components/layout/main-layout'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Auth bypass for mobile access - TODO: remove when done
  // const session = await getServerSession(authOptions)
  // if (!session) {
  //   redirect('/api/auth/signin')
  // }

  return <MainLayout>{children}</MainLayout>
}
