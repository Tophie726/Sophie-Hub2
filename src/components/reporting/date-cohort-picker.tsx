'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Calendar, Check, ChevronDown } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { easeOut, duration, springQuick } from '@/lib/animations'
import type { DateRange, DateRangePreset, ComparisonPeriod } from '@/types/modules'

// =============================================================================
// Preset definitions grouped for the popover menu
// =============================================================================

interface PresetDef {
  value: DateRangePreset
  label: string
}

const QUICK_RANGES: PresetDef[] = [
  { value: '7d', label: 'Last 7 days' },
  { value: '14d', label: 'Last 14 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '60d', label: 'Last 60 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: '365d', label: 'Last 365 days' },
]

const RELATIVE_PERIODS: PresetDef[] = [
  { value: 'mtd', label: 'Month to date' },
  { value: 'last_month', label: 'Last month' },
  { value: 'ytd', label: 'Year to date' },
]

const COMPARISON_OPTIONS: { value: ComparisonPeriod; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'previous_period', label: 'Previous period' },
  { value: 'same_period_last_year', label: 'Same period last year' },
]

const ALL_PRESETS: PresetDef[] = [...QUICK_RANGES, ...RELATIVE_PERIODS, { value: 'custom', label: 'Custom range' }]

function getPresetLabel(preset: DateRangePreset): string {
  return ALL_PRESETS.find((p) => p.value === preset)?.label ?? 'Custom range'
}

// =============================================================================
// Component
// =============================================================================

interface DateCohortPickerProps {
  dateRange: DateRange
  onChange: (range: DateRange) => void
}

export function DateCohortPicker({ dateRange, onChange }: DateCohortPickerProps) {
  const [open, setOpen] = useState(false)
  const [showCustom, setShowCustom] = useState(dateRange.preset === 'custom')
  const [customStart, setCustomStart] = useState(dateRange.start ?? '')
  const [customEnd, setCustomEnd] = useState(dateRange.end ?? '')

  function selectPreset(preset: DateRangePreset) {
    if (preset === 'custom') {
      setShowCustom(true)
      // Pre-fill with last 7 days if empty
      if (!customStart || !customEnd) {
        const today = new Date().toISOString().split('T')[0]
        const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
        setCustomStart(weekAgo)
        setCustomEnd(today)
      }
      return
    }
    setShowCustom(false)
    onChange({ ...dateRange, preset, start: undefined, end: undefined })
    setOpen(false)
  }

  function applyCustomRange() {
    if (customStart && customEnd) {
      onChange({ ...dateRange, preset: 'custom', start: customStart, end: customEnd })
      setOpen(false)
    }
  }

  function setComparison(comparison: ComparisonPeriod) {
    onChange({ ...dateRange, comparison: comparison === 'none' ? undefined : comparison })
  }

  // Build the trigger label
  const triggerLabel = dateRange.preset === 'custom' && dateRange.start && dateRange.end
    ? `${dateRange.start} - ${dateRange.end}`
    : getPresetLabel(dateRange.preset)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="inline-flex items-center gap-2 rounded-lg bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted/50 active:scale-[0.97]"
          style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)' }}
        >
          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
          <span>{triggerLabel}</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-60 p-0"
      >
        {/* ---- Preset groups ---- */}
        <div className="p-1.5">
          {/* Quick ranges */}
          <PresetGroup
            items={QUICK_RANGES}
            active={dateRange.preset}
            onSelect={selectPreset}
          />

          {/* Divider */}
          <div className="mx-2 my-1 h-px bg-border/50" />

          {/* Relative periods */}
          <PresetGroup
            items={RELATIVE_PERIODS}
            active={dateRange.preset}
            onSelect={selectPreset}
          />

          {/* Divider */}
          <div className="mx-2 my-1 h-px bg-border/50" />

          {/* Custom range trigger */}
          <button
            onClick={() => selectPreset('custom')}
            className="relative flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-muted/60"
          >
            <span className="w-4 flex-shrink-0">
              {dateRange.preset === 'custom' && (
                <motion.span initial={false} animate={{ scale: 1 }} transition={springQuick}>
                  <Check className="h-3.5 w-3.5 text-primary" />
                </motion.span>
              )}
            </span>
            <span className={dateRange.preset === 'custom' ? 'font-medium text-foreground' : 'text-foreground'}>
              Custom range
            </span>
          </button>
        </div>

        {/* ---- Custom date inputs (inline expand) ---- */}
        <AnimatePresence initial={false}>
          {showCustom && (
            <motion.div
              key="custom-range"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: duration.ui, ease: easeOut }}
              className="overflow-hidden"
            >
              <div className="border-t border-border/50 px-3 pb-3 pt-2.5">
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="h-7 flex-1 text-base md:text-xs"
                  />
                  <span className="text-xs text-muted-foreground">to</span>
                  <Input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="h-7 flex-1 text-base md:text-xs"
                  />
                </div>
                <button
                  onClick={applyCustomRange}
                  disabled={!customStart || !customEnd}
                  className="mt-2 w-full rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none"
                >
                  Apply
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ---- Comparison ---- */}
        <div className="border-t border-border/50 p-1.5">
          <p className="px-2 pb-1 pt-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
            Compare to
          </p>
          {COMPARISON_OPTIONS.map((opt) => {
            const isActive = (dateRange.comparison ?? 'none') === opt.value
            return (
              <button
                key={opt.value}
                onClick={() => {
                  setComparison(opt.value)
                }}
                className="relative flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-muted/60"
              >
                <span className="w-4 flex-shrink-0">
                  {isActive && (
                    <motion.span initial={false} animate={{ scale: 1 }} transition={springQuick}>
                      <Check className="h-3.5 w-3.5 text-primary" />
                    </motion.span>
                  )}
                </span>
                <span className={isActive ? 'font-medium text-foreground' : 'text-foreground'}>
                  {opt.label}
                </span>
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

// =============================================================================
// Preset group sub-component
// =============================================================================

function PresetGroup({
  items,
  active,
  onSelect,
}: {
  items: PresetDef[]
  active: DateRangePreset
  onSelect: (preset: DateRangePreset) => void
}) {
  return (
    <div>
      {items.map((item) => (
        <button
          key={item.value}
          onClick={() => onSelect(item.value)}
          className="relative flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-muted/60"
        >
          <span className="w-4 flex-shrink-0">
            {active === item.value && (
              <motion.span initial={false} animate={{ scale: 1 }} transition={springQuick}>
                <Check className="h-3.5 w-3.5 text-primary" />
              </motion.span>
            )}
          </span>
          <span className={active === item.value ? 'font-medium text-foreground' : 'text-foreground'}>
            {item.label}
          </span>
        </button>
      ))}
    </div>
  )
}
