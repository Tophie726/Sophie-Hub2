'use client'

import { useSession } from 'next-auth/react'
import { useTheme } from 'next-themes'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/page-header'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Sun, Moon, Monitor, Shield, ChevronRight, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

function getInitials(name?: string | null): string {
  if (!name) return '?'
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export default function SettingsPage() {
  const { data: session } = useSession()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Check admin status from API (since ADMIN_EMAILS isn't a NEXT_PUBLIC env var)
  const checkAdminStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/me')
      if (response.ok) {
        const data = await response.json()
        setIsAdmin(data.user?.isAdmin || false)
      }
    } catch (error) {
      console.error('Failed to check admin status:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    setMounted(true)
    checkAdminStatus()
  }, [checkAdminStatus])

  const themes = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ]

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Settings"
        description="Manage your account and preferences"
      />

      <div className="p-4 md:p-8 max-w-3xl space-y-6">
        {/* Profile Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-lg">
                👤
              </span>
              Profile
            </CardTitle>
            <CardDescription>Your account information from Google</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage
                  src={session?.user?.image || undefined}
                  alt={session?.user?.name || 'User'}
                />
                <AvatarFallback className="bg-primary/10 text-primary text-lg font-medium">
                  {getInitials(session?.user?.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold truncate">
                  {session?.user?.name || 'Loading...'}
                </h3>
                <p className="text-sm text-muted-foreground truncate">
                  {session?.user?.email}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Signed in with Google
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Appearance Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-lg">
                🎨
              </span>
              Appearance
            </CardTitle>
            <CardDescription>Customize how Sophie Hub looks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-3 block">Theme</label>
                <div className="flex gap-2">
                  {themes.map(({ value, label, icon: Icon }) => (
                    <Button
                      key={value}
                      variant={mounted && theme === value ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTheme(value)}
                      className={cn(
                        'flex-1 gap-2',
                        mounted && theme === value && 'bg-primary text-primary-foreground'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Admin Settings Link (only for admins) */}
        {isLoading ? (
          <Card className="border-muted">
            <CardContent className="py-6">
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Checking permissions...</span>
              </div>
            </CardContent>
          </Card>
        ) : isAdmin && (
          <Card className="border-orange-500/20 bg-orange-500/5">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
                <Shield className="h-5 w-5" />
                Admin Settings
              </CardTitle>
              <CardDescription>
                Configure API keys and system settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/admin/settings">
                <Button variant="outline" className="w-full justify-between group">
                  <span className="flex items-center gap-2">
                    Open Admin Settings
                  </span>
                  <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
