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

interface SlackUser {
  id: string
  name: string
  display_name: string
  email: string | null
  image: string | null
  staff_id: string | null
  staff_name: string | null
  is_mapped: boolean
}

interface StaffMember {
  id: string
  full_name: string
  email: string
}

const easeOut: [number, number, number, number] = [0.22, 1, 0.36, 1]
const PAGE_SIZE = 30

export function SlackStaffMapping() {
  const [slackUsers, setSlackUsers] = useState<SlackUser[]>([])
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([])
  const [isLoadingUsers, setIsLoadingUsers] = useState(true)
  const [isLoadingStaff, setIsLoadingStaff] = useState(true)
  const [isAutoMatching, setIsAutoMatching] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'mapped' | 'unmapped'>('all')
  const [selectedStaff, setSelectedStaff] = useState<Record<string, string>>({})
  const [savingUserId, setSavingUserId] = useState<string | null>(null)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [error, setError] = useState<string | null>(null)

  // Fetch Slack users
  useEffect(() => {
    async function fetchUsers() {
      try {
        const res = await fetch('/api/slack/users')
        if (!res.ok) throw new Error('Failed to fetch Slack users')
        const json = await res.json()
        setSlackUsers(json.data?.users || [])
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

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(u =>
        u.name.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.staff_name?.toLowerCase().includes(q)
      )
    }

    if (filter === 'mapped') filtered = filtered.filter(u => u.is_mapped)
    if (filter === 'unmapped') filtered = filtered.filter(u => !u.is_mapped)

    return filtered
  }, [slackUsers, searchQuery, filter])

  useEffect(() => { setVisibleCount(PAGE_SIZE) }, [searchQuery, filter])

  const visibleUsers = filteredUsers.slice(0, visibleCount)
  const hasMore = visibleCount < filteredUsers.length
  const mappedCount = slackUsers.filter(u => u.is_mapped).length

  // Auto-match by email
  async function handleAutoMatch() {
    setIsAutoMatching(true)
    try {
      const res = await fetch('/api/slack/mappings/staff/auto-match', { method: 'POST' })
      if (!res.ok) throw new Error('Auto-match failed')
      const json = await res.json()
      const result = json.data

      toast.success(`Matched ${result.matched} staff members by email`)

      // Refresh users list
      const refreshRes = await fetch('/api/slack/users')
      if (refreshRes.ok) {
        const refreshJson = await refreshRes.json()
        setSlackUsers(refreshJson.data?.users || [])
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
      // Need to find the mapping ID — fetch from mappings endpoint
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

  const isLoading = isLoadingUsers || isLoadingStaff

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 py-8 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">
          {isLoadingUsers ? 'Fetching Slack users...' : 'Loading staff members...'}
        </span>
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
      {/* Stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge variant="outline">{slackUsers.length} Slack users</Badge>
          <Badge variant="secondary" className="bg-green-500/10 text-green-600">
            {mappedCount} mapped
          </Badge>
          <Badge variant="secondary" className="bg-orange-500/10 text-orange-600">
            {slackUsers.length - mappedCount} unmapped
          </Badge>
        </div>
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
        <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <SelectTrigger className="w-[140px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="mapped">Mapped</SelectItem>
            <SelectItem value="unmapped">Unmapped</SelectItem>
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
                {/* User info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {user.is_mapped ? (
                      <Link2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                    ) : (
                      <Unlink className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
                    )}
                    <span className="font-medium truncate">{user.name}</span>
                    {user.email && (
                      <span className="text-xs text-muted-foreground truncate hidden md:inline">
                        {user.email}
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
                  ) : (
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
      </p>
    </div>
  )
}
