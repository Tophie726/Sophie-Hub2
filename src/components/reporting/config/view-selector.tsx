'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { VIEW_LABELS } from '@/types/modules'

interface ViewSelectorProps {
  value: string
  onChange: (value: string) => void
}

const VIEW_OPTIONS = Object.entries(VIEW_LABELS).map(([value, label]) => ({
  value,
  label,
}))

export function ViewSelector({ value, onChange }: ViewSelectorProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="view-select">Data View</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id="view-select" className="h-9">
          <SelectValue placeholder="Select a data view" />
        </SelectTrigger>
        <SelectContent>
          {VIEW_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
