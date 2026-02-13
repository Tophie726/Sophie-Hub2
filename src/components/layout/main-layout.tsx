'use client'

import { useEffect, useState } from 'react'
import { Menu } from 'lucide-react'
import { Sidebar } from './sidebar'
import { MobileMenuProvider, useMobileMenu } from './mobile-menu-context'
import { ErrorBoundary } from '@/components/error-boundary'
import { captureError } from '@/lib/posthog'
import { ViewerContextBadge } from './viewer-context-badge'
import type { Role } from '@/lib/auth/roles'

interface MainLayoutProps {
  children: React.ReactNode
}

function MobileHeader() {
  const { toggle } = useMobileMenu()

  return (
    <div className="md:hidden fixed top-0 left-0 right-0 h-14 z-40 border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 pt-safe">
      <div className="flex items-center h-full px-4 gap-3">
        <button
          onClick={toggle}
          className="flex items-center justify-center w-10 h-10 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          aria-label="Toggle menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-semibold text-xs">
            SH
          </div>
          <span className="font-semibold text-sm">Sophie Hub</span>
        </div>
      </div>
    </div>
  )
}

// Module-level cache for user role (mirrors sidebar pattern)
let cachedLayoutRole: Role | undefined = undefined

function MainLayoutContent({ children }: MainLayoutProps) {
  const [userRole, setUserRole] = useState<Role | undefined>(cachedLayoutRole)

  useEffect(() => {
    if (cachedLayoutRole !== undefined) {
      setUserRole(cachedLayoutRole)
      return
    }
    fetch('/api/auth/me')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        const role = data?.user?.role as Role | undefined
        cachedLayoutRole = role
        setUserRole(role)
      })
      .catch(() => {})
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <MobileHeader />
      <main className="pl-0 md:pl-64">
        <div className="min-h-screen pt-14 md:pt-0">
          {/* Viewer context badge - visible across all pages */}
          <ViewerContextBadge userRole={userRole} />
          <ErrorBoundary
            onError={(error, errorInfo) => {
              captureError(error, { componentStack: errorInfo.componentStack })
            }}
          >
            {children}
          </ErrorBoundary>
        </div>
      </main>
    </div>
  )
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <MobileMenuProvider>
      <MainLayoutContent>{children}</MainLayoutContent>
    </MobileMenuProvider>
  )
}
