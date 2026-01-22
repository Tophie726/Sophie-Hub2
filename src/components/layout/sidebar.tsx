'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  LayoutDashboard,
  Users,
  UserCircle,
  Database,
  Settings,
  ChevronRight,
  Building2,
  Calendar,
  FileSpreadsheet,
  TrendingUp,
  MessageSquare,
  GraduationCap,
  Lightbulb,
  LogOut,
} from 'lucide-react'

const navigation = [
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
      { name: 'Team', href: '/team', icon: UserCircle },
    ],
  },
  {
    title: 'Operations',
    items: [
      { name: 'PTO Calendar', href: '/pto', icon: Calendar },
      { name: 'Reporting', href: '/reporting', icon: TrendingUp },
      { name: 'Feedback', href: '/feedback', icon: MessageSquare },
    ],
  },
  {
    title: 'Admin',
    items: [
      { name: 'Data Enrichment', href: '/admin/data-enrichment', icon: Database, highlight: true },
      { name: 'Education', href: '/education', icon: GraduationCap },
      { name: 'Roadmap', href: '/roadmap', icon: Lightbulb },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <motion.aside
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      >
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
                              layoutId="activeNav"
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
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: '/' })}
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </motion.aside>
  )
}
