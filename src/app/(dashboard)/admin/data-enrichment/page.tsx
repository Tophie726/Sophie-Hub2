'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSession } from 'next-auth/react'
import { PageHeader } from '@/components/layout/page-header'
import { SheetSearchModal } from '@/components/data-enrichment/sheet-search-modal'
import { SmartMapper } from '@/components/data-enrichment/smart-mapper'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Database,
  FileSpreadsheet,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Circle,
  Loader2,
  ExternalLink,
  Settings,
  Sparkles,
  Search,
  Table,
  X,
  Check,
  ChevronRight,
} from 'lucide-react'

// ============ TYPES ============
interface GoogleSheet {
  id: string
  name: string
  url: string
  modifiedTime: string
  owner?: string
}

interface SheetTab {
  sheetId: number
  title: string
  rowCount: number
  columnCount: number
}

interface SheetPreview {
  spreadsheetId: string
  title: string
  tabs: SheetTab[]
  preview: {
    tabName: string
    headers: string[]
    rows: string[][]
  }
}

interface ComputedFieldConfig {
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

interface ColumnClassification {
  sourceIndex: number
  sourceColumn: string
  category: 'partner' | 'staff' | 'asin' | 'weekly' | 'computed' | 'skip' | null
  targetField: string | null
  authority: 'source_of_truth' | 'reference'
  isKey: boolean
  computedConfig?: ComputedFieldConfig
}

interface TabMapping {
  tabName: string
  headerRow: number
  primaryEntity: 'partners' | 'staff' | 'asins'
  columns: ColumnClassification[]
}

type WizardStep = 'overview' | 'select-sheet' | 'select-tab' | 'map-tab' | 'review' | 'complete'

const easeOut: [number, number, number, number] = [0.22, 1, 0.36, 1]

export default function DataEnrichmentPage() {
  const { data: session } = useSession()
  const [currentStep, setCurrentStep] = useState<WizardStep>('overview')
  const [showSearchModal, setShowSearchModal] = useState(false)

  // Sheet state
  const [selectedSheet, setSelectedSheet] = useState<GoogleSheet | null>(null)
  const [sheetPreview, setSheetPreview] = useState<SheetPreview | null>(null)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)

  // Tab mapping state
  const [selectedTab, setSelectedTab] = useState<string | null>(null)
  const [completedMappings, setCompletedMappings] = useState<TabMapping[]>([])

  const handleSelectSheet = async (sheet: GoogleSheet) => {
    setSelectedSheet(sheet)
    setCurrentStep('select-tab')
    setIsLoadingPreview(true)

    try {
      const response = await fetch(`/api/sheets/preview?id=${sheet.id}`)
      const data = await response.json()

      if (response.ok) {
        setSheetPreview(data.preview)
      }
    } catch (error) {
      console.error('Error loading preview:', error)
    } finally {
      setIsLoadingPreview(false)
    }
  }

  const handleReset = () => {
    setCurrentStep('overview')
    setSelectedSheet(null)
    setSheetPreview(null)
    setSelectedTab(null)
    setCompletedMappings([])
  }

  const handleSelectTab = (tabName: string) => {
    setSelectedTab(tabName)
    setCurrentStep('map-tab')
  }

  const handleMappingComplete = (mapping: Omit<TabMapping, 'tabName'>) => {
    const newMapping: TabMapping = {
      tabName: selectedTab!,
      ...mapping,
    }
    setCompletedMappings([...completedMappings, newMapping])
    setSelectedTab(null)
    setCurrentStep('select-tab')
  }

  const handleFinish = () => {
    setCurrentStep('review')
  }

  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const handleCommit = async () => {
    if (!selectedSheet) return

    setIsSaving(true)
    setSaveError(null)

    try {
      // Save each tab mapping
      for (const mapping of completedMappings) {
        const response = await fetch('/api/mappings/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dataSource: {
              name: selectedSheet.name,
              spreadsheet_id: selectedSheet.id,
              spreadsheet_url: selectedSheet.url,
            },
            tabMapping: {
              tab_name: mapping.tabName,
              header_row: mapping.headerRow,
              primary_entity: mapping.primaryEntity,
            },
            columnMappings: mapping.columns.map(col => ({
              source_column: col.sourceColumn,
              source_column_index: col.sourceIndex,
              category: col.category || 'skip',
              target_field: col.targetField,
              authority: col.authority,
              is_key: col.isKey,
            })),
            // Use default weekly pattern for any weekly columns
            weeklyPattern: mapping.columns.some(c => c.category === 'weekly')
              ? {
                  pattern_name: 'Weekly Status Columns',
                  match_config: {
                    contains: ['weekly'],
                    matches_date: true,
                  },
                }
              : undefined,
            // Include computed fields with their configuration
            computedFields: mapping.columns
              .filter(c => c.category === 'computed' && c.computedConfig)
              .map(col => ({
                source_column: col.sourceColumn,
                source_column_index: col.sourceIndex,
                target_table: col.computedConfig!.targetTable,
                target_field: col.computedConfig!.targetField,
                display_name: col.computedConfig!.displayName,
                computation_type: col.computedConfig!.computationType,
                config: {
                  depends_on: col.computedConfig!.dependsOn,
                  formula: col.computedConfig!.formula,
                  source_table: col.computedConfig!.sourceTable,
                  aggregation: col.computedConfig!.aggregation,
                  lookup_source: col.computedConfig!.lookupSource,
                  match_field: col.computedConfig!.matchField,
                  lookup_field: col.computedConfig!.lookupField,
                },
                description: col.computedConfig!.description,
              })),
          }),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Failed to save mapping')
        }
      }

      setCurrentStep('complete')
    } catch (error) {
      console.error('Error saving mappings:', error)
      setSaveError(error instanceof Error ? error.message : 'Failed to save mappings')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Data Enrichment"
        description="Connect data sources and map fields to your master tables"
      >
        {currentStep !== 'overview' && (
          <Button variant="outline" onClick={handleReset}>
            Start Over
          </Button>
        )}
      </PageHeader>

      <div className="p-8">
        <AnimatePresence mode="wait">
          {currentStep === 'overview' && (
            <OverviewView
              key="overview"
              onSearchSheets={() => setShowSearchModal(true)}
            />
          )}

          {currentStep === 'select-tab' && selectedSheet && (
            <TabSelectionView
              key="select-tab"
              sheet={selectedSheet}
              sheetPreview={sheetPreview}
              isLoading={isLoadingPreview}
              completedMappings={completedMappings}
              onSelectTab={handleSelectTab}
              onSearchAgain={() => setShowSearchModal(true)}
              onFinish={handleFinish}
              onBack={handleReset}
            />
          )}

          {currentStep === 'map-tab' && selectedSheet && selectedTab && (
            <motion.div
              key="map-tab"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3, ease: easeOut }}
            >
              <SmartMapper
                spreadsheetId={selectedSheet.id}
                tabName={selectedTab}
                onComplete={handleMappingComplete}
                onBack={() => {
                  setSelectedTab(null)
                  setCurrentStep('select-tab')
                }}
              />
            </motion.div>
          )}

          {currentStep === 'review' && (
            <ReviewView
              key="review"
              completedMappings={completedMappings}
              onBack={() => setCurrentStep('select-tab')}
              onCommit={handleCommit}
              isSaving={isSaving}
              saveError={saveError}
            />
          )}

          {currentStep === 'complete' && (
            <CompleteView
              key="complete"
              completedMappings={completedMappings}
              onDone={handleReset}
            />
          )}
        </AnimatePresence>
      </div>

      <SheetSearchModal
        open={showSearchModal}
        onOpenChange={setShowSearchModal}
        onSelectSheet={handleSelectSheet}
      />
    </div>
  )
}

// ============ OVERVIEW VIEW ============
interface TableStats {
  partners: { count: number; fields: string[] }
  staff: { count: number; fields: string[] }
}

function OverviewView({ onSearchSheets }: { onSearchSheets: () => void }) {
  const [stats, setStats] = useState<TableStats | null>(null)
  const [isLoadingStats, setIsLoadingStats] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch('/api/stats/tables')
        if (response.ok) {
          const data = await response.json()
          setStats(data)
        }
      } catch (error) {
        console.error('Error fetching stats:', error)
      } finally {
        setIsLoadingStats(false)
      }
    }
    fetchStats()
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3, ease: easeOut }}
      className="space-y-8"
    >
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-500/10 mb-6">
            <Database className="h-8 w-8 text-orange-500" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Start Data Enrichment</h2>
          <p className="text-muted-foreground text-center max-w-md mb-6">
            Connect a Google Sheet and map its columns to your Partner and Staff tables.
          </p>
          <Button onClick={onSearchSheets} className="gap-2">
            <Search className="h-4 w-4" />
            Search Google Sheets
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">How It Works</h3>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { step: 1, title: 'Select a Tab', description: 'Choose a tab from your spreadsheet to map.', icon: Table },
            { step: 2, title: 'Map Fields', description: 'Identify the primary key and map columns to fields.', icon: Settings },
            { step: 3, title: 'Review & Import', description: 'Preview your data and import to Sophie Hub.', icon: CheckCircle2 },
          ].map((item) => {
            const Icon = item.icon
            return (
              <Card key={item.step} className="relative overflow-hidden">
                <div className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground">
                  {item.step}
                </div>
                <CardHeader className="pb-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 mb-2">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-base">{item.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{item.description}</CardDescription>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Your Master Tables</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-blue-500" />
                  Partners
                </CardTitle>
                <Badge variant="secondary">
                  {isLoadingStats ? '...' : `${stats?.partners.count ?? 0} records`}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                Client brands you manage. Identified by brand name.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {(stats?.partners.fields.slice(0, 5) ?? ['brand_name', 'client_name', 'status', 'tier', 'base_fee']).map((field) => (
                  <Badge key={field} variant="outline" className="text-xs font-mono">{field}</Badge>
                ))}
                {stats && stats.partners.fields.length > 5 && (
                  <Badge variant="outline" className="text-xs text-muted-foreground">+{stats.partners.fields.length - 5} more</Badge>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-green-500" />
                  Staff
                </CardTitle>
                <Badge variant="secondary">
                  {isLoadingStats ? '...' : `${stats?.staff.count ?? 0} records`}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                Team members. Identified by full name or email.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {(stats?.staff.fields.slice(0, 5) ?? ['full_name', 'email', 'role', 'department', 'status']).map((field) => (
                  <Badge key={field} variant="outline" className="text-xs font-mono">{field}</Badge>
                ))}
                {stats && stats.staff.fields.length > 5 && (
                  <Badge variant="outline" className="text-xs text-muted-foreground">+{stats.staff.fields.length - 5} more</Badge>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </motion.div>
  )
}

// ============ TAB SELECTION VIEW ============
function TabSelectionView({
  sheet,
  sheetPreview,
  isLoading,
  completedMappings,
  onSelectTab,
  onSearchAgain,
  onFinish,
  onBack,
}: {
  sheet: GoogleSheet
  sheetPreview: SheetPreview | null
  isLoading: boolean
  completedMappings: TabMapping[]
  onSelectTab: (tabName: string) => void
  onSearchAgain: () => void
  onFinish: () => void
  onBack: () => void
}) {
  const mappedTabs = new Set(completedMappings.map(m => m.tabName))
  const [focusedIndex, setFocusedIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const hasInteracted = useRef(false)

  // Get available (unmapped) tabs
  const availableTabs = sheetPreview?.tabs.filter(t => !mappedTabs.has(t.title)) || []

  // Auto-focus container for keyboard nav
  useEffect(() => {
    if (containerRef.current && availableTabs.length > 0) {
      containerRef.current.focus()
    }
  }, [availableTabs.length])

  // Scroll focused item into view (only after user interaction)
  useEffect(() => {
    if (!hasInteracted.current) return
    const focused = containerRef.current?.children[focusedIndex] as HTMLElement
    focused?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [focusedIndex])

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!availableTabs.length) return

    switch (e.key) {
      case 'ArrowDown':
      case 'j':
        e.preventDefault()
        hasInteracted.current = true
        setFocusedIndex(prev => Math.min(prev + 1, availableTabs.length - 1))
        break
      case 'ArrowUp':
      case 'k':
        e.preventDefault()
        hasInteracted.current = true
        setFocusedIndex(prev => Math.max(prev - 1, 0))
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        if (availableTabs[focusedIndex]) {
          onSelectTab(availableTabs[focusedIndex].title)
        }
        break
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3, ease: easeOut }}
      className="space-y-6"
    >
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-green-600" />
            {sheet.name}
          </CardTitle>
          <CardDescription>
            Select a tab to begin mapping its columns.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Completed Mappings */}
          {completedMappings.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-green-600 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Mapped Tabs ({completedMappings.length})
              </h4>
              <div className="grid gap-2">
                {completedMappings.map((mapping) => {
                  const entityLabel = mapping.primaryEntity === 'partners' ? 'Partners' : mapping.primaryEntity === 'staff' ? 'Staff' : 'ASINs'
                  const entityColor = mapping.primaryEntity === 'partners' ? 'blue' : mapping.primaryEntity === 'staff' ? 'green' : 'orange'
                  const mappedCount = mapping.columns.filter(c => c.targetField && c.category !== 'skip').length

                  return (
                    <div
                      key={mapping.tabName}
                      className="flex items-center gap-3 p-3 rounded-lg bg-green-500/5 border border-green-500/20"
                    >
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      <div className="flex-1">
                        <p className="font-medium">{mapping.tabName}</p>
                        <p className="text-xs text-muted-foreground">
                          {entityLabel} · {mappedCount} fields mapped
                        </p>
                      </div>
                      <Badge variant="outline" className={`text-${entityColor}-600`}>
                        {entityLabel}
                      </Badge>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Available Tabs */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : sheetPreview ? (
            <div className="space-y-3">
              <h4 className="text-sm font-medium">
                Available Tabs ({availableTabs.length} remaining)
              </h4>
              <div
                ref={containerRef}
                tabIndex={0}
                onKeyDown={handleKeyDown}
                className="max-h-[350px] overflow-y-auto scrollbar-hide space-y-2 focus:outline-none"
              >
                {availableTabs.map((tab, index) => {
                  const isFocused = index === focusedIndex

                  return (
                    <button
                      key={tab.sheetId}
                      onClick={() => onSelectTab(tab.title)}
                      className={`w-full flex items-center gap-3 p-4 rounded-lg border text-left transition-all ${
                        isFocused
                          ? 'border-primary bg-accent/50 ring-2 ring-primary/20'
                          : 'hover:border-primary/50 hover:bg-accent/50'
                      }`}
                    >
                      <Table className="h-5 w-5 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{tab.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {tab.rowCount.toLocaleString()} rows · {tab.columnCount} columns
                        </p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}

          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={onBack}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button variant="outline" onClick={onSearchAgain}>
                Different Sheet
              </Button>
            </div>
            {completedMappings.length > 0 && (
              <Button onClick={onFinish} className="gap-2">
                Review & Import
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ============ REVIEW VIEW ============
// Note: Using ColumnClassification and TabMapping interfaces defined at top of file

function ReviewView({
  completedMappings,
  onBack,
  onCommit,
  isSaving,
  saveError,
}: {
  completedMappings: TabMapping[]
  onBack: () => void
  onCommit: () => void
  isSaving: boolean
  saveError: string | null
}) {
  const partnerMappings = completedMappings.filter(m => m.primaryEntity === 'partners')
  const staffMappings = completedMappings.filter(m => m.primaryEntity === 'staff')
  const asinMappings = completedMappings.filter(m => m.primaryEntity === 'asins')

  const countMappedFields = (mapping: TabMapping) =>
    mapping.columns.filter(c => c.targetField && c.category !== 'skip').length

  const totalPartnerFields = partnerMappings.reduce((sum, m) => sum + countMappedFields(m), 0)
  const totalStaffFields = staffMappings.reduce((sum, m) => sum + countMappedFields(m), 0)
  const totalAsinFields = asinMappings.reduce((sum, m) => sum + countMappedFields(m), 0)

  const getEntityColor = (entity: string) => {
    switch (entity) {
      case 'partners': return 'blue'
      case 'staff': return 'green'
      case 'asins': return 'orange'
      default: return 'gray'
    }
  }

  const getEntityLabel = (entity: string) => {
    switch (entity) {
      case 'partners': return 'Partners'
      case 'staff': return 'Staff'
      case 'asins': return 'ASINs'
      default: return entity
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3, ease: easeOut }}
      className="space-y-6"
    >
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-orange-500" />
            Review Your Mappings
          </CardTitle>
          <CardDescription>
            You've configured {completedMappings.length} tab{completedMappings.length > 1 ? 's' : ''} for import
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <p className="text-2xl font-bold text-blue-600">{partnerMappings.length}</p>
              <p className="text-sm text-muted-foreground">Partner tabs · {totalPartnerFields} fields</p>
            </div>
            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
              <p className="text-2xl font-bold text-green-600">{staffMappings.length}</p>
              <p className="text-sm text-muted-foreground">Staff tabs · {totalStaffFields} fields</p>
            </div>
            <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/20">
              <p className="text-2xl font-bold text-orange-600">{asinMappings.length}</p>
              <p className="text-sm text-muted-foreground">ASIN tabs · {totalAsinFields} fields</p>
            </div>
          </div>

          {/* Mapping Details */}
          <div className="space-y-4">
            {completedMappings.map((mapping) => {
              const color = getEntityColor(mapping.primaryEntity)
              const keyColumn = mapping.columns.find(c => c.isKey)
              const mappedColumns = mapping.columns.filter(c => c.targetField && c.category !== 'skip')

              return (
                <div key={mapping.tabName} className="rounded-lg border p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Badge className={`bg-${color}-500`}>
                      {getEntityLabel(mapping.primaryEntity)}
                    </Badge>
                    <span className="font-medium">{mapping.tabName}</span>
                    {keyColumn && (
                      <span className="text-xs text-muted-foreground">
                        (Key: {keyColumn.sourceColumn})
                      </span>
                    )}
                  </div>
                  <div className="grid gap-1 text-sm">
                    {mappedColumns.map((col) => (
                      <div key={col.sourceIndex} className="flex items-center gap-2 text-muted-foreground">
                        <span className="font-mono text-xs">{col.sourceColumn}</span>
                        <ArrowRight className="h-3 w-3" />
                        <span className={`font-mono text-xs text-${color}-600`}>
                          {col.targetField}
                        </span>
                        {col.authority === 'reference' && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0">ref</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          {saveError && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 text-sm">
              {saveError}
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t">
            <Button variant="outline" onClick={onBack} disabled={isSaving} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Add More Tabs
            </Button>
            <Button onClick={onCommit} disabled={isSaving} className="gap-2">
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {isSaving ? 'Saving...' : 'Save Mappings'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ============ COMPLETE VIEW ============
function CompleteView({
  completedMappings,
  onDone,
}: {
  completedMappings: TabMapping[]
  onDone: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3, ease: easeOut }}
      className="space-y-6"
    >
      <Card className="max-w-2xl mx-auto">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.4, ease: easeOut, delay: 0.1 }}
            className="flex h-20 w-20 items-center justify-center rounded-2xl bg-green-500/10 mb-6"
          >
            <CheckCircle2 className="h-10 w-10 text-green-500" />
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            className="text-xl font-semibold mb-2"
          >
            Mappings Saved!
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.3 }}
            className="text-muted-foreground text-center max-w-md mb-6"
          >
            Your {completedMappings.length} tab mapping{completedMappings.length > 1 ? 's have' : ' has'} been saved to the database.
            Weekly columns will be automatically detected using pattern matching.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.4 }}
          >
            <Button onClick={onDone} className="gap-2">
              Done
              <Check className="h-4 w-4" />
            </Button>
          </motion.div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
