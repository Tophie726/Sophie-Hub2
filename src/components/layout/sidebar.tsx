'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { signOut, useSession } from 'next-auth/react'
import { motion, AnimatePresence } from 'framer-motion'
import posthog from 'posthog-js'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  ChevronRight,
  LogOut,
  Settings,
  X,
} from 'lucide-react'
import { useMobileMenu } from './mobile-menu-context'
import { getNavigationForRole, type NavSection } from '@/lib/navigation/config'
import { ROLES, type Role } from '@/lib/auth/roles'
import type { ViewerContext } from '@/lib/auth/viewer-context'
import { FeedbackButton } from '@/components/feedback'
import { AdminModeControl } from './admin-mode-control'

// Get initials from name
function getInitials(name?: string | null): string {
  if (!name) return '?'
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

const easeOut: [number, number, number, number] = [0.22, 1, 0.36, 1]

// Module-level cache for user role (avoids refetch on navigation)
let cachedUserRole: Role | undefined = undefined
let roleLoadPromise: Promise<Role | undefined> | null = null

async function fetchUserRole(): Promise<Role | undefined> {
  try {
    const res = await fetch('/api/auth/me')
    if (!res.ok) return undefined
    const data = await res.json()
    return data.user?.role as Role | undefined
  } catch {
    return undefined
  }
}

function getUserRole(): Promise<Role | undefined> {
  if (cachedUserRole !== undefined) {
    return Promise.resolve(cachedUserRole)
  }
  if (!roleLoadPromise) {
    roleLoadPromise = fetchUserRole().then(role => {
      cachedUserRole = role
      roleLoadPromise = null
      return role
    })
  }
  return roleLoadPromise
}

function deriveNavRole(
  baseRole: Role | undefined,
  context: ViewerContext | null,
): Role | undefined {
  if (!context) return baseRole

  if (!context.adminModeOn) {
    return baseRole === ROLES.ADMIN ? ROLES.STAFF : baseRole
  }

  if (context.isImpersonating && context.subject?.resolvedRole) {
    return context.subject.resolvedRole
  }

  return baseRole
}

async function fetchViewerContext(): Promise<ViewerContext | null> {
  try {
    const res = await fetch('/api/viewer-context')
    if (!res.ok) return null
    const json = await res.json()
    return (json.data?.viewerContext || null) as ViewerContext | null
  } catch {
    return null
  }
}

export interface SidebarContentProps {
  onNavigate?: () => void
  layoutId?: string
  /** Override navigation sections (used by preview shell). Bypasses role fetching. */
  navOverride?: NavSection[]
  /** Hide profile/admin controls (used by preview shell). */
  hideUserControls?: boolean
  /** Optional identity override used by preview shell to mimic target audience profile. */
  previewIdentity?: {
    name: string
    roleLabel: string
    image?: string | null
  }
}

export function SidebarContent({
  onNavigate,
  layoutId = 'activeNav',
  navOverride,
  hideUserControls,
  previewIdentity,
}: SidebarContentProps) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [userRole, setUserRole] = useState<Role | undefined>(cachedUserRole)
  const [effectiveNavRole, setEffectiveNavRole] = useState<Role | undefined>(cachedUserRole)
  const [filteredNav, setFilteredNav] = useState<NavSection[]>(() => navOverride ?? getNavigationForRole(cachedUserRole))
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)

  // When navOverride changes, update immediately
  useEffect(() => {
    if (navOverride) {
      setFilteredNav(navOverride)
    }
  }, [navOverride])

  // Fetch user role on mount (skip if navOverride provided)
  useEffect(() => {
    if (navOverride) return
    let cancelled = false

    async function load() {
      const [role, context] = await Promise.all([getUserRole(), fetchViewerContext()])
      if (cancelled) return
      setUserRole(role)
      setEffectiveNavRole(deriveNavRole(role, context))
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [navOverride])

  // Listen for viewer context changes (skip if navOverride provided)
  useEffect(() => {
    if (navOverride) return
    let cancelled = false

    async function syncFromContext() {
      const context = await fetchViewerContext()
      if (cancelled) return
      setEffectiveNavRole((currentRole) => deriveNavRole(userRole ?? currentRole, context))
    }

    function handleContextChange() {
      void syncFromContext()
    }

    void syncFromContext()
    window.addEventListener('viewer-context-changed', handleContextChange)

    return () => {
      cancelled = true
      window.removeEventListener('viewer-context-changed', handleContextChange)
    }
  }, [userRole, navOverride])

  // Recompute nav when effective role changes (skip if navOverride provided)
  useEffect(() => {
    if (navOverride) return
    setFilteredNav(getNavigationForRole(effectiveNavRole))
  }, [effectiveNavRole, navOverride])

  // Display role label
  const roleLabel = userRole === 'admin' ? 'Admin' : userRole === 'pod_leader' ? 'PPC Strategist' : 'Staff'
  const displayName = previewIdentity?.name || session?.user?.name || 'Loading...'
  const displayRoleLabel = previewIdentity?.roleLabel || roleLabel
  const avatarImage = previewIdentity?.image || session?.user?.image || undefined
  const isAdmin = !previewIdentity && userRole === 'admin'

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-border/40 px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-semibold text-sm">
          SH
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold">Sophie Hub</span>
          <span className="text-xs text-muted-foreground uppercase tracking-wider">v2.0</span>
        </div>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-6">
          {filteredNav.map((section) => (
            <div key={section.title}>
              <h4 className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
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

      {/* User Section (hidden in preview mode) */}
      {!hideUserControls && <div className={cn(
        'border-t border-border/40 p-3',
        !previewIdentity && 'pb-safe'
      )}>
        <div className="flex items-center gap-2">
          {isAdmin ? (
            <Popover open={profileMenuOpen} onOpenChange={setProfileMenuOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="flex flex-1 items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-accent min-w-0 text-left"
                >
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarImage
                        src={avatarImage}
                        alt={displayName}
                      />
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                        {getInitials(displayName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-1 flex-col min-w-0">
                      <span className="text-sm font-medium truncate leading-tight">
                        {displayName}
                      </span>
                      <span className="text-xs text-muted-foreground leading-tight">{displayRoleLabel}</span>
                    </div>
                  </button>
              </PopoverTrigger>
              <PopoverContent
                side="top"
                align="start"
                className="w-[340px] max-w-[calc(100vw-2rem)] p-0"
              >
                <div className="border-b border-border/60 px-3 py-2.5">
                  <p className="text-sm font-medium">Admin Controls</p>
                </div>
                <AdminModeControl
                  userRole={userRole}
                  menuOpen={profileMenuOpen}
                  onContextApplied={() => setProfileMenuOpen(false)}
                />
              </PopoverContent>
            </Popover>
          ) : (
            <Link
              href="/settings"
              onClick={onNavigate}
              className="flex flex-1 items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-accent min-w-0"
            >
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarImage
                  src={avatarImage}
                  alt={displayName}
                />
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                  {getInitials(displayName)}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-1 flex-col min-w-0">
                <span className="text-sm font-medium truncate leading-tight">
                  {displayName}
                </span>
                <span className="text-xs text-muted-foreground leading-tight">{displayRoleLabel}</span>
              </div>
            </Link>
          )}

          {/* Feedback, Settings & Logout */}
          <div className="flex items-center">
            <FeedbackButton compact />
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href="/settings"
                    onClick={onNavigate}
                    className="shrink-0 rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    aria-label="Settings"
                  >
                    <Settings className="h-4 w-4" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>Settings</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => {
                      // Reset PostHog identity before signing out
                      posthog.reset()
                      signOut({ callbackUrl: `${window.location.origin}/signin` })
                    }}
                    className="shrink-0 rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    aria-label="Sign out"
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
      </div>}
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
    <aside
      className="hidden md:block fixed left-0 top-0 z-40 h-screen w-64 border-r border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
    >
      <SidebarContent layoutId="activeNavDesktop" />
    </aside>
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
