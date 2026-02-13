'use client'

import { Loader2, Package } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { Module } from '@/types/modules'
import type { ViewModuleAssignment } from '@/app/(dashboard)/admin/views/[viewId]/use-view-builder-data'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AddModuleModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  modules: Module[]
  assignmentByModuleId: Map<string, ViewModuleAssignment>
  onToggleModule: (moduleId: string, checked: boolean) => void
  moduleMutationId: string | null
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AddModuleModal({
  open,
  onOpenChange,
  modules,
  assignmentByModuleId,
  onToggleModule,
  moduleMutationId,
}: AddModuleModalProps) {
  const sorted = [...modules].sort((a, b) => a.sort_order - b.sort_order)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Manage Modules</DialogTitle>
          <DialogDescription className="text-xs">
            Toggle modules on or off for this view.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[400px] overflow-y-auto -mx-6 px-6">
          <div className="space-y-1">
            {sorted.map((mod) => {
              const isAssigned = assignmentByModuleId.has(mod.id)
              const isMutating = moduleMutationId === mod.id

              return (
                <label
                  key={mod.id}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors cursor-pointer',
                    'hover:bg-accent/50',
                    isMutating && 'opacity-60 pointer-events-none'
                  )}
                >
                  <div className="relative flex items-center justify-center">
                    {isMutating ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : (
                      <input
                        type="checkbox"
                        checked={isAssigned}
                        onChange={() => onToggleModule(mod.id, !isAssigned)}
                        className="h-4 w-4 rounded border-border accent-primary"
                      />
                    )}
                  </div>

                  <Package className="h-4 w-4 text-muted-foreground shrink-0" />

                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{mod.name}</p>
                    {mod.description && (
                      <p className="text-[11px] text-muted-foreground truncate">
                        {mod.description}
                      </p>
                    )}
                  </div>
                </label>
              )
            })}

            {sorted.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                No modules available.
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
