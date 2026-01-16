'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Loader2, Search, Table, ChevronUp } from 'lucide-react'
import { SourceTabBar } from './source-tab-bar'
import { SheetTabBar } from './sheet-tab-bar'
import { SmartMapper } from '../smart-mapper'
import { Button } from '@/components/ui/button'
import { SheetSearchModal } from '../sheet-search-modal'

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
    columnCount: number
    status?: 'active' | 'reference' | 'hidden' | 'flagged'
    notes?: string | null
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
}

const easeOut: [number, number, number, number] = [0.22, 1, 0.36, 1]

export function SourceBrowser({ onBack, initialSourceId }: SourceBrowserProps) {
  const [sources, setSources] = useState<DataSource[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeSourceId, setActiveSourceId] = useState<string | null>(initialSourceId || null)
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [showSearchModal, setShowSearchModal] = useState(false)

  // For new sources - store preview data until saved
  const [sheetPreviews, setSheetPreviews] = useState<Record<string, SheetPreview>>({})
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)

  // Fetch existing sources
  useEffect(() => {
    async function fetchSources() {
      try {
        const response = await fetch('/api/data-sources')
        if (response.ok) {
          const data = await response.json()
          const fetchedSources = data.sources || []
          setSources(fetchedSources)

          // Use initialSourceId if provided, otherwise auto-select first
          const sourceToSelect = initialSourceId
            ? fetchedSources.find((s: DataSource) => s.id === initialSourceId)
            : fetchedSources[0]

          if (sourceToSelect) {
            setActiveSourceId(sourceToSelect.id)

            // Always load preview from Google Sheets to get full tab list
            if (sourceToSelect.spreadsheet_id) {
              loadPreviewForSource(sourceToSelect.id, sourceToSelect.spreadsheet_id)
            }

            // Auto-select first workable tab (active or reference, not flagged/hidden)
            if (sourceToSelect.tabs.length > 0) {
              const workableTabs = sourceToSelect.tabs.filter((t: { status?: string }) =>
                !t.status || t.status === 'active' || t.status === 'reference'
              )
              if (workableTabs.length > 0) {
                setActiveTabId(workableTabs[0].id)
              }
            }
          }
        }
      } catch (error) {
        console.error('Error fetching sources:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchSources()
  }, [initialSourceId])

  // Load preview for a source that has no tabs yet
  const loadPreviewForSource = async (sourceId: string, spreadsheetId: string) => {
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

        // Only auto-select if no tab is currently selected
        // (DB tabs are already selected in fetchSources if available)
        setActiveTabId(current => {
          if (current) return current // Don't override existing selection
          if (preview.tabs.length > 0) {
            return String(preview.tabs[0].sheetId)
          }
          return current
        })
      }
    } catch (error) {
      console.error('Error loading preview:', error)
    } finally {
      setIsLoadingPreview(false)
    }
  }

  // Get active source and tab data
  const activeSource = sources.find(s => s.id === activeSourceId)
  const activePreview = activeSourceId ? sheetPreviews[activeSourceId] : null

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
    }))

    // If no preview tabs, just return db tabs
    if (previewTabs.length === 0) return dbTabs

    // Merge: use db tab if it exists for that name, otherwise use preview tab
    const dbTabsByName = new Map(dbTabs.map(t => [t.name, t]))

    return previewTabs.map(previewTab => {
      const dbTab = dbTabsByName.get(previewTab.name)
      return dbTab || previewTab
    })
  })()

  const activeTab = sheetTabs.find(t => t.id === activeTabId)

  // Auto-select first workable tab when tabs are available but none selected
  useEffect(() => {
    if (sheetTabs.length > 0 && !activeTabId) {
      // Prefer active/reference tabs, exclude flagged/hidden
      const workableTabs = sheetTabs.filter(t =>
        t.status === 'active' || t.status === 'reference' || !t.status
      )
      if (workableTabs.length > 0) {
        setActiveTabId(workableTabs[0].id)
      } else if (sheetTabs.length > 0) {
        // Fall back to first tab if all are flagged/hidden
        setActiveTabId(sheetTabs[0].id)
      }
    }
  }, [sheetTabs, activeTabId])

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

  // Handle adding a new source via the sheet search modal
  const handleAddSource = () => {
    setShowSearchModal(true)
  }

  const handleSelectSheet = async (sheet: { id: string; name: string; url: string }) => {
    console.log('handleSelectSheet called with:', sheet.name)
    setShowSearchModal(false)
    setIsLoadingPreview(true)

    try {
      // First, save the data source to the database
      console.log('Creating data source...')
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
        console.log('Source already exists, using ID:', data.existingId)
        sourceId = data.existingId
      } else if (createResponse.ok) {
        const data = await createResponse.json()
        console.log('Source created with ID:', data.source.id)
        sourceId = data.source.id
      } else {
        const errorData = await createResponse.json()
        console.error('Failed to create data source:', errorData)
        setIsLoadingPreview(false)
        return
      }

      // Now fetch the preview
      console.log('Fetching preview for spreadsheet:', sheet.id)
      const previewResponse = await fetch(`/api/sheets/preview?id=${sheet.id}`)
      if (previewResponse.ok) {
        const data = await previewResponse.json()
        const preview = data.preview as SheetPreview
        console.log('Preview loaded, tabs:', preview.tabs.length)

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

    // Load preview if we don't have it yet
    if (!preview && source?.spreadsheet_id) {
      loadPreviewForSource(sourceId, source.spreadsheet_id)
    }

    // Auto-select first tab of the new source
    if (source?.tabs.length) {
      setActiveTabId(source.tabs[0].id)
    } else if (preview?.tabs.length) {
      setActiveTabId(String(preview.tabs[0].sheetId))
    } else {
      setActiveTabId(null)
    }
  }

  // Handle sheet tab selection
  const handleSelectTab = (tabId: string) => {
    setActiveTabId(tabId)
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

      console.log('Saving mappings:', savePayload)

      const response = await fetch('/api/mappings/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(savePayload),
      })

      if (response.ok) {
        const result = await response.json()
        console.log('Mappings saved:', result)

        // Refresh sources to get updated mapping data
        const sourcesResponse = await fetch('/api/data-sources')
        if (sourcesResponse.ok) {
          const data = await sourcesResponse.json()
          setSources(data.sources || [])

          // Update activeTabId to the new tab mapping ID if available
          if (result.tab_mapping_id) {
            setActiveTabId(result.tab_mapping_id)
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

        {/* Skeleton source tabs */}
        <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30">
          {[120, 100, 90].map((w, i) => (
            <div
              key={i}
              className="h-10 rounded-lg bg-gradient-to-r from-muted/60 via-muted/30 to-muted/60 bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite]"
              style={{ width: w, animationDelay: `${i * 100}ms` }}
            />
          ))}
        </div>

        {/* Skeleton content */}
        <div className="p-6">
          <div className="rounded-xl border bg-card p-6 space-y-4">
            <div className="h-5 w-48 bg-gradient-to-r from-muted/50 via-muted/25 to-muted/50 bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite] rounded" />
            <div className="space-y-3 pt-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex gap-4">
                  <div className="h-10 flex-1 bg-gradient-to-r from-muted/40 via-muted/20 to-muted/40 bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite] rounded" style={{ animationDelay: `${i * 75}ms` }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    )
  }

  // Empty state - no sources yet
  if (sources.length === 0 && !isLoadingPreview) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: easeOut }}
        className="space-y-6"
      >
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-xl font-semibold">Google Sheets</h2>
            <p className="text-sm text-muted-foreground">
              Connect your first spreadsheet to get started
            </p>
          </div>
        </div>

        {/* Empty state card */}
        <div className="border-2 border-dashed rounded-xl p-16 text-center">
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
      transition={{ duration: 0.3, ease: easeOut }}
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
          tabCount: s.tabs.length || sheetPreviews[s.id]?.tabs.length || 0,
        }))}
        activeSourceId={activeSourceId}
        onSelectSource={handleSelectSource}
        onAddSource={handleAddSource}
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
        {isLoadingPreview && sheetTabs.length === 0 ? (
          /* Elegant skeleton loader - only show when we have NO tabs yet */
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="p-6 space-y-4"
          >
            {/* Skeleton tab bar with animated shimmer */}
            <div className="flex gap-2 pb-2">
              {[80, 100, 90, 85, 75].map((width, i) => (
                <motion.div
                  key={i}
                  className="h-9 rounded-lg bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite]"
                  style={{ width: `${width}px`, animationDelay: `${i * 100}ms` }}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                />
              ))}
            </div>

            {/* Main content card with loading context */}
            <div className="rounded-xl border bg-card overflow-hidden">
              {/* Header with context */}
              <div className="p-5 border-b bg-gradient-to-r from-muted/10 to-transparent">
                <div className="flex items-center gap-4">
                  {/* Animated icon */}
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

              {/* Table skeleton with staggered rows */}
              <div className="p-5 space-y-2">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <motion.div
                    key={i}
                    className="flex items-center gap-4"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05, duration: 0.3 }}
                  >
                    <div className="h-9 w-8 bg-muted/20 rounded flex items-center justify-center text-xs text-muted-foreground/40">{i + 1}</div>
                    <div className="h-9 flex-[2] bg-gradient-to-r from-muted/30 via-muted/15 to-muted/30 bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite] rounded" style={{ animationDelay: `${i * 75 + 50}ms` }} />
                    <div className="h-9 flex-[3] bg-gradient-to-r from-muted/25 via-muted/10 to-muted/25 bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite] rounded" style={{ animationDelay: `${i * 75 + 100}ms` }} />
                    <div className="h-9 w-24 bg-gradient-to-r from-muted/20 via-muted/10 to-muted/20 bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite] rounded" style={{ animationDelay: `${i * 75 + 150}ms` }} />
                  </motion.div>
                ))}
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
        ) : activeSourceId && activeTabId && activeTab ? (
          <motion.div
            key={`${activeSourceId}-${activeTabId}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: easeOut }}
            className="p-4"
          >
            <SmartMapper
              spreadsheetId={activeSource?.spreadsheet_id || activeSourceId.replace('temp-', '')}
              sheetName={activeSource?.name || activePreview?.title || ''}
              tabName={activeTab.name}
              dataSourceId={activeSource?.id}
              onComplete={handleMappingComplete}
              onBack={() => setActiveTabId(null)}
              embedded
            />
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

      <SheetSearchModal
        open={showSearchModal}
        onOpenChange={setShowSearchModal}
        onSelectSheet={handleSelectSheet}
      />
    </motion.div>
  )
}
