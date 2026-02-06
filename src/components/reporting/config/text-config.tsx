'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { TextWidgetConfig } from '@/types/modules'

interface TextConfigProps {
  config: TextWidgetConfig
  title: string
  onConfigChange: (config: TextWidgetConfig) => void
  onTitleChange: (title: string) => void
}

export function TextConfig({ config, title, onConfigChange, onTitleChange }: TextConfigProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="text-title">Title</Label>
        <Input
          id="text-title"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="e.g., Notes"
          className="h-9"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="text-content">Content</Label>
        <Textarea
          id="text-content"
          value={config.content}
          onChange={(e) => onConfigChange({ ...config, content: e.target.value })}
          placeholder="Enter text content for this widget..."
          className="min-h-[120px] resize-y"
        />
      </div>

      <div className="space-y-2">
        <Label>Alignment</Label>
        <Select
          value={config.alignment}
          onValueChange={(val) => onConfigChange({ ...config, alignment: val as 'left' | 'center' | 'right' })}
        >
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="left">Left</SelectItem>
            <SelectItem value="center">Center</SelectItem>
            <SelectItem value="right">Right</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
