'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Loader2, Search, Table, ChevronUp, RefreshCw, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { SourceTabBar } from './source-tab-bar'
import { SheetTabBar, OVERVIEW_TAB_ID } from './sheet-tab-bar'
import { SmartMapper } from '../smart-mapper'
import { TabOverviewDashboard } from './tab-overview-dashboard'
import { SyncPreviewDialog, type TabPreviewResult } from '../sync-preview-dialog'
import { Button } from '@/components/ui/button'
import { ShimmerGrid } from '@/components/ui/shimmer-grid'
import { SheetSearchModal } from '../sheet-search-modal'
import type { CategoryStats } from '@/types/entities'

interface DataSource {
  id: string
  name: string
  type: string
  spreadsheet_id: string
  spreadsheet_url: string
  tabCount: number
  mappedFieldsCount: number
  tabs: {
    id: string
    tab_name: string
    primary_entity: 'partners' | 'staff' | 'asins'
    header_row: number
    header_confirmed?: boolean
    columnCount: number
    categoryStats?: CategoryStats
    status?: 'active' | 'reference' | 'hidden' | 'flagged'
    notes?: string | null
    updated_at?: string | null
  }[]
}

interface SheetPreview {
  spreadsheetId: string
  title: string
  tabs: {
    sheetId: number
    title: string
    rowCount: number
    columnCount: number
  }[]
}

interface SourceBrowserProps {
  onBack: () => void
  initialSourceId?: string | null
  initialTabId?: string | null
  onSourceChange?: (sourceId: string | null) => void
  onTabChange?: (tabId: string | null) => void
}

const easeOut: [number, number, number, number] = [0.22, 1, 0.36, 1]

export function SourceBrowser({ onBack, initialSourceId, initialTabId, onSourceChange, onTabChange }: SourceBrowserProps) {
  const [sources, setSources] = useState<DataSource[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [authError, setAuthError] = useState(false)
  const [activeSourceId, setActiveSourceIdInternal] = useState<string | null>(initialSourceId || null)
  const [activeTabId, setActiveTabIdInternal] = useState<string | null>(initialTabId || OVERVIEW_TAB_ID) // Default to Overview or initial

  // Track if user has manually selected a tab - prevents race condition with fetch
  const userHasSelectedTab = useRef(!!initialTabId)

  // Stable refs for initial values — prevents fetchSources from being recreated
  const initialSourceIdRef = useRef(initialSourceId)
  const onTabChangeRef = useRef(onTabChange)
  const onSourceChangeRef = useRef(onSourceChange)
  onTabChangeRef.current = onTabChange
  onSourceChangeRef.current = onSourceChange

  // Wrapper to propagate source changes up
  const setActiveSourceId = (sourceId: string | null) => {
    setActiveSourceIdInternal(sourceId)
    onSourceChange?.(sourceId)
  }

  // Wrapper to propagate tab changes up
  const setActiveTabId = (tabId: string | null) => {
    userHasSelectedTab.current = true // Mark that user made a selection
    setActiveTabIdInternal(tabId)
    onTabChange?.(tabId)
  }
  const [showSearchModal, setShowSearchModal] = useState(false)
  const [dashboardViewMode, setDashboardViewMode] = useState<'grid' | 'list'>('grid')

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncStatus, setSyncStatus] = useState<{
    lastSyncAt?: string | null
    lastSyncStatus?: 'completed' | 'failed' | null
    rowsProcessed?: number
    rowsCreated?: number
    rowsUpdated?: number
  }>({})

  // Sync preview state
  const [showSyncPreview, setShowSyncPreview] = useState(false)
  const [isLoadingSyncPreview, setIsLoadingSyncPreview] = useState(false)
  const [previewResults, setPreviewResults] = useState<TabPreviewResult[]>([])

  // For new sources - store preview data until saved
  const [sheetPreviews, setSheetPreviews] = useState<Record<string, SheetPreview>>({})
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)

  // Load preview for a source that has no tabs yet
  const loadPreviewForSource = useCallback(async (sourceId: string, spreadsheetId: string) => {
    setIsLoadingPreview(true)
    try {
      const response = await fetch(`/api/sheets/preview?id=${spreadsheetId}`)
      if (response.ok) {
        const data = await response.json()
        const preview = data.preview as SheetPreview

        setSheetPreviews(prev => ({
          ...prev,
          [sourceId]: preview,
        }))

        // Only auto-select if user hasn't already selected a tab
        if (!userHasSelectedTab.current && preview.tabs.length > 0) {
          setActiveTabIdInternal(String(preview.tabs[0].sheetId))
          onTabChangeRef.current?.(String(preview.tabs[0].sheetId))
        }
      }
    } catch (error) {
      console.error('Error loading preview:', error)
    } finally {
      setIsLoadingPreview(false)
    }
  }, []) // Stable — uses refs for callbacks

  // Fetch existing sources — stable function, safe to call from effects and retry button
  const fetchSources = useCallback(async () => {
    setIsLoading(true)
    setAuthError(false)
    try {
      const response = await fetch('/api/data-sources')
      if (response.status === 401) {
        setAuthError(true)
        return
      }
      if (response.ok) {
        const json = await response.json()
        const fetchedSources = json.data?.sources || json.sources || []
        setSources(fetchedSources)

        // Use initialSourceId if provided, otherwise auto-select first
        const initSrcId = initialSourceIdRef.current
        const sourceToSelect = initSrcId
          ? fetchedSources.find((s: DataSource) => s.id === initSrcId)
          : fetchedSources[0]

        if (sourceToSelect) {
          setActiveSourceIdInternal(sourceToSelect.id)
          onSourceChangeRef.current?.(sourceToSelect.id)

          // Always fetch Google Sheets preview for full tab discovery.
          if (sourceToSelect.spreadsheet_id) {
            loadPreviewForSource(sourceToSelect.id, sourceToSelect.spreadsheet_id)
          }

          // Only default to Overview if user hasn't already selected a tab
          if (!userHasSelectedTab.current) {
            userHasSelectedTab.current = true
            setActiveTabIdInternal(OVERVIEW_TAB_ID)
            onTabChangeRef.current?.(OVERVIEW_TAB_ID)
          }
        }
      }
    } catch (error) {
      console.error('Error fetching sources:', error)
    } finally {
      setIsLoading(false)
    }
  }, [loadPreviewForSource]) // Stable — loadPreviewForSource is stable

  // Run once on mount
  useEffect(() => {
    fetchSources()
  }, [fetchSources])

  // Get active source and tab data
  const activeSource = sources.find(s => s.id === activeSourceId)
  const activePreview = activeSourceId ? sheetPreviews[activeSourceId] : null

  // Helper to calculate mapping progress from category stats
  const calculateMappingProgress = (stats?: CategoryStats): number => {
    if (!stats) return 0
    const mapped = stats.partner + stats.staff + stats.asin + stats.weekly + stats.computed + stats.skip
    const total = mapped + stats.unmapped
    return total > 0 ? Math.round((mapped / total) * 100) : 0
  }

  // Build tabs list for the active source
  // Merge database tabs with preview tabs - database tabs take precedence
  const sheetTabs = (() => {
    const dbTabs = (activeSource?.tabs || []).map(t => ({
      id: t.id,
      name: t.tab_name,
      columnCount: t.columnCount,
      isMapped: true,
      primaryEntity: t.primary_entity,
      status: t.status || 'active',
      notes: t.notes,
      headerConfirmed: t.header_confirmed || false,
      headerRow: t.header_row,
      hasHeaders: t.header_row >= 0,
      mappingProgress: calculateMappingProgress(t.categoryStats),
    }))

    const previewTabs = (activePreview?.tabs || []).map(t => ({
      id: String(t.sheetId),
      name: t.title,
      rowCount: t.rowCount,
      columnCount: t.columnCount,
      isMapped: false,
      primaryEntity: null as 'partners' | 'staff' | 'asins' | null,
      status: 'active' as const,
      notes: null as string | null,
      headerConfirmed: false,
      headerRow: undefined as number | undefined,
      hasHeaders: false,
      mappingProgress: 0,
    }))

    // If no preview tabs, just return db tabs
    if (previewTabs.length === 0) return dbTabs

    // Merge: use db tab if it exists for that name, otherwise use preview tab
    // Always prefer preview's columnCount (actual sheet columns) over db's columnCount (mapped columns)
    const dbTabsByName = new Map(dbTabs.map(t => [t.name, t]))

    return previewTabs.map(previewTab => {
      const dbTab = dbTabsByName.get(previewTab.name)
      if (dbTab) {
        // Merge: keep DB data but use preview's actual column count
        return {
          ...dbTab,
          columnCount: previewTab.columnCount,
        }
      }
      return previewTab
    })
  })()

  const activeTab = sheetTabs.find(t => t.id === activeTabId)

  // Auto-select Overview when tabs are available but none selected,
  // or when activeTabId is set but not found in sheetTabs (e.g. stale URL deep link)
  useEffect(() => {
    if (sheetTabs.length > 0 && !activeTabId) {
      setActiveTabId(OVERVIEW_TAB_ID)
    }
    // Fallback: if activeTabId is set but doesn't match any tab (and isn't Overview),
    // fall back to Overview so the user doesn't see a blank page
    if (
      sheetTabs.length > 0 &&
      activeTabId &&
      activeTabId !== OVERVIEW_TAB_ID &&
      !activeTab &&
      !isLoading &&
      !isLoadingPreview
    ) {
      setActiveTabId(OVERVIEW_TAB_ID)
    }
  }, [sheetTabs, activeTabId, activeTab, isLoading, isLoadingPreview])

  // Handle tab status change
  const handleTabStatusChange = async (tabId: string, status: string, notes?: string) => {
    try {
      // Check if this is a UUID (mapped tab) or a Google Sheet ID (unmapped tab)
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tabId)

      let actualTabId = tabId

      if (!isUUID && activeSource) {
        // This is an unmapped tab - need to create a tab_mapping first
        const tab = sheetTabs.find(t => t.id === tabId)
        if (!tab) {
          console.error('Tab not found:', tabId)
          return
        }

        // Create a minimal tab_mapping record
        const createResponse = await fetch('/api/tab-mappings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            data_source_id: activeSource.id,
            tab_name: tab.name,
            status,
            notes,
          }),
        })

        if (createResponse.ok) {
          const data = await createResponse.json()
          actualTabId = data.tabMapping.id

          // Refresh sources to get the new tab mapping
          const sourcesResponse = await fetch('/api/data-sources')
          if (sourcesResponse.ok) {
            const sourcesData = await sourcesResponse.json()
            setSources(sourcesData.sources || [])
          }

          // If hiding the currently selected tab, select another visible one
          if (status === 'hidden' && activeTabId === tabId) {
            const visibleTabs = sheetTabs.filter(t => t.id !== tabId && t.status !== 'hidden')
            if (visibleTabs.length > 0) {
              setActiveTabId(visibleTabs[0].id)
            } else {
              setActiveTabId(null)
            }
          }
          return
        } else {
          const error = await createResponse.json()
          console.error('Failed to create tab mapping:', error)
          return
        }
      }

      // Update existing tab mapping
      const response = await fetch(`/api/tab-mappings/${actualTabId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, notes }),
      })

      if (response.ok) {
        // Update local state
        setSources(prev => prev.map(source => ({
          ...source,
          tabs: source.tabs.map(tab =>
            tab.id === actualTabId ? { ...tab, status: status as typeof tab.status, notes } : tab
          ),
        })))

        // If hiding the currently selected tab, select another visible one
        if (status === 'hidden' && activeTabId === actualTabId) {
          const visibleTabs = sheetTabs.filter(t => t.id !== actualTabId && t.status !== 'hidden')
          if (visibleTabs.length > 0) {
            setActiveTabId(visibleTabs[0].id)
          } else {
            setActiveTabId(null)
          }
        }
      }
    } catch (error) {
      console.error('Error updating tab status:', error)
    }
  }

  // Handle sync: run dry run first to show preview
  const handleSync = useCallback(async () => {
    if (!activeSource?.id || isSyncing || isLoadingSyncPreview) return

    // Get all active tabs with mappings
    const activeTabs = activeSource.tabs?.filter(
      t => t.status === 'active' || !t.status
    ) || []

    if (activeTabs.length === 0) {
      toast.info('No active tabs to sync')
      return
    }

    // Open preview dialog and run dry run
    setShowSyncPreview(true)
    setIsLoadingSyncPreview(true)
    setPreviewResults([])

    const results: TabPreviewResult[] = []

    for (const tab of activeTabs) {
      if (!tab.id) continue

      try {
        const response = await fetch(`/api/sync/tab/${tab.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dry_run: true }),
        })

        if (response.ok) {
          const json = await response.json()
          const data = json.data
          results.push({
            tabId: tab.id,
            tabName: tab.tab_name,
            changes: data.changes || [],
            stats: data.stats || { rows_processed: 0, rows_created: 0, rows_updated: 0, rows_skipped: 0, errors: [] },
          })
        } else {
          const errorData = await response.json().catch(() => ({}))
          results.push({
            tabId: tab.id,
            tabName: tab.tab_name,
            changes: [],
            stats: { rows_processed: 0, rows_created: 0, rows_updated: 0, rows_skipped: 0, errors: [] },
            error: errorData.error?.message || 'Dry run failed',
          })
        }
      } catch {
        results.push({
          tabId: tab.id,
          tabName: tab.tab_name,
          changes: [],
          stats: { rows_processed: 0, rows_created: 0, rows_updated: 0, rows_skipped: 0, errors: [] },
          error: 'Network error',
        })
      }
    }

    setPreviewResults(results)
    setIsLoadingSyncPreview(false)
  }, [activeSource, isSyncing, isLoadingSyncPreview])

  // Confirm sync: apply changes for real
  const handleConfirmSync = useCallback(async () => {
    if (!activeSource?.id || isSyncing) return

    const activeTabs = activeSource.tabs?.filter(
      t => t.status === 'active' || !t.status
    ) || []

    setIsSyncing(true)
    let totalProcessed = 0
    let totalCreated = 0
    let totalUpdated = 0
    const errors: string[] = []

    try {
      for (const tab of activeTabs) {
        if (!tab.id) continue

        try {
          const response = await fetch(`/api/sync/tab/${tab.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          })

          if (response.ok) {
            const result = await response.json()
            const data = result.data
            totalProcessed += data.stats?.rows_processed || 0
            totalCreated += data.stats?.rows_created || 0
            totalUpdated += data.stats?.rows_updated || 0
          } else {
            const errorData = await response.json().catch(() => ({}))
            errors.push(`${tab.tab_name}: ${errorData.error?.message || 'Sync failed'}`)
          }
        } catch {
          errors.push(`${tab.tab_name}: Network error`)
        }
      }

      setSyncStatus({
        lastSyncAt: new Date().toISOString(),
        lastSyncStatus: errors.length === 0 ? 'completed' : 'failed',
        rowsProcessed: totalProcessed,
        rowsCreated: totalCreated,
        rowsUpdated: totalUpdated,
      })

      setShowSyncPreview(false)

      if (errors.length === 0) {
        toast.success('Sync complete', {
          description: `${totalProcessed} rows processed · ${totalCreated} created · ${totalUpdated} updated`,
        })
      } else if (errors.length < activeTabs.length) {
        toast.warning('Sync partially complete', {
          description: `${activeTabs.length - errors.length}/${activeTabs.length} tabs synced`,
        })
      } else {
        toast.error('Sync failed', {
          description: errors[0],
        })
      }
    } catch (error) {
      console.error('Sync error:', error)
      setSyncStatus({
        lastSyncAt: new Date().toISOString(),
        lastSyncStatus: 'failed',
      })
      setShowSyncPreview(false)
      toast.error('Sync failed', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    } finally {
      setIsSyncing(false)
    }
  }, [activeSource, isSyncing])

  // Handle adding a new source via the sheet search modal
  const handleAddSource = () => {
    setShowSearchModal(true)
  }

  const handleSelectSheet = async (sheet: { id: string; name: string; url: string }) => {
    setShowSearchModal(false)
    setIsLoadingPreview(true)

    try {
      // First, save the data source to the database
      const createResponse = await fetch('/api/data-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: sheet.name,
          spreadsheet_id: sheet.id,
          spreadsheet_url: sheet.url,
        }),
      })

      let sourceId: string

      if (createResponse.status === 409) {
        // Already exists - use existing ID
        const data = await createResponse.json()
        sourceId = data.existingId
      } else if (createResponse.ok) {
        const data = await createResponse.json()
        sourceId = data.source.id
      } else {
        const errorData = await createResponse.json()
        console.error('Failed to create data source:', errorData)
        setIsLoadingPreview(false)
        return
      }

      // Now fetch the preview
      const previewResponse = await fetch(`/api/sheets/preview?id=${sheet.id}`)
      if (previewResponse.ok) {
        const data = await previewResponse.json()
        const preview = data.preview as SheetPreview

        // Store preview
        setSheetPreviews(prev => ({
          ...prev,
          [sourceId]: preview,
        }))

        // Add to sources list (will be refreshed on next fetch, but show immediately)
        setSources(prev => {
          // Check if already in list
          if (prev.some(s => s.id === sourceId)) {
            return prev
          }
          return [
            ...prev,
            {
              id: sourceId,
              name: sheet.name,
              type: 'google_sheet',
              spreadsheet_id: sheet.id,
              spreadsheet_url: sheet.url,
              tabCount: preview.tabs.length,
              mappedFieldsCount: 0,
              tabs: [],
            },
          ]
        })

        // Select this source
        setActiveSourceId(sourceId)
        if (preview.tabs.length > 0) {
          setActiveTabId(String(preview.tabs[0].sheetId))
        }
      } else {
        const errorData = await previewResponse.json()
        console.error('Failed to fetch preview:', errorData)
      }
    } catch (error) {
      console.error('Error adding source:', error)
    } finally {
      setIsLoadingPreview(false)
    }
  }

  // Handle source tab selection
  const handleSelectSource = (sourceId: string) => {
    setActiveSourceId(sourceId)

    const source = sources.find(s => s.id === sourceId)
    const preview = sheetPreviews[sourceId]

    // Load preview if we don't have it cached (for full tab discovery)
    if (!preview && source?.spreadsheet_id) {
      loadPreviewForSource(sourceId, source.spreadsheet_id)
    }

    // Default to Overview tab when selecting a source
    setActiveTabId(OVERVIEW_TAB_ID)
  }

  // Handle sheet tab selection
  const handleSelectTab = (tabId: string) => {
    setActiveTabId(tabId)
  }

  // Handle header confirmation - update local state to reflect confirmed header
  const handleHeaderConfirmed = () => {
    if (!activeSource || !activeTabId) return

    // Update the sources state to mark this tab's header as confirmed
    setSources(prev => prev.map(source => {
      if (source.id !== activeSource.id) return source
      return {
        ...source,
        tabs: source.tabs?.map(tab => {
          if (tab.id !== activeTabId && tab.tab_name !== activeTab?.name) return tab
          return { ...tab, header_confirmed: true }
        })
      }
    }))
  }

  // Handle mapping completion for a tab
  const handleMappingComplete = async (mappings: {
    headerRow: number
    columns: {
      sourceIndex: number
      sourceColumn: string
      category: 'partner' | 'staff' | 'asin' | 'weekly' | 'computed' | 'skip' | null
      targetField: string | null
      authority: 'source_of_truth' | 'reference'
      isKey: boolean
      computedConfig?: {
        computationType: 'formula' | 'aggregation' | 'lookup' | 'custom'
        targetTable: 'partners' | 'staff' | 'asins'
        targetField: string
        displayName: string
        description?: string
        dependsOn?: string[]
        formula?: string
        sourceTable?: string
        aggregation?: string
        lookupSource?: string
        matchField?: string
        lookupField?: string
      }
    }[]
    primaryEntity: 'partners' | 'staff' | 'asins'
  }) => {
    if (!activeSource || !activeTab) {
      console.error('No active source or tab')
      return
    }

    try {
      // Build the save request payload
      const savePayload = {
        dataSource: {
          name: activeSource.name,
          spreadsheet_id: activeSource.spreadsheet_id,
          spreadsheet_url: activeSource.spreadsheet_url,
        },
        tabMapping: {
          tab_name: activeTab.name,
          header_row: mappings.headerRow,
          primary_entity: mappings.primaryEntity,
        },
        columnMappings: mappings.columns
          .filter(col => col.category !== null && col.category !== 'weekly' && col.category !== 'computed')
          .map(col => ({
            source_column: col.sourceColumn,
            source_column_index: col.sourceIndex,
            category: col.category as 'partner' | 'staff' | 'asin' | 'skip',
            target_field: col.targetField,
            authority: col.authority,
            is_key: col.isKey,
          })),
        // Include weekly pattern if there are weekly columns
        weeklyPattern: mappings.columns.some(col => col.category === 'weekly')
          ? {
              pattern_name: 'Weekly Status Columns',
              match_config: { matches_date: true },
            }
          : undefined,
        // Include computed fields
        computedFields: mappings.columns
          .filter(col => col.category === 'computed' && col.computedConfig)
          .map(col => ({
            source_column: col.sourceColumn,
            source_column_index: col.sourceIndex,
            target_table: col.computedConfig!.targetTable,
            target_field: col.computedConfig!.targetField,
            display_name: col.computedConfig!.displayName,
            computation_type: col.computedConfig!.computationType,
            config: {
              dependsOn: col.computedConfig!.dependsOn,
              formula: col.computedConfig!.formula,
              sourceTable: col.computedConfig!.sourceTable,
              aggregation: col.computedConfig!.aggregation,
              lookupSource: col.computedConfig!.lookupSource,
              matchField: col.computedConfig!.matchField,
              lookupField: col.computedConfig!.lookupField,
            },
            description: col.computedConfig!.description,
          })),
      }

      const response = await fetch('/api/mappings/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(savePayload),
      })

      if (response.ok) {
        const result = await response.json()

        // Refresh sources to get updated mapping data (bypass cache after save)
        const sourcesResponse = await fetch('/api/data-sources', { cache: 'no-store' })
        if (sourcesResponse.ok) {
          const json = await sourcesResponse.json()
          setSources(json.data?.sources || json.sources || [])

          // Update activeTabId to the new tab mapping ID if available
          const tabMappingId = result.data?.tab_mapping_id || result.tab_mapping_id
          if (tabMappingId) {
            setActiveTabId(tabMappingId)
          }
        }
      } else {
        const error = await response.json()
        console.error('Failed to save mappings:', error)
      }
    } catch (error) {
      console.error('Error saving mappings:', error)
    }
  }

  // Auth error state - session not ready or expired
  if (authError) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-6"
      >
        <div className="flex items-center gap-3 md:gap-4 px-4 md:px-0">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-lg md:text-xl font-semibold">Google Sheets</h2>
            <p className="text-sm text-muted-foreground">Session not ready</p>
          </div>
        </div>
        <div className="border rounded-xl p-8 md:p-12 text-center mx-4 md:mx-0">
          <div className="max-w-md mx-auto space-y-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 mx-auto">
              <AlertCircle className="h-7 w-7 text-amber-600" />
            </div>
            <h3 className="text-lg font-semibold">Session Loading</h3>
            <p className="text-sm text-muted-foreground">
              Your session is still being established. Click retry to try again.
            </p>
            <Button onClick={fetchSources} variant="outline" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          </div>
        </div>
      </motion.div>
    )
  }

  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-0"
      >
        {/* Header - same as loaded state */}
        <div className="flex items-center gap-4 p-4 border-b">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h2 className="text-lg font-semibold">Google Sheets</h2>
            <p className="text-xs text-muted-foreground">Loading sources...</p>
          </div>
        </div>

        {/* Skeleton source tabs — shimmer wave */}
        <div className="px-4 py-3 border-b bg-muted/30">
          <ShimmerGrid rows={1} columns={3} cellHeight={40} gap={8} stagger={100} />
        </div>

        {/* Skeleton content — shimmer grid */}
        <div className="p-6">
          <div className="rounded-xl border bg-card p-5 flex flex-col min-h-[50vh]">
            <ShimmerGrid
              variant="table"
              rows={8}
              columns={5}
              showRowNumbers
              stagger={40}
            />
          </div>
        </div>
      </motion.div>
    )
  }

  // Empty state - no sources yet
  if (sources.length === 0 && !isLoadingPreview) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2, ease: easeOut }}
        className="space-y-6"
      >
        {/* Header */}
        <div className="flex items-center gap-3 md:gap-4 px-4 md:px-0">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-lg md:text-xl font-semibold">Google Sheets</h2>
            <p className="text-sm text-muted-foreground">
              Connect your first spreadsheet to get started
            </p>
          </div>
        </div>

        {/* Empty state card */}
        <div className="border-2 border-dashed rounded-xl p-8 md:p-16 text-center mx-4 md:mx-0">
          <div className="max-w-md mx-auto space-y-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-green-500/10 mx-auto">
              <Search className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold">No sheets connected yet</h3>
            <p className="text-sm text-muted-foreground">
              Search for a Google Sheet to connect and start mapping columns to your database.
            </p>
            <Button onClick={() => setShowSearchModal(true)} className="gap-2">
              <Search className="h-4 w-4" />
              Connect a Google Sheet
            </Button>
          </div>
        </div>

        <SheetSearchModal
          open={showSearchModal}
          onOpenChange={setShowSearchModal}
          onSelectSheet={handleSelectSheet}
        />
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: easeOut }}
      className="space-y-0"
    >
      {/* Header */}
      <div className="flex items-center gap-4 p-4 border-b">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h2 className="text-lg font-semibold">Google Sheets</h2>
          <p className="text-xs text-muted-foreground">
            {sources.length} source{sources.length !== 1 ? 's' : ''} connected
          </p>
        </div>
      </div>

      {/* Source Tab Bar */}
      <SourceTabBar
        sources={sources.map(s => ({
          id: s.id,
          name: s.name,
          tabCount: sheetPreviews[s.id]
            ? Math.max(s.tabs.length, sheetPreviews[s.id].tabs.length)
            : (s.spreadsheet_id ? null : s.tabs.length),
        }))}
        activeSourceId={activeSourceId}
        onSelectSource={handleSelectSource}
        onAddSource={handleAddSource}
        onReorder={async (reorderedSources) => {
          // Reorder the full sources array to match the new order
          const newOrder = reorderedSources.map(rs =>
            sources.find(s => s.id === rs.id)!
          ).filter(Boolean)
          setSources(newOrder)

          // Persist to database
          try {
            await fetch('/api/data-sources/reorder', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sourceIds: reorderedSources.map(s => s.id) }),
            })
          } catch (error) {
            console.error('Failed to persist source order:', error)
          }
        }}
      />

      {/* Sheet Tab Bar */}
      {sheetTabs.length > 0 && (
        <SheetTabBar
          tabs={sheetTabs}
          activeTabId={activeTabId}
          onSelectTab={handleSelectTab}
          onStatusChange={handleTabStatusChange}
        />
      )}

      {/* Content Area */}
      <AnimatePresence mode="wait">
        {(isLoadingPreview || isLoading) && sheetTabs.length === 0 ? (
          /* Shimmer grid loader - only show when we have NO tabs yet */
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="p-6 space-y-4"
          >
            {/* Skeleton tab bar — shimmer wave */}
            <ShimmerGrid rows={1} columns={5} cellHeight={36} gap={8} stagger={100} />

            {/* Main content card */}
            <div className="rounded-xl border bg-card overflow-hidden">
              {/* Header with context */}
              <div className="p-5 border-b bg-gradient-to-r from-muted/10 to-transparent">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                      <Table className="h-5 w-5 text-green-600/70" />
                    </div>
                    <motion.div
                      className="absolute -right-0.5 -bottom-0.5 h-4 w-4 rounded-full bg-background border-2 border-green-500/50 flex items-center justify-center"
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                    >
                      <Loader2 className="h-2.5 w-2.5 text-green-600 animate-spin" />
                    </motion.div>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-foreground">{activeSource?.name || 'Loading...'}</h3>
                    <p className="text-sm text-muted-foreground">Connecting to Google Sheets...</p>
                  </div>
                </div>
              </div>

              {/* Shimmer grid table skeleton */}
              <div className="p-5">
                <ShimmerGrid
                  variant="table"
                  rows={8}
                  columns={5}
                  showRowNumbers
                  stagger={40}
                />
              </div>

              {/* Progress bar at bottom */}
              <div className="h-1 bg-muted/20 overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-green-500/40 via-green-500/60 to-green-500/40"
                  initial={{ x: "-100%" }}
                  animate={{ x: "100%" }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                />
              </div>
            </div>
          </motion.div>
        ) : activeSourceId && activeTabId === OVERVIEW_TAB_ID && sheetTabs.length > 0 ? (
          /* Overview Dashboard */
          <motion.div
            key={`${activeSourceId}-overview`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: easeOut }}
          >
            <TabOverviewDashboard
              sourceName={activeSource?.name || ''}
              sourceId={activeSource?.id}
              spreadsheetId={activeSource?.spreadsheet_id}
              tabs={sheetTabs.map(t => {
                // Find matching DB tab for additional data
                const dbTab = activeSource?.tabs?.find(dt => dt.tab_name === t.name)
                return {
                  id: t.id,
                  tab_name: t.name,
                  primary_entity: t.primaryEntity,
                  header_row: dbTab?.header_row ?? -1,
                  header_confirmed: dbTab?.header_confirmed || false,
                  columnCount: t.columnCount || 0,
                  categoryStats: dbTab?.categoryStats || {
                    partner: 0,
                    staff: 0,
                    asin: 0,
                    weekly: 0,
                    computed: 0,
                    skip: 0,
                    unmapped: t.columnCount || 0,
                  },
                  status: t.status || 'active',
                  notes: t.notes || null,
                  updated_at: dbTab?.updated_at || null,
                }
              })}
              onSelectTab={handleSelectTab}
              onTabStatusChange={handleTabStatusChange}
              viewMode={dashboardViewMode}
              onViewModeChange={setDashboardViewMode}
              onSync={handleSync}
              isSyncing={isSyncing}
              syncStatus={syncStatus}
            />
          </motion.div>
        ) : activeSourceId && activeTabId && activeTab && (activeSource?.spreadsheet_id || activePreview) ? (
          <motion.div
            key={`${activeSourceId}-${activeTabId}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: easeOut }}
            className="p-4"
          >
            <SmartMapper
              spreadsheetId={activeSource?.spreadsheet_id || activePreview?.spreadsheetId || ''}
              sheetName={activeSource?.name || activePreview?.title || ''}
              tabName={activeTab.name}
              dataSourceId={activeSource?.id}
              onComplete={handleMappingComplete}
              onBack={() => setActiveTabId(OVERVIEW_TAB_ID)}
              onHeaderConfirmed={handleHeaderConfirmed}
              headerAlreadyConfirmed={activeTab.headerConfirmed}
              confirmedHeaderRow={activeTab.headerRow}
              embedded
            />
          </motion.div>
        ) : activeSourceId && activeTabId && activeTab && !activeSource?.spreadsheet_id && !activePreview ? (
          /* Loading state - waiting for source data */
          <motion.div
            key="loading-source"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center justify-center py-32"
          >
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </motion.div>
        ) : activeSourceId && sheetTabs.length === 0 ? (
          <motion.div
            key="no-tabs"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center justify-center py-32 text-muted-foreground"
          >
            No tabs available in this source
          </motion.div>
        ) : activeSourceId && sheetTabs.length > 0 && !activeTabId ? (
          /* Empty state - tabs exist but none selected */
          <motion.div
            key="select-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: easeOut }}
            className="flex flex-col items-center justify-center py-24 px-4"
          >
            <div className="max-w-sm text-center space-y-4">
              {/* Decorative icon */}
              <div className="relative mx-auto w-16 h-16">
                <div className="absolute inset-0 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-2xl rotate-6" />
                <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-2xl -rotate-3" />
                <div className="relative flex items-center justify-center w-full h-full bg-card border rounded-2xl shadow-sm">
                  <Table className="h-7 w-7 text-green-600" />
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-foreground">Select a tab to begin</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Choose a sheet tab above to preview its columns and start mapping data to your database.
                </p>
              </div>

              {/* Visual hint pointing up */}
              <div className="flex justify-center pt-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground/70">
                  <ChevronUp className="h-4 w-4 animate-bounce" />
                  <span>{sheetTabs.length} tabs available</span>
                </div>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <SyncPreviewDialog
        open={showSyncPreview}
        onOpenChange={setShowSyncPreview}
        previewResults={previewResults}
        isLoadingPreview={isLoadingSyncPreview}
        isSyncing={isSyncing}
        onConfirm={handleConfirmSync}
        sourceName={activeSource?.name || ''}
      />

      <SheetSearchModal
        open={showSearchModal}
        onOpenChange={setShowSearchModal}
        onSelectSheet={handleSelectSheet}
      />
    </motion.div>
  )
}
