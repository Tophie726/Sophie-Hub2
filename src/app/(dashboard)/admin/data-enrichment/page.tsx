'use client'

import { Suspense, useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { CategoryHub, SourceBrowser } from '@/components/data-enrichment/browser'
import { DataFlowMap } from '@/components/data-enrichment/lineage'
import { Button } from '@/components/ui/button'
import { Network } from 'lucide-react'

type DataBrowserView = 'hub' | 'sheets-overview' | 'sheets-browser' | 'forms' | 'docs' | 'flow-map'

// Wrap in Suspense so useSearchParams() works on direct URL navigation
export default function DataEnrichmentPage() {
  return (
    <Suspense>
      <DataEnrichmentContent />
    </Suspense>
  )
}

const STORAGE_KEY = 'data-enrichment-state'

function DataEnrichmentContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  // Read initial state from URL params, then localStorage fallback
  const getInitialState = () => {
    // URL params take priority
    const urlView = searchParams.get('view') as DataBrowserView | null
    const urlSourceId = searchParams.get('source')
    const urlTabId = searchParams.get('tab')

    if (urlView || urlSourceId || urlTabId) {
      return {
        view: urlView || 'hub',
        sourceId: urlSourceId,
        tabId: urlTabId,
      }
    }

    // Fallback to localStorage
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
          const parsed = JSON.parse(stored)
          return {
            view: (parsed.view as DataBrowserView) || 'hub',
            sourceId: parsed.sourceId || null,
            tabId: parsed.tabId || null,
          }
        }
      } catch {
        // Ignore parse errors
      }
    }

    return { view: 'hub' as DataBrowserView, sourceId: null, tabId: null }
  }

  const initial = getInitialState()

  // Data Browser view state (initialized from URL or localStorage)
  const [browserView, setBrowserView] = useState<DataBrowserView>(initial.view)
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(initial.sourceId)
  const [selectedTabId, setSelectedTabId] = useState<string | null>(initial.tabId)

  // Sync state to URL when it changes
  const updateURL = useCallback((view: DataBrowserView, sourceId: string | null, tabId: string | null) => {
    const params = new URLSearchParams()
    if (view !== 'hub') {
      params.set('view', view)
    }
    if (sourceId) {
      params.set('source', sourceId)
    }
    if (tabId) {
      params.set('tab', tabId)
    }
    const queryString = params.toString()
    const newPath = queryString ? `?${queryString}` : '/admin/data-enrichment'
    router.replace(newPath, { scroll: false })
  }, [router])

  // Update URL and localStorage when view, source, or tab changes
  useEffect(() => {
    updateURL(browserView, selectedSourceId, selectedTabId)

    // Also persist to localStorage for cross-navigation memory
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        view: browserView,
        sourceId: selectedSourceId,
        tabId: selectedTabId,
      }))
    } catch {
      // Ignore storage errors
    }
  }, [browserView, selectedSourceId, selectedTabId, updateURL])

  // Handle category selection from the hub
  const handleSelectCategory = (category: 'sheets' | 'forms' | 'docs') => {
    if (category === 'sheets') {
      // Go directly to SourceBrowser - it has its own modal and handles everything
      setSelectedSourceId(null)
      setBrowserView('sheets-browser')
    } else {
      setBrowserView(category)
    }
  }

  return (
    <div className="min-h-screen">
      {/* Minimal header for browser views - hide description to save space */}
      {browserView !== 'hub' ? (
        <div className="border-b" />
      ) : (
        <PageHeader
          title="Data Enrichment"
          description="Connect and map your data sources to Sophie Hub"
        >
          <Button
            variant="outline"
            size="sm"
            onClick={() => setBrowserView('flow-map')}
            className="gap-2 text-muted-foreground hover:text-foreground"
          >
            <Network className="h-4 w-4" />
            <span className="hidden sm:inline">Data Flow</span>
          </Button>
        </PageHeader>
      )}

      <div className={browserView === 'hub' ? 'p-4 md:p-8' : browserView === 'sheets-browser' ? 'h-[calc(100vh-64px)]' : ''}>
        {/* No AnimatePresence - instant view switching, no overlap */}
        {/* Hub View - Category selection */}
        {browserView === 'hub' && (
          <CategoryHub key="hub" onSelectCategory={handleSelectCategory} />
        )}

        {/* Sheets Browser View (tab mapping) */}
        {browserView === 'sheets-browser' && (
          <SourceBrowser
            key="sheets-browser"
            onBack={() => setBrowserView('hub')}
            initialSourceId={selectedSourceId}
            initialTabId={selectedTabId}
            onSourceChange={setSelectedSourceId}
            onTabChange={setSelectedTabId}
          />
        )}

        {/* Flow Map View */}
        {browserView === 'flow-map' && (
          <DataFlowMap
            key="flow-map"
            onBack={() => setBrowserView('hub')}
          />
        )}

        {/* Forms View - Coming Soon */}
        {browserView === 'forms' && (
          <div className="p-8 text-center">
            <p className="text-muted-foreground">Forms integration coming soon</p>
            <Button variant="outline" onClick={() => setBrowserView('hub')} className="mt-4">
              Back to Hub
            </Button>
          </div>
        )}

        {/* Docs View - Coming Soon */}
        {browserView === 'docs' && (
          <div className="p-8 text-center">
            <p className="text-muted-foreground">Documents integration coming soon</p>
            <Button variant="outline" onClick={() => setBrowserView('hub')} className="mt-4">
              Back to Hub
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
