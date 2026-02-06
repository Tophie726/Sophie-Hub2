'use client'

import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import type { Dashboard } from '@/types/modules'

interface Partner {
  id: string
  brand_name: string
}

interface CreateDashboardDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  moduleId: string
  onCreated: (dashboard: Dashboard) => void
}

export function CreateDashboardDialog({
  open,
  onOpenChange,
  moduleId,
  onCreated,
}: CreateDashboardDialogProps) {
  const [partners, setPartners] = useState<Partner[]>([])
  const [loadingPartners, setLoadingPartners] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [isTemplate, setIsTemplate] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoadingPartners(true)
    fetch('/api/partners?limit=1000')
      .then((res) => res.json())
      .then((json) => {
        const list = json.data?.partners || json.partners || []
        setPartners(list)
      })
      .catch(() => toast.error('Failed to load partners'))
      .finally(() => setLoadingPartners(false))
  }, [open])

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setSearch('')
      setSelectedPartnerId(null)
      setName('')
      setIsTemplate(false)
    }
  }, [open])

  const filteredPartners = partners.filter((p) =>
    p.brand_name?.toLowerCase().includes(search.toLowerCase())
  )

  const selectedPartner = partners.find((p) => p.id === selectedPartnerId)

  async function handleCreate() {
    if (!isTemplate && !selectedPartnerId) {
      toast.error('Select a partner or mark as template')
      return
    }

    setIsSubmitting(true)
    try {
      const title =
        name.trim() ||
        (isTemplate
          ? 'Template Dashboard'
          : `${selectedPartner?.brand_name || 'Partner'} Dashboard`)

      const response = await fetch('/api/modules/dashboards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module_id: moduleId,
          partner_id: isTemplate ? null : selectedPartnerId,
          title,
          is_template: isTemplate,
        }),
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error?.message || 'Failed to create dashboard')
      }

      const json = await response.json()
      const dashboard = json.data?.dashboard || json.dashboard
      toast.success('Dashboard created')
      onCreated(dashboard)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create dashboard')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] md:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Dashboard</DialogTitle>
          <DialogDescription>
            Create a new reporting dashboard for a partner.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleCreate()
          }}
          className="space-y-4"
        >
          {/* Template toggle */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="is-template"
              checked={isTemplate}
              onCheckedChange={(checked) => setIsTemplate(checked === true)}
            />
            <Label htmlFor="is-template" className="text-sm cursor-pointer">
              Create as template (no specific partner)
            </Label>
          </div>

          {/* Partner selector */}
          {!isTemplate && (
            <div className="space-y-2">
              <Label htmlFor="partner-search">Partner</Label>
              <Input
                id="partner-search"
                placeholder="Search partners..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setSelectedPartnerId(null)
                }}
                className="h-10 md:h-9"
              />
              {search && !selectedPartnerId && (
                <div className="max-h-40 overflow-y-auto rounded-md border bg-popover">
                  {loadingPartners ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : filteredPartners.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-muted-foreground">
                      No partners found
                    </p>
                  ) : (
                    filteredPartners.slice(0, 20).map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setSelectedPartnerId(p.id)
                          setSearch(p.brand_name)
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                      >
                        {p.brand_name}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* Dashboard name */}
          <div className="space-y-2">
            <Label htmlFor="dashboard-name">Dashboard Name (optional)</Label>
            <Input
              id="dashboard-name"
              placeholder={
                isTemplate
                  ? 'Template Dashboard'
                  : selectedPartner
                    ? `${selectedPartner.brand_name} Dashboard`
                    : 'My Dashboard'
              }
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-10 md:h-9"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-10 md:h-9"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || (!isTemplate && !selectedPartnerId)}
              className="h-10 md:h-9"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
