'use client'

import { useSession } from 'next-auth/react'
import { useTheme } from 'next-themes'
import { useEffect, useState, useCallback } from 'react'
import { PageHeader } from '@/components/layout/page-header'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Sun,
  Moon,
  Monitor,
  Key,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
  Loader2,
  Shield,
  ExternalLink,
} from 'lucide-react'
import { toast } from 'sonner'
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

interface ApiKeySetting {
  key: string
  name: string
  description: string
  helpUrl: string
  placeholder: string
  isSet: boolean
  maskedValue?: string
  lastUpdated?: string
}

export default function SettingsPage() {
  const { data: session } = useSession()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isCheckingAdmin, setIsCheckingAdmin] = useState(true)

  // API Key state
  const [apiSettings, setApiSettings] = useState<ApiKeySetting[]>([
    {
      key: 'anthropic_api_key',
      name: 'Anthropic (Claude)',
      description: 'Powers AI mapping suggestions in Data Enrichment',
      helpUrl: 'https://console.anthropic.com/settings/keys',
      placeholder: 'sk-ant-api03-...',
      isSet: false,
    },
  ])
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [inputValue, setInputValue] = useState('')
  const [showValue, setShowValue] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoadingSettings, setIsLoadingSettings] = useState(true)

  // Check admin status and load settings
  const initialize = useCallback(async () => {
    try {
      // Check admin status
      const authResponse = await fetch('/api/auth/me')
      if (authResponse.ok) {
        const authData = await authResponse.json()
        const userIsAdmin = authData.user?.isAdmin || false
        setIsAdmin(userIsAdmin)

        // If admin, load API key settings
        if (userIsAdmin) {
          const settingsResponse = await fetch('/api/admin/settings')
          if (settingsResponse.ok) {
            const json = await settingsResponse.json()
            const data = json.data || json
            if (data.settings) {
              setApiSettings(prev => prev.map(setting => {
                const saved = data.settings.find((s: { key: string }) => s.key === setting.key)
                if (saved) {
                  return {
                    ...setting,
                    isSet: saved.is_set,
                    maskedValue: saved.masked_value,
                    lastUpdated: saved.updated_at,
                  }
                }
                return setting
              }))
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to initialize settings:', error)
    } finally {
      setIsCheckingAdmin(false)
      setIsLoadingSettings(false)
    }
  }, [])

  useEffect(() => {
    setMounted(true)
    initialize()
  }, [initialize])

  const handleSaveApiKey = async (settingKey: string) => {
    if (!inputValue.trim()) {
      toast.error('Please enter a value')
      return
    }

    setIsSaving(true)
    try {
      const response = await fetch(`/api/admin/settings/${settingKey}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: inputValue }),
      })

      if (response.ok) {
        const json = await response.json()
        const data = json.data || json
        setApiSettings(prev => prev.map(s =>
          s.key === settingKey
            ? { ...s, isSet: true, maskedValue: data.masked_value, lastUpdated: new Date().toISOString() }
            : s
        ))
        setEditingKey(null)
        setInputValue('')
        setShowValue(false)
        toast.success('API key saved successfully')
      } else {
        const json = await response.json()
        const error = json.error || json
        toast.error(error.message || 'Failed to save')
      }
    } catch (error) {
      toast.error('Failed to save API key')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteApiKey = async (settingKey: string) => {
    if (!confirm('Are you sure you want to remove this API key?')) return

    try {
      const response = await fetch(`/api/admin/settings/${settingKey}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setApiSettings(prev => prev.map(s =>
          s.key === settingKey
            ? { ...s, isSet: false, maskedValue: undefined, lastUpdated: undefined }
            : s
        ))
        toast.success('API key removed')
      }
    } catch (error) {
      toast.error('Failed to remove API key')
    }
  }

  const startEditing = (settingKey: string) => {
    setEditingKey(settingKey)
    setInputValue('')
    setShowValue(false)
  }

  const cancelEditing = () => {
    setEditingKey(null)
    setInputValue('')
    setShowValue(false)
  }

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

        {/* Admin Section - API Keys (only for admins) */}
        {isCheckingAdmin ? (
          <Card className="border-muted">
            <CardContent className="py-6">
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Checking permissions...</span>
              </div>
            </CardContent>
          </Card>
        ) : isAdmin && (
          <>
            {/* API Keys Card */}
            <Card className="border-orange-500/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
                  <Key className="h-5 w-5" />
                  API Keys
                </CardTitle>
                <CardDescription>
                  Manage API keys for external services. Keys are encrypted at rest.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {isLoadingSettings ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  apiSettings.map((setting) => (
                    <div key={setting.key} className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-base font-medium">{setting.name}</span>
                          <p className="text-sm text-muted-foreground">{setting.description}</p>
                        </div>
                        <a
                          href={setting.helpUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                        >
                          Get key <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>

                      {editingKey === setting.key ? (
                        <div className="space-y-3">
                          <div className="relative">
                            <Input
                              type={showValue ? 'text' : 'password'}
                              value={inputValue}
                              onChange={(e) => setInputValue(e.target.value)}
                              placeholder={setting.placeholder}
                              className="pr-10 font-mono text-sm"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => setShowValue(!showValue)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                              {showValue ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleSaveApiKey(setting.key)}
                              disabled={isSaving}
                            >
                              {isSaving ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              ) : (
                                <Check className="h-4 w-4 mr-2" />
                              )}
                              Save
                            </Button>
                            <Button size="sm" variant="outline" onClick={cancelEditing}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          {setting.isSet ? (
                            <>
                              <div className="flex-1">
                                <code className="text-sm bg-muted px-2 py-1 rounded font-mono">
                                  {setting.maskedValue}
                                </code>
                                {setting.lastUpdated && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Last updated: {new Date(setting.lastUpdated).toLocaleDateString()}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="flex items-center gap-1 text-xs text-green-600">
                                  <Check className="h-3 w-3" /> Connected
                                </span>
                                <Button size="sm" variant="outline" onClick={() => startEditing(setting.key)}>
                                  Update
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => handleDeleteApiKey(setting.key)}
                                >
                                  Remove
                                </Button>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="flex-1 flex items-center gap-2 text-muted-foreground">
                                <AlertCircle className="h-4 w-4" />
                                <span className="text-sm">Not configured</span>
                              </div>
                              <Button size="sm" onClick={() => startEditing(setting.key)}>
                                Add Key
                              </Button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Security Notice */}
            <Card className="border-blue-500/20 bg-blue-500/5">
              <CardContent className="pt-6">
                <div className="flex gap-3">
                  <Shield className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-blue-700 dark:text-blue-300">Security Notice</p>
                    <p className="text-muted-foreground mt-1">
                      API keys are encrypted before storage and never exposed in full after saving.
                      Only administrators can view or modify these settings.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}
