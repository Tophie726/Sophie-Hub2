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
  Hash,
  Lock,
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
import { SLACK } from '@/lib/constants'

interface SlackChannel {
  id: string
  name: string
  is_private: boolean
  num_members: number
  purpose: string
  partner_id: string | null
  partner_name: string | null
  channel_type: 'partner_facing' | 'alerts' | 'internal'
  is_mapped: boolean
}

interface Partner {
  id: string
  brand_name: string
}

const easeOut: [number, number, number, number] = [0.22, 1, 0.36, 1]
const PAGE_SIZE = 30

function isAlertsChannel(name: string): boolean {
  return SLACK.PARTNER_CHANNEL_SUFFIXES.some((suffix) => name.endsWith(suffix))
}

const CHANNEL_TYPE_LABEL: Record<SlackChannel['channel_type'], string> = {
  partner_facing: 'Brand-facing',
  alerts: 'Alerts',
  internal: 'Internal',
}

export function SlackChannelMapping() {
  const [channels, setChannels] = useState<SlackChannel[]>([])
  const [partners, setPartners] = useState<Partner[]>([])
  const [isLoadingChannels, setIsLoadingChannels] = useState(true)
  const [isLoadingPartners, setIsLoadingPartners] = useState(true)
  const [isAutoMatching, setIsAutoMatching] = useState(false)
  const [autoMatchPrefix, setAutoMatchPrefix] = useState('client-')
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'mapped' | 'unmapped' | 'partner_facing' | 'alerts' | 'internal'>('all')
  const [selectedPartners, setSelectedPartners] = useState<Record<string, string>>({})
  const [savingChannelId, setSavingChannelId] = useState<string | null>(null)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [error, setError] = useState<string | null>(null)
  const [autoMatchResult, setAutoMatchResult] = useState<{
    auto_matched: number
    needs_review: number
  } | null>(null)

  // Fetch channels
  useEffect(() => {
    async function fetchChannels() {
      try {
        const res = await fetch('/api/slack/channels')
        if (!res.ok) throw new Error('Failed to fetch channels')
        const json = await res.json()
        setChannels(json.data?.channels || [])
      } catch (err) {
        console.error('Error fetching channels:', err)
        setError('Failed to load Slack channels. Is the bot token configured?')
      } finally {
        setIsLoadingChannels(false)
      }
    }
    fetchChannels()
  }, [])

  // Fetch partners
  useEffect(() => {
    async function fetchPartners() {
      try {
        const res = await fetch('/api/partners?limit=1000')
        if (!res.ok) throw new Error('Failed to fetch partners')
        const json = await res.json()
        const list = json.data?.partners || json.partners || []
        setPartners(list.map((p: { id: string; brand_name: string }) => ({
          id: p.id,
          brand_name: p.brand_name,
        })))
      } catch (err) {
        console.error('Error fetching partners:', err)
      } finally {
        setIsLoadingPartners(false)
      }
    }
    fetchPartners()
  }, [])

  const filteredChannels = useMemo(() => {
    let filtered = channels

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.partner_name?.toLowerCase().includes(q) ||
        c.purpose.toLowerCase().includes(q)
      )
    }

    if (filter === 'mapped') filtered = filtered.filter(c => c.is_mapped)
    if (filter === 'unmapped') filtered = filtered.filter(c => !c.is_mapped)
    if (filter === 'partner_facing') filtered = filtered.filter(c => c.channel_type === 'partner_facing')
    if (filter === 'alerts') filtered = filtered.filter(c => c.channel_type === 'alerts')
    if (filter === 'internal') filtered = filtered.filter(c => c.channel_type === 'internal')

    return filtered
  }, [channels, searchQuery, filter])

  useEffect(() => { setVisibleCount(PAGE_SIZE) }, [searchQuery, filter])

  const visibleChannels = filteredChannels.slice(0, visibleCount)
  const hasMore = visibleCount < filteredChannels.length
  const mappedCount = channels.filter(c => c.is_mapped).length

  // Auto-match by naming convention
  async function handleAutoMatch() {
    setIsAutoMatching(true)
    setAutoMatchResult(null)

    try {
      const res = await fetch('/api/slack/mappings/channels/auto-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefix: autoMatchPrefix }),
      })

      if (!res.ok) throw new Error('Auto-match failed')
      const json = await res.json()
      const result = json.data

      setAutoMatchResult({
        auto_matched: result.auto_matched,
        needs_review: result.needs_review,
      })

      toast.success(
        `Matched ${result.auto_matched} channels` +
        (result.needs_review > 0 ? ` (${result.needs_review} need review)` : '')
      )

      // Refresh channels
      const refreshRes = await fetch('/api/slack/channels')
      if (refreshRes.ok) {
        const refreshJson = await refreshRes.json()
        setChannels(refreshJson.data?.channels || [])
      }
    } catch (err) {
      console.error('Channel auto-match error:', err)
      toast.error('Auto-match failed')
    } finally {
      setIsAutoMatching(false)
    }
  }

  // Save individual mapping
  async function handleSaveMapping(channelId: string) {
    const partnerId = selectedPartners[channelId]
    if (!partnerId) return

    setSavingChannelId(channelId)
    try {
      const channel = channels.find(c => c.id === channelId)
      const res = await fetch('/api/slack/mappings/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partner_id: partnerId,
          channel_id: channelId,
          channel_name: channel?.name,
        }),
      })

      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error?.message || 'Failed to save mapping')
      }

      const partner = partners.find(p => p.id === partnerId)
      setChannels(prev => prev.map(c =>
        c.id === channelId
          ? { ...c, is_mapped: true, partner_id: partnerId, partner_name: partner?.brand_name || null }
          : c
      ))
      setSelectedPartners(prev => { const n = { ...prev }; delete n[channelId]; return n })
      toast.success('Channel mapped to partner')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSavingChannelId(null)
    }
  }

  // Delete mapping
  async function handleDeleteMapping(channelId: string) {
    try {
      const mappingsRes = await fetch('/api/slack/mappings/channels')
      if (!mappingsRes.ok) throw new Error('Failed to fetch mappings')
      const mappingsJson = await mappingsRes.json()
      const mapping = (mappingsJson.data?.mappings || []).find(
        (m: { channel_id: string }) => m.channel_id === channelId
      )

      if (!mapping) throw new Error('Mapping not found')

      const res = await fetch(`/api/slack/mappings/channels?id=${mapping.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete mapping')

      setChannels(prev => prev.map(c =>
        c.id === channelId
          ? { ...c, is_mapped: false, partner_id: null, partner_name: null }
          : c
      ))
      toast.success('Channel mapping removed')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove')
    }
  }

  const isLoading = isLoadingChannels || isLoadingPartners

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 py-8 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">
          {isLoadingChannels ? 'Fetching Slack channels...' : 'Loading partners...'}
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
          <Badge variant="outline">{channels.length} channels</Badge>
          <Badge variant="secondary" className="bg-green-500/10 text-green-600">
            {mappedCount} mapped
          </Badge>
          <Badge variant="secondary" className="bg-orange-500/10 text-orange-600">
            {channels.length - mappedCount} unmapped
          </Badge>
        </div>
      </div>

      {/* Auto-match controls */}
      <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
        <Sparkles className="h-4 w-4 text-purple-500 flex-shrink-0" />
        <span className="text-sm text-muted-foreground">Channel prefix:</span>
        <Input
          value={autoMatchPrefix}
          onChange={(e) => setAutoMatchPrefix(e.target.value)}
          className="w-32 h-8 text-sm"
          placeholder="e.g. client-"
        />
        <Button
          onClick={handleAutoMatch}
          disabled={isAutoMatching || !autoMatchPrefix}
          variant="outline"
          size="sm"
        >
          {isAutoMatching ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Matching...</>
          ) : (
            'Auto-match'
          )}
        </Button>
        {autoMatchResult && (
          <span className="text-xs text-muted-foreground">
            {autoMatchResult.auto_matched} matched
            {autoMatchResult.needs_review > 0 && `, ${autoMatchResult.needs_review} to review`}
          </span>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search channels..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <SelectTrigger className="w-[170px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="mapped">Mapped</SelectItem>
            <SelectItem value="unmapped">Unmapped</SelectItem>
            <SelectItem value="partner_facing">Brand-facing</SelectItem>
            <SelectItem value="alerts">Alerts</SelectItem>
            <SelectItem value="internal">Internal</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Channel list */}
      <div className="border rounded-lg divide-y max-h-[500px] overflow-y-auto">
        {filteredChannels.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No channels match your search
          </div>
        ) : (
          visibleChannels.map((channel) => {
            const isSaving = savingChannelId === channel.id
            const selectedId = selectedPartners[channel.id]

            return (
              <motion.div
                key={channel.id}
                initial={false}
                animate={{
                  backgroundColor: channel.is_mapped ? 'rgba(34, 197, 94, 0.05)' : 'transparent',
                }}
                transition={{ duration: 0.2, ease: easeOut }}
                className="flex items-center gap-3 p-3 hover:bg-muted/50"
              >
                {/* Channel info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {channel.is_mapped ? (
                      <Link2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                    ) : (
                      <Unlink className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
                    )}
                    {channel.is_private ? (
                      <Lock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    ) : (
                      <Hash className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    )}
                    <span className="font-medium truncate">{channel.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {CHANNEL_TYPE_LABEL[channel.channel_type]}
                    </Badge>
                    {isAlertsChannel(channel.name) && channel.channel_type !== 'alerts' && (
                      <Badge variant="outline" className="text-xs">
                        Alerts
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {channel.num_members} members
                    </span>
                  </div>
                  {channel.is_mapped && channel.partner_name && (
                    <p className="text-sm text-muted-foreground ml-6 truncate">
                      → {channel.partner_name}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {channel.is_mapped ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDeleteMapping(channel.id)}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Remove
                    </Button>
                  ) : (
                    <>
                      <Select
                        value={selectedId || ''}
                        onValueChange={(v) =>
                          setSelectedPartners(prev => ({ ...prev, [channel.id]: v }))
                        }
                      >
                        <SelectTrigger className="w-[180px] h-8 text-sm">
                          <SelectValue placeholder="Select partner..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                          {partners.map(p => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.brand_name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        className="h-8"
                        disabled={!selectedId || isSaving}
                        onClick={() => handleSaveMapping(channel.id)}
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
            Load more ({filteredChannels.length - visibleCount} remaining)
          </button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Map Slack channels to Sophie Hub partners. Use auto-match with your channel naming convention
        to bulk-match channels to partners. `-alerts` channel suffixes are grouped with their brand channel.
      </p>
    </div>
  )
}
