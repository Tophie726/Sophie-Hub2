'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
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
} from 'lucide-react'
import { easeOut } from '@/lib/animations'
import { type ColumnCategory } from '@/types/entities'

// =============================================================================
// Types
// =============================================================================

export interface AISuggestion {
  category: ColumnCategory
  target_field: string | null
  confidence: number
  reasoning: string
  is_key: boolean
  authority: 'source_of_truth' | 'reference'
}

interface AISuggestionButtonProps {
  columnName: string
  sampleValues: string[]
  siblingColumns: string[]
  position: number
  onApply: (suggestion: AISuggestion) => void
  disabled?: boolean
  tabName?: string
  sourceName?: string
}

// =============================================================================
// Helpers
// =============================================================================

const getCategoryIcon = (category: ColumnCategory) => {
  switch (category) {
    case 'partner':
      return <Building2 className="h-4 w-4 text-blue-500" />
    case 'staff':
      return <Users className="h-4 w-4 text-green-500" />
    case 'asin':
      return <Package className="h-4 w-4 text-orange-500" />
    case 'weekly':
      return <Calendar className="h-4 w-4 text-purple-500" />
    case 'computed':
      return <Calculator className="h-4 w-4 text-cyan-500" />
    case 'skip':
      return <SkipForward className="h-4 w-4 text-gray-500" />
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

const getConfidenceColor = (confidence: number) => {
  if (confidence >= 0.8) return 'text-green-600'
  if (confidence >= 0.5) return 'text-amber-600'
  return 'text-red-600'
}

const getConfidenceLabel = (confidence: number) => {
  if (confidence >= 0.8) return 'High'
  if (confidence >= 0.5) return 'Medium'
  return 'Low'
}

// =============================================================================
// Component
// =============================================================================

export function AISuggestionButton({
  columnName,
  sampleValues,
  siblingColumns,
  position,
  onApply,
  disabled = false,
  tabName,
  sourceName,
}: AISuggestionButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [suggestion, setSuggestion] = useState<AISuggestion | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchSuggestion = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/ai/suggest-mapping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          column_name: columnName,
          sample_values: sampleValues,
          sibling_columns: siblingColumns,
          position,
          tab_name: tabName,
          source_name: sourceName,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error?.message || 'Failed to get AI suggestion')
      }

      const data = await response.json()
      setSuggestion(data.data.suggestion)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get suggestion')
    } finally {
      setIsLoading(false)
    }
  }

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (open && !suggestion && !isLoading) {
      fetchSuggestion()
    }
  }

  const handleApply = () => {
    if (suggestion) {
      onApply(suggestion)
      setIsOpen(false)
      setSuggestion(null)
    }
  }

  const handleDismiss = () => {
    setIsOpen(false)
    setSuggestion(null)
  }

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-purple-500 transition-colors"
          disabled={disabled}
          title="Get AI suggestion"
        >
          {isLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[300px] p-0"
        align="end"
        side="left"
        sideOffset={8}
      >
        <AnimatePresence mode="wait">
          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-4 flex flex-col items-center gap-3"
            >
              <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
              <p className="text-sm text-muted-foreground">Analyzing column...</p>
            </motion.div>
          )}

          {error && !isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-4"
            >
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-destructive">Error</p>
                  <p className="text-xs text-muted-foreground mt-1">{error}</p>
                </div>
              </div>
              <div className="flex justify-end mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setError(null)
                    fetchSuggestion()
                  }}
                >
                  Try Again
                </Button>
              </div>
            </motion.div>
          )}

          {suggestion && !isLoading && !error && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15, ease: easeOut }}
            >
              {/* Header */}
              <div className="px-4 py-3 border-b border-border/50 bg-purple-500/5">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-500" />
                  <span className="text-sm font-medium">AI Suggestion</span>
                </div>
              </div>

              {/* Content */}
              <div className="p-4 space-y-4">
                {/* Category + Target */}
                <div className="flex items-center gap-2">
                  {getCategoryIcon(suggestion.category)}
                  <Badge
                    variant="outline"
                    className={getCategoryColor(suggestion.category)}
                  >
                    {suggestion.category.charAt(0).toUpperCase() +
                      suggestion.category.slice(1)}
                  </Badge>
                  {suggestion.target_field && (
                    <>
                      <span className="text-muted-foreground">→</span>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                        {suggestion.target_field}
                      </code>
                    </>
                  )}
                </div>

                {/* Key indicator */}
                {suggestion.is_key && (
                  <div className="flex items-center gap-2 text-xs">
                    <Key className="h-3.5 w-3.5 text-amber-500" />
                    <span className="text-amber-600 font-medium">
                      Recommended as key field
                    </span>
                  </div>
                )}

                {/* Authority */}
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Authority:</span>
                  <Badge variant="outline" className="text-[10px] h-5">
                    {suggestion.authority === 'source_of_truth'
                      ? 'Source of Truth'
                      : 'Reference'}
                  </Badge>
                </div>

                {/* Confidence */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Confidence:</span>
                  <span
                    className={`text-sm font-medium tabular-nums ${getConfidenceColor(
                      suggestion.confidence
                    )}`}
                  >
                    {Math.round(suggestion.confidence * 100)}%
                  </span>
                  <span
                    className={`text-xs ${getConfidenceColor(suggestion.confidence)}`}
                  >
                    ({getConfidenceLabel(suggestion.confidence)})
                  </span>
                </div>

                {/* Reasoning */}
                <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
                  {suggestion.reasoning}
                </div>
              </div>

              {/* Actions */}
              <div className="px-4 py-3 border-t border-border/50 flex items-center justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDismiss}
                  className="text-xs h-8"
                >
                  <X className="h-3 w-3 mr-1" />
                  Dismiss
                </Button>
                <Button
                  size="sm"
                  onClick={handleApply}
                  className="text-xs h-8 bg-purple-500 hover:bg-purple-600"
                >
                  <Check className="h-3 w-3 mr-1" />
                  Apply
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </PopoverContent>
    </Popover>
  )
}
