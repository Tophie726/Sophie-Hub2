'use client'

import { useSession } from 'next-auth/react'
import { useTheme } from 'next-themes'
import { useEffect, useState, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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
  User,
  Palette,
  ExternalLink,
  History,
  Bug,
  Lightbulb,
  HelpCircle,
  ChevronRight,
  Clock,
  Filter,
  Terminal,
  Ticket,
  MessageCircle,
  Image as ImageIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

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

interface FeedbackItem {
  id: string
  type: 'bug' | 'feature' | 'question'
  title: string | null
  description: string
  status: string
  created_at: string
  vote_count: number
  screenshot_url?: string | null
  submitted_by_email?: string
}

interface TicketComment {
  id: string
  user_email: string
  content: string
  is_from_submitter: boolean
  created_at: string
}

const TABS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'changelog', label: 'Changelog', icon: History },
  { id: 'advanced', label: 'Advanced', icon: Terminal },
] as const

type TabId = (typeof TABS)[number]['id']

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  new: { label: 'Under Review', color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  reviewed: { label: 'Planned', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  in_progress: { label: 'In Progress', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' },
  resolved: { label: 'Shipped', color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  wont_fix: { label: 'Not Planned', color: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' },
}

const TYPE_ICONS = {
  bug: Bug,
  feature: Lightbulb,
  question: HelpCircle,
}

const TYPE_COLORS = {
  bug: 'text-red-500',
  feature: 'text-amber-500',
  question: 'text-blue-500',
}

export default function SettingsPage() {
  const { data: session } = useSession()
  const { theme, setTheme } = useTheme()
  const searchParams = useSearchParams()
  const router = useRouter()

  const [mounted, setMounted] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isCheckingAdmin, setIsCheckingAdmin] = useState(true)
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    const tab = searchParams.get('tab')
    if (tab && TABS.some(t => t.id === tab)) {
      return tab as TabId
    }
    return 'profile'
  })

  // My Tickets state
  const [myTickets, setMyTickets] = useState<FeedbackItem[]>([])
  const [ticketsLoading, setTicketsLoading] = useState(false)
  const [ticketFilter, setTicketFilter] = useState<'all' | 'bug' | 'feature' | 'question'>('all')
  const [selectedTicket, setSelectedTicket] = useState<FeedbackItem | null>(null)
  const [ticketComments, setTicketComments] = useState<TicketComment[]>([])
  const [commentsLoading, setCommentsLoading] = useState(false)

  // API Key state
  const [apiSettings, setApiSettings] = useState<ApiKeySetting[]>([
    {
      key: 'anthropic_api_key',
      name: 'Anthropic (Claude)',
      description: 'Powers AI mapping suggestions and bug analysis',
      helpUrl: 'https://console.anthropic.com/settings/keys',
      placeholder: 'sk-ant-api03-...',
      isSet: false,
    },
    {
      key: 'posthog_api_key',
      name: 'PostHog (Personal API Key)',
      description: 'Enables AI to analyze session replays and errors for bug reports',
      helpUrl: 'https://us.posthog.com/settings/user-api-keys',
      placeholder: 'phx_...',
      isSet: false,
    },
  ])
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [inputValue, setInputValue] = useState('')
  const [showValue, setShowValue] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoadingSettings, setIsLoadingSettings] = useState(true)

  // Handle tab change with URL sync
  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab)
    const url = new URL(window.location.href)
    url.searchParams.set('tab', tab)
    router.replace(url.pathname + url.search, { scroll: false })
  }

  // Fetch my tickets
  const fetchMyTickets = useCallback(async () => {
    setTicketsLoading(true)
    try {
      const res = await fetch('/api/feedback?mine=true')
      if (res.ok) {
        const json = await res.json()
        setMyTickets(json.data?.feedback || [])
      }
    } catch (error) {
      console.error('Failed to fetch tickets:', error)
    } finally {
      setTicketsLoading(false)
    }
  }, [])

  // Fetch comments for a ticket
  const fetchTicketComments = useCallback(async (ticketId: string) => {
    setCommentsLoading(true)
    try {
      const res = await fetch(`/api/feedback/${ticketId}/comments`)
      if (res.ok) {
        const json = await res.json()
        setTicketComments(json.data?.comments || [])
      }
    } catch (error) {
      console.error('Failed to fetch comments:', error)
    } finally {
      setCommentsLoading(false)
    }
  }, [])

  // Handle ticket click
  const handleTicketClick = useCallback((ticket: FeedbackItem) => {
    setSelectedTicket(ticket)
    setTicketComments([])
    fetchTicketComments(ticket.id)
  }, [fetchTicketComments])

  const initialize = useCallback(async () => {
    try {
      const authResponse = await fetch('/api/auth/me')
      if (authResponse.ok) {
        const authData = await authResponse.json()
        const userIsAdmin = authData.user?.isAdmin || false
        setIsAdmin(userIsAdmin)

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

  // Fetch tickets when changelog tab is active
  useEffect(() => {
    if (activeTab === 'changelog' && myTickets.length === 0) {
      fetchMyTickets()
    }
  }, [activeTab, myTickets.length, fetchMyTickets])

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
        toast.success('API key saved')
      } else {
        const json = await response.json()
        toast.error(json.error?.message || 'Failed to save')
      }
    } catch {
      toast.error('Failed to save API key')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteApiKey = async (settingKey: string) => {
    if (!confirm('Remove this API key?')) return

    try {
      const response = await fetch(`/api/admin/settings/${settingKey}`, { method: 'DELETE' })
      if (response.ok) {
        setApiSettings(prev => prev.map(s =>
          s.key === settingKey ? { ...s, isSet: false, maskedValue: undefined, lastUpdated: undefined } : s
        ))
        toast.success('API key removed')
      }
    } catch {
      toast.error('Failed to remove')
    }
  }

  const themes = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ]

  // Filter tickets
  const filteredTickets = ticketFilter === 'all'
    ? myTickets
    : myTickets.filter(t => t.type === ticketFilter)

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Settings"
        description="Manage your account, view your activity, and configure preferences"
      />

      <div className="p-4 md:p-8">
        {/* Tab Navigation */}
        <div className="flex gap-1 p-1 mb-6 bg-muted/50 rounded-lg w-fit">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            // Hide Advanced tab for non-admins
            if (tab.id === 'advanced' && !isAdmin && !isCheckingAdmin) return null

            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all',
                  isActive
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            )
          })}
        </div>

        <div className="max-w-2xl">
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="space-y-8">
              {/* Profile Section */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Profile</h2>
                </div>
                <div className="rounded-xl bg-card border border-border/50 shadow-sm p-6">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-14 w-14">
                      <AvatarImage
                        src={session?.user?.image || undefined}
                        alt={session?.user?.name || 'User'}
                      />
                      <AvatarFallback className="bg-primary/10 text-primary text-base font-medium">
                        {getInitials(session?.user?.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-semibold truncate">
                        {session?.user?.name || 'Loading...'}
                      </h3>
                      <p className="text-sm text-muted-foreground truncate">
                        {session?.user?.email}
                      </p>
                    </div>
                    <div className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                      Google
                    </div>
                  </div>
                </div>
              </section>

              {/* Appearance Section */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Palette className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Appearance</h2>
                </div>
                <div className="rounded-xl bg-card border border-border/50 shadow-sm p-6">
                  <div className="space-y-3">
                    <label className="text-sm font-medium">Theme</label>
                    <div className="grid grid-cols-3 gap-2">
                      {themes.map(({ value, label, icon: Icon }) => (
                        <button
                          key={value}
                          onClick={() => setTheme(value)}
                          className={cn(
                            'flex items-center justify-center gap-2 px-4 py-3 rounded-lg border text-sm font-medium transition-all',
                            mounted && theme === value
                              ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                              : 'bg-background border-border/50 text-muted-foreground hover:bg-accent hover:text-foreground hover:border-border'
                          )}
                        >
                          <Icon className="h-4 w-4" />
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* Changelog Tab */}
          {activeTab === 'changelog' && (
            <div className="space-y-8">
              {/* My Tickets Section */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Ticket className="h-4 w-4 text-muted-foreground" />
                    <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">My Tickets</h2>
                    {myTickets.length > 0 && (
                      <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                        {myTickets.length}
                      </span>
                    )}
                  </div>

                  {/* Filter */}
                  <div className="flex items-center gap-1">
                    <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                    <div className="flex gap-1">
                      {(['all', 'bug', 'feature', 'question'] as const).map((filter) => (
                        <button
                          key={filter}
                          onClick={() => setTicketFilter(filter)}
                          className={cn(
                            'px-2 py-1 text-xs rounded-md transition-colors',
                            ticketFilter === filter
                              ? 'bg-primary text-primary-foreground'
                              : 'text-muted-foreground hover:bg-muted'
                          )}
                        >
                          {filter === 'all' ? 'All' : filter.charAt(0).toUpperCase() + filter.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="rounded-xl bg-card border border-border/50 shadow-sm overflow-hidden">
                  {ticketsLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : filteredTickets.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">
                        {ticketFilter === 'all'
                          ? "You haven't submitted any feedback yet"
                          : `No ${ticketFilter} tickets found`}
                      </p>
                      <p className="text-xs mt-1">
                        Submit a bug report or feature request using the feedback button
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border/50">
                      {filteredTickets.map((ticket) => {
                        const TypeIcon = TYPE_ICONS[ticket.type]
                        const status = STATUS_LABELS[ticket.status] || STATUS_LABELS.new

                        return (
                          <button
                            key={ticket.id}
                            onClick={() => handleTicketClick(ticket)}
                            className="w-full flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors group text-left"
                          >
                            <TypeIcon className={cn('h-5 w-5 shrink-0', TYPE_COLORS[ticket.type])} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium truncate">
                                  {ticket.title || ticket.description.slice(0, 50)}
                                </span>
                                <Badge variant="secondary" className={cn('text-[10px] px-1.5 shrink-0', status.color)}>
                                  {status.label}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}
                                </span>
                                {ticket.vote_count > 0 && (
                                  <span>{ticket.vote_count} vote{ticket.vote_count !== 1 ? 's' : ''}</span>
                                )}
                              </div>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </section>

              {/* Recent Activity Section (placeholder for future) */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <History className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Recent Activity</h2>
                </div>
                <div className="rounded-xl bg-card border border-border/50 shadow-sm p-6">
                  <div className="text-center py-6 text-muted-foreground">
                    <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Activity tracking coming soon</p>
                    <p className="text-xs mt-1">
                      View your recent changes, syncs, and approvals
                    </p>
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* Advanced Tab (Admin Only) */}
          {activeTab === 'advanced' && (
            <div className="space-y-8">
              {isCheckingAdmin ? (
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <Key className="h-4 w-4 text-muted-foreground" />
                    <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">API Keys</h2>
                  </div>
                  <div className="rounded-xl bg-card border border-border/50 shadow-sm p-6">
                    <div className="flex items-center justify-center gap-2 text-muted-foreground py-4">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Checking permissions...</span>
                    </div>
                  </div>
                </section>
              ) : isAdmin ? (
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <Key className="h-4 w-4 text-orange-500" />
                    <h2 className="text-sm font-medium text-orange-600 dark:text-orange-400 uppercase tracking-wide">API Keys</h2>
                    <span className="text-[10px] uppercase tracking-wider bg-orange-100 dark:bg-orange-950 text-orange-600 dark:text-orange-400 px-1.5 py-0.5 rounded font-medium">Admin</span>
                  </div>
                  <div className="rounded-xl bg-card border border-orange-200/50 dark:border-orange-900/30 shadow-sm">
                    {isLoadingSettings ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      apiSettings.map((setting, idx) => (
                        <div
                          key={setting.key}
                          className={cn(
                            'p-6',
                            idx !== apiSettings.length - 1 && 'border-b border-border/50'
                          )}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h3 className="text-sm font-medium">{setting.name}</h3>
                              <p className="text-xs text-muted-foreground mt-0.5">{setting.description}</p>
                            </div>
                            <a
                              href={setting.helpUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 shrink-0"
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
                                  className="pr-10 font-mono text-sm h-10"
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
                                  className="h-8"
                                >
                                  {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                                  <span className="ml-1.5">Save</span>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => { setEditingKey(null); setInputValue(''); setShowValue(false) }}
                                  className="h-8"
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3">
                              {setting.isSet ? (
                                <>
                                  <div className="flex-1 flex items-center gap-3">
                                    <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                                      {setting.maskedValue}
                                    </code>
                                    <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-500">
                                      <Check className="h-3 w-3" />
                                      Connected
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => { setEditingKey(setting.key); setInputValue(''); setShowValue(false) }}
                                      className="h-7 text-xs"
                                    >
                                      Update
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleDeleteApiKey(setting.key)}
                                      className="h-7 text-xs text-destructive hover:text-destructive"
                                    >
                                      Remove
                                    </Button>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="flex-1 flex items-center gap-2 text-muted-foreground">
                                    <AlertCircle className="h-3.5 w-3.5" />
                                    <span className="text-xs">Not configured</span>
                                  </div>
                                  <Button
                                    size="sm"
                                    onClick={() => { setEditingKey(setting.key); setInputValue(''); setShowValue(false) }}
                                    className="h-7 text-xs"
                                  >
                                    Add Key
                                  </Button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-3 px-1">
                    API keys are encrypted at rest. Only administrators can access this section.
                  </p>
                </section>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Admin access required</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Ticket Detail Dialog */}
      <Dialog open={!!selectedTicket} onOpenChange={(open) => !open && setSelectedTicket(null)}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col">
          {selectedTicket && (
            <>
              <DialogHeader className="space-y-3 pb-4 border-b">
                <div className="flex items-center gap-3">
                  {(() => {
                    const TypeIcon = TYPE_ICONS[selectedTicket.type]
                    return (
                      <div className={cn(
                        'h-10 w-10 rounded-lg flex items-center justify-center',
                        selectedTicket.type === 'bug' && 'bg-red-500/10',
                        selectedTicket.type === 'feature' && 'bg-amber-500/10',
                        selectedTicket.type === 'question' && 'bg-blue-500/10'
                      )}>
                        <TypeIcon className={cn('h-5 w-5', TYPE_COLORS[selectedTicket.type])} />
                      </div>
                    )
                  })()}
                  <Badge
                    variant="secondary"
                    className={cn('text-xs', (STATUS_LABELS[selectedTicket.status] || STATUS_LABELS.new).color)}
                  >
                    {(STATUS_LABELS[selectedTicket.status] || STATUS_LABELS.new).label}
                  </Badge>
                </div>
                <DialogTitle className="text-lg">
                  {selectedTicket.title || selectedTicket.description.slice(0, 60)}
                </DialogTitle>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {formatDistanceToNow(new Date(selectedTicket.created_at), { addSuffix: true })}
                  </span>
                  {selectedTicket.vote_count > 0 && (
                    <span>{selectedTicket.vote_count} vote{selectedTicket.vote_count !== 1 ? 's' : ''}</span>
                  )}
                </div>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto py-4 space-y-4">
                {/* Description */}
                <div>
                  <h4 className="text-sm font-medium mb-2">Description</h4>
                  <div className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted/30 rounded-lg p-3">
                    {selectedTicket.description}
                  </div>
                </div>

                {/* Screenshot */}
                {selectedTicket.screenshot_url && (
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <ImageIcon className="h-4 w-4" />
                      Screenshot
                    </h4>
                    <div className="rounded-lg border overflow-hidden">
                      <img
                        src={selectedTicket.screenshot_url}
                        alt="Screenshot"
                        className="w-full max-h-64 object-contain bg-muted/30"
                      />
                    </div>
                  </div>
                )}

                {/* Comments */}
                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <MessageCircle className="h-4 w-4" />
                    Comments
                    <Badge variant="secondary" className="text-xs">
                      {ticketComments.length}
                    </Badge>
                  </h4>

                  {commentsLoading ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : ticketComments.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4 bg-muted/30 rounded-lg">
                      No comments yet
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {ticketComments.map(comment => (
                        <div
                          key={comment.id}
                          className={cn(
                            'p-3 rounded-lg text-sm',
                            comment.is_from_submitter
                              ? 'bg-primary/5 border border-primary/20'
                              : 'bg-muted/50'
                          )}
                        >
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="font-medium text-xs">
                              {comment.user_email.split('@')[0]}
                            </span>
                            {comment.is_from_submitter && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                You
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground ml-auto">
                              {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                            </span>
                          </div>
                          <p className="whitespace-pre-wrap">{comment.content}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Footer with link to feedback page */}
              <div className="pt-4 border-t flex justify-between items-center">
                <a
                  href={`/feedback?id=${selectedTicket.id}`}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  View on Feedback page
                  <ExternalLink className="h-3 w-3" />
                </a>
                <Button variant="outline" size="sm" onClick={() => setSelectedTicket(null)}>
                  Close
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
