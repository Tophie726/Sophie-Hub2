'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
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
  ExternalLink,
  RefreshCw,
  Table,
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
  external_id: string
  partner_name: string | null
  created_at: string
}

type SheetSuggestionStatus =
  | 'ready'
  | 'already_mapped'
  | 'partner_not_found'
  | 'ambiguous_partner'
  | 'client_conflict'
  | 'missing_data'

interface SheetSuggestion {
  rowNumber: number
  brand: string
  clientId: string
  clientName: string | null
  matchedPartnerId: string | null
  matchedPartnerName: string | null
  partnerMatchType: 'exact' | 'normalized' | null
  status: SheetSuggestionStatus
  currentPartnerExternalId: string | null
  conflictingPartnerName: string | null
}

interface SheetSummary {
  ready: number
  already_mapped: number
  partner_not_found: number
  ambiguous_partner: number
  client_conflict: number
  missing_data: number
}

interface SheetMeta {
  title: string
  tabName: string
  parsedRows: number
}

interface PartnerMappingProps {
  onMappingChange?: () => void
}

type MappingTab = 'bigquery' | 'sheet'
type AutoMatchConfidence = 'exact' | 'close' | 'sheet'

const easeOut: [number, number, number, number] = [0.22, 1, 0.36, 1]
const PAGE_SIZE = 30

function normalizeExternalId(value: string): string {
  return value.trim().toLowerCase()
}

function compactName(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]/g, '')
}

function mergeMappings(existing: Mapping[], incoming: Mapping[]): Mapping[] {
  const next = [...existing]

  for (const mapping of incoming) {
    const byId = next.findIndex(item => item.id === mapping.id)
    if (byId >= 0) {
      next[byId] = mapping
      continue
    }

    const key = normalizeExternalId(mapping.external_id)
    const byExternal = next.findIndex(item => normalizeExternalId(item.external_id) === key)
    if (byExternal >= 0) {
      next[byExternal] = mapping
      continue
    }

    next.push(mapping)
  }

  return next
}

function getSheetStatusBadge(status: SheetSuggestionStatus) {
  switch (status) {
    case 'ready':
      return <Badge className="bg-blue-500/10 text-blue-600">Ready</Badge>
    case 'already_mapped':
      return <Badge className="bg-green-500/10 text-green-600">Already mapped</Badge>
    case 'partner_not_found':
      return <Badge className="bg-orange-500/10 text-orange-600">Partner not found</Badge>
    case 'ambiguous_partner':
      return <Badge className="bg-orange-500/10 text-orange-600">Ambiguous partner</Badge>
    case 'client_conflict':
      return <Badge className="bg-red-500/10 text-red-600">Conflict</Badge>
    case 'missing_data':
      return <Badge className="bg-muted text-muted-foreground">Missing data</Badge>
    default:
      return null
  }
}

function buildSheetSummaryFromSuggestions(suggestions: SheetSuggestion[]): SheetSummary {
  return suggestions.reduce<SheetSummary>(
    (summary, suggestion) => {
      summary[suggestion.status] += 1
      return summary
    },
    {
      ready: 0,
      already_mapped: 0,
      partner_not_found: 0,
      ambiguous_partner: 0,
      client_conflict: 0,
      missing_data: 0,
    }
  )
}

export function PartnerMapping({ onMappingChange }: PartnerMappingProps) {
  // Data state
  const [activeTab, setActiveTab] = useState<MappingTab>('bigquery')
  const [clientNames, setClientNames] = useState<string[]>([])
  const [partners, setPartners] = useState<Partner[]>([])
  const [mappings, setMappings] = useState<Mapping[]>([])
  const [sheetSuggestions, setSheetSuggestions] = useState<SheetSuggestion[]>([])
  const [sheetSummary, setSheetSummary] = useState<SheetSummary | null>(null)
  const [sheetMeta, setSheetMeta] = useState<SheetMeta | null>(null)

  // Loading state
  const [isLoadingClients, setIsLoadingClients] = useState(true)
  const [isLoadingPartners, setIsLoadingPartners] = useState(true)
  const [isLoadingMappings, setIsLoadingMappings] = useState(true)
  const [isLoadingSheet, setIsLoadingSheet] = useState(true)
  const [savingClientName, setSavingClientName] = useState<string | null>(null)
  const [isSyncingSheet, setIsSyncingSheet] = useState(false)

  // UI state
  const [searchQuery, setSearchQuery] = useState('')
  const [showMapped, setShowMapped] = useState<'all' | 'mapped' | 'unmapped' | 'auto'>('all')
  const [selectedPartners, setSelectedPartners] = useState<Record<string, string>>({})
  const [isBulkSaving, setIsBulkSaving] = useState(false)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  // Error state
  const [error, setError] = useState<string | null>(null)
  const [sheetError, setSheetError] = useState<string | null>(null)

  const fetchClientNames = useCallback(async () => {
    setIsLoadingClients(true)
    try {
      const res = await fetch('/api/bigquery/client-names')
      if (!res.ok) throw new Error('Failed to fetch client identifiers')
      const json = await res.json()
      setClientNames(json.data?.clientNames || [])
    } catch (err) {
      console.error('Error fetching client names:', err)
      setError('Failed to load BigQuery client identifiers')
    } finally {
      setIsLoadingClients(false)
    }
  }, [])

  const fetchPartners = useCallback(async () => {
    setIsLoadingPartners(true)
    try {
      const res = await fetch('/api/partners?limit=1000')
      if (!res.ok) throw new Error('Failed to fetch partners')
      const json = await res.json()
      const partnerList = json.data?.partners || json.partners || []
      setPartners(
        partnerList.map((partner: { id: string; brand_name: string }) => ({
          id: partner.id,
          brand_name: partner.brand_name,
        }))
      )
    } catch (err) {
      console.error('Error fetching partners:', err)
      setError('Failed to load partners')
    } finally {
      setIsLoadingPartners(false)
    }
  }, [])

  const fetchMappings = useCallback(async () => {
    setIsLoadingMappings(true)
    try {
      const res = await fetch('/api/bigquery/partner-mappings')
      if (!res.ok) throw new Error('Failed to fetch mappings')
      const json = await res.json()
      setMappings(json.data?.mappings || [])
    } catch (err) {
      console.error('Error fetching mappings:', err)
    } finally {
      setIsLoadingMappings(false)
    }
  }, [])

  const fetchSheetMappings = useCallback(async () => {
    setIsLoadingSheet(true)
    setSheetError(null)
    try {
      const res = await fetch('/api/bigquery/sheet-mappings')
      if (!res.ok) {
        const json = await res.json().catch(() => null)
        throw new Error(json?.error?.message || 'Failed to load reference sheet')
      }
      const json = await res.json()
      const data = json.data
      setSheetSuggestions((data?.suggestions || []) as SheetSuggestion[])
      setSheetSummary((data?.summary || null) as SheetSummary | null)
      setSheetMeta({
        title: data?.sheet?.title || 'Reference sheet',
        tabName: data?.sheet?.tabName || 'Tab',
        parsedRows: data?.sheet?.parsedRows || 0,
      })
    } catch (err) {
      console.error('Error fetching sheet mappings:', err)
      setSheetError(err instanceof Error ? err.message : 'Failed to load reference sheet')
    } finally {
      setIsLoadingSheet(false)
    }
  }, [])

  useEffect(() => {
    fetchClientNames()
    fetchPartners()
    fetchMappings()
    fetchSheetMappings()
  }, [fetchClientNames, fetchPartners, fetchMappings, fetchSheetMappings])

  // Build lookup maps
  const mappingsByClientKey = useMemo(() => {
    const map = new Map<string, Mapping>()
    for (const mapping of mappings) {
      map.set(normalizeExternalId(mapping.external_id), mapping)
    }
    return map
  }, [mappings])

  const sheetAutoMatchesByClient = useMemo(() => {
    const map = new Map<string, { partnerId: string }>()
    for (const suggestion of sheetSuggestions) {
      if (
        (suggestion.status === 'ready' || suggestion.status === 'already_mapped') &&
        suggestion.clientId &&
        suggestion.matchedPartnerId
      ) {
        map.set(normalizeExternalId(suggestion.clientId), {
          partnerId: suggestion.matchedPartnerId,
        })
      }
    }
    return map
  }, [sheetSuggestions])

  const clientIdentifiers = useMemo(() => {
    const values = new Set<string>()

    for (const client of clientNames) {
      const trimmed = client.trim()
      if (trimmed) values.add(trimmed)
    }

    for (const suggestion of sheetSuggestions) {
      const trimmed = suggestion.clientId.trim()
      if (trimmed) values.add(trimmed)
    }

    return Array.from(values).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    )
  }, [clientNames, sheetSuggestions])

  // Build partner lookup for auto-matching (case-insensitive)
  const partnersByNormalizedName = useMemo(() => {
    const map = new Map<string, Partner>()
    for (const partner of partners) {
      const normalized = partner.brand_name.toLowerCase().trim()
      map.set(normalized, partner)
    }
    return map
  }, [partners])

  // Auto-match: prioritize sheet-derived matches, then fallback to fuzzy matching.
  const autoMatches = useMemo(() => {
    const matches: Record<string, { partnerId: string; confidence: AutoMatchConfidence }> = {}

    for (const clientName of clientIdentifiers) {
      const clientKey = normalizeExternalId(clientName)

      // Skip if already mapped
      if (mappingsByClientKey.has(clientKey)) continue

      // Highest confidence: reference sheet says which partner owns this client_id.
      const sheetMatch = sheetAutoMatchesByClient.get(clientKey)
      if (sheetMatch) {
        matches[clientName] = { partnerId: sheetMatch.partnerId, confidence: 'sheet' }
        continue
      }

      const normalized = clientName.toLowerCase().trim()

      // Try exact name match (case-insensitive)
      const exactMatch = partnersByNormalizedName.get(normalized)
      if (exactMatch) {
        matches[clientName] = { partnerId: exactMatch.id, confidence: 'exact' }
        continue
      }

      // Try matching without special chars (e.g., "Coat Defense" vs "CoatDefense")
      const normalizedNoSpaces = compactName(clientName)
      for (const [partnerNormalizedName, partner] of Array.from(partnersByNormalizedName.entries())) {
        if (compactName(partnerNormalizedName) === normalizedNoSpaces) {
          matches[clientName] = { partnerId: partner.id, confidence: 'close' }
          break
        }
      }
    }

    return matches
  }, [clientIdentifiers, mappingsByClientKey, sheetAutoMatchesByClient, partnersByNormalizedName])

  // Auto-populate selections with high-confidence matches.
  useEffect(() => {
    if (Object.keys(autoMatches).length === 0) return

    const highConfidenceMatches: Record<string, string> = {}
    for (const [clientName, match] of Object.entries(autoMatches)) {
      if (match.confidence === 'exact' || match.confidence === 'sheet') {
        highConfidenceMatches[clientName] = match.partnerId
      }
    }

    if (Object.keys(highConfidenceMatches).length > 0) {
      // Keep user overrides by spreading previous selections last.
      setSelectedPartners(prev => ({ ...highConfidenceMatches, ...prev }))
    }
  }, [autoMatches])

  // Filter client identifiers
  const filteredClientNames = useMemo(() => {
    let filtered = clientIdentifiers

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(name => name.toLowerCase().includes(query))
    }

    if (showMapped === 'mapped') {
      filtered = filtered.filter(name => mappingsByClientKey.has(normalizeExternalId(name)))
    } else if (showMapped === 'unmapped') {
      filtered = filtered.filter(name => !mappingsByClientKey.has(normalizeExternalId(name)))
    } else if (showMapped === 'auto') {
      filtered = filtered.filter(
        name => !mappingsByClientKey.has(normalizeExternalId(name)) && !!autoMatches[name]
      )
    }

    return filtered
  }, [clientIdentifiers, searchQuery, showMapped, mappingsByClientKey, autoMatches])

  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [searchQuery, showMapped])

  const visibleClientNames = useMemo(() => {
    return filteredClientNames.slice(0, visibleCount)
  }, [filteredClientNames, visibleCount])

  const hasMore = visibleCount < filteredClientNames.length

  // Stats
  const mappedCount = useMemo(
    () => clientIdentifiers.filter(client => mappingsByClientKey.has(normalizeExternalId(client))).length,
    [clientIdentifiers, mappingsByClientKey]
  )
  const unmappedCount = clientIdentifiers.length - mappedCount
  const autoMatchCount = Object.keys(autoMatches).length

  const persistMapping = useCallback(async (clientIdentifier: string, partnerId: string) => {
    setSavingClientName(clientIdentifier)

    try {
      const res = await fetch('/api/bigquery/partner-mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partner_id: partnerId,
          client_name: clientIdentifier,
        }),
      })

      if (!res.ok) {
        const json = await res.json().catch(() => null)
        throw new Error(json?.error?.message || 'Failed to save mapping')
      }

      const json = await res.json()
      const newMapping = json.data?.mapping as Mapping
      if (newMapping) {
        setMappings(prev => mergeMappings(prev, [newMapping]))
      }

      toast.success(`Mapped "${clientIdentifier}" to partner`)
      onMappingChange?.()
      return newMapping || null
    } catch (err) {
      console.error('Error saving mapping:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to save mapping')
      return null
    } finally {
      setSavingClientName(null)
    }
  }, [onMappingChange])

  async function handleSaveMapping(clientName: string) {
    const partnerId = selectedPartners[clientName]
    if (!partnerId) return

    const savedMapping = await persistMapping(clientName, partnerId)
    if (!savedMapping) return

    // Clear per-row selection after successful save.
    setSelectedPartners(prev => {
      const next = { ...prev }
      delete next[clientName]
      return next
    })
  }

  const applySheetSuggestionLocally = useCallback((appliedSuggestion: SheetSuggestion) => {
    const appliedClientKey = normalizeExternalId(appliedSuggestion.clientId)

    setSheetSuggestions(prev => {
      const updated = prev.map(suggestion => {
        const suggestionClientKey = normalizeExternalId(suggestion.clientId)
        const sameClient = suggestionClientKey === appliedClientKey
        const sameRow =
          sameClient &&
          suggestion.rowNumber === appliedSuggestion.rowNumber &&
          compactName(suggestion.brand) === compactName(appliedSuggestion.brand)

        if (
          sameRow ||
          (sameClient &&
            suggestion.matchedPartnerId &&
            suggestion.matchedPartnerId === appliedSuggestion.matchedPartnerId)
        ) {
          return {
            ...suggestion,
            status: 'already_mapped' as const,
            currentPartnerExternalId: appliedSuggestion.clientId,
            conflictingPartnerName: null,
          }
        }

        if (
          sameClient &&
          suggestion.matchedPartnerId &&
          suggestion.matchedPartnerId !== appliedSuggestion.matchedPartnerId
        ) {
          return {
            ...suggestion,
            status: 'client_conflict' as const,
            conflictingPartnerName: appliedSuggestion.matchedPartnerName,
          }
        }

        return suggestion
      })

      setSheetSummary(buildSheetSummaryFromSuggestions(updated))
      return updated
    })
  }, [])

  async function handleApplySheetSuggestion(suggestion: SheetSuggestion) {
    if (!suggestion.matchedPartnerId || !suggestion.clientId) return

    const savedMapping = await persistMapping(suggestion.clientId, suggestion.matchedPartnerId)
    if (!savedMapping) return

    applySheetSuggestionLocally(suggestion)
  }

  // Handle mapping delete
  async function handleDeleteMapping(mapping: Mapping) {
    try {
      const res = await fetch(`/api/bigquery/partner-mappings?id=${mapping.id}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        throw new Error('Failed to delete mapping')
      }

      setMappings(prev => prev.filter(item => item.id !== mapping.id))
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
      ([clientName]) => !mappingsByClientKey.has(normalizeExternalId(clientName))
    )

    if (autoMatchedItems.length === 0) {
      toast.info('No auto-matched items to save')
      return
    }

    setIsBulkSaving(true)
    const BATCH_SIZE = 10
    let saved = 0
    let failed = 0
    const newMappings: Mapping[] = []

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
                client_name: clientName,
              }),
            })

            if (res.ok) {
              const json = await res.json()
              return { success: true, mapping: json.data?.mapping as Mapping }
            }
            return { success: false, mapping: null as Mapping | null }
          } catch {
            return { success: false, mapping: null as Mapping | null }
          }
        })
      )

      for (const result of results) {
        if (result.success && result.mapping) {
          saved += 1
          newMappings.push(result.mapping)
        } else {
          failed += 1
        }
      }
    }

    if (newMappings.length > 0) {
      setMappings(prev => mergeMappings(prev, newMappings))
    }

    setIsBulkSaving(false)
    setSelectedPartners({})

    if (saved > 0) {
      toast.success(`Saved ${saved} mappings${failed > 0 ? ` (${failed} failed)` : ''}`)
      onMappingChange?.()
      await Promise.all([fetchMappings(), fetchClientNames(), fetchSheetMappings()])
    } else {
      toast.error('Failed to save mappings')
    }
  }

  async function handleSyncSheetMappings() {
    setIsSyncingSheet(true)
    try {
      const res = await fetch('/api/bigquery/sheet-mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dry_run: false }),
      })

      if (!res.ok) {
        const json = await res.json().catch(() => null)
        throw new Error(json?.error?.message || 'Failed to sync sheet mappings')
      }

      const json = await res.json()
      const data = json.data as {
        applied?: number
        inserted?: number
        updated?: number
        conflicts?: number
      } | null

      const applied = data?.applied || 0
      const inserted = data?.inserted || 0
      const updated = data?.updated || 0
      const conflicts = data?.conflicts || 0

      await Promise.all([fetchMappings(), fetchClientNames(), fetchSheetMappings()])
      onMappingChange?.()

      toast.success(
        `Sheet sync complete: ${applied} applied (${inserted} new, ${updated} updated${conflicts > 0 ? `, ${conflicts} conflicts` : ''})`
      )
    } catch (err) {
      console.error('Error syncing sheet mappings:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to sync sheet mappings')
    } finally {
      setIsSyncingSheet(false)
    }
  }

  // Loading state for core mapping tab
  const isLoading = isLoadingClients || isLoadingPartners || isLoadingMappings

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">
            {isLoadingClients
              ? 'Fetching client identifiers from BigQuery...'
              : isLoadingPartners
                ? 'Loading Sophie Hub partners...'
                : 'Loading existing mappings...'}
          </span>
        </div>

        <div className="rounded-lg border overflow-hidden">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 p-3 border-b last:border-b-0"
            >
              <div
                className="h-4 w-4 rounded bg-muted/60"
                style={{
                  animation: 'pulse 1.5s ease-in-out infinite',
                  animationDelay: `${i * 100}ms`,
                }}
              />
              <div
                className="h-4 rounded bg-muted/60"
                style={{
                  width: `${120 + (i % 3) * 40}px`,
                  animation: 'pulse 1.5s ease-in-out infinite',
                  animationDelay: `${i * 100 + 50}ms`,
                }}
              />
              <div className="flex-1" />
              <div
                className="h-8 w-[180px] rounded bg-muted/40"
                style={{
                  animation: 'pulse 1.5s ease-in-out infinite',
                  animationDelay: `${i * 100 + 100}ms`,
                }}
              />
              <div
                className="h-8 w-8 rounded bg-muted/40"
                style={{
                  animation: 'pulse 1.5s ease-in-out infinite',
                  animationDelay: `${i * 100 + 150}ms`,
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
          type="button"
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => {
            setError(null)
            void Promise.all([fetchClientNames(), fetchPartners(), fetchMappings(), fetchSheetMappings()])
          }}
        >
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Top-level tabs */}
      <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg w-fit overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('bigquery')}
          className={`
            relative px-4 py-2 rounded-md text-sm font-medium transition-colors
            ${activeTab === 'bigquery' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}
          `}
        >
          {activeTab === 'bigquery' && (
            <motion.div
              layoutId="bqPartnerMappingTab"
              className="absolute inset-0 bg-background ring-1 ring-border/60 rounded-md"
              transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
            />
          )}
          <span className="relative z-10">BigQuery Mapping</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('sheet')}
          className={`
            relative px-4 py-2 rounded-md text-sm font-medium transition-colors
            ${activeTab === 'sheet' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}
          `}
        >
          {activeTab === 'sheet' && (
            <motion.div
              layoutId="bqPartnerMappingTab"
              className="absolute inset-0 bg-background ring-1 ring-border/60 rounded-md"
              transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
            />
          )}
          <span className="relative z-10 flex items-center gap-1.5">
            <Table className="h-3.5 w-3.5" />
            Reference Sheet
          </span>
        </button>
      </div>

      {activeTab === 'bigquery' && (
        <>
          {/* Stats header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 flex-wrap">
              <Badge variant="outline" className="text-sm">
                {clientIdentifiers.length} BigQuery identifiers
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
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[220px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search client identifiers..."
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

            {autoMatchCount > 0 && (
              <Button
                type="button"
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
          <div className="border rounded-lg divide-y max-h-[500px] overflow-y-auto dark:border-border/60 dark:ring-1 dark:ring-white/[0.06]">
            {filteredClientNames.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No client identifiers match your search
              </div>
            ) : (
              visibleClientNames.map((clientName) => {
                const mapping = mappingsByClientKey.get(normalizeExternalId(clientName))
                const isMapped = !!mapping
                const selectedPartnerId = selectedPartners[clientName]
                const isSaving = savingClientName === clientName
                const autoMatch = autoMatches[clientName]
                const isAutoMatched = !!autoMatch && selectedPartnerId === autoMatch.partnerId
                const isSheetMatch = autoMatch?.confidence === 'sheet'

                return (
                  <motion.div
                    key={clientName}
                    initial={false}
                    animate={{
                      backgroundColor: isMapped
                        ? 'rgba(34, 197, 94, 0.05)'
                        : isAutoMatched
                          ? isSheetMatch
                            ? 'rgba(59, 130, 246, 0.08)'
                            : 'rgba(147, 51, 234, 0.05)'
                          : 'transparent',
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
                          <Sparkles className={`h-4 w-4 flex-shrink-0 ${isSheetMatch ? 'text-blue-500' : 'text-purple-500'}`} />
                        ) : (
                          <Unlink className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
                        )}
                        <span className="font-medium truncate">{clientName}</span>
                        {isAutoMatched && (
                          <span className={`text-xs px-1.5 py-0.5 rounded ${isSheetMatch ? 'text-blue-600 bg-blue-500/10' : 'text-purple-500 bg-purple-500/10'}`}>
                            {isSheetMatch ? 'sheet' : 'auto'}
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
                            type="button"
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
                            onValueChange={(value) =>
                              setSelectedPartners(prev => ({ ...prev, [clientName]: value }))
                            }
                          >
                            <SelectTrigger className="w-[220px] h-8 text-sm">
                              <SelectValue placeholder="Select partner..." />
                            </SelectTrigger>
                            <SelectContent className="max-h-[300px]">
                              {partners.map(partner => (
                                <SelectItem key={partner.id} value={partner.id}>
                                  {partner.brand_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          <Button
                            type="button"
                            size="sm"
                            className="h-8"
                            disabled={!selectedPartnerId || isSaving}
                            onClick={() => handleSaveMapping(clientName)}
                            aria-label={`Confirm mapping for ${clientName}`}
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
                type="button"
                onClick={() => setVisibleCount(prev => prev + PAGE_SIZE)}
                className="w-full p-3 text-sm text-muted-foreground hover:bg-muted/50 flex items-center justify-center gap-2 transition-colors"
              >
                <ChevronDown className="h-4 w-4" />
                Load more ({filteredClientNames.length - visibleCount} remaining)
              </button>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Map BigQuery client identifiers to Sophie Hub partners. Sheet-derived matches are tagged as
            <span className="font-medium"> sheet</span> and can be saved in bulk.
          </p>
        </>
      )}

      {activeTab === 'sheet' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              {sheetMeta && (
                <Badge variant="outline" className="text-sm">
                  {sheetMeta.title} · {sheetMeta.tabName}
                </Badge>
              )}
              <Badge variant="secondary" className="text-sm">
                {(sheetMeta?.parsedRows ?? sheetSuggestions.length)} rows scanned
              </Badge>
              <Badge variant="secondary" className="text-sm bg-blue-500/10 text-blue-600">
                {sheetSummary?.ready || 0} ready
              </Badge>
              <Badge variant="secondary" className="text-sm bg-green-500/10 text-green-600">
                {sheetSummary?.already_mapped || 0} already mapped
              </Badge>
              {(sheetSummary?.client_conflict || 0) > 0 && (
                <Badge variant="secondary" className="text-sm bg-red-500/10 text-red-600">
                  {sheetSummary?.client_conflict || 0} conflicts
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9"
                onClick={() => void fetchSheetMappings()}
                disabled={isLoadingSheet || isSyncingSheet}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingSheet ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-9"
                onClick={handleSyncSheetMappings}
                disabled={isLoadingSheet || isSyncingSheet || (sheetSummary?.ready || 0) === 0}
              >
                {isSyncingSheet ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>Sync {sheetSummary?.ready || 0} ready matches</>
                )}
              </Button>
            </div>
          </div>

          {isLoadingSheet ? (
            <div className="flex items-center gap-2 py-10 justify-center text-muted-foreground border rounded-lg">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Loading reference sheet mappings...</span>
            </div>
          ) : sheetError ? (
            <div className="flex flex-col items-center justify-center py-10 text-center border rounded-lg">
              <AlertCircle className="h-6 w-6 text-destructive mb-2" />
              <p className="text-sm text-muted-foreground">{sheetError}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => void fetchSheetMappings()}
              >
                Retry
              </Button>
            </div>
          ) : (
            <div className="border rounded-lg divide-y max-h-[560px] overflow-y-auto dark:border-border/60 dark:ring-1 dark:ring-white/[0.06]">
              {sheetSuggestions.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  No rows found in the reference sheet.
                </div>
              ) : (
                sheetSuggestions.map((suggestion) => {
                  const isSaving = savingClientName === suggestion.clientId
                  return (
                    <div key={`${suggestion.rowNumber}-${suggestion.clientId}-${suggestion.brand}`} className="p-3">
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-4">
                        <div className="text-xs text-muted-foreground md:w-[72px]">
                          Row {suggestion.rowNumber}
                        </div>

                        <div className="min-w-0 md:w-[220px]">
                          <p className="text-sm font-medium truncate">{suggestion.clientId || '—'}</p>
                          {suggestion.clientName && (
                            <p className="text-xs text-muted-foreground truncate">
                              {suggestion.clientName}
                            </p>
                          )}
                        </div>

                        <div className="min-w-0 md:flex-1">
                          <p className="text-sm font-medium truncate">{suggestion.brand || '—'}</p>
                        </div>

                        <div className="min-w-0 md:w-[270px]">
                          {suggestion.matchedPartnerName ? (
                            <p className="text-sm truncate">
                              {suggestion.matchedPartnerName}
                              {suggestion.partnerMatchType && (
                                <span className="text-xs text-muted-foreground ml-2">
                                  ({suggestion.partnerMatchType})
                                </span>
                              )}
                            </p>
                          ) : (
                            <p className="text-sm text-muted-foreground truncate">No partner match</p>
                          )}
                          {suggestion.status === 'client_conflict' && suggestion.conflictingPartnerName && (
                            <p className="text-xs text-red-600 truncate">
                              Conflicts with {suggestion.conflictingPartnerName}
                            </p>
                          )}
                          {suggestion.status === 'already_mapped' && suggestion.currentPartnerExternalId && (
                            <p className="text-xs text-muted-foreground truncate">
                              Current mapping: {suggestion.currentPartnerExternalId}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center justify-between gap-2 md:w-[200px] md:justify-end">
                          {getSheetStatusBadge(suggestion.status)}
                          {suggestion.status === 'ready' && suggestion.matchedPartnerId && (
                            <Button
                              type="button"
                              size="sm"
                              className="h-8"
                              onClick={() => void handleApplySheetSuggestion(suggestion)}
                              disabled={isSaving}
                            >
                              {isSaving ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <Check className="h-4 w-4 mr-1" />
                                  Apply
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            This tab reads the reference sheet each refresh. Tab syncs for this same sheet also trigger
            automatic BigQuery mapping refresh to capture newly added rows.
          </p>
        </div>
      )}
    </div>
  )
}
