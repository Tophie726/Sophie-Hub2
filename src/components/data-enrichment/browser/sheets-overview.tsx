'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  FileSpreadsheet,
  ArrowLeft,
  ArrowRight,
  Loader2,
  Search,
  Flag,
  Building2,
  Users,
  Package,
  Calendar,
  SkipForward,
  HelpCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

interface CategoryStats {
  partner: number
  staff: number
  asin: number
  weekly: number
  computed: number
  skip: number
  unmapped: number
}

interface DataSourceWithStats {
  id: string
  name: string
  type: string
  spreadsheet_id: string
  spreadsheet_url: string
  created_at: string
  updated_at: string
  tabCount: number
  totalColumns: number
  mappedFieldsCount: number
  categoryStats: CategoryStats
  tabs: {
    id: string
    tab_name: string
    status: 'active' | 'reference' | 'hidden' | 'flagged'
    notes: string | null
  }[]
}

interface SheetsOverviewProps {
  onBack: () => void
  onSelectSource: (sourceId: string) => void
  onAddSource: () => void
}

const easeOut: [number, number, number, number] = [0.22, 1, 0.36, 1]

function SourceCard({
  source,
  onOpen,
}: {
  source: DataSourceWithStats
  onOpen: () => void
}) {
  const stats = source.categoryStats
  const total = source.totalColumns || 1
  const mapped = stats.partner + stats.staff + stats.asin + stats.weekly + stats.computed
  const progress = total > 0 ? Math.round((mapped / total) * 100) : 0

  const flaggedCount = source.tabs.filter(t => t.status === 'flagged').length
  const hiddenCount = source.tabs.filter(t => t.status === 'hidden').length
  const activeTabCount = source.tabs.filter(t => t.status === 'active' || t.status === 'flagged').length

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2, ease: easeOut }}
      className="group relative bg-card border rounded-xl p-5 hover:border-primary/30 hover:shadow-md transition-all cursor-pointer"
      onClick={onOpen}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
            <FileSpreadsheet className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <h3 className="font-semibold text-sm line-clamp-1">{source.name}</h3>
            <p className="text-xs text-muted-foreground">
              {activeTabCount} tab{activeTabCount !== 1 ? 's' : ''} · {source.totalColumns} columns
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="opacity-0 group-hover:opacity-100 transition-opacity"
        >
          Open <ArrowRight className="h-3 w-3 ml-1" />
        </Button>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-muted-foreground">Mapping progress</span>
          <span className={cn(
            "text-xs font-medium",
            progress === 100 ? "text-green-600" : "text-muted-foreground"
          )}>
            {progress}%
          </span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Category Breakdown */}
      <div className="flex flex-wrap gap-2">
        {stats.partner > 0 && (
          <div className="flex items-center gap-1 text-xs bg-blue-500/10 text-blue-700 px-2 py-1 rounded-full">
            <Building2 className="h-3 w-3" />
            {stats.partner}
          </div>
        )}
        {stats.staff > 0 && (
          <div className="flex items-center gap-1 text-xs bg-green-500/10 text-green-700 px-2 py-1 rounded-full">
            <Users className="h-3 w-3" />
            {stats.staff}
          </div>
        )}
        {stats.asin > 0 && (
          <div className="flex items-center gap-1 text-xs bg-orange-500/10 text-orange-700 px-2 py-1 rounded-full">
            <Package className="h-3 w-3" />
            {stats.asin}
          </div>
        )}
        {stats.weekly > 0 && (
          <div className="flex items-center gap-1 text-xs bg-purple-500/10 text-purple-700 px-2 py-1 rounded-full">
            <Calendar className="h-3 w-3" />
            {stats.weekly}
          </div>
        )}
        {stats.skip > 0 && (
          <div className="flex items-center gap-1 text-xs bg-gray-500/10 text-gray-600 px-2 py-1 rounded-full">
            <SkipForward className="h-3 w-3" />
            {stats.skip}
          </div>
        )}
        {stats.unmapped > 0 && (
          <div className="flex items-center gap-1 text-xs bg-amber-500/10 text-amber-700 px-2 py-1 rounded-full">
            <HelpCircle className="h-3 w-3" />
            {stats.unmapped} unmapped
          </div>
        )}
      </div>

      {/* Badges for hidden/flagged */}
      {(flaggedCount > 0 || hiddenCount > 0) && (
        <div className="flex gap-2 mt-3 pt-3 border-t border-border/50">
          {flaggedCount > 0 && (
            <span className="text-xs text-amber-600 flex items-center gap-1">
              <Flag className="h-3 w-3" />
              {flaggedCount} flagged
            </span>
          )}
          {hiddenCount > 0 && (
            <span className="text-xs text-muted-foreground">
              {hiddenCount} hidden
            </span>
          )}
        </div>
      )}
    </motion.div>
  )
}

export function SheetsOverview({ onBack, onSelectSource, onAddSource }: SheetsOverviewProps) {
  const [sources, setSources] = useState<DataSourceWithStats[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchSources() {
      try {
        const response = await fetch('/api/data-sources')
        if (response.ok) {
          const json = await response.json()
          // Handle both old format and new standardized format
          setSources(json.data?.sources || json.sources || [])
        }
      } catch (error) {
        console.error('Error fetching sources:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchSources()
  }, [])

  // Calculate totals across all sources
  const totalFlagged = sources.reduce(
    (sum, s) => sum + s.tabs.filter(t => t.status === 'flagged').length,
    0
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Empty state
  if (sources.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: easeOut }}
        className="space-y-6 p-8"
      >
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

        <div className="border-2 border-dashed rounded-xl p-16 text-center">
          <div className="max-w-md mx-auto space-y-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-green-500/10 mx-auto">
              <Search className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold">No sheets connected yet</h3>
            <p className="text-sm text-muted-foreground">
              Search for a Google Sheet to connect and start mapping columns to your database.
            </p>
            <Button onClick={onAddSource} className="gap-2">
              <Search className="h-4 w-4" />
              Connect a Google Sheet
            </Button>
          </div>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: easeOut }}
      className="space-y-6 p-8"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-xl font-semibold">Google Sheets</h2>
            <p className="text-sm text-muted-foreground">
              {sources.length} source{sources.length !== 1 ? 's' : ''} connected
            </p>
          </div>
        </div>
        <Button onClick={onAddSource} variant="outline" className="gap-2">
          <Search className="h-4 w-4" />
          Connect Sheet
        </Button>
      </div>

      {/* Flagged Items Alert */}
      {totalFlagged > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20"
        >
          <Flag className="h-5 w-5 text-amber-600" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800">
              {totalFlagged} tab{totalFlagged !== 1 ? 's' : ''} flagged for review
            </p>
            <p className="text-xs text-amber-600">
              Click into a source to see flagged tabs and their notes
            </p>
          </div>
        </motion.div>
      )}

      {/* Source Cards Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sources.map((source, index) => (
          <motion.div
            key={source.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05, duration: 0.3, ease: easeOut }}
          >
            <SourceCard
              source={source}
              onOpen={() => onSelectSource(source.id)}
            />
          </motion.div>
        ))}

        {/* Add New Source Card */}
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: sources.length * 0.05, duration: 0.3, ease: easeOut }}
          onClick={onAddSource}
          className="flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors min-h-[200px]"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Search className="h-6 w-6" />
          </div>
          <span className="text-sm font-medium">Connect Another Sheet</span>
        </motion.button>
      </div>
    </motion.div>
  )
}
