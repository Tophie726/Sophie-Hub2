'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { signOut } from 'next-auth/react'
import { useTheme } from 'next-themes'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  LayoutDashboard,
  Users,
  Database,
  ChevronRight,
  Building2,
  LogOut,
  Sun,
  Moon,
  Monitor,
  X,
} from 'lucide-react'
import { useMobileMenu } from './mobile-menu-context'

interface NavItem {
  name: string
  href: string
  icon: typeof LayoutDashboard
  highlight?: boolean
}

interface NavSection {
  title: string
  items: NavItem[]
}

const navigation: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    ],
  },
  {
    title: 'Core',
    items: [
      { name: 'Partners', href: '/partners', icon: Building2 },
      { name: 'Staff', href: '/staff', icon: Users },
    ],
  },
  {
    title: 'Admin',
    items: [
      { name: 'Data Enrichment', href: '/admin/data-enrichment', icon: Database, highlight: true },
    ],
  },
]

const easeOut: [number, number, number, number] = [0.22, 1, 0.36, 1]

interface SidebarContentProps {
  onNavigate?: () => void
  layoutId?: string
}

function SidebarContent({ onNavigate, layoutId = 'activeNav' }: SidebarContentProps) {
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Avoid hydration mismatch by only rendering theme icon after mount
  useEffect(() => {
    setMounted(true)
  }, [])

  // Cycle through themes: light -> dark -> system
  const cycleTheme = () => {
    if (theme === 'light') setTheme('dark')
    else if (theme === 'dark') setTheme('system')
    else setTheme('light')
  }

  const getThemeIcon = () => {
    // Return consistent icon on server to avoid hydration mismatch
    if (!mounted) return Sun
    if (theme === 'light') return Sun
    if (theme === 'dark') return Moon
    return Monitor
  }

  const getThemeLabel = () => {
    if (!mounted) return 'Theme'
    if (theme === 'light') return 'Light mode'
    if (theme === 'dark') return 'Dark mode'
    return 'System'
  }

  const ThemeIcon = getThemeIcon()

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-border/40 px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-semibold text-sm">
          SH
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold">Sophie Hub</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">v2.0</span>
        </div>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-6">
          {navigation.map((section) => (
            <div key={section.title}>
              <h4 className="mb-2 px-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                {section.title}
              </h4>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                  const Icon = item.icon

                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={onNavigate}
                      className={cn(
                        'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                        isActive
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                        item.highlight && !isActive && 'text-orange-500/80 hover:text-orange-500'
                      )}
                    >
                      {isActive && (
                        <motion.div
                          layoutId={layoutId}
                          className="absolute inset-0 rounded-lg bg-primary/10"
                          transition={{ type: 'spring', bounce: 0.15, duration: 0.5 }}
                        />
                      )}
                      <Icon className={cn(
                        'relative h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-110',
                        item.highlight && !isActive && 'text-orange-500'
                      )} />
                      <span className="relative">{item.name}</span>
                      {item.highlight && (
                        <span className="relative ml-auto flex h-2 w-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-75"></span>
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-orange-500"></span>
                        </span>
                      )}
                      {isActive && (
                        <ChevronRight className="relative ml-auto h-4 w-4 opacity-50" />
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>
      </ScrollArea>

      {/* User Section */}
      <div className="border-t border-border/40 p-4">
        <div className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-accent">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
              TN
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-1 flex-col">
            <span className="text-sm font-medium">Tomas Norton</span>
            <span className="text-xs text-muted-foreground">Admin</span>
          </div>
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={cycleTheme}
                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={theme}
                      initial={{ scale: 0.8, opacity: 0, rotate: -30 }}
                      animate={{ scale: 1, opacity: 1, rotate: 0 }}
                      exit={{ scale: 0.8, opacity: 0, rotate: 30 }}
                      transition={{ duration: 0.15, ease: easeOut }}
                    >
                      <ThemeIcon className="h-4 w-4" />
                    </motion.div>
                  </AnimatePresence>
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>{getThemeLabel()}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: `${window.location.origin}/signin` })}
                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>Sign out</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  )
}

function MobileSidebar() {
  const { isOpen, close } = useMobileMenu()
  const pathname = usePathname()

  // Close on route change
  useEffect(() => {
    close()
  }, [pathname, close])

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: easeOut }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={close}
          />

          {/* Drawer */}
          <motion.aside
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ duration: 0.3, ease: easeOut }}
            className="absolute left-0 top-0 h-full w-[280px] border-r border-border/40 bg-background shadow-xl"
          >
            {/* Close button */}
            <button
              onClick={close}
              className="absolute right-3 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>

            <SidebarContent onNavigate={close} layoutId="activeNavMobile" />
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  )
}

function DesktopSidebar() {
  return (
    <motion.aside
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="hidden md:block fixed left-0 top-0 z-40 h-screen w-64 border-r border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
    >
      <SidebarContent layoutId="activeNavDesktop" />
    </motion.aside>
  )
}

export function Sidebar() {
  return (
    <>
      <DesktopSidebar />
      <MobileSidebar />
    </>
  )
}
