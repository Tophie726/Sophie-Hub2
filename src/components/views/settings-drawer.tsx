'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, GripVertical, Loader2, Pencil, Plus, SquareArrowOutUpRight, Trash2, X } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { Module, DashboardSection } from '@/types/modules'
import type { ViewDetail, ViewModuleAssignment } from '@/app/(dashboard)/admin/views/[viewId]/use-view-builder-data'
import {
  CANONICAL_PARTNER_TYPES,
  CANONICAL_PARTNER_TYPE_LABELS,
} from '@/lib/partners/computed-partner-type'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'pod_leader', label: 'PPC Strategist' },
  { value: 'staff', label: 'Staff' },
] as const

const TIER_LABELS: Record<number, string> = {
  1: 'Staff',
  2: 'Role',
  3: 'Partner',
  4: 'Partner Type',
  5: 'Default',
}

// ---------------------------------------------------------------------------
// Sortable Module Item
// ---------------------------------------------------------------------------

interface SortableModuleItemProps {
  assignment: ViewModuleAssignment & { module: Module | null }
  index: number
}

function SortableModuleItem({ assignment, index }: SortableModuleItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: assignment.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-2.5 rounded-md border border-border/60 px-2.5 py-2',
        isDragging && 'opacity-80 shadow-md bg-background'
      )}
    >
      <button
        type="button"
        className="cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-muted-foreground touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <span className="text-[10px] font-mono text-muted-foreground w-4 text-right">
        {index + 1}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {assignment.module?.name || 'Unknown'}
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sortable Section Item (Wave 4)
// ---------------------------------------------------------------------------

interface SortableSectionItemProps {
  section: DashboardSection
  isRenaming: boolean
  renameTitle: string
  setRenameTitle: (v: string) => void
  onStartRename: () => void
  onConfirmRename: () => void
  onCancelRename: () => void
  onDelete: () => void
  isEditMode?: boolean
}

function SortableSectionItem({
  section,
  isRenaming,
  renameTitle,
  setRenameTitle,
  onStartRename,
  onConfirmRename,
  onCancelRename,
  onDelete,
  isEditMode,
}: SortableSectionItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-2 rounded-md border border-border/60 px-2.5 py-2',
        isDragging && 'opacity-80 shadow-md bg-background'
      )}
    >
      {isEditMode && (
        <button
          type="button"
          className="cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-muted-foreground touch-none"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      )}
      <div className="min-w-0 flex-1">
        {isRenaming ? (
          <div className="flex items-center gap-1">
            <input
              className="flex-1 text-sm bg-transparent border-b border-primary outline-none"
              value={renameTitle}
              onChange={(e) => setRenameTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onConfirmRename()
                if (e.key === 'Escape') onCancelRename()
              }}
              autoFocus
            />
            <button
              type="button"
              className="rounded p-0.5 text-primary hover:bg-primary/10"
              onClick={onConfirmRename}
            >
              <Check className="h-3 w-3" />
            </button>
            <button
              type="button"
              className="rounded p-0.5 text-muted-foreground hover:bg-muted"
              onClick={onCancelRename}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <p className="truncate text-sm">{section.title}</p>
        )}
      </div>
      {isEditMode && !isRenaming && (
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            className="rounded p-1 text-muted-foreground/50 transition-colors hover:bg-accent hover:text-foreground"
            onClick={onStartRename}
            aria-label="Rename section"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            type="button"
            className="rounded p-1 text-muted-foreground/50 transition-colors hover:bg-destructive/10 hover:text-destructive"
            onClick={onDelete}
            aria-label="Delete section"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SettingsDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  view: ViewDetail
  assignments: ViewModuleAssignment[]
  modules: Module[]
  assignedModules: Array<ViewModuleAssignment & { module: Module | null }>
  metaName: string
  setMetaName: (v: string) => void
  metaDescription: string
  setMetaDescription: (v: string) => void
  savingMeta: boolean
  onSaveMeta: () => void
  onToggleViewField: (field: 'is_active' | 'is_default', value: boolean) => void
  onAddRule: (e: React.FormEvent) => void
  onDeleteRule: (ruleId: string) => void
  onReorderModules?: (reordered: Array<{ module_id: string; sort_order: number }>) => void
  addRuleState: {
    type: string
    setType: (v: string) => void
    targetId: string
    setTargetId: (v: string) => void
    priority: string
    setPriority: (v: string) => void
    submitting: boolean
  }
  // Wave 4: section management
  activeDashboardId?: string | null
  activeModuleSlug?: string | null
  dashboardSections?: DashboardSection[]
  isEditMode?: boolean
  onAddSection?: (title: string) => void
  onRenameSection?: (sectionId: string, title: string) => void
  onDeleteSection?: (sectionId: string) => void
  onReorderSections?: (order: Array<{ id: string; sort_order: number }>) => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SettingsDrawer({
  open,
  onOpenChange,
  view,
  assignedModules,
  metaName,
  setMetaName,
  metaDescription,
  setMetaDescription,
  savingMeta,
  onSaveMeta,
  onToggleViewField,
  onAddRule,
  onDeleteRule,
  onReorderModules,
  addRuleState,
  // Wave 4
  activeDashboardId,
  activeModuleSlug,
  dashboardSections,
  isEditMode,
  onAddSection,
  onRenameSection,
  onDeleteSection,
  onReorderSections,
}: SettingsDrawerProps) {
  const rules = view.view_audience_rules || []
  const [addingSectionFor, setAddingSectionFor] = useState<string | null>(null)

  // Section management state
  const [newSectionTitle, setNewSectionTitle] = useState('')
  const [addingSectionToView, setAddingSectionToView] = useState(false)
  const [renamingSectionId, setRenamingSectionId] = useState<string | null>(null)
  const [renameTitle, setRenameTitle] = useState('')

  // Local order state for optimistic drag updates
  const [localOrder, setLocalOrder] = useState<typeof assignedModules | null>(null)
  const displayModules = localOrder ?? assignedModules

  // Reset local order when assignedModules identity changes (after server response)
  const prevAssignmentsRef = useRef(assignedModules)
  useEffect(() => {
    if (prevAssignmentsRef.current !== assignedModules) {
      prevAssignmentsRef.current = assignedModules
      setLocalOrder(null)
    }
  }, [assignedModules])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = displayModules.findIndex((m) => m.id === active.id)
    const newIndex = displayModules.findIndex((m) => m.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(displayModules, oldIndex, newIndex)
    setLocalOrder(reordered)

    const order = reordered.map((m, i) => ({
      module_id: m.module_id,
      sort_order: i,
    }))

    onReorderModules?.(order)
  }

  async function handleAddSectionToDashboard(dashboardId: string, moduleName: string) {
    setAddingSectionFor(dashboardId)
    try {
      const res = await fetch(`/api/modules/dashboards/${dashboardId}/sections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: `${moduleName} Section` }),
      })

      if (!res.ok) {
        toast.error('Failed to add section')
        return
      }

      toast.success('Section added. Open Edit Widgets to arrange it.')
    } catch {
      toast.error('Failed to add section')
    } finally {
      setAddingSectionFor(null)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[380px] sm:w-[420px] p-0 flex flex-col">
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-border/40">
          <SheetTitle className="text-base">View Settings</SheetTitle>
          <SheetDescription className="text-xs">
            Configure {view.name}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-5 space-y-4">
            {/* ============================================================= */}
            {/* View Settings Section                                          */}
            {/* ============================================================= */}
            <Collapsible defaultOpen>
              <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-1 py-1.5 text-sm font-semibold hover:bg-accent/50 transition-colors">
                Settings
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform [[data-state=open]>&]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-3 pt-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Name</label>
                    <Input
                      value={metaName}
                      onChange={(e) => setMetaName(e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Description</label>
                    <Input
                      value={metaDescription}
                      onChange={(e) => setMetaDescription(e.target.value)}
                      placeholder="Optional description"
                      className="h-9 text-sm"
                    />
                  </div>

                  <div className="space-y-2 rounded-md border border-border/60 px-3 py-2.5">
                    <label className="flex items-center justify-between text-sm">
                      <span>Active</span>
                      <Switch
                        checked={view.is_active}
                        onCheckedChange={(checked) => onToggleViewField('is_active', checked)}
                      />
                    </label>
                    <label className="flex items-center justify-between text-sm">
                      <span>Default</span>
                      <Switch
                        checked={view.is_default}
                        onCheckedChange={(checked) => onToggleViewField('is_default', checked)}
                      />
                    </label>
                  </div>

                  <Button
                    onClick={onSaveMeta}
                    className="w-full"
                    size="sm"
                    disabled={!metaName.trim() || savingMeta}
                  >
                    {savingMeta && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                    Save Settings
                  </Button>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* ============================================================= */}
            {/* Audience Rules Section                                          */}
            {/* ============================================================= */}
            <Collapsible defaultOpen>
              <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-1 py-1.5 text-sm font-semibold hover:bg-accent/50 transition-colors">
                <span className="flex items-center gap-2">
                  Audience Rules
                  <Badge variant="secondary" className="text-[10px]">{rules.length}</Badge>
                </span>
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform [[data-state=open]>&]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-2 pt-2">
                  {rules.length === 0 ? (
                    <p className="rounded-md border border-border/50 px-3 py-2 text-xs text-muted-foreground">
                      No rules yet.
                    </p>
                  ) : (
                    [...rules]
                      .sort((a, b) => a.tier - b.tier || a.priority - b.priority)
                      .map((rule) => (
                        <div key={rule.id} className="flex items-start gap-2 rounded-md border border-border/60 px-2.5 py-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium">
                              {TIER_LABELS[rule.tier] || `Tier ${rule.tier}`}
                            </p>
                            <p className="text-[11px] text-muted-foreground font-mono truncate">
                              {rule.target_id || 'default'} &bull; p{rule.priority}
                            </p>
                          </div>
                          <button
                            type="button"
                            className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => onDeleteRule(rule.id)}
                            aria-label="Delete rule"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))
                  )}

                  {/* Add rule form */}
                  <form onSubmit={onAddRule} className="space-y-2 border-t border-border/50 pt-3">
                    <Select value={addRuleState.type} onValueChange={addRuleState.setType}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="Target type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="staff">Staff</SelectItem>
                        <SelectItem value="role">Role</SelectItem>
                        <SelectItem value="partner">Partner</SelectItem>
                        <SelectItem value="partner_type">Partner Type</SelectItem>
                        <SelectItem value="default">Default</SelectItem>
                      </SelectContent>
                    </Select>

                    {addRuleState.type === 'role' && (
                      <Select value={addRuleState.targetId} onValueChange={addRuleState.setTargetId}>
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectLabel>Roles</SelectLabel>
                            {ROLE_OPTIONS.map((role) => (
                              <SelectItem key={role.value} value={role.value}>
                                {role.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    )}

                    {addRuleState.type === 'partner_type' && (
                      <Select value={addRuleState.targetId} onValueChange={addRuleState.setTargetId}>
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue placeholder="Select partner type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectLabel>Partner Types</SelectLabel>
                            {CANONICAL_PARTNER_TYPES.map((type) => (
                              <SelectItem key={type} value={type}>
                                {CANONICAL_PARTNER_TYPE_LABELS[type]}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    )}

                    {addRuleState.type && addRuleState.type !== 'default' && addRuleState.type !== 'role' && addRuleState.type !== 'partner_type' && (
                      <Input
                        value={addRuleState.targetId}
                        onChange={(e) => addRuleState.setTargetId(e.target.value)}
                        placeholder={`${addRuleState.type} id`}
                        className="h-9 text-sm"
                      />
                    )}

                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={addRuleState.priority}
                        onChange={(e) => addRuleState.setPriority(e.target.value)}
                        min={0}
                        max={1000}
                        className="h-9 w-24 text-sm"
                        placeholder="Priority"
                      />
                      <Button
                        type="submit"
                        size="sm"
                        className="h-9 flex-1"
                        disabled={!addRuleState.type || addRuleState.submitting}
                      >
                        {addRuleState.submitting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Plus className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </form>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* ============================================================= */}
            {/* Module Order Section                                            */}
            {/* ============================================================= */}
            <Collapsible defaultOpen>
              <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-1 py-1.5 text-sm font-semibold hover:bg-accent/50 transition-colors">
                <span className="flex items-center gap-2">
                  Module Order
                  <Badge variant="secondary" className="text-[10px]">{displayModules.length}</Badge>
                </span>
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform [[data-state=open]>&]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-1.5 pt-2">
                  {displayModules.length === 0 ? (
                    <p className="rounded-md border border-border/50 px-3 py-2 text-xs text-muted-foreground">
                      No modules assigned.
                    </p>
                  ) : (
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleDragEnd}
                    >
                      <SortableContext
                        items={displayModules.map((m) => m.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {displayModules.map((a, idx) => (
                          <SortableModuleItem
                            key={a.id}
                            assignment={a}
                            index={idx}
                          />
                        ))}
                      </SortableContext>
                    </DndContext>
                  )}
                </div>

                {displayModules.length > 0 && (
                  <div className="mt-3 space-y-2 border-t border-border/50 pt-3">
                    <p className="px-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Section + Widget Tools
                    </p>
                    {displayModules.map((assignment) => {
                      const mod = assignment.module
                      const slug = mod?.slug
                      const dashboardId = assignment.dashboard_id
                      const moduleName = mod?.name || 'Module'
                      const canEditWidgets = Boolean(slug && dashboardId)
                      const isAddingSection = addingSectionFor === dashboardId

                      return (
                        <div key={`tools-${assignment.id}`} className="rounded-md border border-border/60 px-2.5 py-2">
                          <p className="truncate text-xs font-medium">{moduleName}</p>
                          <div className="mt-2 flex items-center gap-2">
                            {canEditWidgets ? (
                              <Link
                                href={`/admin/modules/${slug}/${dashboardId}`}
                                target="_blank"
                                rel="noreferrer"
                                className="flex-1"
                              >
                                <Button size="sm" variant="outline" className="h-8 w-full text-xs">
                                  <SquareArrowOutUpRight className="mr-1.5 h-3.5 w-3.5" />
                                  Edit Widgets
                                </Button>
                              </Link>
                            ) : (
                              <Button size="sm" variant="outline" className="h-8 flex-1 text-xs" disabled>
                                Edit Widgets
                              </Button>
                            )}

                            <Button
                              size="sm"
                              variant="secondary"
                              className="h-8 text-xs"
                              disabled={!dashboardId || isAddingSection}
                              onClick={() => {
                                if (!dashboardId) return
                                void handleAddSectionToDashboard(dashboardId, moduleName)
                              }}
                            >
                              {isAddingSection ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <>
                                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                                  Add Section
                                </>
                              )}
                            </Button>
                          </div>
                          {!canEditWidgets && (
                            <p className="mt-1 text-[10px] text-muted-foreground">
                              Assign a dashboard to this module to edit its widget layout.
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>

            {/* ============================================================= */}
            {/* Dashboard Sections (Wave 4 — visible when module active)       */}
            {/* ============================================================= */}
            {activeDashboardId && activeModuleSlug && (
              <Collapsible defaultOpen>
                <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-1 py-1.5 text-sm font-semibold hover:bg-accent/50 transition-colors">
                  <span className="flex items-center gap-2">
                    Sections
                    <Badge variant="secondary" className="text-[10px]">{dashboardSections?.length ?? 0}</Badge>
                  </span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform [[data-state=open]>&]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-1.5 pt-2">
                    {!dashboardSections || dashboardSections.length === 0 ? (
                      <p className="rounded-md border border-border/50 px-3 py-2 text-xs text-muted-foreground">
                        No sections yet.
                      </p>
                    ) : (
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={(event) => {
                          const { active, over } = event
                          if (!over || active.id === over.id || !dashboardSections) return
                          const oldIdx = dashboardSections.findIndex((s) => s.id === active.id)
                          const newIdx = dashboardSections.findIndex((s) => s.id === over.id)
                          if (oldIdx === -1 || newIdx === -1) return
                          const reordered = arrayMove(dashboardSections, oldIdx, newIdx)
                          onReorderSections?.(reordered.map((s, i) => ({ id: s.id, sort_order: i })))
                        }}
                      >
                        <SortableContext
                          items={(dashboardSections || []).map((s) => s.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          {dashboardSections.map((section) => (
                            <SortableSectionItem
                              key={section.id}
                              section={section}
                              isRenaming={renamingSectionId === section.id}
                              renameTitle={renameTitle}
                              setRenameTitle={setRenameTitle}
                              onStartRename={() => {
                                setRenamingSectionId(section.id)
                                setRenameTitle(section.title)
                              }}
                              onConfirmRename={() => {
                                if (renameTitle.trim()) {
                                  onRenameSection?.(section.id, renameTitle.trim())
                                }
                                setRenamingSectionId(null)
                              }}
                              onCancelRename={() => setRenamingSectionId(null)}
                              onDelete={() => onDeleteSection?.(section.id)}
                              isEditMode={isEditMode}
                            />
                          ))}
                        </SortableContext>
                      </DndContext>
                    )}

                    {/* Add section form */}
                    {isEditMode && (
                      <form
                        className="flex items-center gap-2 border-t border-border/50 pt-3"
                        onSubmit={async (e) => {
                          e.preventDefault()
                          if (!newSectionTitle.trim()) return
                          setAddingSectionToView(true)
                          await onAddSection?.(newSectionTitle.trim())
                          setNewSectionTitle('')
                          setAddingSectionToView(false)
                        }}
                      >
                        <Input
                          value={newSectionTitle}
                          onChange={(e) => setNewSectionTitle(e.target.value)}
                          placeholder="Section title"
                          className="h-8 text-sm flex-1"
                        />
                        <Button
                          type="submit"
                          size="sm"
                          className="h-8"
                          disabled={!newSectionTitle.trim() || addingSectionToView}
                        >
                          {addingSectionToView ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Plus className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </form>
                    )}

                    {!isEditMode && dashboardSections && dashboardSections.length > 0 && (
                      <p className="text-[10px] text-muted-foreground/70 pt-1">
                        Enter edit mode to add, rename, or delete sections.
                      </p>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
