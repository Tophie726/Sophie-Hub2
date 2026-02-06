'use client'

import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Save, Loader2, ArrowLeft, Building2, ChevronDown } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { DateCohortPicker } from '@/components/reporting/date-cohort-picker'
import { easeOut, duration } from '@/lib/animations'
import type { DateRange } from '@/types/modules'

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
    <div className="border-b border-border/40 bg-background/95 backdrop-blur sticky top-0 z-30">
      <div className="flex h-16 items-center justify-between px-8">
        <div className="flex items-center gap-3">
          <Link href={`/admin/modules/${moduleSlug}`}>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
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
              className="text-lg font-semibold tracking-tight bg-transparent border-b-2 border-primary/60 outline-none px-0 py-0.5 -webkit-font-smoothing-antialiased"
              style={{ WebkitFontSmoothing: 'antialiased' }}
            />
          ) : (
            <button
              onClick={() => {
                setEditValue(title)
                setIsEditingTitle(true)
              }}
              className="text-lg font-semibold tracking-tight hover:text-primary/80 transition-colors cursor-text"
              style={{ WebkitFontSmoothing: 'antialiased' }}
            >
              {title}
            </button>
          )}
        </div>

        <div className="flex items-center gap-4">
          {/* Partner Picker */}
          {onPartnerChange && (
            <Popover open={partnerOpen} onOpenChange={setPartnerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 px-3 gap-2 min-w-[160px] justify-between"
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
              <PopoverContent className="w-72 p-0" align="end">
                <div className="p-2 border-b">
                  <input
                    type="text"
                    placeholder="Search partners..."
                    value={partnerSearch}
                    onChange={(e) => setPartnerSearch(e.target.value)}
                    className="w-full text-sm bg-transparent outline-none placeholder:text-muted-foreground/50 px-2 py-1.5"
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
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : (
                <Save className="h-4 w-4 mr-1.5" />
              )}
              Save
            </Button>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
