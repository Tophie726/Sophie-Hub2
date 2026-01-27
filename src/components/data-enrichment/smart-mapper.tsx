'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  ChevronUp,
  ChevronDown,
  Check,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Sparkles,
  Table,
  Key,
  Link2,
  Star,
  FileText,
  Users,
  Building2,
  Calendar,
  SkipForward,
  CheckCircle2,
  Package,
  Calculator,
  Database,
  Search,
  MessageSquare,
  X,
  ChevronRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { MobileColumnCard } from './mobile-column-card'
import { AISuggestionButton, type AISuggestion } from './ai-suggestion-button'
import { AISuggestAllDialog, type BulkSuggestion } from './ai-suggest-all-dialog'
import { AITabAnalysis, type TabSummary } from './ai-tab-analysis'
import { ShimmerGrid } from '@/components/ui/shimmer-grid'
import { getGroupedFieldDefs } from '@/lib/entity-fields'

// ============ ANIMATED LOCK ICON ============
// Custom animated lock that shows shackle closing
function AnimatedLockIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Lock body */}
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />

      {/* Animated shackle - starts raised, animates down */}
      <motion.path
        d="M7 11V7a5 5 0 0 1 10 0v4"
        initial={{ y: -4, opacity: 0.5 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{
          duration: 0.4,
          ease: [0.34, 1.56, 0.64, 1], // easeOutBack for satisfying bounce
          delay: 0.1,
        }}
      />

      {/* Keyhole that appears after lock closes */}
      <motion.circle
        cx="12"
        cy="16"
        r="1"
        fill="currentColor"
        stroke="none"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{
          duration: 0.2,
          delay: 0.4,
          ease: [0.34, 1.56, 0.64, 1],
        }}
      />
    </svg>
  )
}

// ============ TYPES ============
interface TabRawData {
  rows: string[][]
  totalRows: number
  detectedHeaderRow: number
  headerConfidence: number    // 0-100 confidence score
  headerReasons: string[]     // Human-readable explanations
}

// Import canonical types from entities (single source of truth)
import type { EntityType, ColumnCategoryOrNull } from '@/types/entities'
import type { ComputationType, SourceAuthority, ColumnMapping } from '@/types/enrichment'

type ColumnCategory = ColumnCategoryOrNull

interface ComputedFieldConfig {
  computationType: ComputationType
  targetTable: EntityType
  targetField: string
  displayName: string
  description?: string
  // For formulas
  dependsOn?: string[]
  formula?: string
  // For aggregation
  sourceTable?: string
  aggregation?: string
  // For lookup
  lookupSource?: string
  matchField?: string
  lookupField?: string
}

interface ColumnClassification {
  sourceIndex: number
  sourceColumn: string
  category: ColumnCategory
  targetField: string | null
  authority: SourceAuthority
  isKey: boolean // This column is the identifier/key for its entity type
  tagIds?: string[] // Field tag IDs for cross-cutting domain classification
  computedConfig?: ComputedFieldConfig // For computed fields
}

// Field tag type for UI
interface FieldTag {
  id: string
  name: string
  color: string
  description?: string | null
}

interface SmartMapperProps {
  spreadsheetId: string
  sheetName: string
  tabName: string
  /** Data source ID for database persistence (optional, falls back to localStorage only) */
  dataSourceId?: string
  onComplete: (mappings: {
    headerRow: number
    columns: ColumnClassification[]
    primaryEntity: EntityType
  }) => void
  onBack: () => void
  /** Called when user confirms header row - use to update UI state */
  onHeaderConfirmed?: () => void
  /** When true, renders in a more compact mode for embedding in browser shell */
  embedded?: boolean
  /** If header was already confirmed, skip directly to classify phase */
  headerAlreadyConfirmed?: boolean
  /** The confirmed header row from database (used when headerAlreadyConfirmed is true) */
  confirmedHeaderRow?: number
}

// Field definitions are now in @/lib/entity-fields (single source of truth)

// Animation
const easeOut: [number, number, number, number] = [0.22, 1, 0.36, 1]
const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
  transition: { duration: 0.3, ease: easeOut }
}


// LocalStorage key for draft persistence (fallback when DB not available)
const getDraftKey = (spreadsheetId: string, tabName: string) =>
  `smartmapper-draft-${spreadsheetId}-${tabName}`

// Module-level cache for raw sheet data (persists across tab switches, clears on page reload)
const RAW_DATA_CACHE_TTL = 5 * 60 * 1000 // 5 minutes
const rawDataCache = new Map<string, { data: TabRawData; timestamp: number }>()
function getCachedRawData(spreadsheetId: string, tabName: string): TabRawData | null {
  const key = `${spreadsheetId}:${tabName}`
  const entry = rawDataCache.get(key)
  if (entry && Date.now() - entry.timestamp < RAW_DATA_CACHE_TTL) return entry.data
  if (entry) rawDataCache.delete(key) // Expired
  return null
}
function setCachedRawData(spreadsheetId: string, tabName: string, data: TabRawData) {
  rawDataCache.set(`${spreadsheetId}:${tabName}`, { data, timestamp: Date.now() })
}

interface DraftState {
  phase: 'preview' | 'classify' | 'map'
  headerRow: number
  columns: ColumnClassification[]
  timestamp: number
}

export function SmartMapper({ spreadsheetId, sheetName, tabName, dataSourceId, onComplete, onBack, onHeaderConfirmed, embedded = false, headerAlreadyConfirmed = false, confirmedHeaderRow }: SmartMapperProps) {
  // Simplified: just preview → classify → map
  // If header already confirmed, skip preview phase
  const [phase, setPhase] = useState<'preview' | 'classify' | 'map'>(headerAlreadyConfirmed ? 'classify' : 'preview')
  const [isLoading, setIsLoading] = useState(true)
  const [rawData, setRawData] = useState<TabRawData | null>(null)
  const [headerRow, setHeaderRow] = useState(0)
  const [initialHeaderRow, setInitialHeaderRow] = useState<number | undefined>(undefined)
  const [columns, setColumns] = useState<ColumnClassification[]>([])
  const [columnsHistory, setColumnsHistory] = useState<ColumnClassification[][]>([])
  const [draftRestored, setDraftRestored] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isSavingDraft, setIsSavingDraft] = useState(false) // TODO: Show saving indicator in UI
  const [availableTags, setAvailableTags] = useState<FieldTag[]>([])
  // AI Tab Summary - provides context for per-column suggestions
  const [tabSummary, setTabSummary] = useState<TabSummary | null>(null)
  const draftKey = getDraftKey(spreadsheetId, tabName)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pendingDraftRef = useRef<DraftState | null>(null)
  // Refs for flush-on-unmount (so cleanup closure has current values)
  const dataSourceIdRef = useRef(dataSourceId)
  const tabNameRef = useRef(tabName)
  dataSourceIdRef.current = dataSourceId
  tabNameRef.current = tabName

  // Fetch available field tags (deferred: only when entering classify phase)
  useEffect(() => {
    if (phase !== 'classify' && phase !== 'map') return
    if (availableTags.length > 0) return // Already loaded

    async function fetchTags() {
      try {
        const response = await fetch('/api/field-tags')
        const data = await response.json()
        if (data.tags) {
          setAvailableTags(data.tags)
        }
      } catch (error) {
        console.warn('Failed to fetch field tags:', error)
      }
    }
    fetchTags()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // Save draft to DB (debounced) and localStorage (immediate backup)
  useEffect(() => {
    // Don't save until we've loaded data and possibly restored a draft
    if (isLoading || columns.length === 0) return

    const draft: DraftState = {
      phase,
      headerRow,
      columns,
      timestamp: Date.now(),
    }

    // Track as pending (for flush-on-unmount)
    pendingDraftRef.current = draft

    // Always save to localStorage immediately (offline resilience)
    localStorage.setItem(draftKey, JSON.stringify(draft))

    // Debounce DB save (500ms) to avoid hammering the server
    if (dataSourceId) {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
      saveTimeoutRef.current = setTimeout(async () => {
        try {
          setIsSavingDraft(true)
          await fetch('/api/tab-mappings/draft', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              data_source_id: dataSourceId,
              tab_name: tabName,
              draft_state: draft,
            }),
          })
          pendingDraftRef.current = null // Successfully saved — no longer pending
        } catch (e) {
          console.warn('Failed to save draft to DB:', e)
        } finally {
          setIsSavingDraft(false)
        }
      }, 500)
    }

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [phase, headerRow, columns, draftKey, isLoading, dataSourceId, tabName])

  // Flush pending draft to DB on unmount (fire-and-forget)
  // Prevents data loss when user switches tabs before the 500ms debounce completes
  useEffect(() => {
    return () => {
      if (pendingDraftRef.current && dataSourceIdRef.current) {
        fetch('/api/tab-mappings/draft', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            data_source_id: dataSourceIdRef.current,
            tab_name: tabNameRef.current,
            draft_state: pendingDraftRef.current,
          }),
        }).catch(() => {})
        pendingDraftRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Empty deps — only runs on unmount

  // Restore draft: compare DB and localStorage timestamps, use the freshest
  useEffect(() => {
    if (!rawData || draftRestored) return

    async function restoreDraft() {
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
      let dbDraft: DraftState | null = null
      let localDraft: DraftState | null = null

      // Fetch DB draft
      if (dataSourceId) {
        try {
          const response = await fetch(
            `/api/tab-mappings/draft?data_source_id=${dataSourceId}&tab_name=${encodeURIComponent(tabName)}`,
            { cache: 'no-store' }
          )
          const data = await response.json()
          if (data.draft?.columns?.length > 0 && data.draft.timestamp > sevenDaysAgo) {
            dbDraft = data.draft
          }
        } catch (e) {
          console.warn('Failed to load draft from DB:', e)
        }
      }

      // Check localStorage
      try {
        const savedDraft = localStorage.getItem(draftKey)
        if (savedDraft) {
          const draft: DraftState = JSON.parse(savedDraft)
          if (draft.timestamp > sevenDaysAgo && draft.columns.length > 0) {
            localDraft = draft
          }
        }
      } catch (e) {
        console.warn('Failed to restore draft from localStorage:', e)
      }

      // Use whichever draft is newer (handles stale DB when debounce was cancelled on unmount)
      const bestDraft = dbDraft && localDraft
        ? (localDraft.timestamp > dbDraft.timestamp ? localDraft : dbDraft)
        : dbDraft || localDraft

      if (bestDraft) {
        setPhase(headerAlreadyConfirmed ? 'classify' : 'preview')
        setHeaderRow(bestDraft.headerRow)
        setInitialHeaderRow(bestDraft.headerRow) // Track for unsaved changes
        setColumns(bestDraft.columns)
        setDraftRestored(true)
        return
      }

      // Step 3: Try loading persisted column_mappings (saved data, not drafts)
      // IMPORTANT: Saved mappings only include classified columns (category != null).
      // We need to merge them with the full sheet headers so unmapped columns are still visible.
      if (dataSourceId) {
        try {
          const savedResponse = await fetch(
            `/api/mappings/load?data_source_id=${dataSourceId}`,
            { cache: 'no-store' }
          )
          if (savedResponse.ok) {
            const savedData = await savedResponse.json()
            const tabMapping = savedData.tabMappings?.find(
              (t: { tab_name: string }) => t.tab_name === tabName
            )
            if (tabMapping && tabMapping.columnMappings?.length > 0) {
              // Build a lookup of saved mappings by source column name
              const savedByColumn = new Map<string, ColumnMapping>()
              for (const cm of tabMapping.columnMappings as ColumnMapping[]) {
                savedByColumn.set(cm.source_column, cm)
              }

              // Get all headers from raw data at the saved header row
              const savedHeaderRow = tabMapping.header_row ?? 0
              const headers = rawData?.rows[savedHeaderRow] || []

              // Merge: saved mappings applied on top of full column list
              const merged: ColumnClassification[] = headers.map((header: string, idx: number) => {
                const saved = savedByColumn.get(header || `Column ${idx + 1}`)
                if (saved) {
                  return {
                    sourceIndex: saved.source_column_index ?? idx,
                    sourceColumn: saved.source_column,
                    category: saved.category,
                    targetField: saved.target_field,
                    authority: saved.authority,
                    isKey: saved.is_key,
                    tagIds: saved.tags?.map((t: { id: string }) => t.id) || [],
                  }
                }
                // Column exists in sheet but wasn't classified — show as unmapped
                const name = (header || '').toLowerCase()
                const isWeekly =
                  name.includes('weekly') ||
                  name.includes('week ') ||
                  name.match(/^w\d+\s/) ||
                  name.match(/^\d{1,2}\/\d{1,2}/) ||
                  name.match(/^\d{4}-\d{2}-\d{2}/)
                return {
                  sourceIndex: idx,
                  sourceColumn: header || `Column ${idx + 1}`,
                  category: isWeekly ? 'weekly' as const : null,
                  targetField: null,
                  authority: 'source_of_truth' as const,
                  isKey: false,
                }
              })

              setPhase('classify')
              setHeaderRow(savedHeaderRow)
              setInitialHeaderRow(savedHeaderRow)
              setColumns(merged)
              setDraftRestored(true)
              toast.info('Restored saved mappings')
              return
            }
          }
        } catch (e) {
          console.warn('Failed to load saved mappings:', e)
        }
      }

      setDraftRestored(true)
    }

    restoreDraft()
  }, [rawData, draftKey, draftRestored, dataSourceId, tabName])

  // Clear draft when completing (both DB and localStorage)
  const handleCompleteWithClear = async () => {
    // Clear localStorage
    localStorage.removeItem(draftKey)

    // Clear DB draft
    if (dataSourceId) {
      try {
        await fetch(
          `/api/tab-mappings/draft?data_source_id=${dataSourceId}&tab_name=${encodeURIComponent(tabName)}`,
          { method: 'DELETE' }
        )
      } catch (e) {
        console.warn('Failed to clear draft from DB:', e)
      }
    }

    onComplete({
      headerRow,
      columns,
      primaryEntity: getPrimaryEntity(),
    })
  }

  // Confirm header row selection (saves to DB)
  const handleConfirmHeader = async () => {
    if (dataSourceId) {
      try {
        await fetch('/api/tab-mappings/confirm-header', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            data_source_id: dataSourceId,
            tab_name: tabName,
            header_row: headerRow,
          }),
        })
        // Notify parent to update UI state
        onHeaderConfirmed?.()
      } catch (e) {
        console.warn('Failed to confirm header:', e)
      }
    }
    setPhase('classify')
  }

  // Undo handler
  const handleUndo = useCallback(() => {
    if (columnsHistory.length > 0) {
      const previous = columnsHistory[columnsHistory.length - 1]
      setColumnsHistory(prev => prev.slice(0, -1))
      setColumns(previous)
    }
  }, [columnsHistory])

  // Global Cmd/Ctrl+Z for undo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        handleUndo()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleUndo])

  // Load raw data (with client-side cache to avoid re-fetching from Google API on tab switch)
  const [loadError, setLoadError] = useState<string | null>(null)
  useEffect(() => {
    async function loadData() {
      setLoadError(null)

      // Check client-side cache first (avoids Google API round-trip on tab revisit)
      const cached = getCachedRawData(spreadsheetId, tabName)
      if (cached) {
        setRawData(cached)
        const effectiveHeaderRow = confirmedHeaderRow !== undefined ? confirmedHeaderRow : cached.detectedHeaderRow
        setHeaderRow(effectiveHeaderRow)
        setInitialHeaderRow(effectiveHeaderRow)
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      try {
        const response = await fetch(
          `/api/sheets/raw-rows?id=${spreadsheetId}&tab=${encodeURIComponent(tabName)}`
        )
        const data = await response.json()
        if (response.ok) {
          setCachedRawData(spreadsheetId, tabName, data)
          setRawData(data)
          // Use confirmed header row if available, otherwise use detected
          const effectiveHeaderRow = confirmedHeaderRow !== undefined ? confirmedHeaderRow : data.detectedHeaderRow
          setHeaderRow(effectiveHeaderRow)
          setInitialHeaderRow(effectiveHeaderRow) // Track initial for unsaved changes detection
        } else if (response.status === 401) {
          setLoadError('Sign in required to access Google Sheets data')
        } else {
          setLoadError(data.error || 'Failed to load sheet data')
        }
      } catch (error) {
        console.error('Error loading data:', error)
        setLoadError('Network error - please try again')
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [spreadsheetId, tabName, confirmedHeaderRow])

  // Track the last headerRow we initialized columns for (to detect user changes)
  const lastInitializedHeaderRow = useRef<number | null>(null)

  // Reset tracking when tab changes
  useEffect(() => {
    lastInitializedHeaderRow.current = null
  }, [spreadsheetId, tabName])

  // Initialize columns when header row changes - with auto-detection
  // When restoring a draft, preserve classifications but refresh header names from rawData
  // IMPORTANT: Wait for draftRestored before initializing — otherwise the column init
  // races with the async restoreDraft() and overwrites restored classifications with fresh ones.
  useEffect(() => {
    if (!rawData || !draftRestored || headerRow >= rawData.rows.length) return

    const headers = rawData.rows[headerRow]

    // Case 1: User changed headerRow in Preview phase - reinitialize columns
    // This happens when lastInitializedHeaderRow differs from current headerRow
    const headerRowChanged = lastInitializedHeaderRow.current !== null &&
                            lastInitializedHeaderRow.current !== headerRow

    if (headerRowChanged) {
      lastInitializedHeaderRow.current = headerRow
      const initialColumns: ColumnClassification[] = headers.map((header, idx) => {
        const name = (header || '').toLowerCase()
        const isWeekly =
          name.includes('weekly') ||
          name.includes('week ') ||
          name.match(/^w\d+\s/) ||
          name.match(/^\d{1,2}\/\d{1,2}/) ||
          name.match(/^\d{4}-\d{2}-\d{2}/)

        return {
          sourceIndex: idx,
          sourceColumn: header || `Column ${idx + 1}`,
          category: isWeekly ? 'weekly' : null,
          targetField: null,
          authority: 'source_of_truth',
          isKey: false,
        }
      })
      setColumns(initialColumns)
      return
    }

    // Case 2: Draft restored - preserve classifications but sync header names
    if (draftRestored && columns.length > 0 && lastInitializedHeaderRow.current === null) {
      lastInitializedHeaderRow.current = headerRow
      // Update sourceColumn names from actual headers to ensure they're current
      setColumns(prev => prev.map((col, idx) => ({
        ...col,
        sourceColumn: headers[idx] || `Column ${idx + 1}`,
      })))
      return
    }

    // Case 3: First initialization (no draft)
    if (lastInitializedHeaderRow.current === null) {
      lastInitializedHeaderRow.current = headerRow
      const initialColumns: ColumnClassification[] = headers.map((header, idx) => {
        const name = (header || '').toLowerCase()
        const isWeekly =
          name.includes('weekly') ||
          name.includes('week ') ||
          name.match(/^w\d+\s/) ||
          name.match(/^\d{1,2}\/\d{1,2}/) ||
          name.match(/^\d{4}-\d{2}-\d{2}/)

        return {
          sourceIndex: idx,
          sourceColumn: header || `Column ${idx + 1}`,
          category: isWeekly ? 'weekly' : null,
          targetField: null,
          authority: 'source_of_truth',
          isKey: false,
        }
      })
      setColumns(initialColumns)
    }
  }, [rawData, headerRow, draftRestored, columns.length])

  // Handlers
  const handleCategoryChange = (columnIndex: number, category: ColumnCategory) => {
    setColumnsHistory(prev => [...prev.slice(-19), columns]) // Keep last 20 states
    setColumns(prev => prev.map((col, idx) => {
      if (idx !== columnIndex) return col
      // If changing category, reset isKey and computed config
      return { ...col, category, isKey: false, targetField: null, computedConfig: undefined }
    }))
  }

  const handleBulkCategoryChange = (indices: number[], category: ColumnCategory) => {
    setColumnsHistory(prev => [...prev.slice(-19), columns]) // Keep last 20 states
    setColumns(prev => prev.map((col, idx) => {
      if (!indices.includes(idx)) return col
      return { ...col, category, isKey: false, targetField: null, computedConfig: undefined }
    }))
  }

  const handleComputedConfigChange = (columnIndex: number, config: ComputedFieldConfig) => {
    setColumns(prev => prev.map((col, idx) =>
      idx === columnIndex ? { ...col, computedConfig: config } : col
    ))
  }

  const handleTagsChange = (columnIndex: number, tagIds: string[]) => {
    setColumns(prev => prev.map((col, idx) =>
      idx === columnIndex ? { ...col, tagIds } : col
    ))
  }

  const handleKeyToggle = (columnIndex: number) => {
    const col = columns[columnIndex]
    if (!col.category || col.category === 'skip' || col.category === 'weekly') return

    setColumns(prev => prev.map((c, idx) => {
      // If this is the column being toggled
      if (idx === columnIndex) {
        return { ...c, isKey: !c.isKey }
      }
      // If another column of same category was the key, unset it
      if (c.category === col.category && c.isKey) {
        return { ...c, isKey: false }
      }
      return c
    }))
  }

  const handleFieldChange = (columnIndex: number, field: string | null) => {
    setColumns(prev => prev.map((col, idx) =>
      idx === columnIndex ? { ...col, targetField: field } : col
    ))
  }

  const handleAuthorityChange = (columnIndex: number, authority: SourceAuthority) => {
    setColumns(prev => prev.map((col, idx) =>
      idx === columnIndex ? { ...col, authority } : col
    ))
  }

  // Determine primary entity (whichever has a key marked, or most columns)
  const getPrimaryEntity = (): EntityType => {
    const keyCol = columns.find(c => c.isKey)
    if (keyCol?.category === 'partner') return 'partners'
    if (keyCol?.category === 'staff') return 'staff'
    if (keyCol?.category === 'asin') return 'asins'

    // Fallback: most columns
    const counts = {
      partner: columns.filter(c => c.category === 'partner').length,
      staff: columns.filter(c => c.category === 'staff').length,
      asin: columns.filter(c => c.category === 'asin').length,
    }
    if (counts.partner >= counts.staff && counts.partner >= counts.asin) return 'partners'
    if (counts.staff >= counts.asin) return 'staff'
    return 'asins'
  }

  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col min-h-[60vh]"
      >
        {/* Loading header with tab context */}
        <div className="rounded-xl border bg-card overflow-hidden flex-1 flex flex-col">
          {/* Header with loading context */}
          <div className="p-5 border-b bg-gradient-to-r from-muted/10 to-transparent">
            <div className="flex items-center gap-4">
              {/* Animated icon */}
              <div className="relative">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Table className="h-5 w-5 text-primary/70" />
                </div>
                <motion.div
                  className="absolute -right-0.5 -bottom-0.5 h-4 w-4 rounded-full bg-background border-2 border-primary/50 flex items-center justify-center"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                >
                  <Loader2 className="h-2.5 w-2.5 text-primary animate-spin" />
                </motion.div>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-foreground truncate">{tabName}</h3>
                <p className="text-sm text-muted-foreground">Loading spreadsheet data...</p>
              </div>
            </div>
          </div>

          {/* Skeleton table — reusable shimmer wave */}
          <div className="p-4 flex-1">
            <ShimmerGrid
              variant="table"
              rows={12}
              columns={5}
              showRowNumbers
              stagger={40}
            />
          </div>

          {/* Progress bar at bottom */}
          <div className="h-1 bg-muted/20 overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-primary/40 via-primary/60 to-primary/40"
              initial={{ x: "-100%" }}
              animate={{ x: "100%" }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>
        </div>
      </motion.div>
    )
  }

  if (loadError) {
    const isAuthError = loadError.includes('Sign in')
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <p className="text-muted-foreground">{loadError}</p>
        {isAuthError ? (
          <Button
            variant="default"
            onClick={() => window.location.href = `${window.location.origin}/signin`}
            className="mt-4"
          >
            Sign In
          </Button>
        ) : (
          <Button variant="outline" onClick={onBack} className="mt-4">
            Go Back
          </Button>
        )}
      </div>
    )
  }

  if (!rawData || rawData.rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <p className="text-muted-foreground">No data found in this tab</p>
        <Button variant="outline" onClick={onBack} className="mt-4">
          Go Back
        </Button>
      </div>
    )
  }

  return (
    <AnimatePresence mode="wait">
      {phase === 'preview' && (
        <PreviewPhase
          key="preview"
          rawData={rawData}
          headerRow={headerRow}
          headerConfidence={rawData.headerConfidence}
          headerReasons={rawData.headerReasons}
          onHeaderRowChange={setHeaderRow}
          onConfirm={handleConfirmHeader}
          onBack={onBack}
          embedded={embedded}
          tabName={tabName}
          initialHeaderRow={initialHeaderRow}
        />
      )}
      {phase === 'classify' && (
        <ClassifyPhase
          key="classify"
          sheetName={sheetName}
          tabName={tabName}
          rawData={rawData}
          headerRow={headerRow}
          columns={columns}
          onCategoryChange={handleCategoryChange}
          onBulkCategoryChange={handleBulkCategoryChange}
          onKeyToggle={handleKeyToggle}
          onComputedConfigChange={handleComputedConfigChange}
          availableTags={availableTags}
          onTagsChange={handleTagsChange}
          onConfirm={() => setPhase('map')}
          onBack={() => setPhase('preview')}
          embedded={embedded}
          tabSummary={tabSummary}
          onTabSummaryChange={setTabSummary}
          dataSourceId={dataSourceId}
        />
      )}
      {phase === 'map' && (
        <MapPhase
          key="map"
          rawData={rawData}
          headerRow={headerRow}
          columns={columns}
          onFieldChange={handleFieldChange}
          onAuthorityChange={handleAuthorityChange}
          onConfirm={handleCompleteWithClear}
          onBack={() => setPhase('classify')}
          embedded={embedded}
        />
      )}
    </AnimatePresence>
  )
}

// ============ PHASE 1: PREVIEW ============
function PreviewPhase({
  rawData,
  headerRow,
  headerConfidence,
  headerReasons, // Reserved for future tooltip/explanation feature
  onHeaderRowChange,
  onConfirm,
  onBack,
  embedded = false,
  tabName,
  initialHeaderRow,
}: {
  rawData: TabRawData
  headerRow: number
  headerConfidence: number
  headerReasons: string[] // Why this header was detected (for future feature) - currently unused
  onHeaderRowChange: (row: number) => void
  onConfirm: () => void
  onBack: () => void
  embedded?: boolean
  tabName?: string
  initialHeaderRow?: number // Track initial auto-detected row for unsaved changes
}) {
  // Reserved for future tooltip feature showing why header was detected
  void headerReasons

  const scrollRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([])
  const hasScrolledToDetected = useRef(false)
  const maxRow = Math.min(rawData.rows.length - 1, 19)

  // Track if header row was modified from initial
  const hasUnsavedChanges = initialHeaderRow !== undefined && headerRow !== initialHeaderRow
  const [showBackDialog, setShowBackDialog] = useState(false)
  const [showConfirmAnimation, setShowConfirmAnimation] = useState(false)

  useEffect(() => {
    containerRef.current?.focus()
  }, [])

  // Handle back with confirmation if changes made
  const handleBack = () => {
    if (hasUnsavedChanges) {
      setShowBackDialog(true)
    } else {
      onBack()
    }
  }

  // Handle confirm with lock animation
  const handleConfirm = () => {
    setShowConfirmAnimation(true)
    // Brief delay for animation before proceeding
    setTimeout(() => {
      onConfirm()
    }, 600)
  }

  // Auto-scroll to detected header row on mount (once)
  useEffect(() => {
    if (!hasScrolledToDetected.current && headerRow > 0) {
      hasScrolledToDetected.current = true
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        const row = rowRefs.current[headerRow]
        if (row) {
          row.scrollIntoView({ block: 'center', behavior: 'smooth' })
        }
      }, 100)
    }
  }, [headerRow])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
      case 'j':
        e.preventDefault()
        onHeaderRowChange(Math.min(maxRow, headerRow + 1))
        // Scroll to new row
        setTimeout(() => {
          const row = rowRefs.current[Math.min(maxRow, headerRow + 1)]
          row?.scrollIntoView({ block: 'center', behavior: 'smooth' })
        }, 0)
        break
      case 'ArrowUp':
      case 'k':
        e.preventDefault()
        onHeaderRowChange(Math.max(0, headerRow - 1))
        setTimeout(() => {
          const row = rowRefs.current[Math.max(0, headerRow - 1)]
          row?.scrollIntoView({ block: 'center', behavior: 'smooth' })
        }, 0)
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        onConfirm()
        break
    }
  }

  return (
    <motion.div {...fadeInUp} className="space-y-6">
      <div
        ref={containerRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className="focus:outline-none"
      >
      <Card className={embedded ? '' : 'max-w-5xl mx-auto'}>
        <CardHeader className={embedded ? 'pb-4' : ''}>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className={`flex items-center gap-2 ${embedded ? 'text-base' : ''}`}>
                <Sparkles className={`${embedded ? 'h-4 w-4' : 'h-5 w-5'} text-orange-500`} />
                {embedded ? `Preview: ${tabName}` : 'We found your data!'}
              </CardTitle>
              <CardDescription>
                {headerConfidence >= 80 ? (
                  <>We detected row {headerRow + 1} as headers. Confirm or select a different row.</>
                ) : headerConfidence > 0 ? (
                  <>Row {headerRow + 1} might be headers ({headerConfidence}% confident). Select the correct row.</>
                ) : (
                  <>Click on the row that contains your column headers.</>
                )}
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              {/* Confidence badge - subtle */}
              {headerConfidence > 0 && (
                <span className="text-xs text-muted-foreground">
                  {headerConfidence}% confident
                </span>
              )}
              <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    onHeaderRowChange(Math.max(0, headerRow - 1))
                    setTimeout(() => {
                      const row = rowRefs.current[Math.max(0, headerRow - 1)]
                      row?.scrollIntoView({ block: 'center', behavior: 'smooth' })
                    }, 0)
                  }}
                  disabled={headerRow === 0}
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <span className="w-8 text-center font-mono text-sm">{headerRow + 1}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    onHeaderRowChange(Math.min(maxRow, headerRow + 1))
                    setTimeout(() => {
                      const row = rowRefs.current[Math.min(maxRow, headerRow + 1)]
                      row?.scrollIntoView({ block: 'center', behavior: 'smooth' })
                    }, 0)
                  }}
                  disabled={headerRow >= maxRow}
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border overflow-hidden relative">
            {/* Lock animation - only covers table, follows design MD guidelines */}
            <AnimatePresence>
              {showConfirmAnimation && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute inset-0 z-10 flex items-center justify-center bg-background/90 backdrop-blur-md"
                >
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    transition={{
                      duration: 0.35,
                      ease: [0.34, 1.56, 0.64, 1], // easeOutBack for playful bounce
                    }}
                    className="flex flex-col items-center gap-3"
                  >
                    <motion.div
                      className="p-5 rounded-2xl bg-green-500/15 border border-green-500/20"
                      initial={{ rotate: -10 }}
                      animate={{ rotate: 0 }}
                      transition={{
                        duration: 0.4,
                        ease: [0.34, 1.56, 0.64, 1],
                        delay: 0.1,
                      }}
                    >
                      <AnimatedLockIcon className="h-10 w-10 text-green-500" />
                    </motion.div>
                    <motion.span
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
                      className="text-base font-medium text-green-600"
                    >
                      Header Confirmed
                    </motion.span>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
            <div ref={scrollRef} className="max-h-[400px] overflow-auto scroll-smooth">
              <table className="w-full text-sm">
                <tbody>
                  {rawData.rows.slice(0, 20).map((row, rowIndex) => {
                    const isHeaderRow = rowIndex === headerRow
                    const isBeforeHeader = rowIndex < headerRow

                    return (
                      <motion.tr
                        key={rowIndex}
                        ref={(el) => { rowRefs.current[rowIndex] = el }}
                        initial={false}
                        animate={{
                          backgroundColor: isHeaderRow ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                        }}
                        transition={{ duration: 0.2, ease: easeOut }}
                        className={`border-b cursor-pointer hover:bg-muted/50 ${isBeforeHeader ? 'opacity-50' : ''}`}
                        onClick={() => {
                          onHeaderRowChange(rowIndex)
                        }}
                      >
                        <td className="px-2 py-2 w-12 text-center text-xs text-muted-foreground bg-muted/30 border-r">
                          {rowIndex + 1}
                        </td>
                        {row.slice(0, 10).map((cell, colIndex) => (
                          <td
                            key={colIndex}
                            className={`px-3 py-2 whitespace-nowrap max-w-[150px] truncate ${
                              isHeaderRow ? 'font-semibold text-blue-600' : ''
                            }`}
                          >
                            {cell || <span className="text-muted-foreground/50">—</span>}
                          </td>
                        ))}
                        {row.length > 10 && (
                          <td className="px-3 py-2 text-muted-foreground text-xs">
                            +{row.length - 10} more
                          </td>
                        )}
                      </motion.tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Showing {Math.min(rawData.rows.length, 20)} of {rawData.totalRows.toLocaleString()} rows
            </span>
            {headerRow > 0 && (
              <span className="text-blue-600">
                Rows 1-{headerRow} will be skipped
              </span>
            )}
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
            <Button variant="outline" onClick={handleBack} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Button onClick={handleConfirm} className="gap-2">
              Confirm Header
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
      </div>


      {/* Confirmation dialog for back when changes made */}
      <Dialog open={showBackDialog} onOpenChange={setShowBackDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Discard Changes?</DialogTitle>
            <DialogDescription>
              You&apos;ve changed the header row from row {(initialHeaderRow ?? 0) + 1} to row {headerRow + 1}.
              Going back will discard this change.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowBackDialog(false)}>
              Keep Editing
            </Button>
            <Button variant="destructive" onClick={() => { setShowBackDialog(false); onBack() }}>
              Discard Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}

// ============ PHASE 2: CLASSIFY COLUMNS ============
function ClassifyPhase({
  sheetName,
  tabName,
  rawData,
  headerRow,
  columns,
  onCategoryChange,
  onBulkCategoryChange,
  onKeyToggle,
  onComputedConfigChange,
  availableTags,
  onTagsChange,
  onConfirm,
  onBack,
  embedded = false,
  tabSummary,
  onTabSummaryChange,
  dataSourceId,
}: {
  sheetName: string
  tabName: string
  rawData: TabRawData
  headerRow: number
  columns: ColumnClassification[]
  onCategoryChange: (index: number, category: ColumnCategory) => void
  onBulkCategoryChange: (indices: number[], category: ColumnCategory) => void
  onKeyToggle: (index: number) => void
  onComputedConfigChange: (index: number, config: ComputedFieldConfig) => void
  availableTags: FieldTag[]
  onTagsChange: (index: number, tagIds: string[]) => void
  onConfirm: () => void
  onBack: () => void
  embedded?: boolean
  tabSummary: TabSummary | null
  onTabSummaryChange: (summary: TabSummary) => void
  dataSourceId?: string
}) {
  // State for computed field config modal
  const [configureComputedIndex, setConfigureComputedIndex] = useState<number | null>(null)
  const [selectedIndices, setSelectedIndices] = useState<number[]>([])
  const [activeFilter, setActiveFilter] = useState<ColumnCategory | 'all' | 'unclassified'>('all')
  const containerRef = useRef<HTMLDivElement>(null)
  const hasInteracted = useRef(false)

  // State for "Change Header Row" confirmation dialog
  const [showChangeHeaderDialog, setShowChangeHeaderDialog] = useState(false)

  // Check if any columns have been classified
  const hasClassifiedColumns = columns.some(col => col.category !== null)
  const [focusedIndex, setFocusedIndex] = useState(0)

  // State for key confirmation dialog
  const [keyConfirmation, setKeyConfirmation] = useState<{
    open: boolean
    columnIndex: number | null
    columnName: string
    category: ColumnCategory
    currentKeyName: string | null
    action: 'set' | 'change' | 'remove'
  }>({ open: false, columnIndex: null, columnName: '', category: null, currentKeyName: null, action: 'set' })

  // State for AI Suggest All dialog
  const [showAISuggestAll, setShowAISuggestAll] = useState(false)

  const sampleRows = rawData.rows.slice(headerRow + 1, headerRow + 2)
  const allValidColumns = columns.filter(c => c.sourceColumn.trim())

  // Apply filter
  const validColumns = activeFilter === 'all'
    ? allValidColumns
    : activeFilter === 'unclassified'
    ? allValidColumns.filter(c => c.category === null)
    : allValidColumns.filter(c => c.category === activeFilter)

  const lastClickedIndex = useRef<number | null>(null)

  useEffect(() => {
    containerRef.current?.focus()
  }, [])

  const getSample = (colIndex: number) => sampleRows[0]?.[colIndex] || ''

  // Handle selection with Shift (range) and Cmd/Ctrl (toggle individual)
  const handleSelectionClick = (idx: number, e: React.MouseEvent) => {
    const visualIdx = validColumns.findIndex(c => c.sourceIndex === idx)

    if (e.shiftKey && lastClickedIndex.current !== null) {
      // Range selection
      const start = Math.min(lastClickedIndex.current, visualIdx)
      const end = Math.max(lastClickedIndex.current, visualIdx)
      const rangeIndices = validColumns.slice(start, end + 1).map(c => c.sourceIndex)
      setSelectedIndices(prev => {
        const newSelection = new Set(prev)
        rangeIndices.forEach(i => newSelection.add(i))
        return Array.from(newSelection)
      })
    } else if (e.metaKey || e.ctrlKey) {
      // Toggle individual (Cmd/Ctrl click)
      setSelectedIndices(prev =>
        prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
      )
      lastClickedIndex.current = visualIdx
    } else {
      // Regular click - select only this one (or deselect if already selected)
      if (selectedIndices.length === 1 && selectedIndices[0] === idx) {
        setSelectedIndices([])
      } else {
        setSelectedIndices([idx])
      }
      lastClickedIndex.current = visualIdx
    }
  }

  const applyBulkCategory = (category: ColumnCategory) => {
    if (selectedIndices.length > 0) {
      onBulkCategoryChange(selectedIndices, category)
      setSelectedIndices([])
    }
  }

  // Stats (always based on all columns, not filtered)
  const stats = {
    partner: allValidColumns.filter(c => c.category === 'partner').length,
    staff: allValidColumns.filter(c => c.category === 'staff').length,
    asin: allValidColumns.filter(c => c.category === 'asin').length,
    weekly: allValidColumns.filter(c => c.category === 'weekly').length,
    computed: allValidColumns.filter(c => c.category === 'computed').length,
    skip: allValidColumns.filter(c => c.category === 'skip').length,
    unclassified: allValidColumns.filter(c => c.category === null).length,
  }

  const partnerKey = allValidColumns.find(c => c.category === 'partner' && c.isKey)
  const staffKey = allValidColumns.find(c => c.category === 'staff' && c.isKey)

  // Helper to request key confirmation before setting (Partner and Staff only - ASIN doesn't need keys)
  const requestKeyConfirmation = (
    columnIndex: number,
    columnName: string,
    category: ColumnCategory,
    isCurrentlyKey: boolean
  ) => {
    const currentKey = category === 'partner' ? partnerKey
      : category === 'staff' ? staffKey : null

    setKeyConfirmation({
      open: true,
      columnIndex,
      columnName,
      category,
      currentKeyName: currentKey && !isCurrentlyKey ? currentKey.sourceColumn : null,
      action: isCurrentlyKey ? 'remove' : currentKey ? 'change' : 'set'
    })
  }

  // Confirm key action
  const confirmKeyAction = () => {
    if (keyConfirmation.columnIndex !== null) {
      onKeyToggle(keyConfirmation.columnIndex)
    }
    setKeyConfirmation({ open: false, columnIndex: null, columnName: '', category: null, currentKeyName: null, action: 'set' })
  }

  const totalClassified = stats.partner + stats.staff + stats.asin + stats.weekly + stats.computed + stats.skip
  const totalColumns = allValidColumns.length


  // Category shortcuts mapping (ASIN is sub-option under Partner, no direct shortcut)
  const categoryShortcuts: Record<string, ColumnCategory> = {
    '1': 'partner',
    '2': 'staff',
    '3': 'weekly',
    '4': 'computed',
    '5': 'skip',
    'p': 'partner',
    's': 'staff',
    'w': 'weekly',
    'c': 'computed',
    'x': 'skip',
  }

  // Find next unclassified column index
  const findNextUnclassified = (startIndex: number): number => {
    // Look forward from current position
    for (let i = startIndex + 1; i < validColumns.length; i++) {
      if (validColumns[i].category === null) return i
    }
    // Wrap around and look from beginning
    for (let i = 0; i < startIndex; i++) {
      if (validColumns[i].category === null) return i
    }
    // No unclassified found, stay at current
    return startIndex
  }

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const col = validColumns[focusedIndex]

    // Number keys 1-6 or letter shortcuts for quick classification
    if (categoryShortcuts[e.key]) {
      e.preventDefault()
      hasInteracted.current = true
      if (col) {
        onCategoryChange(col.sourceIndex, categoryShortcuts[e.key])
        // Auto-advance to next unclassified column
        const nextIndex = findNextUnclassified(focusedIndex)
        setFocusedIndex(nextIndex)
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
      case 'j':
        e.preventDefault()
        hasInteracted.current = true
        setFocusedIndex(prev => Math.min(prev + 1, validColumns.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        hasInteracted.current = true
        setFocusedIndex(prev => Math.max(prev - 1, 0))
        break
      case 'k':
        e.preventDefault()
        // Toggle key status
        if (col && col.category && col.category !== 'skip' && col.category !== 'weekly' && col.category !== 'computed') {
          onKeyToggle(col.sourceIndex)
        }
        break
      case 'Enter':
        e.preventDefault()
        // If computed, open config modal
        if (col && col.category === 'computed') {
          setConfigureComputedIndex(col.sourceIndex)
        }
        break
      case 'Tab':
        e.preventDefault()
        hasInteracted.current = true
        // Tab jumps to next unclassified
        const nextUnclassified = findNextUnclassified(focusedIndex)
        setFocusedIndex(nextUnclassified)
        break
    }
  }

  // Check if we have at least one key designated (Partner or Staff - ASIN doesn't need a key)
  const hasKeyDesignated = partnerKey || staffKey

  return (
    <motion.div {...fadeInUp} className="space-y-6">
      {/* AI Tab Summary - provides context before column mapping */}
      <AITabAnalysis
        tabName={tabName}
        sourceName={sheetName}
        columnNames={rawData.rows[headerRow] || []}
        sampleRows={rawData.rows.slice(headerRow + 1, headerRow + 4)}
        dataSourceId={dataSourceId}
        initialSummary={tabSummary}
        currentMappings={columns.map(c => ({
          column_name: c.sourceColumn,
          category: c.category,
          target_field: c.targetField,
        }))}
        allColumnsClassified={columns.length > 0 && columns.every(c => c.category !== null)}
        onSummaryComplete={onTabSummaryChange}
        className={embedded ? '' : 'max-w-4xl mx-auto'}
      />

      <div
        ref={containerRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className="focus:outline-none"
      >
      <Card className={embedded ? '' : 'max-w-4xl mx-auto'}>
        <CardHeader className={embedded ? 'pb-3' : ''}>
          {/* Breadcrumb - hide in embedded mode since tabs show context */}
          {!embedded && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
              <FileText className="h-3.5 w-3.5" />
              <span className="truncate max-w-[200px]">{sheetName}</span>
              <ChevronRight className="h-3 w-3 flex-shrink-0" />
              <span className="font-medium text-foreground truncate">{tabName}</span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div>
              <CardTitle className={`flex items-center gap-2 ${embedded ? 'text-base' : ''}`}>
                <Table className={`${embedded ? 'h-4 w-4' : 'h-5 w-5'} text-orange-500`} />
                {embedded ? 'Classify Columns' : "What's in each column?"}
              </CardTitle>
              <CardDescription>
                {embedded ? 'Set keys and categories for each column.' : <>Classify columns and mark which one is the <strong>key identifier</strong> for each entity type.</>}
              </CardDescription>
            </div>
            <div className="flex items-center gap-4">
              {/* AI Suggest All button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // Auto-skip empty columns before opening AI dialog
                  const dataRows = rawData.rows.slice(headerRow + 1, headerRow + 11) // Check 10 rows
                  const emptyIndices: number[] = []
                  allValidColumns
                    .filter(col => col.category === null)
                    .forEach(col => {
                      const hasAnyValue = dataRows.some(row => {
                        const val = row[col.sourceIndex]
                        return val !== undefined && val !== null && String(val).trim() !== ''
                      })
                      if (!hasAnyValue) {
                        emptyIndices.push(col.sourceIndex)
                      }
                    })

                  if (emptyIndices.length > 0) {
                    onBulkCategoryChange(emptyIndices, 'skip')
                    toast.info(`Auto-skipped ${emptyIndices.length} empty column${emptyIndices.length !== 1 ? 's' : ''}`)
                  }
                  setShowAISuggestAll(true)
                }}
                className="h-8 text-xs bg-purple-500/5 border-purple-500/30 text-purple-600 hover:bg-purple-500/10"
              >
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                AI Suggest All
              </Button>
              <div className="text-right">
                <div className="text-2xl font-bold tabular-nums">{totalClassified}/{totalColumns}</div>
                <div className="text-xs text-muted-foreground">classified</div>
              </div>
            </div>
          </div>

          {/* Stats badges - static, no animation noise */}
          <div className="flex flex-wrap gap-2 mt-4">
            {stats.partner > 0 && (
              <Badge variant="outline" className="gap-1 bg-blue-500/10 text-blue-600 border-blue-500/30">
                <Building2 className="h-3 w-3" />
                <span className="tabular-nums">{stats.partner}</span>
                <span>Partner</span>
                {partnerKey && <Key className="h-3 w-3 text-amber-500" />}
              </Badge>
            )}
            {stats.staff > 0 && (
              <Badge variant="outline" className="gap-1 bg-green-500/10 text-green-600 border-green-500/30">
                <Users className="h-3 w-3" />
                <span className="tabular-nums">{stats.staff}</span>
                <span>Staff</span>
                {staffKey && <Key className="h-3 w-3 text-amber-500" />}
              </Badge>
            )}
            {stats.asin > 0 && (
              <Badge variant="outline" className="gap-1 bg-orange-500/10 text-orange-600 border-orange-500/30">
                <Package className="h-3 w-3" />
                <span className="tabular-nums">{stats.asin}</span>
                <span>ASIN</span>
              </Badge>
            )}
            {stats.weekly > 0 && (
              <Badge variant="outline" className="gap-1 bg-purple-500/10 text-purple-600 border-purple-500/30">
                <Calendar className="h-3 w-3" />
                <span className="tabular-nums">{stats.weekly}</span>
                <span>Weekly</span>
              </Badge>
            )}
            {stats.computed > 0 && (
              <Badge variant="outline" className="gap-1 bg-cyan-500/10 text-cyan-600 border-cyan-500/30">
                <Calculator className="h-3 w-3" />
                <span className="tabular-nums">{stats.computed}</span>
                <span>Computed</span>
              </Badge>
            )}
            {stats.skip > 0 && (
              <Badge variant="outline" className="gap-1 bg-gray-500/10 text-gray-600 border-gray-500/30">
                <SkipForward className="h-3 w-3" />
                <span className="tabular-nums">{stats.skip}</span>
                <span>Skip</span>
              </Badge>
            )}
            {stats.unclassified > 0 && (
              <Badge variant="outline" className="gap-1 text-muted-foreground">
                <span className="tabular-nums">{stats.unclassified}</span>
                <span>unclassified</span>
              </Badge>
            )}
          </div>

          {/* Bulk action bar */}
          {selectedIndices.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-wrap items-center gap-2 mt-4 p-3 bg-muted rounded-lg"
            >
              <span className="text-sm font-medium w-full md:w-auto">{selectedIndices.length} selected:</span>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => applyBulkCategory('partner')} className="h-9 md:h-7 text-xs">
                  <Building2 className="h-3 w-3 mr-1" /> Partner
                </Button>
                <Button size="sm" variant="outline" onClick={() => applyBulkCategory('staff')} className="h-9 md:h-7 text-xs">
                  <Users className="h-3 w-3 mr-1" /> Staff
                </Button>
                <Button size="sm" variant="outline" onClick={() => applyBulkCategory('asin')} className="h-9 md:h-7 text-xs">
                  <Package className="h-3 w-3 mr-1" /> ASIN
                </Button>
                <Button size="sm" variant="outline" onClick={() => applyBulkCategory('weekly')} className="h-9 md:h-7 text-xs">
                  <Calendar className="h-3 w-3 mr-1" /> Weekly
                </Button>
                <Button size="sm" variant="outline" onClick={() => applyBulkCategory('computed')} className="h-9 md:h-7 text-xs">
                  <Calculator className="h-3 w-3 mr-1" /> Computed
                </Button>
                <Button size="sm" variant="outline" onClick={() => applyBulkCategory('skip')} className="h-9 md:h-7 text-xs">
                  <SkipForward className="h-3 w-3 mr-1" /> Skip
                </Button>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setSelectedIndices([])} className="h-9 md:h-7 text-xs ml-auto">
                Clear
              </Button>
            </motion.div>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Subtle filter tabs - scrollable on mobile */}
          <div className="flex items-center gap-1 pb-2 border-b border-border/50 overflow-x-auto scrollbar-hide">
            <span className="text-xs text-muted-foreground mr-2 flex-shrink-0">View:</span>
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-2 py-1 rounded text-xs transition-all ${
                activeFilter === 'all'
                  ? 'bg-foreground text-background font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              All ({totalColumns})
            </button>
            {stats.unclassified > 0 && (
              <button
                onClick={() => setActiveFilter('unclassified')}
                className={`px-2 py-1 rounded text-xs transition-all ${
                  activeFilter === 'unclassified'
                    ? 'bg-foreground text-background font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                Unclassified ({stats.unclassified})
              </button>
            )}
            {stats.partner > 0 && (
              <button
                onClick={() => setActiveFilter('partner')}
                className={`px-2 py-1 rounded text-xs transition-all ${
                  activeFilter === 'partner'
                    ? 'bg-blue-500 text-white font-medium'
                    : 'text-blue-600 hover:bg-blue-500/10'
                }`}
              >
                Partner ({stats.partner})
              </button>
            )}
            {stats.staff > 0 && (
              <button
                onClick={() => setActiveFilter('staff')}
                className={`px-2 py-1 rounded text-xs transition-all ${
                  activeFilter === 'staff'
                    ? 'bg-green-500 text-white font-medium'
                    : 'text-green-600 hover:bg-green-500/10'
                }`}
              >
                Staff ({stats.staff})
              </button>
            )}
            {stats.asin > 0 && (
              <button
                onClick={() => setActiveFilter('asin')}
                className={`px-2 py-1 rounded text-xs transition-all ${
                  activeFilter === 'asin'
                    ? 'bg-orange-500 text-white font-medium'
                    : 'text-orange-600 hover:bg-orange-500/10'
                }`}
              >
                ASIN ({stats.asin})
              </button>
            )}
            {stats.weekly > 0 && (
              <button
                onClick={() => setActiveFilter('weekly')}
                className={`px-2 py-1 rounded text-xs transition-all ${
                  activeFilter === 'weekly'
                    ? 'bg-purple-500 text-white font-medium'
                    : 'text-purple-600 hover:bg-purple-500/10'
                }`}
              >
                Weekly ({stats.weekly})
              </button>
            )}
            {stats.computed > 0 && (
              <button
                onClick={() => setActiveFilter('computed')}
                className={`px-2 py-1 rounded text-xs transition-all ${
                  activeFilter === 'computed'
                    ? 'bg-cyan-500 text-white font-medium'
                    : 'text-cyan-600 hover:bg-cyan-500/10'
                }`}
              >
                Computed ({stats.computed})
              </button>
            )}
            {stats.skip > 0 && (
              <button
                onClick={() => setActiveFilter('skip')}
                className={`px-2 py-1 rounded text-xs transition-all ${
                  activeFilter === 'skip'
                    ? 'bg-gray-500 text-white font-medium'
                    : 'text-gray-500 hover:bg-gray-500/10'
                }`}
              >
                Skip ({stats.skip})
              </button>
            )}
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-3 max-h-[400px] overflow-y-auto pb-2">
            {validColumns.map((col, visualIdx) => {
              const idx = col.sourceIndex
              const sample = getSample(idx)
              const isSelected = selectedIndices.includes(idx)
              const isFocused = focusedIndex === visualIdx

              return (
                <MobileColumnCard
                  key={idx}
                  column={col}
                  sampleValue={sample}
                  index={visualIdx}
                  isSelected={isSelected}
                  isFocused={isFocused}
                  availableTags={availableTags}
                  onCategoryChange={(category) => onCategoryChange(idx, category)}
                  onKeyToggle={() => onKeyToggle(idx)}
                  onTagsChange={(tagIds) => onTagsChange(idx, tagIds)}
                  onSelect={(e) => handleSelectionClick(idx, e)}
                />
              )
            })}
          </div>

          {/* Desktop Table View */}
          <ScrollArea className="h-[380px] hidden md:block">
            <div className="space-y-1 pr-3">
              {validColumns.map((col, visualIdx) => {
                const idx = col.sourceIndex
                const sample = getSample(idx)
                const isSelected = selectedIndices.includes(idx)
                const isFocused = focusedIndex === visualIdx

                // Get the actual sample values for each key (for showing linked relationship)
                const partnerKeyValue = partnerKey ? getSample(partnerKey.sourceIndex) : null
                const staffKeyValue = staffKey ? getSample(staffKey.sourceIndex) : null

                return (
                  <motion.div
                    key={idx}
                    layout
                    initial={false}
                    animate={{
                      backgroundColor: col.isKey
                        ? 'rgba(245, 158, 11, 0.05)'
                        : isSelected
                        ? 'hsl(var(--accent))'
                        : isFocused
                        ? 'hsl(var(--accent) / 0.5)'
                        : col.category
                        ? 'hsl(var(--muted) / 0.3)'
                        : 'transparent',
                      scale: 1,
                    }}
                    whileTap={{ scale: 0.995 }}
                    transition={{
                      backgroundColor: { duration: 0.2, ease: easeOut },
                      scale: { duration: 0.1 },
                      layout: { duration: 0.2, ease: easeOut }
                    }}
                    className={`flex items-center gap-3 p-3 rounded-lg border relative hover:bg-accent/50 transition-colors ${
                      col.isKey
                        ? 'border-amber-500/30'
                        : isSelected
                        ? 'border-primary/50'
                        : isFocused
                        ? 'border-primary/60 bg-accent/30'
                        : 'border-border'
                    }`}
                  >
                    {/* Checkbox */}
                    <button
                      onClick={(e) => handleSelectionClick(idx, e)}
                      className={`w-5 h-5 rounded border flex items-center justify-center transition-all flex-shrink-0 ${
                        isSelected
                          ? 'bg-primary border-primary text-primary-foreground'
                          : 'border-border hover:border-primary'
                      }`}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                    </button>

                    {/* Column info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">{col.sourceColumn}</span>
                        <AnimatePresence mode="wait">
                          {col.isKey && col.category && (
                            <motion.div
                              initial={{ scale: 0, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0, opacity: 0 }}
                              transition={{
                                type: "spring",
                                stiffness: 500,
                                damping: 25,
                                duration: 0.3
                              }}
                            >
                              <Badge className={`text-white text-[10px] px-1.5 py-0 ${
                                col.category === 'partner' ? 'bg-blue-500' :
                                col.category === 'staff' ? 'bg-green-500' :
                                col.category === 'asin' ? 'bg-orange-500' : 'bg-amber-500'
                              }`}>
                                <motion.span
                                  initial={{ rotate: -20 }}
                                  animate={{ rotate: 0 }}
                                  transition={{ delay: 0.1, type: "spring", stiffness: 300 }}
                                  className="inline-flex"
                                >
                                  <Key className="h-3 w-3 mr-0.5" />
                                </motion.span>
                                {col.category === 'partner' ? 'Partner Key' :
                                 col.category === 'staff' ? 'Staff Key' :
                                 col.category === 'asin' ? 'ASIN Key' : 'Key'}
                              </Badge>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{sample || '(empty)'}</p>
                    </div>


                    {/* Display selected domain tags for entity columns - LEFT of dropdown */}
                    {(col.category === 'partner' || col.category === 'staff' || col.category === 'asin') && col.tagIds && col.tagIds.length > 0 && (
                      <div className="flex items-center gap-1">
                        {col.tagIds.map(tagId => {
                          const tag = availableTags.find(t => t.id === tagId)
                          if (!tag) return null
                          const tagBgClass = {
                            emerald: 'bg-emerald-500/20 text-emerald-600',
                            blue: 'bg-blue-500/20 text-blue-600',
                            violet: 'bg-violet-500/20 text-violet-600',
                            amber: 'bg-amber-500/20 text-amber-600',
                            orange: 'bg-orange-500/20 text-orange-600',
                            gray: 'bg-gray-500/20 text-gray-600',
                          }[tag.color] || 'bg-gray-500/20 text-gray-600'
                          return (
                            <span
                              key={tagId}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${tagBgClass}`}
                            >
                              {tag.name}
                            </span>
                          )
                        })}
                      </div>
                    )}

                    {/* AI Suggestion button */}
                    <AISuggestionButton
                      columnName={col.sourceColumn}
                      sampleValues={sampleRows.slice(0, 10).map(row => String(row[idx] ?? '')).filter(v => v.trim())}
                      siblingColumns={validColumns.slice(0, 50).map(c => c.sourceColumn)}
                      position={idx}
                      tabName={tabName}
                      sourceName={sheetName}
                      primaryEntity={tabSummary?.primary_entity === 'partner' || tabSummary?.primary_entity === 'staff' || tabSummary?.primary_entity === 'asin' ? tabSummary.primary_entity : null}
                      onApply={(suggestion: AISuggestion) => {
                        // Apply the category
                        onCategoryChange(idx, suggestion.category)
                        // If it's a key field and we have Partner/Staff category, request key confirmation
                        if (suggestion.is_key && (suggestion.category === 'partner' || suggestion.category === 'staff')) {
                          requestKeyConfirmation(idx, col.sourceColumn, suggestion.category, false)
                        }
                      }}
                    />

                    {/* Category selector with integrated key management */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className={`w-[130px] h-8 text-xs justify-between ${
                            col.category === 'partner' ? 'border-blue-500/30 bg-blue-500/5' :
                            col.category === 'staff' ? 'border-green-500/30 bg-green-500/5' :
                            col.category === 'asin' ? 'border-orange-500/30 bg-orange-500/5' :
                            col.category === 'weekly' ? 'border-purple-500/30 bg-purple-500/5' :
                            col.category === 'computed' ? 'border-cyan-500/30 bg-cyan-500/5' :
                            col.category === 'skip' ? 'border-gray-500/30 bg-gray-500/5' : ''
                          }`}
                        >
                          <span className="flex items-center gap-1.5">
                            {col.category === 'partner' && <Building2 className="h-3 w-3 text-blue-500" />}
                            {col.category === 'staff' && <Users className="h-3 w-3 text-green-500" />}
                            {col.category === 'asin' && <Package className="h-3 w-3 text-orange-500" />}
                            {col.category === 'weekly' && <Calendar className="h-3 w-3 text-purple-500" />}
                            {col.category === 'computed' && <Calculator className="h-3 w-3 text-cyan-500" />}
                            {col.category === 'skip' && <SkipForward className="h-3 w-3 text-gray-500" />}
                            {col.category ? (
                              col.category.charAt(0).toUpperCase() + col.category.slice(1)
                            ) : (
                              <span className="text-muted-foreground">Classify...</span>
                            )}
                          </span>
                          <ChevronDown className="h-3 w-3 text-muted-foreground" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-[180px]">
                        <DropdownMenuItem
                          onClick={() => onCategoryChange(idx, null)}
                          className="text-xs"
                        >
                          <span className="text-muted-foreground">Unclassified</span>
                          {!col.category && <Check className="h-3 w-3 ml-auto" />}
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />

                        {/* Partner with key submenu - ASIN nested under Partner */}
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger className="text-xs">
                            <Building2 className="h-3 w-3 mr-2 text-blue-500" />
                            Partner
                            {(col.category === 'partner' || col.category === 'asin') && <Check className="h-3 w-3 ml-auto" />}
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent className="w-[220px]">
                            {/* Partner key info */}
                            {partnerKey && (
                              <div className="px-2 py-1.5 text-[10px] border-b border-border/50 mb-1">
                                <div className="flex items-center gap-1 text-muted-foreground">
                                  <Key className="h-3 w-3 text-blue-500" />
                                  <span>Partner Key: {partnerKey.sourceColumn}</span>
                                </div>
                                {partnerKeyValue && (
                                  <div className="mt-1 pl-4 font-medium text-blue-600 truncate">
                                    → {partnerKeyValue}
                                  </div>
                                )}
                              </div>
                            )}
                            <DropdownMenuItem
                              onClick={() => onCategoryChange(idx, 'partner')}
                              className="text-xs"
                            >
                              <Building2 className="h-3 w-3 mr-2 text-blue-500" />
                              Set as Partner
                              {col.category === 'partner' && !col.isKey && <Check className="h-3 w-3 ml-auto" />}
                            </DropdownMenuItem>
                            {partnerKey ? (
                              <>
                                {!col.isKey && (
                                  <DropdownMenuItem
                                    onClick={() => {
                                      onCategoryChange(idx, 'partner')
                                      requestKeyConfirmation(idx, col.sourceColumn, 'partner', false)
                                    }}
                                    className="text-xs"
                                  >
                                    <Key className="h-3 w-3 mr-2 text-amber-500" />
                                    Make this the Key
                                  </DropdownMenuItem>
                                )}
                                {col.isKey && col.category === 'partner' && (
                                  <DropdownMenuItem
                                    onClick={() => requestKeyConfirmation(idx, col.sourceColumn, 'partner', true)}
                                    className="text-xs text-destructive"
                                  >
                                    <X className="h-3 w-3 mr-2" />
                                    Remove as Key
                                  </DropdownMenuItem>
                                )}
                              </>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => {
                                  onCategoryChange(idx, 'partner')
                                  requestKeyConfirmation(idx, col.sourceColumn, 'partner', false)
                                }}
                                className="text-xs"
                              >
                                <Key className="h-3 w-3 mr-2 text-amber-500" />
                                Set as Partner Key
                              </DropdownMenuItem>
                            )}

                            <DropdownMenuSeparator />

                            {/* ASIN nested under Partner - simple click, no key management */}
                            <DropdownMenuItem
                              onClick={() => onCategoryChange(idx, 'asin')}
                              className="text-xs"
                            >
                              <Package className="h-3 w-3 mr-2 text-orange-500" />
                              ASIN (Product)
                              {col.category === 'asin' && <Check className="h-3 w-3 ml-auto" />}
                            </DropdownMenuItem>

                            {/* Domain tags for Partner/ASIN columns - always show in submenu */}
                            {availableTags.length > 0 && (
                              <>
                                <DropdownMenuSeparator />
                                <div className="px-2 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                                  Domain Tags
                                </div>
                                {availableTags.map(tag => {
                                  const isSelected = col.tagIds?.includes(tag.id) || false
                                  const dotColor = {
                                    emerald: 'bg-emerald-500',
                                    blue: 'bg-blue-500',
                                    violet: 'bg-violet-500',
                                    amber: 'bg-amber-500',
                                    orange: 'bg-orange-500',
                                    gray: 'bg-gray-500',
                                  }[tag.color] || 'bg-gray-500'
                                  return (
                                    <DropdownMenuItem
                                      key={tag.id}
                                      onClick={(e) => {
                                        e.preventDefault()
                                        const currentTags = col.tagIds || []
                                        const newTags = isSelected
                                          ? currentTags.filter(id => id !== tag.id)
                                          : [...currentTags, tag.id]
                                        onTagsChange(idx, newTags)
                                      }}
                                      className="text-xs flex items-center gap-2"
                                    >
                                      <span className={`h-2 w-2 rounded-full ${dotColor}`} />
                                      <span className="flex-1">{tag.name}</span>
                                      {isSelected && <Check className="h-3 w-3" />}
                                    </DropdownMenuItem>
                                  )
                                })}
                              </>
                            )}
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>

                        {/* Staff with key submenu */}
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger className="text-xs">
                            <Users className="h-3 w-3 mr-2 text-green-500" />
                            Staff
                            {col.category === 'staff' && <Check className="h-3 w-3 ml-auto" />}
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent className="w-[200px]">
                            {/* Always show current key info first with real value */}
                            {staffKey && (
                              <div className="px-2 py-1.5 text-[10px] border-b border-border/50 mb-1">
                                <div className="flex items-center gap-1 text-muted-foreground">
                                  <Key className="h-3 w-3 text-green-500" />
                                  <span>Key: {staffKey.sourceColumn}</span>
                                </div>
                                {staffKeyValue && (
                                  <div className="mt-1 pl-4 font-medium text-green-600 truncate">
                                    → {staffKeyValue}
                                  </div>
                                )}
                              </div>
                            )}
                            <DropdownMenuItem
                              onClick={() => onCategoryChange(idx, 'staff')}
                              className="text-xs"
                            >
                              <Users className="h-3 w-3 mr-2 text-green-500" />
                              Set as Staff
                            </DropdownMenuItem>
                            {staffKey ? (
                              <>
                                {!col.isKey && (
                                  <DropdownMenuItem
                                    onClick={() => {
                                      onCategoryChange(idx, 'staff')
                                      requestKeyConfirmation(idx, col.sourceColumn, 'staff', false)
                                    }}
                                    className="text-xs"
                                  >
                                    <Key className="h-3 w-3 mr-2 text-amber-500" />
                                    Make this the Key
                                  </DropdownMenuItem>
                                )}
                                {col.isKey && col.category === 'staff' && (
                                  <DropdownMenuItem
                                    onClick={() => requestKeyConfirmation(idx, col.sourceColumn, 'staff', true)}
                                    className="text-xs text-destructive"
                                  >
                                    <X className="h-3 w-3 mr-2" />
                                    Remove as Key
                                  </DropdownMenuItem>
                                )}
                              </>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => {
                                  onCategoryChange(idx, 'staff')
                                  requestKeyConfirmation(idx, col.sourceColumn, 'staff', false)
                                }}
                                className="text-xs"
                              >
                                <Key className="h-3 w-3 mr-2 text-amber-500" />
                                Set as Staff Key
                              </DropdownMenuItem>
                            )}

                            {/* Domain tags for Staff columns - always show in submenu */}
                            {availableTags.length > 0 && (
                              <>
                                <DropdownMenuSeparator />
                                <div className="px-2 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                                  Domain Tags
                                </div>
                                {availableTags.map(tag => {
                                  const isSelected = col.tagIds?.includes(tag.id) || false
                                  const dotColor = {
                                    emerald: 'bg-emerald-500',
                                    blue: 'bg-blue-500',
                                    violet: 'bg-violet-500',
                                    amber: 'bg-amber-500',
                                    orange: 'bg-orange-500',
                                    gray: 'bg-gray-500',
                                  }[tag.color] || 'bg-gray-500'
                                  return (
                                    <DropdownMenuItem
                                      key={tag.id}
                                      onClick={(e) => {
                                        e.preventDefault()
                                        const currentTags = col.tagIds || []
                                        const newTags = isSelected
                                          ? currentTags.filter(id => id !== tag.id)
                                          : [...currentTags, tag.id]
                                        onTagsChange(idx, newTags)
                                      }}
                                      className="text-xs flex items-center gap-2"
                                    >
                                      <span className={`h-2 w-2 rounded-full ${dotColor}`} />
                                      <span className="flex-1">{tag.name}</span>
                                      {isSelected && <Check className="h-3 w-3" />}
                                    </DropdownMenuItem>
                                  )
                                })}
                              </>
                            )}
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>

                        <DropdownMenuSeparator />

                        {/* Simple categories without key options */}
                        <DropdownMenuItem
                          onClick={() => onCategoryChange(idx, 'weekly')}
                          className="text-xs"
                        >
                          <Calendar className="h-3 w-3 mr-2 text-purple-500" />
                          Weekly
                          {col.category === 'weekly' && <Check className="h-3 w-3 ml-auto" />}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onCategoryChange(idx, 'computed')}
                          className="text-xs"
                        >
                          <Calculator className="h-3 w-3 mr-2 text-cyan-500" />
                          Computed
                          {col.category === 'computed' && <Check className="h-3 w-3 ml-auto" />}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onCategoryChange(idx, 'skip')}
                          className="text-xs"
                        >
                          <SkipForward className="h-3 w-3 mr-2 text-gray-500" />
                          Skip
                          {col.category === 'skip' && <Check className="h-3 w-3 ml-auto" />}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Configure button for computed fields */}
                    {col.category === 'computed' && (
                      <Button
                        variant={col.computedConfig ? "default" : "outline"}
                        size="sm"
                        onClick={() => setConfigureComputedIndex(idx)}
                        className={`h-8 text-xs ${col.computedConfig ? 'bg-cyan-500 hover:bg-cyan-600' : ''}`}
                      >
                        <Calculator className="h-3 w-3 mr-1" />
                        {col.computedConfig ? 'Edit' : 'Configure'}
                      </Button>
                    )}
                  </motion.div>
                )
              })}
            </div>
          </ScrollArea>

          {/* Keyboard shortcuts legend - hidden on mobile */}
          <div className="hidden md:block p-3 rounded-lg bg-muted/30 border border-border">
            <div className="text-xs text-muted-foreground mb-2">Shortcuts</div>
            <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono">1-5</kbd>
                <span>Classify</span>
              </div>
              <div className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono">↑↓</kbd>
                <span>Navigate</span>
              </div>
              <div className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono">Tab</kbd>
                <span>Next unclassified</span>
              </div>
              <div className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono">K</kbd>
                <span>Set key</span>
              </div>
              <div className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono">⇧+click</kbd>
                <span>Range select</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (hasClassifiedColumns) {
                  setShowChangeHeaderDialog(true)
                } else {
                  onBack()
                }
              }}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Change Header Row
            </Button>
            <Button
              onClick={onConfirm}
              disabled={!hasKeyDesignated}
              className="gap-2"
            >
              {hasKeyDesignated ? 'Continue to Field Mapping' : 'Select at least one key'}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Computed Field Configuration Modal */}
      {configureComputedIndex !== null && (
        <ComputedFieldConfigModal
          column={columns[configureComputedIndex]}
          allColumns={columns}
          onSave={(config) => {
            onComputedConfigChange(configureComputedIndex, config)
            setConfigureComputedIndex(null)
          }}
          onClose={() => setConfigureComputedIndex(null)}
        />
      )}

      {/* Key Confirmation Dialog */}
      <Dialog
        open={keyConfirmation.open}
        onOpenChange={(open) => !open && setKeyConfirmation({ ...keyConfirmation, open: false })}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-amber-500" />
              {keyConfirmation.action === 'set' && 'Set as Key?'}
              {keyConfirmation.action === 'change' && 'Change Key?'}
              {keyConfirmation.action === 'remove' && 'Remove Key?'}
            </DialogTitle>
            <DialogDescription className="pt-2">
              {keyConfirmation.action === 'set' && (
                <>
                  Set <span className="font-medium text-foreground">&quot;{keyConfirmation.columnName}&quot;</span> as the{' '}
                  <span className={`font-medium ${
                    keyConfirmation.category === 'partner' ? 'text-blue-600' :
                    keyConfirmation.category === 'staff' ? 'text-green-600' : 'text-orange-600'
                  }`}>
                    {keyConfirmation.category === 'partner' ? 'Partner' :
                     keyConfirmation.category === 'staff' ? 'Staff' : 'ASIN'} Key
                  </span>?
                  <p className="mt-2 text-xs">This column will uniquely identify each record.</p>
                </>
              )}
              {keyConfirmation.action === 'change' && (
                <>
                  Change the{' '}
                  <span className={`font-medium ${
                    keyConfirmation.category === 'partner' ? 'text-blue-600' :
                    keyConfirmation.category === 'staff' ? 'text-green-600' : 'text-orange-600'
                  }`}>
                    {keyConfirmation.category === 'partner' ? 'Partner' :
                     keyConfirmation.category === 'staff' ? 'Staff' : 'ASIN'} Key
                  </span>{' '}
                  from <span className="font-medium text-foreground">&quot;{keyConfirmation.currentKeyName}&quot;</span> to{' '}
                  <span className="font-medium text-foreground">&quot;{keyConfirmation.columnName}&quot;</span>?
                </>
              )}
              {keyConfirmation.action === 'remove' && (
                <>
                  Remove <span className="font-medium text-foreground">&quot;{keyConfirmation.columnName}&quot;</span> as the{' '}
                  <span className={`font-medium ${
                    keyConfirmation.category === 'partner' ? 'text-blue-600' :
                    keyConfirmation.category === 'staff' ? 'text-green-600' : 'text-orange-600'
                  }`}>
                    {keyConfirmation.category === 'partner' ? 'Partner' :
                     keyConfirmation.category === 'staff' ? 'Staff' : 'ASIN'} Key
                  </span>?
                  <p className="mt-2 text-xs text-amber-600">You&apos;ll need to set a new key before continuing.</p>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setKeyConfirmation({ ...keyConfirmation, open: false })}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmKeyAction}
              className={keyConfirmation.action === 'remove' ? 'bg-destructive hover:bg-destructive/90' : ''}
            >
              {keyConfirmation.action === 'set' && 'Set as Key'}
              {keyConfirmation.action === 'change' && 'Change Key'}
              {keyConfirmation.action === 'remove' && 'Remove Key'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Header Row Confirmation Dialog */}
      <Dialog open={showChangeHeaderDialog} onOpenChange={setShowChangeHeaderDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change Header Row?</DialogTitle>
            <DialogDescription className="pt-2">
              You have classified <span className="font-medium text-foreground">{columns.filter(c => c.category !== null).length}</span> columns.
              Changing the header row will <span className="text-amber-600 font-medium">reset all classifications</span>.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowChangeHeaderDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setShowChangeHeaderDialog(false)
                onBack()
              }}
            >
              Change Header Row
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Suggest All Dialog */}
      <AISuggestAllDialog
        open={showAISuggestAll}
        onOpenChange={setShowAISuggestAll}
        columns={allValidColumns
          .filter(col => col.category === null) // Only send unclassified columns
          .map((col) => ({
            name: col.sourceColumn,
            sample_values: sampleRows.slice(0, 10).map(row => String(row[col.sourceIndex] ?? '')).filter(v => v.trim()),
            position: col.sourceIndex,
          }))}
        tabName={tabName}
        onApplyAll={(suggestions: BulkSuggestion[]) => {
          suggestions.forEach((suggestion) => {
            onCategoryChange(suggestion.position, suggestion.category)
            // Request key confirmation for key fields
            if (suggestion.is_key && (suggestion.category === 'partner' || suggestion.category === 'staff')) {
              const col = allValidColumns.find(c => c.sourceIndex === suggestion.position)
              if (col) {
                requestKeyConfirmation(suggestion.position, col.sourceColumn, suggestion.category, false)
              }
            }
          })
        }}
        onApplySelected={(suggestions: BulkSuggestion[]) => {
          suggestions.forEach((suggestion) => {
            onCategoryChange(suggestion.position, suggestion.category)
            // Request key confirmation for key fields
            if (suggestion.is_key && (suggestion.category === 'partner' || suggestion.category === 'staff')) {
              const col = allValidColumns.find(c => c.sourceIndex === suggestion.position)
              if (col) {
                requestKeyConfirmation(suggestion.position, col.sourceColumn, suggestion.category, false)
              }
            }
          })
        }}
      />
      </div>
    </motion.div>
  )
}

// ============ COMPUTED FIELD CONFIG MODAL ============
function ComputedFieldConfigModal({
  column,
  allColumns,
  onSave,
  onClose,
}: {
  column: ColumnClassification
  allColumns: ColumnClassification[]
  onSave: (config: ComputedFieldConfig) => void
  onClose: () => void
}) {
  const [computationType, setComputationType] = useState<ComputationType>(
    column.computedConfig?.computationType || 'formula'
  )
  const [targetTable, setTargetTable] = useState<EntityType>(
    column.computedConfig?.targetTable || 'partners'
  )
  const [targetField, setTargetField] = useState(
    column.computedConfig?.targetField || column.sourceColumn.toLowerCase().replace(/\s+/g, '_')
  )
  const [displayName, setDisplayName] = useState(
    column.computedConfig?.displayName || column.sourceColumn
  )
  const [description, setDescription] = useState(
    column.computedConfig?.description || ''
  )
  // Formula specific
  const [dependsOn, setDependsOn] = useState<string>(
    column.computedConfig?.dependsOn?.join(', ') || ''
  )
  const [formula, setFormula] = useState(
    column.computedConfig?.formula || 'timezone_to_current_time'
  )
  // Aggregation specific
  const [sourceTable, setSourceTable] = useState(
    column.computedConfig?.sourceTable || 'weekly_statuses'
  )
  const [aggregation, setAggregation] = useState(
    column.computedConfig?.aggregation || 'latest'
  )
  // Lookup specific
  const [lookupSource, setLookupSource] = useState(
    column.computedConfig?.lookupSource || 'zoho'
  )
  const [matchField, setMatchField] = useState(
    column.computedConfig?.matchField || 'email'
  )
  const [lookupField, setLookupField] = useState(
    column.computedConfig?.lookupField || ''
  )

  const handleSave = () => {
    const config: ComputedFieldConfig = {
      computationType,
      targetTable,
      targetField,
      displayName,
      description: description || undefined,
    }

    // Add type-specific config
    if (computationType === 'formula') {
      config.dependsOn = dependsOn.split(',').map(s => s.trim()).filter(Boolean)
      config.formula = formula
    } else if (computationType === 'aggregation') {
      config.sourceTable = sourceTable
      config.aggregation = aggregation
    } else if (computationType === 'lookup') {
      config.lookupSource = lookupSource
      config.matchField = matchField
      config.lookupField = lookupField
    }

    onSave(config)
  }

  // Get available columns for formula dependencies
  const availableDependencies = allColumns
    .filter(c => c.category !== 'computed' && c.category !== 'skip' && c.category !== 'weekly')
    .map(c => c.sourceColumn)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-background rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-hidden"
      >
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <Calculator className="h-4 w-4 text-cyan-500" />
              Configure Computed Field
            </h3>
            <p className="text-sm text-muted-foreground">&quot;{column.sourceColumn}&quot;</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="max-h-[60vh]">
          <div className="p-4 space-y-4">
            {/* Computation Type */}
            <div className="space-y-2">
              <label className="text-sm font-medium">How is this computed?</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setComputationType('formula')}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    computationType === 'formula'
                      ? 'border-cyan-500 bg-cyan-500/10'
                      : 'border-border hover:border-cyan-500/50'
                  }`}
                >
                  <Calculator className="h-4 w-4 text-cyan-500 mb-1" />
                  <div className="text-sm font-medium">Formula</div>
                  <div className="text-xs text-muted-foreground">From other fields</div>
                </button>
                <button
                  onClick={() => setComputationType('aggregation')}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    computationType === 'aggregation'
                      ? 'border-cyan-500 bg-cyan-500/10'
                      : 'border-border hover:border-cyan-500/50'
                  }`}
                >
                  <Database className="h-4 w-4 text-purple-500 mb-1" />
                  <div className="text-sm font-medium">From History</div>
                  <div className="text-xs text-muted-foreground">Aggregated data</div>
                </button>
                <button
                  onClick={() => setComputationType('lookup')}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    computationType === 'lookup'
                      ? 'border-cyan-500 bg-cyan-500/10'
                      : 'border-border hover:border-cyan-500/50'
                  }`}
                >
                  <Search className="h-4 w-4 text-orange-500 mb-1" />
                  <div className="text-sm font-medium">External Lookup</div>
                  <div className="text-xs text-muted-foreground">Zoho, Xero, Slack...</div>
                </button>
                <button
                  onClick={() => setComputationType('custom')}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    computationType === 'custom'
                      ? 'border-cyan-500 bg-cyan-500/10'
                      : 'border-border hover:border-cyan-500/50'
                  }`}
                >
                  <MessageSquare className="h-4 w-4 text-green-500 mb-1" />
                  <div className="text-sm font-medium">Custom Logic</div>
                  <div className="text-xs text-muted-foreground">Describe it</div>
                </button>
              </div>
            </div>

            {/* Target Entity */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Which entity does this belong to?</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setTargetTable('partners')}
                  className={`flex-1 p-2 rounded-lg border text-sm transition-all ${
                    targetTable === 'partners'
                      ? 'border-blue-500 bg-blue-500/10 text-blue-600'
                      : 'border-border hover:border-blue-500/50'
                  }`}
                >
                  <Building2 className="h-4 w-4 mx-auto mb-1" />
                  Partner
                </button>
                <button
                  onClick={() => setTargetTable('staff')}
                  className={`flex-1 p-2 rounded-lg border text-sm transition-all ${
                    targetTable === 'staff'
                      ? 'border-green-500 bg-green-500/10 text-green-600'
                      : 'border-border hover:border-green-500/50'
                  }`}
                >
                  <Users className="h-4 w-4 mx-auto mb-1" />
                  Staff
                </button>
                <button
                  onClick={() => setTargetTable('asins')}
                  className={`flex-1 p-2 rounded-lg border text-sm transition-all ${
                    targetTable === 'asins'
                      ? 'border-orange-500 bg-orange-500/10 text-orange-600'
                      : 'border-border hover:border-orange-500/50'
                  }`}
                >
                  <Package className="h-4 w-4 mx-auto mb-1" />
                  ASIN
                </button>
              </div>
            </div>

            {/* Field Name */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Display Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
                  placeholder="Current Time"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Field Name</label>
                <input
                  type="text"
                  value={targetField}
                  onChange={(e) => setTargetField(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border bg-background text-sm font-mono"
                  placeholder="current_time"
                />
              </div>
            </div>

            {/* Type-specific options */}
            {computationType === 'formula' && (
              <div className="space-y-3 p-3 rounded-lg bg-cyan-500/5 border border-cyan-500/20">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Depends on columns</label>
                  <input
                    type="text"
                    value={dependsOn}
                    onChange={(e) => setDependsOn(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
                    placeholder="Time Zone, Start Date"
                  />
                  <p className="text-xs text-muted-foreground">
                    Available: {availableDependencies.slice(0, 5).join(', ')}
                    {availableDependencies.length > 5 && '...'}
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Formula</label>
                  <Select value={formula} onValueChange={setFormula}>
                    <SelectTrigger className="text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="timezone_to_current_time">Timezone → Current Time</SelectItem>
                      <SelectItem value="days_since">Days Since Date</SelectItem>
                      <SelectItem value="months_between">Months Between Dates</SelectItem>
                      <SelectItem value="custom">Custom (describe below)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {computationType === 'aggregation' && (
              <div className="space-y-3 p-3 rounded-lg bg-purple-500/5 border border-purple-500/20">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Source Table</label>
                    <Select value={sourceTable} onValueChange={setSourceTable}>
                      <SelectTrigger className="text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekly_statuses">Weekly Statuses</SelectItem>
                        <SelectItem value="partner_assignments">Partner Assignments</SelectItem>
                        <SelectItem value="sync_runs">Sync History</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Aggregation</label>
                    <Select value={aggregation} onValueChange={setAggregation}>
                      <SelectTrigger className="text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="latest">Latest Value</SelectItem>
                        <SelectItem value="earliest">Earliest Value</SelectItem>
                        <SelectItem value="count">Count</SelectItem>
                        <SelectItem value="count_distinct">Count Distinct</SelectItem>
                        <SelectItem value="sum">Sum</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {computationType === 'lookup' && (
              <div className="space-y-3 p-3 rounded-lg bg-orange-500/5 border border-orange-500/20">
                <div className="space-y-2">
                  <label className="text-sm font-medium">External System</label>
                  <Select value={lookupSource} onValueChange={setLookupSource}>
                    <SelectTrigger className="text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="zoho">Zoho (Invoicing)</SelectItem>
                      <SelectItem value="xero">Xero (Accounting)</SelectItem>
                      <SelectItem value="slack">Slack (Profiles)</SelectItem>
                      <SelectItem value="close">Close (CRM)</SelectItem>
                      <SelectItem value="amazon">Amazon SP-API</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Match on</label>
                    <input
                      type="text"
                      value={matchField}
                      onChange={(e) => setMatchField(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
                      placeholder="email"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Get field</label>
                    <input
                      type="text"
                      value={lookupField}
                      onChange={(e) => setLookupField(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
                      placeholder="payment_status"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Description (always shown, required for custom) */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Description {computationType === 'custom' && <span className="text-red-500">*</span>}
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border bg-background text-sm min-h-[80px] resize-none"
                placeholder={
                  computationType === 'custom'
                    ? "Describe how this field should be computed..."
                    : "Optional: Add notes about this computed field..."
                }
              />
            </div>

            {/* Future source hot-swap hint */}
            <div className="p-3 rounded-lg bg-muted/50 border border-dashed">
              <p className="text-xs text-muted-foreground">
                <Sparkles className="h-3 w-3 inline mr-1 text-amber-500" />
                <strong>Future:</strong> You&apos;ll be able to hot-swap data sources later (e.g., get timezone from Slack instead of this sheet)
              </p>
            </div>
          </div>
        </ScrollArea>

        <div className="p-4 border-t flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={computationType === 'custom' && !description.trim()}
            className="bg-cyan-500 hover:bg-cyan-600"
          >
            <Check className="h-4 w-4 mr-1" />
            Save Configuration
          </Button>
        </div>
      </motion.div>
    </div>
  )
}

// ============ PHASE 3: MAP TO FIELDS ============
function MapPhase({
  rawData,
  headerRow,
  columns,
  onFieldChange,
  onAuthorityChange,
  onConfirm,
  onBack,
  embedded = false,
}: {
  rawData: TabRawData
  headerRow: number
  columns: ColumnClassification[]
  onFieldChange: (index: number, field: string | null) => void
  onAuthorityChange: (index: number, authority: SourceAuthority) => void
  onConfirm: () => void
  onBack: () => void
  embedded?: boolean
}) {
  const sampleRows = rawData.rows.slice(headerRow + 1, headerRow + 4)

  const partnerColumns = columns.filter(c => c.category === 'partner')
  const staffColumns = columns.filter(c => c.category === 'staff')
  const asinColumns = columns.filter(c => c.category === 'asin')
  const weeklyColumns = columns.filter(c => c.category === 'weekly')

  const getSample = (colIndex: number) => sampleRows[0]?.[colIndex] || ''

  const renderColumnMapper = (col: ColumnClassification, entityType: EntityType, colorClass: string) => {
    const groupedFields = getGroupedFieldDefs(entityType)
    return (
      <motion.div
        key={col.sourceIndex}
        layout
        className={`p-3 rounded-lg border ${colorClass}`}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{col.sourceColumn}</span>
            {col.isKey && (
              <Badge className="bg-amber-500 text-white text-[10px] px-1.5 py-0">
                <Key className="h-3 w-3 mr-0.5" />
                Key
              </Badge>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground mb-2 truncate">{getSample(col.sourceIndex) || '(empty)'}</p>

        <Select
          value={col.targetField || '__none__'}
          onValueChange={(value) => onFieldChange(col.sourceIndex, value === '__none__' ? null : value)}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Map to field..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">
              <span className="text-muted-foreground">Don&apos;t map</span>
            </SelectItem>
            {groupedFields.map((group) => (
              <SelectGroup key={group.group}>
                <SelectLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
                  {group.group}
                </SelectLabel>
                {group.fields.map((field) => (
                  <SelectItem key={field.value} value={field.value}>
                    {field.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>

        {col.targetField && (
          <div className="flex items-center gap-1 mt-2">
            <button
              onClick={() => onAuthorityChange(col.sourceIndex, 'source_of_truth')}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-all ${
                col.authority === 'source_of_truth'
                  ? 'bg-amber-500/10 text-amber-600 ring-1 ring-amber-500/30'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted'
              }`}
            >
              <Star className={`h-3 w-3 ${col.authority === 'source_of_truth' ? 'fill-amber-500' : ''}`} />
              Source
            </button>
            <button
              onClick={() => onAuthorityChange(col.sourceIndex, 'reference')}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-all ${
                col.authority === 'reference'
                  ? 'bg-slate-500/10 text-slate-600 ring-1 ring-slate-500/30'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted'
              }`}
            >
              <FileText className="h-3 w-3" />
              Reference
            </button>
          </div>
        )}
      </motion.div>
    )
  }

  return (
    <motion.div {...fadeInUp} className="space-y-6">
      <Card className={embedded ? '' : 'max-w-5xl mx-auto'}>
        <CardHeader className={embedded ? 'pb-3' : ''}>
          <CardTitle className={`flex items-center gap-2 ${embedded ? 'text-base' : ''}`}>
            <Link2 className={`${embedded ? 'h-4 w-4' : 'h-5 w-5'} text-orange-500`} />
            {embedded ? 'Map Fields' : 'Map to database fields'}
          </CardTitle>
          <CardDescription>
            {embedded ? 'Connect columns to database fields.' : 'Connect your classified columns to specific fields. Set each as Source of Truth or Reference.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Partner columns */}
            {partnerColumns.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2 text-blue-600">
                  <Building2 className="h-4 w-4" />
                  Partner Fields ({partnerColumns.length})
                </h4>
                <ScrollArea className="h-[300px]">
                  <div className="space-y-2 pr-2">
                    {partnerColumns.map(col => renderColumnMapper(col, 'partners', 'bg-blue-500/5 border-blue-500/20'))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Staff columns */}
            {staffColumns.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2 text-green-600">
                  <Users className="h-4 w-4" />
                  Staff Fields ({staffColumns.length})
                </h4>
                <ScrollArea className="h-[300px]">
                  <div className="space-y-2 pr-2">
                    {staffColumns.map(col => renderColumnMapper(col, 'staff', 'bg-green-500/5 border-green-500/20'))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* ASIN columns */}
            {asinColumns.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2 text-orange-600">
                  <Package className="h-4 w-4" />
                  ASIN Fields ({asinColumns.length})
                </h4>
                <ScrollArea className="h-[300px]">
                  <div className="space-y-2 pr-2">
                    {asinColumns.map(col => renderColumnMapper(col, 'asins', 'bg-orange-500/5 border-orange-500/20'))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Weekly columns */}
            {weeklyColumns.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2 text-purple-600">
                  <Calendar className="h-4 w-4" />
                  Weekly Data ({weeklyColumns.length})
                </h4>
                <div className="p-4 rounded-lg border border-purple-500/20 bg-purple-500/5">
                  <p className="text-sm text-purple-600 mb-2">
                    {weeklyColumns.length} weekly columns detected
                  </p>
                  <p className="text-xs text-muted-foreground">
                    These will be pivoted into the <code className="bg-muted px-1 rounded">weekly_statuses</code> table with one row per week.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {weeklyColumns.slice(0, 5).map(col => (
                      <Badge key={col.sourceIndex} variant="secondary" className="text-xs">
                        {col.sourceColumn}
                      </Badge>
                    ))}
                    {weeklyColumns.length > 5 && (
                      <Badge variant="secondary" className="text-xs">
                        +{weeklyColumns.length - 5} more
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground pt-4 border-t">
            <span className="flex items-center gap-1">
              <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
              Source of Truth = This sheet is authoritative
            </span>
            <span className="flex items-center gap-1">
              <FileText className="h-3 w-3 text-slate-400" />
              Reference = Read-only, don&apos;t update master
            </span>
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
            <Button variant="outline" onClick={onBack} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Classify
            </Button>
            <Button onClick={onConfirm} className="gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Complete Mapping
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
