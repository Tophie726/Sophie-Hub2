'use client'

import { useState, useEffect, useRef } from 'react'
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
  MoreHorizontal,
} from 'lucide-react'

// ============ TYPES ============
interface TabRawData {
  rows: string[][]
  totalRows: number
  detectedHeaderRow: number
}

type EntityType = 'partners' | 'staff' | 'asins'
type ColumnCategory = 'partner' | 'staff' | 'asin' | 'weekly' | 'skip' | null
type SourceAuthority = 'source_of_truth' | 'reference'

interface ColumnClassification {
  sourceIndex: number
  sourceColumn: string
  category: ColumnCategory
  targetField: string | null
  authority: SourceAuthority
  isKey: boolean // This column is the identifier/key for its entity type
}

interface SmartMapperProps {
  spreadsheetId: string
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
const easeOut = [0.22, 1, 0.36, 1]
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
  skip: {
    label: 'Skip',
    color: 'gray',
    icon: SkipForward,
    bgClass: 'bg-gray-500/10 border-gray-500/30 text-gray-500',
    badgeClass: 'bg-gray-500',
  },
}

export function SmartMapper({ spreadsheetId, tabName, onComplete, onBack }: SmartMapperProps) {
  // Simplified: just preview → classify → map
  const [phase, setPhase] = useState<'preview' | 'classify' | 'map'>('preview')
  const [isLoading, setIsLoading] = useState(true)
  const [rawData, setRawData] = useState<TabRawData | null>(null)
  const [headerRow, setHeaderRow] = useState(0)
  const [columns, setColumns] = useState<ColumnClassification[]>([])

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
    setColumns(prev => prev.map((col, idx) => {
      if (idx !== columnIndex) return col
      // If changing category, reset isKey
      return { ...col, category, isKey: false, targetField: null }
    }))
  }

  const handleBulkCategoryChange = (indices: number[], category: ColumnCategory) => {
    setColumns(prev => prev.map((col, idx) => {
      if (!indices.includes(idx)) return col
      return { ...col, category, isKey: false, targetField: null }
    }))
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
          rawData={rawData}
          headerRow={headerRow}
          columns={columns}
          onCategoryChange={handleCategoryChange}
          onBulkCategoryChange={handleBulkCategoryChange}
          onKeyToggle={handleKeyToggle}
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
  rawData,
  headerRow,
  columns,
  onCategoryChange,
  onBulkCategoryChange,
  onKeyToggle,
  onConfirm,
  onBack,
}: {
  rawData: TabRawData
  headerRow: number
  columns: ColumnClassification[]
  onCategoryChange: (index: number, category: ColumnCategory) => void
  onBulkCategoryChange: (indices: number[], category: ColumnCategory) => void
  onKeyToggle: (index: number) => void
  onConfirm: () => void
  onBack: () => void
}) {
  const [selectedIndices, setSelectedIndices] = useState<number[]>([])
  const containerRef = useRef<HTMLDivElement>(null)
  const hasInteracted = useRef(false)
  const [focusedIndex, setFocusedIndex] = useState(0)

  const sampleRows = rawData.rows.slice(headerRow + 1, headerRow + 2)
  const validColumns = columns.filter(c => c.sourceColumn.trim())

  useEffect(() => {
    containerRef.current?.focus()
  }, [])

  const getSample = (colIndex: number) => sampleRows[0]?.[colIndex] || ''

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

  // Stats
  const stats = {
    partner: columns.filter(c => c.category === 'partner').length,
    staff: columns.filter(c => c.category === 'staff').length,
    asin: columns.filter(c => c.category === 'asin').length,
    weekly: columns.filter(c => c.category === 'weekly').length,
    skip: columns.filter(c => c.category === 'skip').length,
    unclassified: columns.filter(c => c.category === null && c.sourceColumn.trim()).length,
  }

  const partnerKey = columns.find(c => c.category === 'partner' && c.isKey)
  const staffKey = columns.find(c => c.category === 'staff' && c.isKey)
  const asinKey = columns.find(c => c.category === 'asin' && c.isKey)

  const totalClassified = stats.partner + stats.staff + stats.asin + stats.weekly + stats.skip
  const totalColumns = validColumns.length

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
      case 'j':
        e.preventDefault()
        hasInteracted.current = true
        setFocusedIndex(prev => Math.min(prev + 1, validColumns.length - 1))
        break
      case 'ArrowUp':
      case 'k':
        e.preventDefault()
        hasInteracted.current = true
        setFocusedIndex(prev => Math.max(prev - 1, 0))
        break
      case ' ':
        e.preventDefault()
        // Toggle selection on space
        const col = validColumns[focusedIndex]
        if (col) toggleSelection(col.sourceIndex)
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
            <div className="text-right">
              <div className="text-2xl font-bold">{totalClassified}/{totalColumns}</div>
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
          <ScrollArea className="h-[400px]">
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
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                      col.isKey
                        ? 'bg-amber-500/5 border-amber-500/30'
                        : isSelected
                        ? 'bg-accent border-primary/50'
                        : isFocused
                        ? 'bg-accent/50 border-primary/30'
                        : col.category
                        ? 'bg-muted/30 border-border'
                        : 'border-border hover:bg-accent/50'
                    }`}
                  >
                    {/* Checkbox */}
                    <button
                      onClick={() => toggleSelection(idx)}
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
                        {col.isKey && (
                          <Badge className="bg-amber-500 text-white text-[10px] px-1.5 py-0">
                            <Key className="h-3 w-3 mr-0.5" />
                            Key
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{sample || '(empty)'}</p>
                    </div>

                    {/* Category selector */}
                    <Select
                      value={col.category || '__none__'}
                      onValueChange={(value) => onCategoryChange(idx, value === '__none__' ? null : value as ColumnCategory)}
                    >
                      <SelectTrigger className="w-[130px] h-8 text-xs">
                        <SelectValue placeholder="Classify..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">
                          <span className="text-muted-foreground">Unclassified</span>
                        </SelectItem>
                        <SelectItem value="partner">
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3 w-3 text-blue-500" /> Partner
                          </span>
                        </SelectItem>
                        <SelectItem value="staff">
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3 text-green-500" /> Staff
                          </span>
                        </SelectItem>
                        <SelectItem value="asin">
                          <span className="flex items-center gap-1">
                            <Package className="h-3 w-3 text-orange-500" /> ASIN
                          </span>
                        </SelectItem>
                        <SelectItem value="weekly">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-purple-500" /> Weekly
                          </span>
                        </SelectItem>
                        <SelectItem value="skip">
                          <span className="flex items-center gap-1">
                            <SkipForward className="h-3 w-3 text-gray-500" /> Skip
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>

                    {/* Key toggle button */}
                    {canBeKey && (
                      <Button
                        variant={col.isKey ? "default" : "outline"}
                        size="sm"
                        onClick={() => onKeyToggle(idx)}
                        className={`h-8 text-xs ${col.isKey ? 'bg-amber-500 hover:bg-amber-600' : ''}`}
                      >
                        <Key className="h-3 w-3 mr-1" />
                        {col.isKey ? 'Key' : 'Set Key'}
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
              <strong>Key</strong> = The column that uniquely identifies each record (e.g., "Brand Name" for partners, "Email" for staff, "ASIN Code" for products)
            </p>
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
      </div>
    </motion.div>
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
