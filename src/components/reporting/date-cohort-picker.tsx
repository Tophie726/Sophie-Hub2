'use client'

import { motion } from 'framer-motion'
import { Calendar } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { springQuick } from '@/lib/animations'
import type { DateRange, DateRangePreset } from '@/types/modules'

const PRESETS: { label: string; value: DateRangePreset }[] = [
  { label: '7d', value: '7d' },
  { label: '30d', value: '30d' },
  { label: '90d', value: '90d' },
  { label: 'Custom', value: 'custom' },
]

interface DateCohortPickerProps {
  dateRange: DateRange
  onChange: (range: DateRange) => void
}

export function DateCohortPicker({ dateRange, onChange }: DateCohortPickerProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-0.5 rounded-lg bg-muted/60 p-0.5">
        {PRESETS.map((preset) => (
          <button
            key={preset.value}
            onClick={() => {
              if (preset.value === 'custom') {
                const today = new Date().toISOString().split('T')[0]
                const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
                onChange({ preset: 'custom', start: weekAgo, end: today })
              } else {
                onChange({ preset: preset.value })
              }
            }}
            className="relative px-3 py-1.5 text-xs font-medium rounded-md transition-colors"
          >
            {dateRange.preset === preset.value && (
              <motion.div
                layoutId="datePicker"
                className="absolute inset-0 bg-background rounded-md shadow-sm"
                transition={springQuick}
              />
            )}
            <span
              className={`relative z-10 ${
                dateRange.preset === preset.value
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {preset.label}
            </span>
          </button>
        ))}
      </div>

      {dateRange.preset === 'custom' && (
        <div className="flex items-center gap-2">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
          <Input
            type="date"
            value={dateRange.start || ''}
            onChange={(e) => onChange({ ...dateRange, start: e.target.value })}
            className="h-8 w-[130px] text-xs"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <Input
            type="date"
            value={dateRange.end || ''}
            onChange={(e) => onChange({ ...dateRange, end: e.target.value })}
            className="h-8 w-[130px] text-xs"
          />
        </div>
      )}
    </div>
  )
}
