'use client'

import { Suspense, useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { CategoryHub, SourceBrowser } from '@/components/data-enrichment/browser'
import { DataFlowMap } from '@/components/data-enrichment/lineage'
import { PartnerMapping } from '@/components/data-enrichment/bigquery'
import { SlackMappingHub } from '@/components/slack/slack-mapping-hub'
import { GWSMappingHub } from '@/components/google-workspace/gws-mapping-hub'
import { Button } from '@/components/ui/button'
import { Network, ArrowLeft } from 'lucide-react'

type DataBrowserView = 'hub' | 'sheets-overview' | 'sheets-browser' | 'bigquery' | 'slack' | 'google_workspace' | 'forms' | 'docs' | 'flow-map'

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

  // Get initial state from URL params only (localStorage read deferred to useEffect)
  const getInitialFromUrl = () => {
    const urlView = searchParams.get('view') as DataBrowserView | null
    const urlSourceId = searchParams.get('source')
    const urlTabId = searchParams.get('tab')

    return {
      view: urlView || 'hub' as DataBrowserView,
      sourceId: urlSourceId,
      tabId: urlTabId,
    }
  }

  const initial = getInitialFromUrl()

  // Data Browser view state (initialized from URL, localStorage applied in useEffect)
  const [browserView, setBrowserView] = useState<DataBrowserView>(initial.view)
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(initial.sourceId)
  const [selectedTabId, setSelectedTabId] = useState<string | null>(initial.tabId)
  const [, setIsHydrated] = useState(false)

  // Restore from localStorage after hydration (only if no URL params)
  useEffect(() => {
    if (!initial.view || initial.view === 'hub') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
          const parsed = JSON.parse(stored)
          if (parsed.view) setBrowserView(parsed.view)
          if (parsed.sourceId) setSelectedSourceId(parsed.sourceId)
          if (parsed.tabId) setSelectedTabId(parsed.tabId)
        }
      } catch {
        // Ignore parse errors
      }
    }
    setIsHydrated(true)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
  const handleSelectCategory = (category: 'sheets' | 'forms' | 'docs' | 'bigquery' | 'slack' | 'google_workspace') => {
    if (category === 'sheets') {
      // Go directly to SourceBrowser - it has its own modal and handles everything
      setSelectedSourceId(null)
      setBrowserView('sheets-browser')
    } else if (category === 'bigquery') {
      setBrowserView('bigquery')
    } else if (category === 'slack') {
      setBrowserView('slack')
    } else if (category === 'google_workspace') {
      setBrowserView('google_workspace')
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
            className="h-10 md:h-9 gap-2 text-muted-foreground hover:text-foreground"
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

        {/* BigQuery View */}
        {browserView === 'bigquery' && (
          <div className="p-4 md:p-8">
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setBrowserView('hub')}
                  className="h-9 px-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                  <h2 className="text-2xl font-bold">BigQuery Integration</h2>
                  <p className="text-muted-foreground">Map BigQuery clients to Sophie Hub partners</p>
                </div>
              </div>

              <div className="rounded-lg border bg-card p-6 shadow-sm dark:border-border/60 dark:ring-1 dark:ring-white/[0.06]">
                <PartnerMapping />
              </div>
            </div>
          </div>
        )}

        {/* Slack View */}
        {browserView === 'slack' && (
          <div className="p-4 md:p-8">
            <div className="max-w-4xl mx-auto">
              <SlackMappingHub onBack={() => setBrowserView('hub')} />
            </div>
          </div>
        )}

        {/* Google Workspace View */}
        {browserView === 'google_workspace' && (
          <div className="p-4 md:p-8">
            <div className="max-w-4xl mx-auto">
              <GWSMappingHub onBack={() => setBrowserView('hub')} />
            </div>
          </div>
        )}

        {/* Forms View - Coming Soon */}
        {browserView === 'forms' && (
          <div className="p-4 md:p-8 text-center">
            <p className="text-muted-foreground">Forms integration coming soon</p>
            <Button variant="outline" onClick={() => setBrowserView('hub')} className="mt-4 h-10 md:h-9">
              Back to Hub
            </Button>
          </div>
        )}

        {/* Docs View - Coming Soon */}
        {browserView === 'docs' && (
          <div className="p-4 md:p-8 text-center">
            <p className="text-muted-foreground">Documents integration coming soon</p>
            <Button variant="outline" onClick={() => setBrowserView('hub')} className="mt-4 h-10 md:h-9">
              Back to Hub
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
