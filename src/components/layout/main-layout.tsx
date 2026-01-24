'use client'

import { motion } from 'framer-motion'
import { Menu } from 'lucide-react'
import { Sidebar } from './sidebar'
import { MobileMenuProvider, useMobileMenu } from './mobile-menu-context'
import { ErrorBoundary } from '@/components/error-boundary'

const easeOut: [number, number, number, number] = [0.22, 1, 0.36, 1]

interface MainLayoutProps {
  children: React.ReactNode
}

function MobileHeader() {
  const { toggle } = useMobileMenu()

  return (
    <div className="md:hidden fixed top-0 left-0 right-0 h-14 z-40 border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
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

function MainLayoutContent({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <MobileHeader />
      <main className="pl-0 md:pl-64">
        <motion.div
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: easeOut }}
          className="min-h-screen pt-14 md:pt-0"
        >
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </motion.div>
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
