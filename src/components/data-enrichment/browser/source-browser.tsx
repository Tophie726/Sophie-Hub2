'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Loader2, Search } from 'lucide-react'
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
            // Auto-select first active tab of that source
            const activeTabs = sourceToSelect.tabs.filter((t: { status?: string }) =>
              !t.status || t.status === 'active' || t.status === 'flagged'
            )
            if (activeTabs.length > 0) {
              setActiveTabId(activeTabs[0].id)
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

  // Get active source and tab data
  const activeSource = sources.find(s => s.id === activeSourceId)
  const activePreview = activeSourceId ? sheetPreviews[activeSourceId] : null

  // Build tabs list for the active source
  // Check if activeSource has mapped tabs first, otherwise fall back to preview
  const sheetTabs = activeSource?.tabs.length
    ? activeSource.tabs.map(t => ({
        id: t.id,
        name: t.tab_name,
        columnCount: t.columnCount,
        isMapped: true,
        primaryEntity: t.primary_entity,
      }))
    : activePreview
      ? activePreview.tabs.map(t => ({
          id: String(t.sheetId),
          name: t.title,
          rowCount: t.rowCount,
          columnCount: t.columnCount,
          isMapped: false,
          primaryEntity: null,
        }))
      : []

  const activeTab = sheetTabs.find(t => t.id === activeTabId)

  // Handle adding a new source via the sheet search modal
  const handleAddSource = () => {
    setShowSearchModal(true)
  }

  const handleSelectSheet = async (sheet: { id: string; name: string; url: string }) => {
    setShowSearchModal(false)
    setIsLoadingPreview(true)

    try {
      const response = await fetch(`/api/sheets/preview?id=${sheet.id}`)
      if (response.ok) {
        const data = await response.json()
        const preview = data.preview as SheetPreview

        // Store preview and create a temporary source entry
        const tempId = `temp-${sheet.id}`
        setSheetPreviews(prev => ({
          ...prev,
          [tempId]: preview,
        }))

        // Add to sources list as a temporary entry
        setSources(prev => [
          ...prev,
          {
            id: tempId,
            name: sheet.name,
            type: 'google_sheet',
            spreadsheet_id: sheet.id,
            spreadsheet_url: sheet.url,
            tabCount: preview.tabs.length,
            mappedFieldsCount: 0,
            tabs: [],
          },
        ])

        // Select this new source
        setActiveSourceId(tempId)
        if (preview.tabs.length > 0) {
          setActiveTabId(String(preview.tabs[0].sheetId))
        }
      }
    } catch (error) {
      console.error('Error loading preview:', error)
    } finally {
      setIsLoadingPreview(false)
    }
  }

  // Handle source tab selection
  const handleSelectSource = (sourceId: string) => {
    setActiveSourceId(sourceId)

    // Auto-select first tab of the new source
    const source = sources.find(s => s.id === sourceId)
    const preview = sheetPreviews[sourceId]

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
  const handleMappingComplete = () => {
    // Refresh sources to get updated mapping data
    fetch('/api/data-sources')
      .then(res => res.json())
      .then(data => {
        setSources(data.sources || [])
      })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
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
        />
      )}

      {/* Content Area */}
      <AnimatePresence mode="wait">
        {isLoadingPreview ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center justify-center py-32"
          >
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
