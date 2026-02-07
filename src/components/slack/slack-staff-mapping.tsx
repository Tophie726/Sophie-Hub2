'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Search,
  Loader2,
  Check,
  X,
  Link2,
  Unlink,
  Sparkles,
  ChevronDown,
  AlertCircle,
  Users,
  UserCheck,
  UserX,
  Bot,
  Download,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { ShimmerGrid } from '@/components/ui/shimmer-grid'

type SlackUserType = 'member' | 'multi_channel_guest' | 'single_channel_guest' | 'bot' | 'deactivated' | 'connect'

interface SlackUser {
  id: string
  name: string
  display_name: string
  email: string | null
  image: string | null
  image_72: string | null
  title: string | null
  timezone: string | null
  tz_label: string | null
  staff_id: string | null
  staff_name: string | null
  is_mapped: boolean
  user_type: SlackUserType
}

interface StaffMember {
  id: string
  full_name: string
  email: string
}

interface Breakdown {
  member: number
  multi_channel_guest: number
  single_channel_guest: number
  bot: number
  deactivated: number
  connect: number
}

const easeOut: [number, number, number, number] = [0.22, 1, 0.36, 1]
const PAGE_SIZE = 30

const USER_TYPE_CONFIG: Record<SlackUserType, { label: string; color: string; shortLabel: string }> = {
  member: { label: 'Member', color: 'bg-blue-500/10 text-blue-700 dark:text-blue-400', shortLabel: 'Member' },
  multi_channel_guest: { label: 'Multi-Channel Guest', color: 'bg-amber-500/10 text-amber-700 dark:text-amber-400', shortLabel: 'MC Guest' },
  single_channel_guest: { label: 'Single-Channel Guest', color: 'bg-orange-500/10 text-orange-700 dark:text-orange-400', shortLabel: 'SC Guest' },
  bot: { label: 'Bot', color: 'bg-gray-500/10 text-gray-500', shortLabel: 'Bot' },
  deactivated: { label: 'Deactivated', color: 'bg-red-500/10 text-red-500', shortLabel: 'Deactivated' },
  connect: { label: 'Slack Connect', color: 'bg-purple-500/10 text-purple-700 dark:text-purple-400', shortLabel: 'Connect' },
}

type FilterType = 'all' | 'mapped' | 'unmapped' | SlackUserType

function isStaffMappable(user: SlackUser): boolean {
  return user.user_type === 'member' ||
    user.user_type === 'multi_channel_guest' ||
    user.user_type === 'single_channel_guest'
}

export function SlackStaffMapping() {
  const [slackUsers, setSlackUsers] = useState<SlackUser[]>([])
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([])
  const [isLoadingUsers, setIsLoadingUsers] = useState(true)
  const [isLoadingStaff, setIsLoadingStaff] = useState(true)
  const [isAutoMatching, setIsAutoMatching] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')
  const [selectedStaff, setSelectedStaff] = useState<Record<string, string>>({})
  const [savingUserId, setSavingUserId] = useState<string | null>(null)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [error, setError] = useState<string | null>(null)
  const [breakdown, setBreakdown] = useState<Breakdown | null>(null)
  const [isEnriching, setIsEnriching] = useState(false)

  // Fetch Slack users
  useEffect(() => {
    async function fetchUsers() {
      try {
        const res = await fetch('/api/slack/users')
        if (!res.ok) throw new Error('Failed to fetch Slack users')
        const json = await res.json()
        setSlackUsers(json.data?.users || [])
        setBreakdown(json.data?.breakdown || null)
      } catch (err) {
        console.error('Error fetching Slack users:', err)
        setError('Failed to load Slack users. Is the bot token configured?')
      } finally {
        setIsLoadingUsers(false)
      }
    }
    fetchUsers()
  }, [])

  // Fetch staff members
  useEffect(() => {
    async function fetchStaff() {
      try {
        const res = await fetch('/api/staff?limit=500')
        if (!res.ok) throw new Error('Failed to fetch staff')
        const json = await res.json()
        const list = json.data?.staff || json.staff || []
        setStaffMembers(list.map((s: { id: string; full_name: string; email: string }) => ({
          id: s.id,
          full_name: s.full_name,
          email: s.email,
        })))
      } catch (err) {
        console.error('Error fetching staff:', err)
      } finally {
        setIsLoadingStaff(false)
      }
    }
    fetchStaff()
  }, [])

  const mappedStaffIds = useMemo(() => {
    return new Set(slackUsers.filter(u => u.is_mapped).map(u => u.staff_id!))
  }, [slackUsers])

  const filteredUsers = useMemo(() => {
    let filtered = slackUsers

    // Default view: show only users that are mappable to staff.
    if (filter === 'all' || filter === 'mapped' || filter === 'unmapped') {
      filtered = filtered.filter(isStaffMappable)
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(u =>
        u.name.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.title?.toLowerCase().includes(q) ||
        u.timezone?.toLowerCase().includes(q) ||
        u.staff_name?.toLowerCase().includes(q)
      )
    }

    if (filter === 'mapped') filtered = filtered.filter(u => u.is_mapped)
    if (filter === 'unmapped') filtered = filtered.filter(u => !u.is_mapped)

    // User type filters
    if (filter === 'member' || filter === 'multi_channel_guest' || filter === 'single_channel_guest' || filter === 'bot' || filter === 'deactivated' || filter === 'connect') {
      filtered = slackUsers.filter(u => u.user_type === filter)
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        filtered = filtered.filter(u =>
          u.name.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q) ||
          u.title?.toLowerCase().includes(q) ||
          u.timezone?.toLowerCase().includes(q) ||
          u.staff_name?.toLowerCase().includes(q)
        )
      }
    }

    return filtered
  }, [slackUsers, searchQuery, filter])

  useEffect(() => { setVisibleCount(PAGE_SIZE) }, [searchQuery, filter])

  const visibleUsers = filteredUsers.slice(0, visibleCount)
  const hasMore = visibleCount < filteredUsers.length

  // Users considered mappable to staff records.
  const activeUsers = slackUsers.filter(isStaffMappable)
  const mappedCount = activeUsers.filter(u => u.is_mapped).length

  // Auto-match by email
  async function handleAutoMatch() {
    setIsAutoMatching(true)
    try {
      const res = await fetch('/api/slack/mappings/staff/auto-match', { method: 'POST' })
      if (!res.ok) throw new Error('Auto-match failed')
      const json = await res.json()
      const result = json.data

      toast.success(`Matched ${result.matched} staff members by email`)

      // Auto-enrich profiles for newly matched staff
      if (result.matched > 0) {
        try {
          const enrichRes = await fetch('/api/slack/enrich-staff', { method: 'POST' })
          if (enrichRes.ok) {
            const enrichJson = await enrichRes.json()
            if (enrichJson.data?.enriched > 0) {
              toast.success(`Enriched ${enrichJson.data.enriched} staff profiles`)
            }
          }
        } catch {
          // Non-critical — enrichment can be retried manually
        }
      }

      // Refresh users list
      const refreshRes = await fetch('/api/slack/users')
      if (refreshRes.ok) {
        const refreshJson = await refreshRes.json()
        setSlackUsers(refreshJson.data?.users || [])
        setBreakdown(refreshJson.data?.breakdown || null)
      }
    } catch (err) {
      console.error('Auto-match error:', err)
      toast.error('Auto-match failed')
    } finally {
      setIsAutoMatching(false)
    }
  }

  // Save individual mapping
  async function handleSaveMapping(slackUserId: string) {
    const staffId = selectedStaff[slackUserId]
    if (!staffId) return

    setSavingUserId(slackUserId)
    try {
      const user = slackUsers.find(u => u.id === slackUserId)
      const res = await fetch('/api/slack/mappings/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_id: staffId,
          slack_user_id: slackUserId,
          slack_user_name: user?.name,
        }),
      })

      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error?.message || 'Failed to save mapping')
      }

      const staff = staffMembers.find(s => s.id === staffId)
      setSlackUsers(prev => prev.map(u =>
        u.id === slackUserId
          ? { ...u, is_mapped: true, staff_id: staffId, staff_name: staff?.full_name || null }
          : u
      ))
      setSelectedStaff(prev => { const n = { ...prev }; delete n[slackUserId]; return n })
      toast.success('Mapping saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSavingUserId(null)
    }
  }

  // Delete mapping
  async function handleDeleteMapping(slackUserId: string) {
    const user = slackUsers.find(u => u.id === slackUserId)
    if (!user?.staff_id) return

    try {
      const mappingsRes = await fetch('/api/slack/mappings/staff')
      if (!mappingsRes.ok) throw new Error('Failed to fetch mappings')
      const mappingsJson = await mappingsRes.json()
      const mapping = (mappingsJson.data?.mappings || []).find(
        (m: { slack_user_id: string }) => m.slack_user_id === slackUserId
      )

      if (!mapping) throw new Error('Mapping not found')

      const res = await fetch(`/api/slack/mappings/staff?id=${mapping.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete mapping')

      setSlackUsers(prev => prev.map(u =>
        u.id === slackUserId
          ? { ...u, is_mapped: false, staff_id: null, staff_name: null }
          : u
      ))
      toast.success('Mapping removed')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove')
    }
  }

  // Enrich staff profiles from Slack
  async function handleEnrichStaff() {
    setIsEnriching(true)
    try {
      const res = await fetch('/api/slack/enrich-staff', { method: 'POST' })
      if (!res.ok) throw new Error('Enrichment failed')
      const json = await res.json()
      const result = json.data

      toast.success(`Enriched ${result.enriched} staff profiles (avatar, timezone, title)`)
    } catch (err) {
      console.error('Enrich error:', err)
      toast.error('Failed to enrich staff profiles')
    } finally {
      setIsEnriching(false)
    }
  }

  const isLoading = isLoadingUsers || isLoadingStaff

  if (isLoading) {
    return (
      <div className="space-y-4">
        {/* Breakdown shimmer */}
        <div className="rounded-lg border p-4 space-y-3">
          <ShimmerGrid variant="grid" rows={1} columns={6} cellHeight={48} gap={12} />
        </div>
        {/* Stats & filter bar shimmer */}
        <ShimmerGrid variant="grid" rows={1} columns={3} cellHeight={28} gap={8} />
        {/* User list shimmer */}
        <div className="border rounded-lg overflow-hidden">
          <ShimmerGrid variant="list" rows={8} cellHeight={52} gap={0} />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center py-12 text-center">
        <AlertCircle className="h-8 w-8 text-destructive mb-2" />
        <p className="text-muted-foreground">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Workspace Breakdown */}
      {breakdown && (
        <div className="rounded-lg border p-4 space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Workspace Breakdown</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <BreakdownCard
              icon={<Users className="h-4 w-4" />}
              label="Members"
              count={breakdown.member}
              color="text-blue-600"
              bgColor="bg-blue-500/10"
              active={filter === 'member'}
              onClick={() => setFilter(filter === 'member' ? 'all' : 'member')}
            />
            <BreakdownCard
              icon={<UserCheck className="h-4 w-4" />}
              label="MC Guests"
              sublabel="Multi-channel"
              count={breakdown.multi_channel_guest}
              color="text-amber-600"
              bgColor="bg-amber-500/10"
              active={filter === 'multi_channel_guest'}
              onClick={() => setFilter(filter === 'multi_channel_guest' ? 'all' : 'multi_channel_guest')}
            />
            <BreakdownCard
              icon={<UserX className="h-4 w-4" />}
              label="SC Guests"
              sublabel="Single-channel"
              count={breakdown.single_channel_guest}
              color="text-orange-600"
              bgColor="bg-orange-500/10"
              active={filter === 'single_channel_guest'}
              onClick={() => setFilter(filter === 'single_channel_guest' ? 'all' : 'single_channel_guest')}
            />
            {breakdown.connect > 0 && (
              <BreakdownCard
                icon={<Link2 className="h-4 w-4" />}
                label="Connect"
                sublabel="External orgs"
                count={breakdown.connect}
                color="text-purple-600"
                bgColor="bg-purple-500/10"
                active={filter === 'connect'}
                onClick={() => setFilter(filter === 'connect' ? 'all' : 'connect')}
              />
            )}
            <BreakdownCard
              icon={<Bot className="h-4 w-4" />}
              label="Bots"
              count={breakdown.bot}
              color="text-gray-500"
              bgColor="bg-gray-500/10"
              active={filter === 'bot'}
              onClick={() => setFilter(filter === 'bot' ? 'all' : 'bot')}
            />
            <BreakdownCard
              icon={<UserX className="h-4 w-4" />}
              label="Deactivated"
              count={breakdown.deactivated}
              color="text-red-500"
              bgColor="bg-red-500/10"
              active={filter === 'deactivated'}
              onClick={() => setFilter(filter === 'deactivated' ? 'all' : 'deactivated')}
            />
          </div>
        </div>
      )}

      {/* Mapping Stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge variant="outline">{activeUsers.length} active users</Badge>
          <Badge variant="secondary" className="bg-green-500/10 text-green-600">
            {mappedCount} mapped
          </Badge>
          <Badge variant="secondary" className="bg-orange-500/10 text-orange-600">
            {activeUsers.length - mappedCount} unmapped
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleEnrichStaff}
            disabled={isEnriching || mappedCount === 0}
            variant="outline"
            size="sm"
          >
            {isEnriching ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Enriching...</>
            ) : (
              <><Download className="h-4 w-4 mr-2" />Enrich profiles</>
            )}
          </Button>
          <Button
            onClick={handleAutoMatch}
            disabled={isAutoMatching}
            variant="outline"
            size="sm"
          >
            {isAutoMatching ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Matching...</>
            ) : (
              <><Sparkles className="h-4 w-4 mr-2" />Auto-match by email</>
            )}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Select value={filter} onValueChange={(v) => setFilter(v as FilterType)}>
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Active</SelectItem>
            <SelectItem value="mapped">Mapped</SelectItem>
            <SelectItem value="unmapped">Unmapped</SelectItem>
            <SelectItem value="member">Members Only</SelectItem>
            <SelectItem value="multi_channel_guest">MC Guests</SelectItem>
            <SelectItem value="single_channel_guest">SC Guests</SelectItem>
            <SelectItem value="connect">Slack Connect</SelectItem>
            <SelectItem value="bot">Bots</SelectItem>
            <SelectItem value="deactivated">Deactivated</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* User list */}
      <div className="border rounded-lg divide-y max-h-[500px] overflow-y-auto">
        {filteredUsers.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No users match your search
          </div>
        ) : (
          visibleUsers.map((user) => {
            const isSaving = savingUserId === user.id
            const selectedId = selectedStaff[user.id]
            const typeConfig = USER_TYPE_CONFIG[user.user_type]

            return (
              <motion.div
                key={user.id}
                initial={false}
                animate={{
                  backgroundColor: user.is_mapped ? 'rgba(34, 197, 94, 0.05)' : 'transparent',
                }}
                transition={{ duration: 0.2, ease: easeOut }}
                className="flex items-center gap-3 p-3 hover:bg-muted/50"
              >
                {/* Avatar */}
                <SlackAvatar name={user.name} src={user.image_72 || user.image} />

                {/* User info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {user.is_mapped ? (
                      <Link2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                    ) : (
                      <Unlink className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
                    )}
                    <span className="font-medium truncate">{user.name}</span>
                    {user.title && (
                      <span className="text-xs text-muted-foreground truncate hidden lg:inline">
                        {user.title}
                      </span>
                    )}
                    {user.user_type !== 'member' && (
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${typeConfig.color}`}>
                        {typeConfig.shortLabel}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-6">
                    {user.email && (
                      <span className="text-xs text-muted-foreground truncate">
                        {user.email}
                      </span>
                    )}
                    {user.timezone && (
                      <span className="text-[10px] text-muted-foreground/70 truncate hidden md:inline" title={user.tz_label || user.timezone}>
                        {user.timezone}
                      </span>
                    )}
                  </div>
                  {user.is_mapped && user.staff_name && (
                    <p className="text-sm text-muted-foreground ml-6 truncate">
                      → {user.staff_name}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {user.is_mapped ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDeleteMapping(user.id)}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Remove
                    </Button>
                  ) : isStaffMappable(user) ? (
                    <>
                      <Select
                        value={selectedId || ''}
                        onValueChange={(v) =>
                          setSelectedStaff(prev => ({ ...prev, [user.id]: v }))
                        }
                      >
                        <SelectTrigger className="w-[180px] h-8 text-sm">
                          <SelectValue placeholder="Select staff..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                          {staffMembers
                            .filter(s => !mappedStaffIds.has(s.id))
                            .map(s => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.full_name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        className="h-8"
                        disabled={!selectedId || isSaving}
                        onClick={() => handleSaveMapping(user.id)}
                      >
                        {isSaving ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4" />
                        )}
                      </Button>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">Not mappable</span>
                  )}
                </div>
              </motion.div>
            )
          })
        )}

        {hasMore && (
          <button
            onClick={() => setVisibleCount(prev => prev + PAGE_SIZE)}
            className="w-full p-3 text-sm text-muted-foreground hover:bg-muted/50 flex items-center justify-center gap-2"
          >
            <ChevronDown className="h-4 w-4" />
            Load more ({filteredUsers.length - visibleCount} remaining)
          </button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Map Slack users to Sophie Hub staff members. Use auto-match to bulk-match by email address.
        Slack Connect users are external by definition and are marked &ldquo;Not mappable&rdquo;.
        After mapping, click &ldquo;Enrich profiles&rdquo; to pull avatars, titles, and timezones into staff records.
      </p>
    </div>
  )
}

/** Clickable breakdown card */
function BreakdownCard({
  icon,
  label,
  sublabel,
  count,
  color,
  bgColor,
  active,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  sublabel?: string
  count: number
  color: string
  bgColor: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2.5 rounded-lg p-2.5 text-left transition-all ${
        active ? 'ring-2 ring-primary/50 ' + bgColor : 'hover:' + bgColor
      }`}
    >
      <div className={`flex h-8 w-8 items-center justify-center rounded-md ${bgColor} ${color} flex-shrink-0`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-lg font-bold tabular-nums leading-tight">{count}</p>
        <p className="text-[11px] text-muted-foreground leading-tight truncate">{label}</p>
        {sublabel && <p className="text-[10px] text-muted-foreground/70 leading-tight">{sublabel}</p>}
      </div>
    </button>
  )
}

/** Slack user avatar with initial fallback */
function SlackAvatar({ name, src }: { name: string; src: string | null }) {
  if (src) {
    return (
      // Slack CDN images — external domain, using img intentionally
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        className="h-8 w-8 rounded-full flex-shrink-0 object-cover"
      />
    )
  }

  return (
    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
      <span className="text-xs font-medium text-muted-foreground">
        {name.charAt(0).toUpperCase()}
      </span>
    </div>
  )
}
