'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Hash,
  BarChart3,
  Table2,
  FileText,
  Sparkles,
  ArrowLeft,
  ChevronDown,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { WIDGET_PRESETS, getPresetsByTemplate, TEMPLATE_LABELS } from '@/lib/bigquery/widget-presets'
import type { PresetTemplate } from '@/lib/bigquery/widget-presets'
import { MetricConfig } from '@/components/reporting/config/metric-config'
import { ChartConfig } from '@/components/reporting/config/chart-config'
import { TableConfig } from '@/components/reporting/config/table-config'
import { TextConfig } from '@/components/reporting/config/text-config'
import { AiTextConfig } from '@/components/reporting/config/ai-text-config'
import { SmartTextConfig } from '@/components/reporting/config/smart-text-config'
import { easeOut } from '@/lib/animations'
import type {
  DashboardWidget,
  WidgetType,
  WidgetConfig,
  MetricWidgetConfig,
  ChartWidgetConfig,
  TableWidgetConfig,
  TextWidgetConfig,
  AiTextWidgetConfig,
  SmartTextWidgetConfig,
} from '@/types/modules'

export interface ConfigChildProps {
  titleTouched: boolean
  onTitleTouched: () => void
}

interface WidgetConfigDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  widget: DashboardWidget | null
  onSave: (
    widgetType: WidgetType,
    title: string,
    config: WidgetConfig,
    colSpan: number,
    rowSpan: number
  ) => void
}

const WIDGET_TYPES: {
  type: WidgetType
  label: string
  description: string
  icon: React.ReactNode
  defaultColSpan: number
  defaultRowSpan: number
}[] = [
  {
    type: 'metric',
    label: 'Metric',
    description: 'Single number with optional comparison',
    icon: <Hash className="h-5 w-5" />,
    defaultColSpan: 2,
    defaultRowSpan: 1,
  },
  {
    type: 'chart',
    label: 'Chart',
    description: 'Line, bar, or area visualization',
    icon: <BarChart3 className="h-5 w-5" />,
    defaultColSpan: 4,
    defaultRowSpan: 2,
  },
  {
    type: 'table',
    label: 'Table',
    description: 'Data table with sorting',
    icon: <Table2 className="h-5 w-5" />,
    defaultColSpan: 8,
    defaultRowSpan: 2,
  },
  {
    type: 'text',
    label: 'Text',
    description: 'Static text or notes',
    icon: <FileText className="h-5 w-5" />,
    defaultColSpan: 4,
    defaultRowSpan: 1,
  },
  {
    type: 'ai_text',
    label: 'AI Summary',
    description: 'AI-generated insights from data',
    icon: <Sparkles className="h-5 w-5" />,
    defaultColSpan: 4,
    defaultRowSpan: 1,
  },
  {
    type: 'smart_text',
    label: 'Smart Text',
    description: 'Dynamic text with viewer variables',
    icon: <FileText className="h-5 w-5" />,
    defaultColSpan: 4,
    defaultRowSpan: 1,
  },
]

const DEFAULT_CONFIGS: Record<WidgetType, WidgetConfig> = {
  metric: { view: 'sales', metric: '', aggregation: 'sum', format: 'currency' } as MetricWidgetConfig,
  chart: { view: 'sales', chart_type: 'line', x_axis: 'date', y_axis: [], aggregation: 'sum', format: 'currency' } as ChartWidgetConfig,
  table: { view: 'sales', columns: [], sort_by: '', sort_direction: 'desc', limit: 20 } as TableWidgetConfig,
  text: { content: '', alignment: 'left' } as TextWidgetConfig,
  ai_text: { prompt: '', view: 'sales', metrics: [], format: 'summary' } as AiTextWidgetConfig,
  smart_text: { template: '', variables: [], alignment: 'left', style: 'body' } as SmartTextWidgetConfig,
}

const COL_SPAN_OPTIONS = [
  { value: '2', label: '2 cols (25%)' },
  { value: '4', label: '4 cols (50%)' },
  { value: '6', label: '6 cols (75%)' },
  { value: '8', label: '8 cols (full width)' },
]

const ROW_SPAN_OPTIONS = [
  { value: '1', label: '1 row' },
  { value: '2', label: '2 rows' },
  { value: '3', label: '3 rows' },
]

export function WidgetConfigDialog({
  open,
  onOpenChange,
  widget,
  onSave,
}: WidgetConfigDialogProps) {
  const isEditing = widget !== null
  const [step, setStep] = useState<'type' | 'config'>(isEditing ? 'config' : 'type')
  const [selectedType, setSelectedType] = useState<WidgetType>(widget?.widget_type || 'metric')
  const [title, setTitle] = useState(widget?.title || '')
  const [config, setConfig] = useState<WidgetConfig>(widget?.config || DEFAULT_CONFIGS.metric)
  const [colSpan, setColSpan] = useState(widget?.col_span || 1)
  const [rowSpan, setRowSpan] = useState(widget?.row_span || 1)
  const [titleTouched, setTitleTouched] = useState(false)
  const [expandedTemplates, setExpandedTemplates] = useState<Set<PresetTemplate>>(new Set<PresetTemplate>(['executive']))

  function toggleTemplate(template: PresetTemplate) {
    setExpandedTemplates((prev) => {
      const next = new Set<PresetTemplate>(prev)
      if (next.has(template)) {
        next.delete(template)
      } else {
        next.add(template)
      }
      return next
    })
  }

  function handlePresetSelect(preset: typeof WIDGET_PRESETS[number]) {
    setSelectedType(preset.widget_type)
    setConfig(preset.config)
    setColSpan(preset.col_span)
    setRowSpan(preset.row_span)
    setTitle(preset.title)
    setTitleTouched(false)
    setStep('config')
  }

  // Reset state when dialog opens/closes or widget changes
  useEffect(() => {
    if (open) {
      if (widget) {
        setStep('config')
        setSelectedType(widget.widget_type)
        setTitle(widget.title)
        setConfig(widget.config)
        setColSpan(widget.col_span)
        setRowSpan(widget.row_span)
        setTitleTouched(true) // Existing widget = user has set a title
      } else {
        setStep('type')
        setSelectedType('metric')
        setTitle('')
        setConfig(DEFAULT_CONFIGS.metric)
        setColSpan(1)
        setRowSpan(1)
        setTitleTouched(false)
      }
    }
  }, [open, widget])

  function handleTypeSelect(type: WidgetType) {
    setSelectedType(type)
    setConfig(DEFAULT_CONFIGS[type])
    const typeInfo = WIDGET_TYPES.find((t) => t.type === type)
    setColSpan(typeInfo?.defaultColSpan || 1)
    setRowSpan(typeInfo?.defaultRowSpan || 1)
    setTitleTouched(false)
    setTitle('')
    setStep('config')
  }

  function handleSave() {
    if (!title.trim()) return
    onSave(selectedType, title.trim(), config, colSpan, rowSpan)
  }

  const canSave = title.trim().length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] md:max-w-[560px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === 'config' && !isEditing && (
              <button
                onClick={() => setStep('type')}
                className="p-1 rounded-md hover:bg-muted transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            {isEditing ? 'Edit Widget' : step === 'type' ? 'Add Widget' : `Configure ${WIDGET_TYPES.find((t) => t.type === selectedType)?.label}`}
          </DialogTitle>
          <DialogDescription>
            {step === 'type'
              ? 'Choose the type of widget to add to your dashboard.'
              : 'Configure how this widget displays data.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'type' ? (
          <div className="space-y-5 py-2">
            {/* Presets section */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-3">Start from Preset</p>
              <div className="space-y-2">
                {(['executive', 'ppc', 'product'] as PresetTemplate[]).map((template) => {
                  const presets = getPresetsByTemplate(template)
                  const isExpanded = expandedTemplates.has(template)
                  return (
                    <div key={template}>
                      <button
                        onClick={() => toggleTemplate(template)}
                        className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium rounded-lg hover:bg-muted/50 transition-colors active:scale-[0.97]"
                      >
                        {TEMPLATE_LABELS[template]}
                        <motion.span
                          initial={false}
                          animate={{ rotate: isExpanded ? 180 : 0 }}
                          transition={{ duration: 0.2, ease: easeOut }}
                        >
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        </motion.span>
                      </button>
                      <AnimatePresence initial={false}>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2, ease: easeOut }}
                            className="overflow-hidden"
                          >
                            <div className="grid grid-cols-2 gap-2 px-1 pt-2 pb-1">
                              {presets.map((preset) => (
                                <button
                                  key={preset.id}
                                  onClick={() => handlePresetSelect(preset)}
                                  className="group text-left p-3 rounded-lg transition-all hover:shadow-sm active:scale-[0.97]"
                                  style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.08)' }}
                                >
                                  <div className="flex items-center gap-2 mb-1">
                                    <p className="text-sm font-medium truncate">{preset.title}</p>
                                    <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground" style={{ fontVariantNumeric: 'tabular-nums' }}>
                                      {preset.widget_type}
                                    </span>
                                  </div>
                                  <p className="text-xs text-muted-foreground line-clamp-1">{preset.description}</p>
                                </button>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border/40" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-background px-3 text-xs text-muted-foreground">Or configure manually</span>
              </div>
            </div>

            {/* Manual type selection */}
            <div className="grid grid-cols-2 gap-3">
              {WIDGET_TYPES.map((wt) => (
                <button
                  key={wt.type}
                  onClick={() => handleTypeSelect(wt.type)}
                  className="group text-left p-4 rounded-xl transition-all hover:shadow-md active:scale-[0.97]"
                  style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.08)' }}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted/60 mb-3 group-hover:bg-primary/10 transition-colors">
                    <span className="text-muted-foreground group-hover:text-primary transition-colors">
                      {wt.icon}
                    </span>
                  </div>
                  <p className="text-sm font-medium">{wt.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{wt.description}</p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-6 py-2">
            {/* Type-specific config */}
            {selectedType === 'metric' && (
              <MetricConfig
                config={config as MetricWidgetConfig}
                title={title}
                onConfigChange={setConfig}
                onTitleChange={setTitle}
                titleTouched={titleTouched}
                onTitleTouched={() => setTitleTouched(true)}
              />
            )}
            {selectedType === 'chart' && (
              <ChartConfig
                config={config as ChartWidgetConfig}
                title={title}
                onConfigChange={setConfig}
                onTitleChange={setTitle}
                titleTouched={titleTouched}
                onTitleTouched={() => setTitleTouched(true)}
              />
            )}
            {selectedType === 'table' && (
              <TableConfig
                config={config as TableWidgetConfig}
                title={title}
                onConfigChange={setConfig}
                onTitleChange={setTitle}
                titleTouched={titleTouched}
                onTitleTouched={() => setTitleTouched(true)}
              />
            )}
            {selectedType === 'text' && (
              <TextConfig
                config={config as TextWidgetConfig}
                title={title}
                onConfigChange={setConfig}
                onTitleChange={setTitle}
              />
            )}
            {selectedType === 'ai_text' && (
              <AiTextConfig
                config={config as AiTextWidgetConfig}
                title={title}
                onConfigChange={setConfig}
                onTitleChange={setTitle}
                titleTouched={titleTouched}
                onTitleTouched={() => setTitleTouched(true)}
              />
            )}
            {selectedType === 'smart_text' && (
              <SmartTextConfig
                config={config as SmartTextWidgetConfig}
                title={title}
                onConfigChange={setConfig}
                onTitleChange={setTitle}
              />
            )}

            {/* Size controls */}
            <div className="pt-2 border-t border-border/40">
              <p className="text-xs font-medium text-muted-foreground mb-3">Widget Size</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Width</Label>
                  <Select
                    value={String(colSpan)}
                    onValueChange={(val) => setColSpan(parseInt(val, 10))}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COL_SPAN_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Height</Label>
                  <Select
                    value={String(rowSpan)}
                    onValueChange={(val) => setRowSpan(parseInt(val, 10))}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROW_SPAN_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 'config' && (
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="active:scale-[0.97]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!canSave}
              className="active:scale-[0.97]"
            >
              {isEditing ? 'Update Widget' : 'Add Widget'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
