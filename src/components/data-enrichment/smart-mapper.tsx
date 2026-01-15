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
  SelectItem,
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

// ============ TYPES ============
interface TabRawData {
  rows: string[][]
  totalRows: number
  detectedHeaderRow: number
}

type EntityType = 'partners' | 'staff' | 'asins'
type ColumnCategory = 'partner' | 'staff' | 'asin' | 'weekly' | 'computed' | 'skip' | null
type ComputationType = 'formula' | 'aggregation' | 'lookup' | 'custom'
type EntityType_Computed = 'partners' | 'staff' | 'asins'

interface ComputedFieldConfig {
  computationType: ComputationType
  targetTable: EntityType_Computed
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
type SourceAuthority = 'source_of_truth' | 'reference'

interface ColumnClassification {
  sourceIndex: number
  sourceColumn: string
  category: ColumnCategory
  targetField: string | null
  authority: SourceAuthority
  isKey: boolean // This column is the identifier/key for its entity type
  computedConfig?: ComputedFieldConfig // For computed fields
}

interface SmartMapperProps {
  spreadsheetId: string
  sheetName: string
  tabName: string
  onComplete: (mappings: {
    headerRow: number
    columns: ColumnClassification[]
    primaryEntity: EntityType
  }) => void
  onBack: () => void
}

// Field definitions per entity type
interface FieldDef {
  value: string
  label: string
  description?: string
}

const PARTNER_FIELDS: FieldDef[] = [
  { value: 'brand_name', label: 'Brand Name', description: 'The brand/company name' },
  { value: 'client_name', label: 'Client Name', description: 'Contact person name' },
  { value: 'status', label: 'Status', description: 'Active, Churned, etc.' },
  { value: 'tier', label: 'Tier', description: 'Service tier level' },
  { value: 'base_fee', label: 'Base Fee', description: 'Monthly fee amount' },
  { value: 'start_date', label: 'Start Date', description: 'When they joined' },
  { value: 'contract_type', label: 'Contract Type', description: 'Type of agreement' },
  { value: 'billing_cycle', label: 'Billing Cycle', description: 'Monthly, quarterly, etc.' },
  { value: 'notes', label: 'Notes', description: 'General notes' },
]

const STAFF_FIELDS: FieldDef[] = [
  { value: 'full_name', label: 'Full Name', description: 'Staff member name' },
  { value: 'email', label: 'Email', description: 'Work email address' },
  { value: 'role', label: 'Role', description: 'Job title/role' },
  { value: 'department', label: 'Department', description: 'Team or department' },
  { value: 'status', label: 'Status', description: 'Active, On Leave, etc.' },
  { value: 'hire_date', label: 'Hire Date', description: 'Start date' },
  { value: 'capacity', label: 'Capacity', description: 'Workload capacity %' },
  { value: 'slack_id', label: 'Slack ID', description: 'Slack username' },
]

const ASIN_FIELDS: FieldDef[] = [
  { value: 'asin_code', label: 'ASIN Code', description: 'Amazon Standard ID' },
  { value: 'product_name', label: 'Product Name', description: 'Product title' },
  { value: 'parent_asin', label: 'Parent ASIN', description: 'Parent product ASIN' },
  { value: 'status', label: 'Status', description: 'Active, Suppressed, etc.' },
  { value: 'category', label: 'Category', description: 'Product category' },
]

// Animation
const easeOut: [number, number, number, number] = [0.22, 1, 0.36, 1]
const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
  transition: { duration: 0.3, ease: easeOut }
}

// Category config
const CATEGORY_CONFIG = {
  partner: {
    label: 'Partner',
    color: 'blue',
    icon: Building2,
    bgClass: 'bg-blue-500/10 border-blue-500/30 text-blue-600',
    badgeClass: 'bg-blue-500',
  },
  staff: {
    label: 'Staff',
    color: 'green',
    icon: Users,
    bgClass: 'bg-green-500/10 border-green-500/30 text-green-600',
    badgeClass: 'bg-green-500',
  },
  asin: {
    label: 'ASIN',
    color: 'orange',
    icon: Package,
    bgClass: 'bg-orange-500/10 border-orange-500/30 text-orange-600',
    badgeClass: 'bg-orange-500',
  },
  weekly: {
    label: 'Weekly',
    color: 'purple',
    icon: Calendar,
    bgClass: 'bg-purple-500/10 border-purple-500/30 text-purple-600',
    badgeClass: 'bg-purple-500',
  },
  computed: {
    label: 'Computed',
    color: 'cyan',
    icon: Calculator,
    bgClass: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-600',
    badgeClass: 'bg-cyan-500',
  },
  skip: {
    label: 'Skip',
    color: 'gray',
    icon: SkipForward,
    bgClass: 'bg-gray-500/10 border-gray-500/30 text-gray-500',
    badgeClass: 'bg-gray-500',
  },
}

export function SmartMapper({ spreadsheetId, sheetName, tabName, onComplete, onBack }: SmartMapperProps) {
  // Simplified: just preview → classify → map
  const [phase, setPhase] = useState<'preview' | 'classify' | 'map'>('preview')
  const [isLoading, setIsLoading] = useState(true)
  const [rawData, setRawData] = useState<TabRawData | null>(null)
  const [headerRow, setHeaderRow] = useState(0)
  const [columns, setColumns] = useState<ColumnClassification[]>([])
  const [columnsHistory, setColumnsHistory] = useState<ColumnClassification[][]>([])

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

  // Load raw data
  useEffect(() => {
    async function loadData() {
      setIsLoading(true)
      try {
        const response = await fetch(
          `/api/sheets/raw-rows?id=${spreadsheetId}&tab=${encodeURIComponent(tabName)}`
        )
        const data = await response.json()
        if (response.ok) {
          setRawData(data)
          setHeaderRow(data.detectedHeaderRow)
        }
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [spreadsheetId, tabName])

  // Initialize columns when header row changes - with auto-detection
  useEffect(() => {
    if (!rawData || headerRow >= rawData.rows.length) return

    const headers = rawData.rows[headerRow]
    const initialColumns: ColumnClassification[] = headers.map((header, idx) => {
      const name = (header || '').toLowerCase()

      // Auto-detect weekly columns (contains "weekly" or matches date patterns)
      const isWeekly =
        name.includes('weekly') ||
        name.includes('week ') ||
        name.match(/^w\d+\s/) || // W1, W2, etc.
        name.match(/^\d{1,2}\/\d{1,2}/) || // 1/6, 12/25
        name.match(/^\d{4}-\d{2}-\d{2}/) // 2024-01-06

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
  }, [rawData, headerRow])

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

  const handleComplete = () => {
    onComplete({
      headerRow,
      columns,
      primaryEntity: getPrimaryEntity(),
    })
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Loading spreadsheet data...</p>
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
          onHeaderRowChange={setHeaderRow}
          onConfirm={() => setPhase('classify')}
          onBack={onBack}
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
          onConfirm={() => setPhase('map')}
          onBack={() => setPhase('preview')}
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
          onConfirm={handleComplete}
          onBack={() => setPhase('classify')}
        />
      )}
    </AnimatePresence>
  )
}

// ============ PHASE 1: PREVIEW ============
function PreviewPhase({
  rawData,
  headerRow,
  onHeaderRowChange,
  onConfirm,
  onBack,
}: {
  rawData: TabRawData
  headerRow: number
  onHeaderRowChange: (row: number) => void
  onConfirm: () => void
  onBack: () => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([])
  const hasInteracted = useRef(false)
  const maxRow = Math.min(rawData.rows.length - 1, 19)

  useEffect(() => {
    containerRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!hasInteracted.current) return
    const row = rowRefs.current[headerRow]
    if (row) {
      row.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  }, [headerRow])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
      case 'j':
        e.preventDefault()
        hasInteracted.current = true
        onHeaderRowChange(Math.min(maxRow, headerRow + 1))
        break
      case 'ArrowUp':
      case 'k':
        e.preventDefault()
        hasInteracted.current = true
        onHeaderRowChange(Math.max(0, headerRow - 1))
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
      <Card className="max-w-5xl mx-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-orange-500" />
                We found your data!
              </CardTitle>
              <CardDescription>
                Confirm where your column headers are. Use arrow keys to navigate.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Header row:</span>
              <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    hasInteracted.current = true
                    onHeaderRowChange(Math.max(0, headerRow - 1))
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
                    hasInteracted.current = true
                    onHeaderRowChange(Math.min(maxRow, headerRow + 1))
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
          <div className="rounded-lg border overflow-hidden">
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
                        className={`border-b ${isBeforeHeader ? 'opacity-50' : ''}`}
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
            <span>Showing first 20 rows · {rawData.totalRows.toLocaleString()} total rows</span>
            {headerRow > 0 && (
              <span className="text-blue-600">
                Rows 1-{headerRow} will be skipped
              </span>
            )}
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
            <Button variant="outline" onClick={onBack} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Button onClick={onConfirm} className="gap-2">
              This looks right
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
      </div>
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
  onConfirm,
  onBack,
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
  onConfirm: () => void
  onBack: () => void
}) {
  // State for computed field config modal
  const [configureComputedIndex, setConfigureComputedIndex] = useState<number | null>(null)
  const [selectedIndices, setSelectedIndices] = useState<number[]>([])
  const [activeFilter, setActiveFilter] = useState<ColumnCategory | 'all' | 'unclassified'>('all')
  const containerRef = useRef<HTMLDivElement>(null)
  const hasInteracted = useRef(false)
  const [focusedIndex, setFocusedIndex] = useState(0)

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

  // Simple toggle for keyboard
  const toggleSelection = (idx: number) => {
    setSelectedIndices(prev =>
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    )
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
  const asinKey = allValidColumns.find(c => c.category === 'asin' && c.isKey)

  const totalClassified = stats.partner + stats.staff + stats.asin + stats.weekly + stats.computed + stats.skip
  const totalColumns = allValidColumns.length

  // Progress milestone celebration
  const progressPercent = totalColumns > 0 ? Math.round((totalClassified / totalColumns) * 100) : 0
  const [lastMilestone, setLastMilestone] = useState(0)
  const [showCelebration, setShowCelebration] = useState(false)

  useEffect(() => {
    const milestones = [25, 50, 75, 100]
    const currentMilestone = milestones.filter(m => progressPercent >= m).pop() || 0

    if (currentMilestone > lastMilestone && currentMilestone > 0) {
      setLastMilestone(currentMilestone)
      setShowCelebration(true)
      setTimeout(() => setShowCelebration(false), 1500)
    }
  }, [progressPercent, lastMilestone])

  // Category shortcuts mapping
  const categoryShortcuts: Record<string, ColumnCategory> = {
    '1': 'partner',
    '2': 'staff',
    '3': 'asin',
    '4': 'weekly',
    '5': 'computed',
    '6': 'skip',
    'p': 'partner',
    's': 'staff',
    'a': 'asin',
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

  // Check if we have at least one key designated
  const hasKeyDesignated = partnerKey || staffKey || asinKey

  return (
    <motion.div {...fadeInUp} className="space-y-6">
      <div
        ref={containerRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className="focus:outline-none"
      >
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <FileText className="h-3.5 w-3.5" />
            <span className="truncate max-w-[200px]">{sheetName}</span>
            <ChevronRight className="h-3 w-3 flex-shrink-0" />
            <span className="font-medium text-foreground truncate">{tabName}</span>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Table className="h-5 w-5 text-orange-500" />
                What's in each column?
              </CardTitle>
              <CardDescription>
                Classify columns and mark which one is the <strong>key identifier</strong> for each entity type.
              </CardDescription>
            </div>
            <div className="text-right relative">
              <motion.div
                animate={showCelebration ? { scale: [1, 1.1, 1] } : {}}
                transition={{ duration: 0.3 }}
                className="relative"
              >
                <div className="text-2xl font-bold">{totalClassified}/{totalColumns}</div>
                {showCelebration && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="absolute -top-6 right-0 text-xs font-medium text-primary flex items-center gap-1"
                  >
                    <Sparkles className="h-3 w-3" />
                    {lastMilestone}%!
                  </motion.div>
                )}
              </motion.div>
              <div className="text-xs text-muted-foreground">classified</div>
            </div>
          </div>

          {/* Stats badges */}
          <div className="flex flex-wrap gap-2 mt-4">
            {stats.partner > 0 && (
              <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30">
                <Building2 className="h-3 w-3 mr-1" />
                {stats.partner} Partner
                {partnerKey && <Key className="h-3 w-3 ml-1 text-amber-500" />}
              </Badge>
            )}
            {stats.staff > 0 && (
              <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
                <Users className="h-3 w-3 mr-1" />
                {stats.staff} Staff
                {staffKey && <Key className="h-3 w-3 ml-1 text-amber-500" />}
              </Badge>
            )}
            {stats.asin > 0 && (
              <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/30">
                <Package className="h-3 w-3 mr-1" />
                {stats.asin} ASIN
                {asinKey && <Key className="h-3 w-3 ml-1 text-amber-500" />}
              </Badge>
            )}
            {stats.weekly > 0 && (
              <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/30">
                <Calendar className="h-3 w-3 mr-1" />
                {stats.weekly} Weekly
              </Badge>
            )}
            {stats.computed > 0 && (
              <Badge variant="outline" className="bg-cyan-500/10 text-cyan-600 border-cyan-500/30">
                <Calculator className="h-3 w-3 mr-1" />
                {stats.computed} Computed
              </Badge>
            )}
            {stats.skip > 0 && (
              <Badge variant="outline" className="bg-gray-500/10 text-gray-600 border-gray-500/30">
                <SkipForward className="h-3 w-3 mr-1" />
                {stats.skip} Skip
              </Badge>
            )}
            {stats.unclassified > 0 && (
              <Badge variant="outline" className="text-muted-foreground">
                {stats.unclassified} unclassified
              </Badge>
            )}
          </div>

          {/* Bulk action bar */}
          {selectedIndices.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 mt-4 p-3 bg-muted rounded-lg"
            >
              <span className="text-sm font-medium">{selectedIndices.length} selected:</span>
              <Button size="sm" variant="outline" onClick={() => applyBulkCategory('partner')} className="h-7 text-xs">
                <Building2 className="h-3 w-3 mr-1" /> Partner
              </Button>
              <Button size="sm" variant="outline" onClick={() => applyBulkCategory('staff')} className="h-7 text-xs">
                <Users className="h-3 w-3 mr-1" /> Staff
              </Button>
              <Button size="sm" variant="outline" onClick={() => applyBulkCategory('asin')} className="h-7 text-xs">
                <Package className="h-3 w-3 mr-1" /> ASIN
              </Button>
              <Button size="sm" variant="outline" onClick={() => applyBulkCategory('weekly')} className="h-7 text-xs">
                <Calendar className="h-3 w-3 mr-1" /> Weekly
              </Button>
              <Button size="sm" variant="outline" onClick={() => applyBulkCategory('computed')} className="h-7 text-xs">
                <Calculator className="h-3 w-3 mr-1" /> Computed
              </Button>
              <Button size="sm" variant="outline" onClick={() => applyBulkCategory('skip')} className="h-7 text-xs">
                <SkipForward className="h-3 w-3 mr-1" /> Skip
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedIndices([])} className="h-7 text-xs ml-auto">
                Clear
              </Button>
            </motion.div>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Subtle filter tabs */}
          <div className="flex items-center gap-1 pb-2 border-b border-border/50">
            <span className="text-xs text-muted-foreground mr-2">View:</span>
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

          <ScrollArea className="h-[380px]">
            <div className="space-y-1 pr-3">
              {validColumns.map((col, visualIdx) => {
                const idx = col.sourceIndex
                const sample = getSample(idx)
                const isSelected = selectedIndices.includes(idx)
                const isFocused = focusedIndex === visualIdx
                const config = col.category ? CATEGORY_CONFIG[col.category] : null
                const canBeKey = col.category && col.category !== 'skip' && col.category !== 'weekly'

                return (
                  <motion.div
                    key={idx}
                    layout
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-all relative ${
                      col.isKey
                        ? 'bg-amber-500/5 border-amber-500/30'
                        : isSelected
                        ? 'bg-accent border-primary/50'
                        : isFocused
                        ? 'bg-accent/50 border-primary ring-2 ring-primary/30 ring-offset-1'
                        : col.category
                        ? 'bg-muted/30 border-border'
                        : 'border-border hover:bg-accent/50'
                    }`}
                  >
                    {/* Focused row indicator */}
                    {isFocused && (
                      <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-8 rounded-full bg-primary" />
                    )}
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
                        {col.isKey && col.category && (
                          <Badge className={`text-white text-[10px] px-1.5 py-0 ${
                            col.category === 'partner' ? 'bg-blue-500' :
                            col.category === 'staff' ? 'bg-green-500' :
                            col.category === 'asin' ? 'bg-orange-500' : 'bg-amber-500'
                          }`}>
                            <Key className="h-3 w-3 mr-0.5" />
                            {col.category === 'partner' ? 'Partner Key' :
                             col.category === 'staff' ? 'Staff Key' :
                             col.category === 'asin' ? 'ASIN Key' : 'Key'}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{sample || '(empty)'}</p>
                    </div>

                    {/* Quick shortcuts hint when focused and unclassified */}
                    {isFocused && !col.category && (
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <kbd className="px-1 py-0.5 rounded bg-blue-500/20 text-blue-600 font-mono">1</kbd>
                        <kbd className="px-1 py-0.5 rounded bg-green-500/20 text-green-600 font-mono">2</kbd>
                        <kbd className="px-1 py-0.5 rounded bg-orange-500/20 text-orange-600 font-mono">3</kbd>
                        <kbd className="px-1 py-0.5 rounded bg-purple-500/20 text-purple-600 font-mono">4</kbd>
                        <kbd className="px-1 py-0.5 rounded bg-cyan-500/20 text-cyan-600 font-mono">5</kbd>
                        <kbd className="px-1 py-0.5 rounded bg-gray-500/20 text-gray-600 font-mono">6</kbd>
                      </div>
                    )}

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

                        {/* Partner with key submenu */}
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger className="text-xs">
                            <Building2 className="h-3 w-3 mr-2 text-blue-500" />
                            Partner
                            {col.category === 'partner' && <Check className="h-3 w-3 ml-auto" />}
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent className="w-[200px]">
                            {/* Always show current key info first */}
                            {partnerKey && (
                              <>
                                <div className="px-2 py-1.5 text-[10px] text-muted-foreground border-b border-border/50 mb-1">
                                  <Key className="h-3 w-3 inline mr-1 text-blue-500" />
                                  Key: <span className="font-medium text-foreground">{partnerKey.sourceColumn}</span>
                                </div>
                              </>
                            )}
                            <DropdownMenuItem
                              onClick={() => onCategoryChange(idx, 'partner')}
                              className="text-xs"
                            >
                              <Building2 className="h-3 w-3 mr-2 text-blue-500" />
                              Set as Partner
                            </DropdownMenuItem>
                            {partnerKey ? (
                              <>
                                {!col.isKey && (
                                  <DropdownMenuItem
                                    onClick={() => {
                                      onCategoryChange(idx, 'partner')
                                      onKeyToggle(idx)
                                    }}
                                    className="text-xs"
                                  >
                                    <Key className="h-3 w-3 mr-2 text-amber-500" />
                                    Make this the Key
                                  </DropdownMenuItem>
                                )}
                                {col.isKey && col.category === 'partner' && (
                                  <DropdownMenuItem
                                    onClick={() => onKeyToggle(idx)}
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
                                  onKeyToggle(idx)
                                }}
                                className="text-xs"
                              >
                                <Key className="h-3 w-3 mr-2 text-amber-500" />
                                Set as Partner Key
                              </DropdownMenuItem>
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
                            {/* Always show current key info first */}
                            {staffKey && (
                              <>
                                <div className="px-2 py-1.5 text-[10px] text-muted-foreground border-b border-border/50 mb-1">
                                  <Key className="h-3 w-3 inline mr-1 text-green-500" />
                                  Key: <span className="font-medium text-foreground">{staffKey.sourceColumn}</span>
                                </div>
                              </>
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
                                      onKeyToggle(idx)
                                    }}
                                    className="text-xs"
                                  >
                                    <Key className="h-3 w-3 mr-2 text-amber-500" />
                                    Make this the Key
                                  </DropdownMenuItem>
                                )}
                                {col.isKey && col.category === 'staff' && (
                                  <DropdownMenuItem
                                    onClick={() => onKeyToggle(idx)}
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
                                  onKeyToggle(idx)
                                }}
                                className="text-xs"
                              >
                                <Key className="h-3 w-3 mr-2 text-amber-500" />
                                Set as Staff Key
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>

                        {/* ASIN with key submenu */}
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger className="text-xs">
                            <Package className="h-3 w-3 mr-2 text-orange-500" />
                            ASIN
                            {col.category === 'asin' && <Check className="h-3 w-3 ml-auto" />}
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent className="w-[200px]">
                            {/* Always show current key info first */}
                            {asinKey && (
                              <>
                                <div className="px-2 py-1.5 text-[10px] text-muted-foreground border-b border-border/50 mb-1">
                                  <Key className="h-3 w-3 inline mr-1 text-orange-500" />
                                  Key: <span className="font-medium text-foreground">{asinKey.sourceColumn}</span>
                                </div>
                              </>
                            )}
                            <DropdownMenuItem
                              onClick={() => onCategoryChange(idx, 'asin')}
                              className="text-xs"
                            >
                              <Package className="h-3 w-3 mr-2 text-orange-500" />
                              Set as ASIN
                            </DropdownMenuItem>
                            {asinKey ? (
                              <>
                                {!col.isKey && (
                                  <DropdownMenuItem
                                    onClick={() => {
                                      onCategoryChange(idx, 'asin')
                                      onKeyToggle(idx)
                                    }}
                                    className="text-xs"
                                  >
                                    <Key className="h-3 w-3 mr-2 text-amber-500" />
                                    Make this the Key
                                  </DropdownMenuItem>
                                )}
                                {col.isKey && col.category === 'asin' && (
                                  <DropdownMenuItem
                                    onClick={() => onKeyToggle(idx)}
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
                                  onCategoryChange(idx, 'asin')
                                  onKeyToggle(idx)
                                }}
                                className="text-xs"
                              >
                                <Key className="h-3 w-3 mr-2 text-amber-500" />
                                Set as ASIN Key
                              </DropdownMenuItem>
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

          {/* Key explanation */}
          <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
            <p className="text-xs text-muted-foreground">
              <Key className="h-3 w-3 inline mr-1 text-amber-500" />
              <strong>Key</strong> = The column that uniquely identifies each record (e.g., <span className="text-blue-600">"Brand Name"</span> for partners, <span className="text-green-600">"Full Name"</span> for staff, <span className="text-orange-600">"ASIN Code"</span> for products)
            </p>
          </div>

          {/* Keyboard shortcuts legend */}
          <div className="p-3 rounded-lg bg-muted/30 border border-border">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-xs font-semibold">Keyboard Shortcuts</span>
            </div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-xs">
              {/* Categories row 1 */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <kbd className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-600 text-[10px] font-mono font-medium">1</kbd>
                  <span className="text-blue-600 font-medium">Partner</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <kbd className="px-1.5 py-0.5 rounded bg-green-500/20 text-green-600 text-[10px] font-mono font-medium">2</kbd>
                  <span className="text-green-600 font-medium">Staff</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <kbd className="px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-600 text-[10px] font-mono font-medium">3</kbd>
                  <span className="text-orange-600 font-medium">ASIN</span>
                </div>
              </div>
              {/* Categories row 2 */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <kbd className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-600 text-[10px] font-mono font-medium">4</kbd>
                  <span className="text-purple-600 font-medium">Weekly</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <kbd className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-600 text-[10px] font-mono font-medium">5</kbd>
                  <span className="text-cyan-600 font-medium">Computed</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <kbd className="px-1.5 py-0.5 rounded bg-gray-500/20 text-gray-500 text-[10px] font-mono font-medium">6</kbd>
                  <span className="text-gray-500 font-medium">Skip</span>
                </div>
              </div>
              {/* Navigation */}
              <div className="flex items-center gap-3 text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono">↑↓</kbd>
                  <span>Navigate</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono">Tab</kbd>
                  <span>Next unclassified</span>
                </div>
              </div>
              {/* Actions */}
              <div className="flex items-center gap-3 text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <kbd className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 text-[10px] font-mono">K</kbd>
                  <span>Set as Key</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono">⇧+click</kbd>
                  <span>Range</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono">⌘Z</kbd>
                  <span>Undo</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
            <Button variant="outline" onClick={onBack} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
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
  const [targetTable, setTargetTable] = useState<EntityType_Computed>(
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
            <p className="text-sm text-muted-foreground">"{column.sourceColumn}"</p>
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
                <strong>Future:</strong> You'll be able to hot-swap data sources later (e.g., get timezone from Slack instead of this sheet)
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
}: {
  rawData: TabRawData
  headerRow: number
  columns: ColumnClassification[]
  onFieldChange: (index: number, field: string | null) => void
  onAuthorityChange: (index: number, authority: SourceAuthority) => void
  onConfirm: () => void
  onBack: () => void
}) {
  const sampleRows = rawData.rows.slice(headerRow + 1, headerRow + 4)

  const partnerColumns = columns.filter(c => c.category === 'partner')
  const staffColumns = columns.filter(c => c.category === 'staff')
  const asinColumns = columns.filter(c => c.category === 'asin')
  const weeklyColumns = columns.filter(c => c.category === 'weekly')

  const getSample = (colIndex: number) => sampleRows[0]?.[colIndex] || ''

  const renderColumnMapper = (col: ColumnClassification, fields: FieldDef[], colorClass: string) => (
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
            <span className="text-muted-foreground">Don't map</span>
          </SelectItem>
          {fields.map(field => (
            <SelectItem key={field.value} value={field.value}>
              {field.label}
            </SelectItem>
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

  return (
    <motion.div {...fadeInUp} className="space-y-6">
      <Card className="max-w-5xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-orange-500" />
            Map to database fields
          </CardTitle>
          <CardDescription>
            Connect your classified columns to specific fields. Set each as Source of Truth or Reference.
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
                    {partnerColumns.map(col => renderColumnMapper(col, PARTNER_FIELDS, 'bg-blue-500/5 border-blue-500/20'))}
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
                    {staffColumns.map(col => renderColumnMapper(col, STAFF_FIELDS, 'bg-green-500/5 border-green-500/20'))}
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
                    {asinColumns.map(col => renderColumnMapper(col, ASIN_FIELDS, 'bg-orange-500/5 border-orange-500/20'))}
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
              Reference = Read-only, don't update master
            </span>
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
            <Button variant="outline" onClick={onBack} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
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
