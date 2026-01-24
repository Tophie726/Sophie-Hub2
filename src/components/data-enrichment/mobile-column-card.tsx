'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu'
import {
  Key,
  Building2,
  Users,
  Package,
  Calendar,
  Calculator,
  SkipForward,
  Check,
  ChevronDown,
  Tag,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ColumnCategoryOrNull } from '@/types/entities'

const easeOut: [number, number, number, number] = [0.22, 1, 0.36, 1]

type ColumnCategory = ColumnCategoryOrNull

interface FieldTag {
  id: string
  name: string
  color: string
  description?: string | null
}

interface ColumnClassification {
  sourceIndex: number
  sourceColumn: string
  category: ColumnCategory
  targetField: string | null
  authority: 'source_of_truth' | 'reference'
  isKey: boolean
  tagIds?: string[]
}

interface MobileColumnCardProps {
  column: ColumnClassification
  sampleValue: string
  index: number
  isSelected: boolean
  isFocused: boolean
  availableTags: FieldTag[]
  onCategoryChange: (category: ColumnCategory) => void
  onKeyToggle: () => void
  onTagsChange: (tagIds: string[]) => void
  onSelect: (e: React.MouseEvent) => void
}

const categoryConfig = {
  partner: { icon: Building2, label: 'Partner', color: 'blue' },
  staff: { icon: Users, label: 'Staff', color: 'green' },
  asin: { icon: Package, label: 'ASIN', color: 'orange' },
  weekly: { icon: Calendar, label: 'Weekly', color: 'purple' },
  computed: { icon: Calculator, label: 'Computed', color: 'cyan' },
  skip: { icon: SkipForward, label: 'Skip', color: 'gray' },
}

const tagColors: Record<string, string> = {
  emerald: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
  blue: 'bg-blue-500/20 text-blue-600 dark:text-blue-400',
  violet: 'bg-violet-500/20 text-violet-600 dark:text-violet-400',
  amber: 'bg-amber-500/20 text-amber-600 dark:text-amber-400',
  orange: 'bg-orange-500/20 text-orange-600 dark:text-orange-400',
  gray: 'bg-gray-500/20 text-gray-600 dark:text-gray-400',
}

export function MobileColumnCard({
  column,
  sampleValue,
  index,
  isSelected,
  isFocused,
  availableTags,
  onCategoryChange,
  onKeyToggle,
  onTagsChange,
  onSelect,
}: MobileColumnCardProps) {
  const config = column.category ? categoryConfig[column.category] : null
  const Icon = config?.icon

  const handleTagToggle = (tagId: string) => {
    const currentTags = column.tagIds || []
    if (currentTags.includes(tagId)) {
      onTagsChange(currentTags.filter((id) => id !== tagId))
    } else {
      onTagsChange([...currentTags, tagId])
    }
  }

  const showTagPicker = column.category === 'partner' || column.category === 'staff' || column.category === 'asin'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: easeOut, delay: index * 0.03 }}
      className={cn(
        'rounded-xl border p-4 transition-all',
        column.isKey
          ? 'border-amber-500/40 bg-amber-500/5'
          : isSelected
          ? 'border-primary/50 bg-accent'
          : isFocused
          ? 'border-primary ring-2 ring-primary/30'
          : column.category
          ? 'border-border bg-muted/30'
          : 'border-border bg-background'
      )}
    >
      {/* Header: Column name + Key badge */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm truncate">{column.sourceColumn}</span>
            <AnimatePresence mode="wait">
              {column.isKey && column.category && (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                >
                  <Badge
                    className={cn(
                      'text-white text-[10px] px-1.5 py-0.5',
                      column.category === 'partner' && 'bg-blue-500',
                      column.category === 'staff' && 'bg-green-500',
                      column.category === 'asin' && 'bg-orange-500'
                    )}
                  >
                    <Key className="h-2.5 w-2.5 mr-0.5" />
                    Key
                  </Badge>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <p className="text-xs text-muted-foreground truncate mt-1">
            {sampleValue || '(empty)'}
          </p>
        </div>

        {/* Checkbox for selection */}
        <button
          onClick={onSelect}
          className={cn(
            'w-6 h-6 rounded-md border flex items-center justify-center transition-all flex-shrink-0 min-h-[44px] min-w-[44px] -m-2',
            isSelected
              ? 'bg-primary border-primary text-primary-foreground'
              : 'border-border hover:border-primary'
          )}
        >
          {isSelected && <Check className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Category Selector - Full width, touch-friendly */}
      <div className="mb-3">
        <Select
          value={column.category || 'unclassified'}
          onValueChange={(value) => onCategoryChange(value === 'unclassified' ? null : value as ColumnCategory)}
        >
          <SelectTrigger
            className={cn(
              'w-full h-12 text-sm',
              column.category === 'partner' && 'border-blue-500/30 bg-blue-500/5',
              column.category === 'staff' && 'border-green-500/30 bg-green-500/5',
              column.category === 'asin' && 'border-orange-500/30 bg-orange-500/5',
              column.category === 'weekly' && 'border-purple-500/30 bg-purple-500/5',
              column.category === 'computed' && 'border-cyan-500/30 bg-cyan-500/5',
              column.category === 'skip' && 'border-gray-500/30 bg-gray-500/5'
            )}
          >
            <SelectValue placeholder="Select category...">
              {config && Icon ? (
                <span className="flex items-center gap-2">
                  <Icon className={cn(
                    'h-4 w-4',
                    config.color === 'blue' && 'text-blue-500',
                    config.color === 'green' && 'text-green-500',
                    config.color === 'orange' && 'text-orange-500',
                    config.color === 'purple' && 'text-purple-500',
                    config.color === 'cyan' && 'text-cyan-500',
                    config.color === 'gray' && 'text-gray-500'
                  )} />
                  {config.label}
                </span>
              ) : (
                <span className="text-muted-foreground">Select category...</span>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unclassified">
              <span className="text-muted-foreground">Unclassified</span>
            </SelectItem>
            <SelectItem value="partner">
              <span className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-blue-500" />
                Partner
              </span>
            </SelectItem>
            <SelectItem value="staff">
              <span className="flex items-center gap-2">
                <Users className="h-4 w-4 text-green-500" />
                Staff
              </span>
            </SelectItem>
            <SelectItem value="asin">
              <span className="flex items-center gap-2">
                <Package className="h-4 w-4 text-orange-500" />
                ASIN
              </span>
            </SelectItem>
            <SelectItem value="weekly">
              <span className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-purple-500" />
                Weekly
              </span>
            </SelectItem>
            <SelectItem value="computed">
              <span className="flex items-center gap-2">
                <Calculator className="h-4 w-4 text-cyan-500" />
                Computed
              </span>
            </SelectItem>
            <SelectItem value="skip">
              <span className="flex items-center gap-2">
                <SkipForward className="h-4 w-4 text-gray-500" />
                Skip
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Actions Row: Key toggle + Tags */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Key toggle - only for entity types */}
        {(column.category === 'partner' || column.category === 'staff') && (
          <Button
            variant={column.isKey ? 'default' : 'outline'}
            size="sm"
            onClick={onKeyToggle}
            className={cn(
              'h-10 px-3 text-xs gap-1.5',
              column.isKey && 'bg-amber-500 hover:bg-amber-600 text-white'
            )}
          >
            <Key className="h-3.5 w-3.5" />
            {column.isKey ? 'Key' : 'Set as Key'}
          </Button>
        )}

        {/* Tag picker - only for entity columns */}
        {showTagPicker && availableTags.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-10 px-3 text-xs gap-1.5">
                <Tag className="h-3.5 w-3.5" />
                Tags
                {column.tagIds && column.tagIds.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                    {column.tagIds.length}
                  </Badge>
                )}
                <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                Field Tags
              </div>
              <DropdownMenuSeparator />
              {availableTags.map((tag) => (
                <DropdownMenuCheckboxItem
                  key={tag.id}
                  checked={column.tagIds?.includes(tag.id)}
                  onCheckedChange={() => handleTagToggle(tag.id)}
                  className="text-xs"
                >
                  <span className={cn(
                    'px-1.5 py-0.5 rounded text-[10px] font-medium',
                    tagColors[tag.color] || tagColors.gray
                  )}>
                    {tag.name}
                  </span>
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Display selected tags */}
        {column.tagIds && column.tagIds.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            {column.tagIds.map((tagId) => {
              const tag = availableTags.find((t) => t.id === tagId)
              if (!tag) return null
              return (
                <span
                  key={tagId}
                  className={cn(
                    'px-1.5 py-0.5 rounded text-[10px] font-medium',
                    tagColors[tag.color] || tagColors.gray
                  )}
                >
                  {tag.name}
                </span>
              )
            })}
          </div>
        )}
      </div>
    </motion.div>
  )
}
