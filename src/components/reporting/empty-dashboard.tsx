'use client'

import { LayoutDashboard, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface EmptyDashboardProps {
  onAddSection: () => void
}

export function EmptyDashboard({ onAddSection }: EmptyDashboardProps) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/60 mb-4">
        <LayoutDashboard className="h-8 w-8 text-muted-foreground/60" />
      </div>
      <h3 className="text-lg font-semibold tracking-tight mb-1">No sections yet</h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-6">
        Sections organize your widgets into groups. Add your first section to start building this dashboard.
      </p>
      <Button onClick={onAddSection} className="active:scale-[0.97]">
        <Plus className="h-4 w-4 mr-1.5" />
        Add First Section
      </Button>
    </div>
  )
}
