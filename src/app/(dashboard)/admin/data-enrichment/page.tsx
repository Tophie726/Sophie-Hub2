'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { PageHeader } from '@/components/layout/page-header'
import { CategoryHub, SourceBrowser } from '@/components/data-enrichment/browser'
import { Button } from '@/components/ui/button'

type DataBrowserView = 'hub' | 'sheets-overview' | 'sheets-browser' | 'forms' | 'docs'

const easeOut: [number, number, number, number] = [0.22, 1, 0.36, 1]

export default function DataEnrichmentPage() {
  const searchParams = useSearchParams()
  const router = useRouter()

  // Read initial state from URL params
  const initialView = (searchParams.get('view') as DataBrowserView) || 'hub'
  const initialSourceId = searchParams.get('source') || null
  const initialTabId = searchParams.get('tab') || null

  // Data Browser view state (initialized from URL)
  const [browserView, setBrowserView] = useState<DataBrowserView>(initialView)
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(initialSourceId)
  const [selectedTabId, setSelectedTabId] = useState<string | null>(initialTabId)

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

  // Update URL when view, source, or tab changes
  useEffect(() => {
    updateURL(browserView, selectedSourceId, selectedTabId)
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
        />
      )}

      <div className={browserView === 'hub' ? 'p-4 md:p-8' : ''}>
        <AnimatePresence mode="popLayout" initial={false}>
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

          {/* Forms View - Coming Soon */}
          {browserView === 'forms' && (
            <motion.div
              key="forms"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: easeOut }}
              className="p-8 text-center"
            >
              <p className="text-muted-foreground">Forms integration coming soon</p>
              <Button variant="outline" onClick={() => setBrowserView('hub')} className="mt-4">
                Back to Hub
              </Button>
            </motion.div>
          )}

          {/* Docs View - Coming Soon */}
          {browserView === 'docs' && (
            <motion.div
              key="docs"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: easeOut }}
              className="p-8 text-center"
            >
              <p className="text-muted-foreground">Documents integration coming soon</p>
              <Button variant="outline" onClick={() => setBrowserView('hub')} className="mt-4">
                Back to Hub
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
