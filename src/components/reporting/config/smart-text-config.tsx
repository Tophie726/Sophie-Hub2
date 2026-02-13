'use client'

import { useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { SmartTextWidgetConfig } from '@/types/modules'
import {
  SMART_TEXT_TOKENS,
  extractSmartTextVariables,
  interpolateSmartText,
  smartTextDateValues,
  type SmartTextTokenKey,
} from '@/lib/reporting/smart-text'

interface SmartTextConfigProps {
  config: SmartTextWidgetConfig
  title: string
  onConfigChange: (config: SmartTextWidgetConfig) => void
  onTitleChange: (title: string) => void
}

const SAMPLE_VALUES: Partial<Record<SmartTextTokenKey, string>> = {
  'partner.brand_name': 'Acme Naturals',
  'partner.status': 'Active',
  'partner.tier': 'tier_1',
  'partner.type': 'The Sophie PPC Partnership',
  'staff.name': 'Tomas Norton',
  'staff.role': 'PPC Strategist',
  'staff.email': 'tomas@sophiesociety.com',
  'view.name': 'PPC Strategist View',
  ...smartTextDateValues(new Date('2026-02-10')),
}

export function SmartTextConfig({ config, title, onConfigChange, onTitleChange }: SmartTextConfigProps) {
  const template = config.template || ''
  const variables = config.variables || []

  function handleTemplateChange(value: string) {
    onConfigChange({
      ...config,
      template: value,
      variables: extractSmartTextVariables(value),
    })
  }

  function handleInsertToken(token: SmartTextTokenKey) {
    const suffix = template && !template.endsWith(' ') && !template.endsWith('\n') ? ' ' : ''
    const next = `${template}${suffix}{{${token}}}`
    handleTemplateChange(next)
  }

  const preview = useMemo(() => {
    return interpolateSmartText(template, SAMPLE_VALUES)
  }, [template])

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="smart-text-title">Title</Label>
        <Input
          id="smart-text-title"
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
          placeholder="e.g., Partner greeting"
          className="h-9"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="smart-text-template">Template</Label>
        <Textarea
          id="smart-text-template"
          value={template}
          onChange={(event) => handleTemplateChange(event.target.value)}
          placeholder="Hello {{partner.brand_name}}, welcome to Sophie Hub."
          className="min-h-[120px] resize-y"
        />
      </div>

      <div className="space-y-2">
        <Label>Insert Token</Label>
        <div className="flex flex-wrap gap-1.5">
          {SMART_TEXT_TOKENS.map((token) => (
            <Button
              key={token.key}
              type="button"
              size="sm"
              variant="outline"
              className="h-7 px-2 text-[11px]"
              onClick={() => handleInsertToken(token.key)}
            >
              {token.label}
            </Button>
          ))}
        </div>
        {variables.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Detected variables: {variables.join(', ')}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Style</Label>
          <Select
            value={config.style}
            onValueChange={(value) =>
              onConfigChange({ ...config, style: value as SmartTextWidgetConfig['style'] })
            }
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="heading">Heading</SelectItem>
              <SelectItem value="body">Body</SelectItem>
              <SelectItem value="callout">Callout</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Alignment</Label>
          <Select
            value={config.alignment}
            onValueChange={(value) =>
              onConfigChange({ ...config, alignment: value as SmartTextWidgetConfig['alignment'] })
            }
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

      <div className="space-y-2">
        <Label>Live Preview</Label>
        <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm text-muted-foreground whitespace-pre-wrap">
          {preview || 'Template preview will appear here.'}
        </div>
      </div>
    </div>
  )
}
