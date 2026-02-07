'use client'

import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Save,
  Loader2,
  ArrowLeft,
  Building2,
  ChevronDown,
  Pencil,
  Check,
  Monitor,
  Tablet,
  Smartphone,
  RefreshCw,
} from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { DateCohortPicker } from '@/components/reporting/date-cohort-picker'
import { easeOut, duration } from '@/lib/animations'
import type { DateRange, WidgetDataMode } from '@/types/modules'

interface PartnerOption {
  id: string
  brand_name: string
  bigquery_client_name: string | null
}

interface DashboardHeaderProps {
  title: string
  onTitleChange: (title: string) => void
  dateRange: DateRange
  onDateRangeChange: (range: DateRange) => void
  hasChanges: boolean
  isSaving: boolean
  onSave: () => void
  moduleSlug: string
  selectedPartnerId?: string | null
  onPartnerChange?: (partnerId: string, partnerName: string) => void
  isEditMode: boolean
  onToggleEditMode: () => void
  previewMode?: 'desktop' | 'tablet' | 'mobile'
  onPreviewModeChange?: (mode: 'desktop' | 'tablet' | 'mobile') => void
  dataMode: WidgetDataMode
  onDataModeChange: (mode: WidgetDataMode) => void
  onLiveRefresh: () => void
  liveRefreshCooldownSec: number
}

export function DashboardHeader({
  title,
  onTitleChange,
  dateRange,
  onDateRangeChange,
  hasChanges,
  isSaving,
  onSave,
  moduleSlug,
  selectedPartnerId,
  onPartnerChange,
  isEditMode,
  onToggleEditMode,
  previewMode = 'desktop',
  onPreviewModeChange,
  dataMode,
  onDataModeChange,
  onLiveRefresh,
  liveRefreshCooldownSec,
}: DashboardHeaderProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [editValue, setEditValue] = useState(title)
  const inputRef = useRef<HTMLInputElement>(null)

  // Partner picker state
  const [partners, setPartners] = useState<PartnerOption[]>([])
  const [partnersLoading, setPartnersLoading] = useState(false)
  const [partnerSearch, setPartnerSearch] = useState('')
  const [partnerOpen, setPartnerOpen] = useState(false)
  const [selectedPartnerName, setSelectedPartnerName] = useState<string | null>(null)

  // Fetch BigQuery-connected partners
  useEffect(() => {
    if (!onPartnerChange) return
    let cancelled = false
    setPartnersLoading(true)
    fetch('/api/bigquery/mapped-partners')
      .then(res => {
        if (!res.ok) throw new Error(`Mapped partners API: ${res.status}`)
        return res.json()
      })
      .then(json => {
        if (cancelled) return
        const bqPartners = (json.data?.partners || []) as PartnerOption[]
        setPartners(bqPartners)
        // If we already have a selectedPartnerId, set the name
        if (selectedPartnerId) {
          const match = bqPartners.find((p: PartnerOption) => p.id === selectedPartnerId)
          if (match) setSelectedPartnerName(match.brand_name)
        }
      })
      .catch((err) => {
        console.error('[partner-picker] Error fetching partners:', err)
      })
      .finally(() => {
        if (!cancelled) setPartnersLoading(false)
      })
    return () => { cancelled = true }
  }, [onPartnerChange]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isEditingTitle && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditingTitle])

  function commitTitle() {
    const trimmed = editValue.trim()
    if (trimmed && trimmed !== title) {
      onTitleChange(trimmed)
    } else {
      setEditValue(title)
    }
    setIsEditingTitle(false)
  }

  return (
    <div className="border-b border-border/40 bg-background/95 backdrop-blur sticky top-14 md:top-0 z-30">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 md:px-8 py-2 md:py-0 md:min-h-[4rem]">
        {/* Top row: back button + title */}
        <div className="flex items-center gap-3 min-w-0">
          <Link href={`/admin/modules/${moduleSlug}`}>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>

          {isEditingTitle ? (
            <input
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitTitle()
                if (e.key === 'Escape') {
                  setEditValue(title)
                  setIsEditingTitle(false)
                }
              }}
              className="text-base md:text-lg font-semibold tracking-tight bg-transparent border-b-2 border-primary/60 outline-none px-0 py-0.5 min-w-0"
              style={{ WebkitFontSmoothing: 'antialiased' }}
            />
          ) : (
            <button
              onClick={() => {
                setEditValue(title)
                setIsEditingTitle(true)
              }}
              className="text-lg font-semibold tracking-tight hover:text-primary/80 transition-colors cursor-text truncate"
              style={{ WebkitFontSmoothing: 'antialiased' }}
            >
              {title}
            </button>
          )}
        </div>

        {/* Bottom row on narrow screens: controls */}
        <div className="flex flex-wrap items-center gap-2 md:gap-4">
          {/* Partner Picker */}
          {onPartnerChange && (
            <Popover open={partnerOpen} onOpenChange={setPartnerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 px-3 gap-2 min-w-0 max-w-[120px] sm:max-w-[160px] md:max-w-[200px] justify-between"
                >
                  <div className="flex items-center gap-2 truncate">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate text-sm">
                      {selectedPartnerName || 'Select Partner'}
                    </span>
                  </div>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[calc(100vw-2rem)] sm:w-72 p-0" align="end">
                <div className="p-2 border-b">
                  <input
                    type="text"
                    placeholder="Search partners..."
                    value={partnerSearch}
                    onChange={(e) => setPartnerSearch(e.target.value)}
                    className="w-full text-base md:text-sm bg-transparent outline-none placeholder:text-muted-foreground/50 px-2 py-1.5"
                    autoFocus
                  />
                </div>
                <div className="max-h-64 overflow-y-auto p-1">
                  {partnersLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : partners.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4 px-2">
                      No BigQuery-connected partners found
                    </p>
                  ) : (
                    partners
                      .filter(p =>
                        p.brand_name.toLowerCase().includes(partnerSearch.toLowerCase()) ||
                        (p.bigquery_client_name || '').toLowerCase().includes(partnerSearch.toLowerCase())
                      )
                      .map((p) => (
                        <button
                          key={p.id}
                          onClick={() => {
                            onPartnerChange(p.id, p.brand_name)
                            setSelectedPartnerName(p.brand_name)
                            setPartnerOpen(false)
                            setPartnerSearch('')
                          }}
                          className={`w-full text-left px-2.5 py-2 rounded-md text-sm hover:bg-muted/50 transition-colors flex items-center justify-between ${
                            selectedPartnerId === p.id ? 'bg-muted/50 font-medium' : ''
                          }`}
                        >
                          <span className="truncate">{p.brand_name}</span>
                          {p.bigquery_client_name && p.bigquery_client_name !== p.brand_name && (
                            <span className="text-xs text-muted-foreground truncate ml-2 shrink-0">
                              {p.bigquery_client_name}
                            </span>
                          )}
                        </button>
                      ))
                  )}
                </div>
              </PopoverContent>
            </Popover>
          )}

          <DateCohortPicker dateRange={dateRange} onChange={onDateRangeChange} />

          {/* Data source mode toggle */}
          <div
            className="hidden sm:flex items-center p-0.5 rounded-lg"
            style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.08)' }}
          >
            <button
              onClick={() => onDataModeChange('snapshot')}
              className={`px-2.5 py-1.5 text-xs rounded-md transition-colors ${
                dataMode === 'snapshot'
                  ? 'text-foreground bg-muted font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Use snapshot test data"
            >
              Snapshot
            </button>
            <button
              onClick={() => onDataModeChange('live')}
              className={`px-2.5 py-1.5 text-xs rounded-md transition-colors ${
                dataMode === 'live'
                  ? 'text-foreground bg-muted font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Use live BigQuery-backed data"
            >
              Live
            </button>
          </div>

          {/* Live refresh with cooldown */}
          {dataMode === 'live' && (
            <Button
              variant="outline"
              size="sm"
              className="h-9 px-3 active:scale-[0.97]"
              onClick={onLiveRefresh}
              disabled={liveRefreshCooldownSec > 0}
              title={liveRefreshCooldownSec > 0 ? `Available in ${liveRefreshCooldownSec}s` : 'Refresh live data now'}
            >
              <RefreshCw className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">
                {liveRefreshCooldownSec > 0 ? `${liveRefreshCooldownSec}s` : 'Refresh'}
              </span>
            </Button>
          )}

          {/* Edit Layout toggle */}
          <Button
            variant={isEditMode ? 'default' : 'outline'}
            size="sm"
            className="h-9 px-3 active:scale-[0.97]"
            onClick={onToggleEditMode}
          >
            {isEditMode ? (
              <>
                <Check className="h-4 w-4 sm:mr-1.5" />
                <span className="hidden sm:inline">{isEditMode ? 'Done' : 'Edit Layout'}</span>
              </>
            ) : (
              <>
                <Pencil className="h-4 w-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Edit Layout</span>
              </>
            )}
          </Button>

          {/* Device preview toggle - only visible in edit mode */}
          {isEditMode && onPreviewModeChange && (
            <div
              className="hidden md:flex items-center p-0.5 rounded-lg"
              style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.08)' }}
            >
              <button
                onClick={() => onPreviewModeChange('desktop')}
                className={`relative p-1.5 rounded-md transition-colors ${
                  previewMode === 'desktop'
                    ? 'text-foreground bg-muted'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="Desktop view"
              >
                <Monitor className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => onPreviewModeChange('tablet')}
                className={`relative p-1.5 rounded-md transition-colors ${
                  previewMode === 'tablet'
                    ? 'text-foreground bg-muted'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="Tablet preview"
              >
                <Tablet className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => onPreviewModeChange('mobile')}
                className={`relative p-1.5 rounded-md transition-colors ${
                  previewMode === 'mobile'
                    ? 'text-foreground bg-muted'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="Mobile preview"
              >
                <Smartphone className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <motion.div
            initial={false}
            animate={{ opacity: hasChanges ? 1 : 0.5 }}
            transition={{ duration: duration.micro, ease: easeOut }}
          >
            <Button
              onClick={onSave}
              disabled={!hasChanges || isSaving}
              size="sm"
              className="h-9 px-4 active:scale-[0.97]"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin sm:mr-1.5" />
              ) : (
                <Save className="h-4 w-4 sm:mr-1.5" />
              )}
              <span className="hidden sm:inline">Save</span>
            </Button>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
