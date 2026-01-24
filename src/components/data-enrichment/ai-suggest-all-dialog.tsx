'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sparkles,
  Loader2,
  Check,
  X,
  Building2,
  Users,
  Package,
  Calendar,
  Calculator,
  SkipForward,
  Key,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
} from 'lucide-react'
import { easeOut } from '@/lib/animations'
import { type ColumnCategory } from '@/types/entities'

// =============================================================================
// Types
// =============================================================================

export interface BulkSuggestion {
  position: number
  category: ColumnCategory
  target_field: string | null
  confidence: number
  reasoning: string
  is_key: boolean
  authority: 'source_of_truth' | 'reference'
}

export interface BulkSuggestionStats {
  total: number
  high_confidence: number
  medium_confidence: number
  low_confidence: number
}

interface ColumnInfo {
  name: string
  sample_values: string[]
  position: number
}

interface AISuggestAllDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  columns: ColumnInfo[]
  tabName: string
  onApplyAll: (suggestions: BulkSuggestion[]) => void
  onApplySelected: (suggestions: BulkSuggestion[]) => void
}

// =============================================================================
// Helpers
// =============================================================================

const getCategoryIcon = (category: ColumnCategory) => {
  switch (category) {
    case 'partner':
      return <Building2 className="h-3.5 w-3.5 text-blue-500" />
    case 'staff':
      return <Users className="h-3.5 w-3.5 text-green-500" />
    case 'asin':
      return <Package className="h-3.5 w-3.5 text-orange-500" />
    case 'weekly':
      return <Calendar className="h-3.5 w-3.5 text-purple-500" />
    case 'computed':
      return <Calculator className="h-3.5 w-3.5 text-cyan-500" />
    case 'skip':
      return <SkipForward className="h-3.5 w-3.5 text-gray-500" />
    default:
      return null
  }
}

const getCategoryColor = (category: ColumnCategory) => {
  switch (category) {
    case 'partner':
      return 'bg-blue-500/10 text-blue-600 border-blue-500/30'
    case 'staff':
      return 'bg-green-500/10 text-green-600 border-green-500/30'
    case 'asin':
      return 'bg-orange-500/10 text-orange-600 border-orange-500/30'
    case 'weekly':
      return 'bg-purple-500/10 text-purple-600 border-purple-500/30'
    case 'computed':
      return 'bg-cyan-500/10 text-cyan-600 border-cyan-500/30'
    case 'skip':
      return 'bg-gray-500/10 text-gray-600 border-gray-500/30'
    default:
      return ''
  }
}

const getConfidenceIcon = (confidence: number) => {
  if (confidence >= 0.8) return <CheckCircle2 className="h-4 w-4 text-green-500" />
  if (confidence >= 0.5) return <AlertTriangle className="h-4 w-4 text-amber-500" />
  return <HelpCircle className="h-4 w-4 text-red-500" />
}

const getConfidenceClass = (confidence: number) => {
  if (confidence >= 0.8) return 'border-green-500/30 bg-green-500/5'
  if (confidence >= 0.5) return 'border-amber-500/30 bg-amber-500/5'
  return 'border-red-500/30 bg-red-500/5'
}

// =============================================================================
// Component
// =============================================================================

export function AISuggestAllDialog({
  open,
  onOpenChange,
  columns,
  tabName,
  onApplyAll,
  onApplySelected,
}: AISuggestAllDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [suggestions, setSuggestions] = useState<BulkSuggestion[]>([])
  const [stats, setStats] = useState<BulkSuggestionStats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedPositions, setSelectedPositions] = useState<Set<number>>(new Set())

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setProgress(0)
      setSuggestions([])
      setStats(null)
      setError(null)
      setSelectedPositions(new Set())
      fetchSuggestions()
    }
  }, [open])

  const fetchSuggestions = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/ai/suggest-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          columns: columns.map((c) => ({
            name: c.name,
            sample_values: c.sample_values,
            position: c.position,
          })),
          tab_name: tabName,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error?.message || 'Failed to get AI suggestions')
      }

      const data = await response.json()
      setSuggestions(data.data.suggestions)
      setStats(data.data.stats)
      // Select high confidence suggestions by default
      const highConfidence = data.data.suggestions
        .filter((s: BulkSuggestion) => s.confidence >= 0.8)
        .map((s: BulkSuggestion) => s.position)
      setSelectedPositions(new Set(highConfidence))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get suggestions')
    } finally {
      setIsLoading(false)
      setProgress(100)
    }
  }

  const toggleSelection = (position: number) => {
    setSelectedPositions((prev) => {
      const next = new Set(prev)
      if (next.has(position)) {
        next.delete(position)
      } else {
        next.add(position)
      }
      return next
    })
  }

  const selectAllHighConfidence = () => {
    const highConfidence = suggestions
      .filter((s) => s.confidence >= 0.8)
      .map((s) => s.position)
    setSelectedPositions(new Set(highConfidence))
  }

  const selectAll = () => {
    setSelectedPositions(new Set(suggestions.map((s) => s.position)))
  }

  const selectNone = () => {
    setSelectedPositions(new Set())
  }

  const handleApplySelected = () => {
    const selected = suggestions.filter((s) => selectedPositions.has(s.position))
    onApplySelected(selected)
    onOpenChange(false)
  }

  const handleApplyAll = () => {
    onApplyAll(suggestions)
    onOpenChange(false)
  }

  const getColumnName = (position: number) => {
    return columns.find((c) => c.position === position)?.name || `Column ${position}`
  }

  const highConfidenceSuggestions = suggestions.filter((s) => s.confidence >= 0.8)
  const mediumConfidenceSuggestions = suggestions.filter(
    (s) => s.confidence >= 0.5 && s.confidence < 0.8
  )
  const lowConfidenceSuggestions = suggestions.filter((s) => s.confidence < 0.5)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            AI Suggestions for {tabName}
          </DialogTitle>
          <DialogDescription>
            {isLoading
              ? `Analyzing ${columns.length} columns...`
              : stats
              ? `${stats.total} suggestions ready for review`
              : 'Getting AI suggestions for all columns'}
          </DialogDescription>
        </DialogHeader>

        {/* Progress or content */}
        <div className="flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            {isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-12 gap-4"
              >
                <Loader2 className="h-10 w-10 animate-spin text-purple-500" />
                <div className="w-full max-w-xs">
                  <Progress value={progress} className="h-2" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Analyzing columns with Claude...
                </p>
              </motion.div>
            )}

            {error && !isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-12 gap-4"
              >
                <AlertCircle className="h-10 w-10 text-destructive" />
                <p className="text-sm text-destructive">{error}</p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setError(null)
                    fetchSuggestions()
                  }}
                >
                  Try Again
                </Button>
              </motion.div>
            )}

            {!isLoading && !error && stats && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                {/* Stats bar */}
                <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg text-sm">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="tabular-nums">{stats.high_confidence}</span>
                    <span className="text-muted-foreground">high</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <span className="tabular-nums">{stats.medium_confidence}</span>
                    <span className="text-muted-foreground">medium</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <HelpCircle className="h-4 w-4 text-red-500" />
                    <span className="tabular-nums">{stats.low_confidence}</span>
                    <span className="text-muted-foreground">low</span>
                  </div>
                  <div className="ml-auto flex items-center gap-2 text-xs">
                    <button
                      onClick={selectAllHighConfidence}
                      className="text-green-600 hover:underline"
                    >
                      Select high
                    </button>
                    <span className="text-muted-foreground">|</span>
                    <button
                      onClick={selectAll}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      All
                    </button>
                    <span className="text-muted-foreground">|</span>
                    <button
                      onClick={selectNone}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      None
                    </button>
                  </div>
                </div>

                {/* Suggestions list */}
                <ScrollArea className="h-[350px] pr-3">
                  <div className="space-y-4">
                    {/* High confidence */}
                    {highConfidenceSuggestions.length > 0 && (
                      <div>
                        <h4 className="text-xs font-medium text-green-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          High Confidence ({highConfidenceSuggestions.length})
                        </h4>
                        <div className="space-y-1.5">
                          {highConfidenceSuggestions.map((suggestion) => (
                            <SuggestionRow
                              key={suggestion.position}
                              suggestion={suggestion}
                              columnName={getColumnName(suggestion.position)}
                              selected={selectedPositions.has(suggestion.position)}
                              onToggle={() => toggleSelection(suggestion.position)}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Medium confidence */}
                    {mediumConfidenceSuggestions.length > 0 && (
                      <div>
                        <h4 className="text-xs font-medium text-amber-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Medium Confidence ({mediumConfidenceSuggestions.length})
                        </h4>
                        <div className="space-y-1.5">
                          {mediumConfidenceSuggestions.map((suggestion) => (
                            <SuggestionRow
                              key={suggestion.position}
                              suggestion={suggestion}
                              columnName={getColumnName(suggestion.position)}
                              selected={selectedPositions.has(suggestion.position)}
                              onToggle={() => toggleSelection(suggestion.position)}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Low confidence */}
                    {lowConfidenceSuggestions.length > 0 && (
                      <div>
                        <h4 className="text-xs font-medium text-red-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <HelpCircle className="h-3.5 w-3.5" />
                          Low Confidence ({lowConfidenceSuggestions.length})
                        </h4>
                        <div className="space-y-1.5">
                          {lowConfidenceSuggestions.map((suggestion) => (
                            <SuggestionRow
                              key={suggestion.position}
                              suggestion={suggestion}
                              columnName={getColumnName(suggestion.position)}
                              selected={selectedPositions.has(suggestion.position)}
                              onToggle={() => toggleSelection(suggestion.position)}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        {!isLoading && !error && stats && (
          <DialogFooter className="mt-4 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={handleApplyAll}
              disabled={suggestions.length === 0}
            >
              Apply All ({suggestions.length})
            </Button>
            <Button
              onClick={handleApplySelected}
              disabled={selectedPositions.size === 0}
              className="bg-purple-500 hover:bg-purple-600"
            >
              <Check className="h-4 w-4 mr-2" />
              Apply Selected ({selectedPositions.size})
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}

// =============================================================================
// Suggestion Row Component
// =============================================================================

function SuggestionRow({
  suggestion,
  columnName,
  selected,
  onToggle,
}: {
  suggestion: BulkSuggestion
  columnName: string
  selected: boolean
  onToggle: () => void
}) {
  return (
    <button
      onClick={onToggle}
      className={`w-full flex items-center gap-3 p-2.5 rounded-lg border text-left transition-all ${
        selected
          ? 'border-purple-500/50 bg-purple-500/5'
          : getConfidenceClass(suggestion.confidence)
      }`}
    >
      {/* Checkbox */}
      <div
        className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center ${
          selected
            ? 'bg-purple-500 border-purple-500 text-white'
            : 'border-border'
        }`}
      >
        {selected && <Check className="h-3 w-3" />}
      </div>

      {/* Confidence icon */}
      {getConfidenceIcon(suggestion.confidence)}

      {/* Column name */}
      <span className="text-sm font-medium truncate min-w-[100px] max-w-[150px]">
        {columnName}
      </span>

      {/* Arrow */}
      <span className="text-muted-foreground">→</span>

      {/* Category + target */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {getCategoryIcon(suggestion.category)}
        <Badge
          variant="outline"
          className={`text-[10px] ${getCategoryColor(suggestion.category)}`}
        >
          {suggestion.category}
        </Badge>
        {suggestion.target_field && (
          <code className="text-[10px] bg-muted px-1 py-0.5 rounded">
            {suggestion.target_field}
          </code>
        )}
      </div>

      {/* Key indicator */}
      {suggestion.is_key && (
        <Key className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
      )}

      {/* Confidence */}
      <span className="ml-auto text-xs tabular-nums text-muted-foreground">
        {Math.round(suggestion.confidence * 100)}%
      </span>
    </button>
  )
}
