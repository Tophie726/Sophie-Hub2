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
  AlertCircle,
  ChevronDown,
  Sparkles,
  ExternalLink
} from 'lucide-react'
import Link from 'next/link'
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

interface Partner {
  id: string
  brand_name: string
}

interface Mapping {
  id: string
  entity_id: string
  external_id: string // client_name
  partner_name: string | null
  created_at: string
}

interface PartnerMappingProps {
  onMappingChange?: () => void
}

const easeOut: [number, number, number, number] = [0.22, 1, 0.36, 1]

export function PartnerMapping({ onMappingChange }: PartnerMappingProps) {
  // Data state
  const [clientNames, setClientNames] = useState<string[]>([])
  const [partners, setPartners] = useState<Partner[]>([])
  const [mappings, setMappings] = useState<Mapping[]>([])

  // Loading state
  const [isLoadingClients, setIsLoadingClients] = useState(true)
  const [isLoadingPartners, setIsLoadingPartners] = useState(true)
  const [isLoadingMappings, setIsLoadingMappings] = useState(true)
  const [savingClientName, setSavingClientName] = useState<string | null>(null)

  // UI state
  const [searchQuery, setSearchQuery] = useState('')
  const [showMapped, setShowMapped] = useState<'all' | 'mapped' | 'unmapped' | 'auto'>('all')
  const [selectedPartners, setSelectedPartners] = useState<Record<string, string>>({})
  const [isBulkSaving, setIsBulkSaving] = useState(false)

  // Pagination - only render 30 items at a time to prevent browser crash
  const PAGE_SIZE = 30
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  // Error state
  const [error, setError] = useState<string | null>(null)

  // Fetch BigQuery client names
  useEffect(() => {
    async function fetchClientNames() {
      try {
        const res = await fetch('/api/bigquery/client-names')
        if (!res.ok) throw new Error('Failed to fetch client names')
        const json = await res.json()
        setClientNames(json.data?.clientNames || [])
      } catch (err) {
        console.error('Error fetching client names:', err)
        setError('Failed to load BigQuery client names')
      } finally {
        setIsLoadingClients(false)
      }
    }
    fetchClientNames()
  }, [])

  // Fetch Sophie Hub partners
  useEffect(() => {
    async function fetchPartners() {
      try {
        const res = await fetch('/api/partners?limit=1000')
        if (!res.ok) throw new Error('Failed to fetch partners')
        const json = await res.json()
        const partnerList = json.data?.partners || json.partners || []
        setPartners(partnerList.map((p: { id: string; brand_name: string }) => ({
          id: p.id,
          brand_name: p.brand_name
        })))
      } catch (err) {
        console.error('Error fetching partners:', err)
        setError('Failed to load partners')
      } finally {
        setIsLoadingPartners(false)
      }
    }
    fetchPartners()
  }, [])

  // Fetch existing mappings
  useEffect(() => {
    async function fetchMappings() {
      try {
        const res = await fetch('/api/bigquery/partner-mappings')
        if (!res.ok) throw new Error('Failed to fetch mappings')
        const json = await res.json()
        setMappings(json.data?.mappings || [])
      } catch (err) {
        console.error('Error fetching mappings:', err)
        // Don't set error - mappings are optional
      } finally {
        setIsLoadingMappings(false)
      }
    }
    fetchMappings()
  }, [])

  // Build lookup maps
  const mappingsByClientName = useMemo(() => {
    return new Map(mappings.map(m => [m.external_id, m]))
  }, [mappings])

  const mappedPartnerIds = useMemo(() => {
    return new Set(mappings.map(m => m.entity_id))
  }, [mappings])

  // Build partner lookup for auto-matching (case-insensitive)
  const partnersByNormalizedName = useMemo(() => {
    const map = new Map<string, Partner>()
    for (const partner of partners) {
      // Normalize: lowercase, remove extra spaces
      const normalized = partner.brand_name.toLowerCase().trim()
      map.set(normalized, partner)
    }
    return map
  }, [partners])

  // Auto-match: find best partner for each unmapped client name
  const autoMatches = useMemo(() => {
    const matches: Record<string, { partnerId: string; confidence: 'exact' | 'close' }> = {}

    for (const clientName of clientNames) {
      // Skip if already mapped
      if (mappingsByClientName.has(clientName)) continue

      const normalized = clientName.toLowerCase().trim()

      // Try exact match (case-insensitive)
      const exactMatch = partnersByNormalizedName.get(normalized)
      if (exactMatch && !mappedPartnerIds.has(exactMatch.id)) {
        matches[clientName] = { partnerId: exactMatch.id, confidence: 'exact' }
        continue
      }

      // Try matching without special chars (e.g., "Coat Defense" vs "CoatDefense")
      const normalizedNoSpaces = normalized.replace(/[^a-z0-9]/g, '')
      for (const [partnerNorm, partner] of Array.from(partnersByNormalizedName.entries())) {
        const partnerNoSpaces = partnerNorm.replace(/[^a-z0-9]/g, '')
        if (normalizedNoSpaces === partnerNoSpaces && !mappedPartnerIds.has(partner.id)) {
          matches[clientName] = { partnerId: partner.id, confidence: 'close' }
          break
        }
      }
    }

    return matches
  }, [clientNames, mappingsByClientName, partnersByNormalizedName, mappedPartnerIds])

  // Auto-populate selections with high-confidence matches
  useEffect(() => {
    if (Object.keys(autoMatches).length === 0) return

    // Only auto-select exact matches
    const exactMatches: Record<string, string> = {}
    for (const [clientName, match] of Object.entries(autoMatches)) {
      if (match.confidence === 'exact') {
        exactMatches[clientName] = match.partnerId
      }
    }

    if (Object.keys(exactMatches).length > 0) {
      setSelectedPartners(prev => ({ ...exactMatches, ...prev }))
    }
  }, [autoMatches])

  // Filter client names
  const filteredClientNames = useMemo(() => {
    let filtered = clientNames

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(name =>
        name.toLowerCase().includes(query)
      )
    }

    // Mapped/unmapped/auto filter
    if (showMapped === 'mapped') {
      filtered = filtered.filter(name => mappingsByClientName.has(name))
    } else if (showMapped === 'unmapped') {
      filtered = filtered.filter(name => !mappingsByClientName.has(name))
    } else if (showMapped === 'auto') {
      filtered = filtered.filter(name => !mappingsByClientName.has(name) && autoMatches[name])
    }

    return filtered
  }, [clientNames, searchQuery, showMapped, mappingsByClientName, autoMatches])

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [searchQuery, showMapped])

  // Only render visible items (pagination)
  const visibleClientNames = useMemo(() => {
    return filteredClientNames.slice(0, visibleCount)
  }, [filteredClientNames, visibleCount])

  const hasMore = visibleCount < filteredClientNames.length

  // Stats
  const mappedCount = mappings.length
  const unmappedCount = clientNames.length - mappedCount
  const autoMatchCount = Object.keys(autoMatches).length

  // Handle mapping save
  async function handleSaveMapping(clientName: string) {
    const partnerId = selectedPartners[clientName]
    if (!partnerId) return

    setSavingClientName(clientName)

    try {
      const res = await fetch('/api/bigquery/partner-mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partner_id: partnerId,
          client_name: clientName
        })
      })

      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error?.message || 'Failed to save mapping')
      }

      const json = await res.json()
      const newMapping = json.data?.mapping

      // Update local state
      setMappings(prev => {
        const existing = prev.findIndex(m => m.external_id === clientName)
        if (existing >= 0) {
          const updated = [...prev]
          updated[existing] = newMapping
          return updated
        }
        return [...prev, newMapping]
      })

      // Clear selection
      setSelectedPartners(prev => {
        const next = { ...prev }
        delete next[clientName]
        return next
      })

      toast.success(`Mapped "${clientName}" to partner`)
      onMappingChange?.()
    } catch (err) {
      console.error('Error saving mapping:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to save mapping')
    } finally {
      setSavingClientName(null)
    }
  }

  // Handle mapping delete
  async function handleDeleteMapping(mapping: Mapping) {
    try {
      const res = await fetch(`/api/bigquery/partner-mappings?id=${mapping.id}`, {
        method: 'DELETE'
      })

      if (!res.ok) {
        throw new Error('Failed to delete mapping')
      }

      // Update local state
      setMappings(prev => prev.filter(m => m.id !== mapping.id))
      toast.success(`Removed mapping for "${mapping.external_id}"`)
      onMappingChange?.()
    } catch (err) {
      console.error('Error deleting mapping:', err)
      toast.error('Failed to remove mapping')
    }
  }

  // Handle bulk save of all auto-matched (parallel batches for speed)
  async function handleBulkSaveAutoMatched() {
    const autoMatchedItems = Object.entries(autoMatches).filter(
      ([clientName]) => !mappingsByClientName.has(clientName)
    )

    if (autoMatchedItems.length === 0) {
      toast.info('No auto-matched items to save')
      return
    }

    setIsBulkSaving(true)
    const BATCH_SIZE = 10 // Save 10 at a time in parallel
    let saved = 0
    let failed = 0
    const newMappings: Mapping[] = []

    // Process in parallel batches
    for (let i = 0; i < autoMatchedItems.length; i += BATCH_SIZE) {
      const batch = autoMatchedItems.slice(i, i + BATCH_SIZE)

      const results = await Promise.all(
        batch.map(async ([clientName, match]) => {
          try {
            const res = await fetch('/api/bigquery/partner-mappings', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                partner_id: match.partnerId,
                client_name: clientName
              })
            })

            if (res.ok) {
              const json = await res.json()
              return { success: true, mapping: json.data?.mapping }
            }
            return { success: false }
          } catch {
            return { success: false }
          }
        })
      )

      // Collect results
      for (const result of results) {
        if (result.success && result.mapping) {
          saved++
          newMappings.push(result.mapping)
        } else {
          failed++
        }
      }
    }

    // Update state once with all new mappings
    setMappings(prev => [...prev, ...newMappings])
    setIsBulkSaving(false)
    setSelectedPartners({}) // Clear selections

    if (saved > 0) {
      toast.success(`Saved ${saved} mappings${failed > 0 ? ` (${failed} failed)` : ''}`)
      onMappingChange?.()
    } else {
      toast.error('Failed to save mappings')
    }
  }

  // Loading state
  const isLoading = isLoadingClients || isLoadingPartners || isLoadingMappings

  if (isLoading) {
    return (
      <div className="space-y-4">
        {/* Loading header */}
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">
            {isLoadingClients ? 'Fetching client names from BigQuery...' :
             isLoadingPartners ? 'Loading Sophie Hub partners...' :
             'Loading existing mappings...'}
          </span>
        </div>

        {/* Shimmer skeleton with wave animation */}
        <div className="rounded-lg border overflow-hidden">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 p-3 border-b last:border-b-0"
            >
              {/* Link icon placeholder */}
              <div
                className="h-4 w-4 rounded bg-muted/60"
                style={{
                  animation: 'pulse 1.5s ease-in-out infinite',
                  animationDelay: `${i * 100}ms`
                }}
              />
              {/* Client name placeholder */}
              <div
                className="h-4 rounded bg-muted/60"
                style={{
                  width: `${120 + (i % 3) * 40}px`,
                  animation: 'pulse 1.5s ease-in-out infinite',
                  animationDelay: `${i * 100 + 50}ms`
                }}
              />
              {/* Spacer */}
              <div className="flex-1" />
              {/* Partner dropdown placeholder */}
              <div
                className="h-8 w-[180px] rounded bg-muted/40"
                style={{
                  animation: 'pulse 1.5s ease-in-out infinite',
                  animationDelay: `${i * 100 + 100}ms`
                }}
              />
              {/* Button placeholder */}
              <div
                className="h-8 w-8 rounded bg-muted/40"
                style={{
                  animation: 'pulse 1.5s ease-in-out infinite',
                  animationDelay: `${i * 100 + 150}ms`
                }}
              />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="h-8 w-8 text-destructive mb-2" />
        <p className="text-muted-foreground">{error}</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => window.location.reload()}
        >
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Stats header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="text-sm">
            {clientNames.length} BigQuery clients
          </Badge>
          <Badge variant="secondary" className="text-sm bg-green-500/10 text-green-600">
            {mappedCount} mapped
          </Badge>
          <Badge variant="secondary" className="text-sm bg-orange-500/10 text-orange-600">
            {unmappedCount} unmapped
          </Badge>
          {autoMatchCount > 0 && (
            <Badge variant="secondary" className="text-sm bg-purple-500/10 text-purple-600 flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              {autoMatchCount} auto-matched
            </Badge>
          )}
        </div>
      </div>

      {/* Filters and Actions */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search client names..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        <Select value={showMapped} onValueChange={(v) => setShowMapped(v as typeof showMapped)}>
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="mapped">Mapped only</SelectItem>
            <SelectItem value="unmapped">Unmapped only</SelectItem>
            <SelectItem value="auto">Auto-matched</SelectItem>
          </SelectContent>
        </Select>

        {/* Bulk save button */}
        {autoMatchCount > 0 && (
          <Button
            onClick={handleBulkSaveAutoMatched}
            disabled={isBulkSaving}
            className="h-9 bg-purple-600 hover:bg-purple-700"
          >
            {isBulkSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Save all {autoMatchCount} auto-matched
              </>
            )}
          </Button>
        )}
      </div>

      {/* Mapping list - paginated for performance */}
      <div className="border rounded-lg divide-y max-h-[500px] overflow-y-auto">
        {filteredClientNames.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No client names match your search
          </div>
        ) : (
          visibleClientNames.map((clientName) => {
            const mapping = mappingsByClientName.get(clientName)
            const isMapped = !!mapping
            const selectedPartnerId = selectedPartners[clientName]
            const isSaving = savingClientName === clientName
            const autoMatch = autoMatches[clientName]
            const isAutoMatched = !!autoMatch && selectedPartnerId === autoMatch.partnerId

            return (
              <motion.div
                key={clientName}
                initial={false}
                animate={{
                  backgroundColor: isMapped
                    ? 'rgba(34, 197, 94, 0.05)'
                    : isAutoMatched
                    ? 'rgba(147, 51, 234, 0.05)'
                    : 'transparent'
                }}
                transition={{ duration: 0.2, ease: easeOut }}
                className="flex items-center gap-4 p-3 hover:bg-muted/50"
              >
                {/* Client name */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {isMapped ? (
                      <Link2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                    ) : isAutoMatched ? (
                      <Sparkles className="h-4 w-4 text-purple-500 flex-shrink-0" />
                    ) : (
                      <Unlink className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
                    )}
                    <span className="font-medium truncate">{clientName}</span>
                    {isAutoMatched && (
                      <span className="text-xs text-purple-500 bg-purple-500/10 px-1.5 py-0.5 rounded">
                        auto
                      </span>
                    )}
                  </div>
                  {isMapped && mapping.partner_name && (
                    <p className="text-sm text-muted-foreground ml-6 truncate">
                      → {mapping.partner_name}
                    </p>
                  )}
                </div>

                {/* Action area */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {isMapped ? (
                    <div className="flex items-center gap-1">
                      <Link
                        href={`/partners/${mapping.entity_id}`}
                        className="inline-flex items-center gap-1 h-8 px-2.5 text-sm text-muted-foreground hover:text-primary rounded-md hover:bg-muted transition-colors"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        View
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDeleteMapping(mapping)}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <>
                      <Select
                        value={selectedPartnerId || ''}
                        onValueChange={(v) =>
                          setSelectedPartners(prev => ({ ...prev, [clientName]: v }))
                        }
                      >
                        <SelectTrigger className="w-[200px] h-8 text-sm">
                          <SelectValue placeholder="Select partner..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                          {partners
                            .filter(p => !mappedPartnerIds.has(p.id))
                            .map(partner => (
                              <SelectItem key={partner.id} value={partner.id}>
                                {partner.brand_name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>

                      <Button
                        size="sm"
                        className="h-8"
                        disabled={!selectedPartnerId || isSaving}
                        onClick={() => handleSaveMapping(clientName)}
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

        {/* Load more button */}
        {hasMore && (
          <button
            onClick={() => setVisibleCount(prev => prev + PAGE_SIZE)}
            className="w-full p-3 text-sm text-muted-foreground hover:bg-muted/50 flex items-center justify-center gap-2 transition-colors"
          >
            <ChevronDown className="h-4 w-4" />
            Load more ({filteredClientNames.length - visibleCount} remaining)
          </button>
        )}
      </div>

      {/* Footer hint */}
      <p className="text-xs text-muted-foreground">
        Map BigQuery client names to Sophie Hub partners. Once mapped, partner dashboards
        will show their specific advertising and sales data.
      </p>
    </div>
  )
}
