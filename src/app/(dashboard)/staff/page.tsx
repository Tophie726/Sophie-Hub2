'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'
import { Users, Plus, Database, ChevronRight, Loader2, Settings2, GripVertical, Sparkles, FileSpreadsheet, MoreHorizontal, Check } from 'lucide-react'
import { Reorder, useDragControls } from 'framer-motion'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ShimmerGrid } from '@/components/ui/shimmer-grid'
import { EntityListToolbar } from '@/components/entities/entity-list-toolbar'
import { StatusBadge } from '@/components/entities/status-badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useDebounce } from '@/lib/hooks/use-debounce'
import { useStaffQuery } from '@/lib/hooks/use-staff-query'
import type { StaffListItem } from '@/types/entities'

const STAFF_SELECT_COL_WIDTH = 40
const STAFF_NAME_COL_WIDTH = 280
const STAFF_ACTION_COL_WIDTH = 52
const VISIBLE_COLUMNS_STORAGE_KEY = 'staff-visible-columns-v2'
const COLUMN_ORDER_STORAGE_KEY = 'staff-column-order-v2'
const ACTIVE_STAFF_STATUSES = ['active', 'trial', 'onboarding', 'probation', 'onboarded', 'on_leave']
const STAFF_ROLE_TYPES = ['staff', 'contractor'] as const
const STAFF_LIFECYCLE_STATUSES = [
  'trial',
  'onboarding',
  'probation',
  'onboarded',
  'on_leave',
  'offboarding',
  'not_active',
  'departed',
] as const
const STAFF_STATUS_TAG_OPTIONS = [
  'trial',
  'onboarding',
  'probation',
  'onboarded',
  'on_leave',
  'offboarding',
  'not_active',
  'inactive_30d',
] as const

const statusOptions = [
  { value: 'trial', label: 'Trial' },
  { value: 'probation', label: 'Probation' },
  { value: 'active', label: 'Active' },
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'onboarded', label: 'Onboarded' },
  { value: 'on_leave', label: 'On Leave' },
  { value: 'offboarding', label: 'Offboarding' },
  { value: 'not_active', label: 'Not Active' },
  { value: 'departed', label: 'Departed' },
]

const sortOptions = [
  { value: 'full_name', label: 'Name' },
  { value: 'google_last_login_at', label: 'Last Login' },
  { value: 'created_at', label: 'Date Added' },
  { value: 'role', label: 'Role' },
  { value: 'hire_date', label: 'Hire Date' },
]

interface FieldLineageInfo {
  targetField: string
  sourceColumn: string
  tabName: string
  sheetName: string
}

interface StaffColumnDef {
  key: string
  label: string
  source: 'db' | 'source_data'
  sourceKey?: string
  sourceType?: 'sheet' | 'computed'
  sourceTab?: string
  defaultVisible: boolean
  minWidth: number
  flex?: number
  align?: 'left' | 'right'
  render?: (staff: StaffListItem) => React.ReactNode
}

function formatRole(role: string | null): string {
  if (!role) return '--'
  return role
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

function formatCompactDate(value: string | null | undefined): string {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--'
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function normalizeStatusToken(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '_')
}

function isInactiveByDays(value: string | null | undefined, days: number): boolean {
  if (!value) return true
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return true
  const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000)
  return date.getTime() < cutoff
}

function isProbationByHireDate(value: string | null | undefined): boolean {
  if (!value) return false
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return false
  const ninetyDaysAgo = Date.now() - (90 * 24 * 60 * 60 * 1000)
  return date.getTime() >= ninetyDaysAgo
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function getPersistedStatusTags(staff: StaffListItem): string[] {
  if (!Array.isArray(staff.status_tags)) return []

  return Array.from(
    new Set(
      staff.status_tags
        .filter((tag): tag is string => typeof tag === 'string')
        .map((tag) => normalizeStatusToken(tag))
        .filter(Boolean)
    )
  )
}

function getDisplayStatusTags(staff: StaffListItem): string[] {
  const tags = new Set(getPersistedStatusTags(staff))
  const normalizedPrimaryStatus = staff.status ? normalizeStatusToken(staff.status) : null

  if (normalizedPrimaryStatus) {
    tags.delete(normalizedPrimaryStatus)
  }

  if (isProbationByHireDate(staff.hire_date) && normalizedPrimaryStatus !== 'probation') {
    tags.add('probation')
  }

  if (
    isInactiveByDays(staff.google_last_login_at, 30) &&
    normalizedPrimaryStatus !== 'not_active' &&
    normalizedPrimaryStatus !== 'departed'
  ) {
    tags.add('inactive_30d')
  }

  return Array.from(tags)
}

function parseStoredStringArray(raw: string | null): string[] | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return null
    return parsed.filter((value): value is string => typeof value === 'string')
  } catch {
    return null
  }
}

const STAFF_CORE_COLUMNS: StaffColumnDef[] = [
  {
    key: 'role',
    label: 'Role',
    source: 'db',
    sourceType: 'sheet',
    defaultVisible: true,
    minWidth: 130,
    flex: 0,
    render: (staff) => formatRole(staff.role),
  },
  {
    key: 'department',
    label: 'Department',
    source: 'db',
    sourceType: 'sheet',
    defaultVisible: true,
    minWidth: 140,
    flex: 0,
    render: (staff) => staff.department || '--',
  },
  {
    key: 'status',
    label: 'Status',
    source: 'db',
    sourceType: 'sheet',
    defaultVisible: true,
    minWidth: 130,
    flex: 0,
    render: (staff) => <StatusBadge status={staff.status} entity="staff" />,
  },
  {
    key: 'google_last_login_at',
    label: 'Last Google Login',
    source: 'db',
    sourceType: 'computed',
    defaultVisible: true,
    minWidth: 170,
    flex: 0,
    render: (staff) => formatCompactDate(staff.google_last_login_at),
  },
  {
    key: 'services',
    label: 'Services',
    source: 'db',
    sourceType: 'sheet',
    defaultVisible: true,
    minWidth: 190,
    flex: 1,
    render: (staff) => {
      if (!staff.services || staff.services.length === 0) {
        return <span className="text-sm text-muted-foreground">--</span>
      }
      return (
        <div className="flex gap-1 overflow-hidden">
          {staff.services.slice(0, 2).map((s, i) => (
            <span
              key={i}
              className="inline-flex px-1.5 py-0.5 text-[10px] rounded bg-muted text-muted-foreground truncate max-w-[80px]"
            >
              {s.replace(/_/g, ' ')}
            </span>
          ))}
          {staff.services.length > 2 && (
            <span className="text-[10px] text-muted-foreground">
              +{staff.services.length - 2}
            </span>
          )}
        </div>
      )
    },
  },
  {
    key: 'title',
    label: 'Title',
    source: 'db',
    sourceType: 'sheet',
    defaultVisible: false,
    minWidth: 150,
    flex: 1,
  },
  {
    key: 'email',
    label: 'Email',
    source: 'db',
    sourceType: 'sheet',
    defaultVisible: false,
    minWidth: 220,
    flex: 1,
  },
  {
    key: 'timezone',
    label: 'Timezone',
    source: 'db',
    sourceType: 'sheet',
    defaultVisible: false,
    minWidth: 120,
    flex: 0,
  },
  {
    key: 'hire_date',
    label: 'Hire Date',
    source: 'db',
    sourceType: 'sheet',
    defaultVisible: false,
    minWidth: 130,
    flex: 0,
    render: (staff) => formatCompactDate(staff.hire_date),
  },
  {
    key: 'current_client_count',
    label: 'Current Clients',
    source: 'db',
    sourceType: 'sheet',
    defaultVisible: false,
    minWidth: 120,
    flex: 0,
    align: 'right',
    render: (staff) => <span className="tabular-nums">{staff.current_client_count ?? '--'}</span>,
  },
  {
    key: 'max_clients',
    label: 'Max Clients',
    source: 'db',
    sourceType: 'sheet',
    defaultVisible: false,
    minWidth: 110,
    flex: 0,
    align: 'right',
    render: (staff) => <span className="tabular-nums">{staff.max_clients ?? '--'}</span>,
  },
  {
    key: 'google_last_seen_at',
    label: 'Last Google Seen',
    source: 'db',
    sourceType: 'computed',
    defaultVisible: false,
    minWidth: 170,
    flex: 0,
    render: (staff) => formatCompactDate(staff.google_last_seen_at),
  },
]

function normalizeSourceKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '_')
}

function extractSourceDataColumns(staffRows: StaffListItem[]): StaffColumnDef[] {
  const fieldSet = new Map<string, { label: string; tabName: string }>()

  for (const member of staffRows) {
    if (!isRecord(member.source_data)) continue
    const gsheets = member.source_data.gsheets
    if (!isRecord(gsheets)) continue

    for (const [tabName, tabData] of Object.entries(gsheets)) {
      if (!isRecord(tabData)) continue
      for (const columnName of Object.keys(tabData)) {
        const normalized = normalizeSourceKey(columnName)
        const existsAsCore = STAFF_CORE_COLUMNS.some(c =>
          c.key === normalized || c.label.toLowerCase() === columnName.toLowerCase()
        )
        if (!existsAsCore && !fieldSet.has(columnName)) {
          fieldSet.set(columnName, { label: columnName, tabName })
        }
      }
    }
  }

  return Array.from(fieldSet.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([sourceKey, { label, tabName }]) => ({
      key: `source_${normalizeSourceKey(sourceKey)}`,
      label,
      source: 'source_data' as const,
      sourceKey,
      sourceType: 'sheet' as const,
      sourceTab: tabName,
      defaultVisible: false,
      minWidth: 150,
      flex: 1,
    }))
}

function getSourceDataValue(staff: StaffListItem, sourceKey: string): string {
  if (!isRecord(staff.source_data)) return '--'
  const gsheets = staff.source_data.gsheets
  if (!isRecord(gsheets)) return '--'

  for (const tabData of Object.values(gsheets)) {
    if (!isRecord(tabData)) continue
    const value = tabData[sourceKey]
    if (value !== undefined && value !== null && value !== '') {
      return String(value)
    }
  }

  return '--'
}

function DraggableStaffColumnItem({
  col,
  isVisible,
  fieldLineage,
  onToggle,
}: {
  col: StaffColumnDef
  isVisible: boolean
  fieldLineage: Record<string, FieldLineageInfo>
  onToggle: () => void
}) {
  const dragControls = useDragControls()
  const lineage = fieldLineage[col.key]

  return (
    <Reorder.Item
      value={col.key}
      dragListener={false}
      dragControls={dragControls}
      className="flex items-center gap-1.5 px-1 py-1.5 text-sm bg-card rounded-md select-none"
      whileDrag={{
        scale: 1.02,
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        zIndex: 50,
      }}
      transition={{ duration: 0.15 }}
    >
      <div
        onPointerDown={(e) => dragControls.start(e)}
        className="cursor-grab active:cursor-grabbing p-0.5 text-muted-foreground/40 hover:text-muted-foreground touch-none"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </div>

      <label className="flex items-center gap-2 flex-1 cursor-pointer">
        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
          isVisible
            ? 'bg-primary border-primary text-primary-foreground'
            : 'border-muted-foreground/30 hover:border-muted-foreground/50'
        }`}>
          {isVisible && (
            <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
              <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </div>
        <input type="checkbox" checked={isVisible} onChange={onToggle} className="sr-only" />
        <span className={`truncate ${isVisible ? 'text-foreground' : 'text-muted-foreground'}`}>
          {col.label}
        </span>
      </label>

      {col.sourceType === 'computed' && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-purple-500/70 shrink-0 cursor-help">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
          </TooltipTrigger>
          <TooltipContent side="left" className="text-xs max-w-[220px]">
            <div className="font-medium">Computed by App</div>
            <div className="text-muted-foreground">Derived from source data</div>
          </TooltipContent>
        </Tooltip>
      )}

      {col.sourceType === 'sheet' && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-green-500/70 shrink-0 cursor-help">
              <FileSpreadsheet className="h-3.5 w-3.5" />
            </span>
          </TooltipTrigger>
          <TooltipContent side="left" className="text-xs max-w-[240px]">
            {col.source === 'source_data' && col.sourceTab ? (
              <div className="space-y-0.5">
                <div className="font-medium">From Google Sheet</div>
                <div className="text-muted-foreground">
                  Tab: <span className="text-foreground">{col.sourceTab}</span>
                </div>
                <div className="text-muted-foreground">
                  Column: <span className="text-foreground">{col.sourceKey}</span>
                </div>
              </div>
            ) : lineage ? (
              <div className="space-y-0.5">
                <div className="font-medium">{lineage.sheetName || 'Google Sheet'}</div>
                <div className="text-muted-foreground">
                  Tab: <span className="text-foreground">{lineage.tabName || 'Unknown'}</span>
                </div>
                <div className="text-muted-foreground">
                  Column: <span className="text-foreground">{lineage.sourceColumn || 'Unknown'}</span>
                </div>
              </div>
            ) : (
              <div className="text-muted-foreground">From connected sheet</div>
            )}
          </TooltipContent>
        </Tooltip>
      )}
    </Reorder.Item>
  )
}

function StaffRow({
  staff,
  columns,
  visibleColumns,
  tableMinWidth,
  selected,
  isUpdating,
  onToggleSelect,
  onUpdateStaff,
}: {
  staff: StaffListItem
  columns: StaffColumnDef[]
  visibleColumns: Set<string>
  tableMinWidth: number
  selected: boolean
  isUpdating: boolean
  onToggleSelect: (staffId: string) => void
  onUpdateStaff: (staffId: string, updates: { role?: string; status?: string; status_tags?: string[] }) => Promise<void>
}) {
  const persistedStatusTags = getPersistedStatusTags(staff)
  const displayStatusTags = getDisplayStatusTags(staff)

  return (
    <div
      className="group flex items-center px-4 md:px-5 py-3.5 hover:bg-muted/30 transition-colors md:min-w-full"
      style={{ minWidth: tableMinWidth }}
    >
      <div
        className="hidden md:flex shrink-0 items-center justify-center md:sticky md:left-0 md:z-20 md:bg-card md:group-hover:bg-muted/30"
        style={{ width: STAFF_SELECT_COL_WIDTH, minWidth: STAFF_SELECT_COL_WIDTH }}
      >
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect(staff.id)}
          className="h-4 w-4 rounded border-border text-primary focus:ring-ring"
          aria-label={`Select ${staff.full_name}`}
        />
      </div>

      <Link
        href={`/staff/${staff.id}`}
        className="flex-1 min-w-0 md:flex-none md:sticky md:z-10 md:bg-card md:group-hover:bg-muted/30 md:pr-4 md:shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]"
        style={{ left: STAFF_SELECT_COL_WIDTH, width: STAFF_NAME_COL_WIDTH, minWidth: STAFF_NAME_COL_WIDTH }}
      >
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{staff.full_name}</span>
          {staff.staff_code && (
            <span className="hidden sm:inline text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
              {staff.staff_code}
            </span>
          )}
        </div>
        <div className="md:hidden text-xs text-muted-foreground mt-0.5 truncate">
          {(() => {
            const parts: string[] = []
            for (const col of columns) {
              if (!visibleColumns.has(col.key)) continue
              if (col.key === 'status' || col.key === 'services') continue

              let value: string | null = null
              if (col.source === 'source_data' && col.sourceKey) {
                const raw = getSourceDataValue(staff, col.sourceKey)
                if (raw !== '--') value = raw
              } else if (col.key === 'role') {
                value = formatRole(staff.role)
              } else if (col.key === 'google_last_login_at') {
                value = formatCompactDate(staff.google_last_login_at)
              } else if (col.key === 'google_last_seen_at') {
                value = formatCompactDate(staff.google_last_seen_at)
              } else if (!col.render) {
                const raw = staff[col.key as keyof StaffListItem]
                if (raw !== null && raw !== undefined && raw !== '') value = String(raw)
              }

              if (value && value !== '--') {
                parts.push(value)
              }
              if (parts.length >= 3) break
            }

            return parts.join(' · ') || 'No additional details'
          })()}
        </div>
      </Link>

      {columns.map(col => {
        if (!visibleColumns.has(col.key)) return null

        let content: React.ReactNode
        if (col.source === 'source_data' && col.sourceKey) {
          content = getSourceDataValue(staff, col.sourceKey)
        } else if (col.key === 'status') {
          content = (
            <div className="flex items-center gap-1.5">
              <StatusBadge status={staff.status} entity="staff" />
              {displayStatusTags.map((tag) => (
                <StatusBadge key={tag} status={tag} entity="staff" className="text-[10px] py-0 px-1.5" />
              ))}
            </div>
          )
        } else if (col.render) {
          content = col.render(staff)
        } else {
          const raw = staff[col.key as keyof StaffListItem]
          content = raw !== null && raw !== undefined && raw !== '' ? String(raw) : '--'
        }

        const shouldTruncate = col.key !== 'status' && col.key !== 'services'

        return (
          <div
            key={col.key}
            className={`hidden md:block text-sm text-muted-foreground px-2 ${shouldTruncate ? 'truncate' : ''} ${col.align === 'right' ? 'text-right' : ''}`}
            style={{ minWidth: col.minWidth, flex: col.flex ?? 1 }}
          >
            {content}
          </div>
        )
      })}

      <div
        className="hidden md:flex shrink-0 items-center justify-center"
        style={{ width: STAFF_ACTION_COL_WIDTH, minWidth: STAFF_ACTION_COL_WIDTH }}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:bg-muted" disabled={isUpdating}>
              {isUpdating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <MoreHorizontal className="h-3.5 w-3.5" />
              )}
              <span className="sr-only">Row actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem asChild>
              <Link href={`/staff/${staff.id}`} className="cursor-pointer">View Details</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Role Type</div>
            {STAFF_ROLE_TYPES.map(roleType => (
              <DropdownMenuItem
                key={roleType}
                onClick={(e) => {
                  e.preventDefault()
                  if (staff.role === roleType) return
                  void onUpdateStaff(staff.id, { role: roleType })
                }}
                className="flex items-center justify-between"
              >
                <span>{formatRole(roleType)}</span>
                {staff.role === roleType && <Check className="h-3.5 w-3.5 text-primary" />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Lifecycle Status</div>
            {STAFF_LIFECYCLE_STATUSES.map(statusValue => (
              <DropdownMenuItem
                key={statusValue}
                onClick={(e) => {
                  e.preventDefault()
                  if (staff.status === statusValue) return
                  const nextTags = persistedStatusTags.filter((tag) => tag !== statusValue)
                  void onUpdateStaff(staff.id, { status: statusValue, status_tags: nextTags })
                }}
                className="flex items-center justify-between"
              >
                <span>{formatRole(statusValue)}</span>
                {staff.status === statusValue && <Check className="h-3.5 w-3.5 text-primary" />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Status Tags</div>
            {STAFF_STATUS_TAG_OPTIONS.map(tag => (
              <DropdownMenuItem
                key={tag}
                onClick={(e) => {
                  e.preventDefault()
                  const next = new Set(persistedStatusTags)
                  if (next.has(tag)) {
                    next.delete(tag)
                  } else {
                    next.add(tag)
                  }

                  const normalizedPrimaryStatus = staff.status ? normalizeStatusToken(staff.status) : null
                  if (normalizedPrimaryStatus) {
                    next.delete(normalizedPrimaryStatus)
                  }

                  void onUpdateStaff(staff.id, { status_tags: Array.from(next) })
                }}
                className="flex items-center justify-between"
              >
                <span>{formatRole(tag)}</span>
                {persistedStatusTags.includes(tag) && <Check className="h-3.5 w-3.5 text-primary" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Link href={`/staff/${staff.id}`} className="flex md:hidden items-center gap-2 shrink-0">
        <StatusBadge status={staff.status} entity="staff" />
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </Link>
    </div>
  )
}

export default function StaffPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string[]>(ACTIVE_STAFF_STATUSES)
  const [roleFilter, setRoleFilter] = useState<'all' | 'staff' | 'contractor'>('all')
  const [inactiveOnly, setInactiveOnly] = useState(false)
  const [sort, setSort] = useState('full_name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [allStaff, setAllStaff] = useState<StaffListItem[]>([])
  const [selectedStaffIds, setSelectedStaffIds] = useState<Set<string>>(new Set())
  const [loadMoreOffset, setLoadMoreOffset] = useState(0)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [isBulkUpdating, setIsBulkUpdating] = useState(false)
  const [updatingStaffId, setUpdatingStaffId] = useState<string | null>(null)
  const [fieldLineage, setFieldLineage] = useState<Record<string, FieldLineageInfo>>({})
  const headerScrollRef = useRef<HTMLDivElement>(null)

  const defaultVisibleColumnKeys = useMemo(
    () => STAFF_CORE_COLUMNS.filter(c => c.defaultVisible).map(c => c.key),
    []
  )

  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(
    () => new Set(defaultVisibleColumnKeys)
  )

  const [columnOrder, setColumnOrder] = useState<string[]>(
    () => STAFF_CORE_COLUMNS.map(c => c.key)
  )

  const debouncedSearch = useDebounce(search, 300)

  const {
    data: staffData,
    isLoading: loading,
    refetch: refetchStaff,
  } = useStaffQuery({
    search: debouncedSearch || undefined,
    status: statusFilter.length > 0 ? statusFilter : undefined,
    role: roleFilter === 'all' ? undefined : [roleFilter],
    sort,
    order: sortOrder,
    inactiveDays: inactiveOnly ? 30 : undefined,
    limit: 50,
    offset: 0,
  })

  const initialStaff: StaffListItem[] = (staffData?.staff ?? []) as StaffListItem[]
  const total = staffData?.total ?? 0
  const staff = loadMoreOffset === 0 ? initialStaff : allStaff
  const hasMore = staff.length < total
  const selectedCount = selectedStaffIds.size
  const selectedStaffIdList = useMemo(() => Array.from(selectedStaffIds), [selectedStaffIds])
  const allVisibleSelected = staff.length > 0 && staff.every(member => selectedStaffIds.has(member.id))
  const hasDefaultStatusFilter =
    statusFilter.length === ACTIVE_STAFF_STATUSES.length &&
    ACTIVE_STAFF_STATUSES.every(value => statusFilter.includes(value))
  const hasCustomFilters = Boolean(debouncedSearch) || roleFilter !== 'all' || inactiveOnly || !hasDefaultStatusFilter

  const sourceDataColumns = useMemo(() => extractSourceDataColumns(staff), [staff])
  const allColumns = useMemo(() => [...STAFF_CORE_COLUMNS, ...sourceDataColumns], [sourceDataColumns])

  useEffect(() => {
    const savedVisible = parseStoredStringArray(localStorage.getItem(VISIBLE_COLUMNS_STORAGE_KEY))
    if (savedVisible && savedVisible.length > 0) {
      setVisibleColumns(new Set(savedVisible))
    }

    const savedOrder = parseStoredStringArray(localStorage.getItem(COLUMN_ORDER_STORAGE_KEY))
    if (savedOrder && savedOrder.length > 0) {
      setColumnOrder(savedOrder)
    }
  }, [])

  useEffect(() => {
    setLoadMoreOffset(0)
    setAllStaff([])
    setSelectedStaffIds(new Set())
  }, [debouncedSearch, statusFilter, roleFilter, inactiveOnly, sort, sortOrder])

  useEffect(() => {
    setColumnOrder(prev => {
      const allKeys = allColumns.map(c => c.key)
      const filtered = prev.filter(k => allKeys.includes(k))
      const added = allKeys.filter(k => !filtered.includes(k))
      return [...filtered, ...added]
    })

    setVisibleColumns(prev => {
      const allKeys = new Set(allColumns.map(c => c.key))
      const filtered = new Set(Array.from(prev).filter(k => allKeys.has(k)))
      if (filtered.size === 0) {
        defaultVisibleColumnKeys.forEach(key => {
          if (allKeys.has(key)) filtered.add(key)
        })
      }
      return filtered
    })
  }, [allColumns, defaultVisibleColumnKeys])

  useEffect(() => {
    localStorage.setItem(VISIBLE_COLUMNS_STORAGE_KEY, JSON.stringify(Array.from(visibleColumns)))
  }, [visibleColumns])

  useEffect(() => {
    localStorage.setItem(COLUMN_ORDER_STORAGE_KEY, JSON.stringify(columnOrder))
  }, [columnOrder])

  const orderedColumns = useMemo(() => {
    const colMap = new Map(allColumns.map(c => [c.key, c]))
    return columnOrder
      .map(key => colMap.get(key))
      .filter((c): c is StaffColumnDef => c !== undefined)
  }, [allColumns, columnOrder])

  const tableMinWidth = useMemo(() => {
    const visibleColumnWidth = orderedColumns
      .filter(col => visibleColumns.has(col.key))
      .reduce((sum, col) => sum + col.minWidth, 0)
    return STAFF_SELECT_COL_WIDTH + STAFF_NAME_COL_WIDTH + visibleColumnWidth + STAFF_ACTION_COL_WIDTH
  }, [orderedColumns, visibleColumns])

  const fetchFieldLineage = useCallback(async () => {
    try {
      const res = await fetch(`/api/staff/field-lineage?_=${Date.now()}`)
      const json = await res.json()
      if (json.data?.lineage) {
        setFieldLineage(json.data.lineage as Record<string, FieldLineageInfo>)
      }
    } catch (error) {
      console.error('Failed to fetch staff field lineage:', error)
    }
  }, [])

  useEffect(() => {
    fetchFieldLineage()
  }, [fetchFieldLineage])

  const toggleColumn = (key: string) => {
    setVisibleColumns(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const toggleSelectStaff = (staffId: string) => {
    setSelectedStaffIds(prev => {
      const next = new Set(prev)
      if (next.has(staffId)) {
        next.delete(staffId)
      } else {
        next.add(staffId)
      }
      return next
    })
  }

  const toggleSelectAllVisible = () => {
    setSelectedStaffIds(prev => {
      const next = new Set(prev)
      if (allVisibleSelected) {
        staff.forEach(member => next.delete(member.id))
      } else {
        staff.forEach(member => next.add(member.id))
      }
      return next
    })
  }

  const handleContentScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (headerScrollRef.current) {
      headerScrollRef.current.scrollLeft = e.currentTarget.scrollLeft
    }
  }, [])

  const handleLoadMore = async () => {
    const nextOffset = staff.length
    setIsLoadingMore(true)
    try {
      const params = new URLSearchParams()
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (statusFilter.length) params.set('status', statusFilter.join(','))
      if (roleFilter !== 'all') params.set('role', roleFilter)
      if (inactiveOnly) params.set('inactive_days', '30')
      params.set('sort', sort)
      params.set('order', sortOrder)
      params.set('limit', '50')
      params.set('offset', String(nextOffset))

      const res = await fetch(`/api/staff?${params}`)
      const json = await res.json()
      const data = json.data

      if (data?.staff) {
        const combined = [...staff, ...(data.staff as StaffListItem[])]
        setAllStaff(combined)
        setLoadMoreOffset(nextOffset)
      }
    } catch (error) {
      console.error('Failed to load more staff:', error)
    } finally {
      setIsLoadingMore(false)
    }
  }

  const handleUpdateStaff = useCallback(async (
    staffId: string,
    updates: { role?: string; status?: string; status_tags?: string[] }
  ) => {
    setUpdatingStaffId(staffId)
    try {
      const res = await fetch(`/api/staff/${staffId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      const json = await res.json()

      if (!res.ok) {
        toast.error(json.error?.message || 'Failed to update staff')
        return
      }

      toast.success('Staff updated')
      setLoadMoreOffset(0)
      setAllStaff([])
      await refetchStaff()
    } catch (error) {
      console.error('Failed to update staff:', error)
      toast.error('Failed to update staff')
    } finally {
      setUpdatingStaffId(null)
    }
  }, [refetchStaff])

  const handleBulkUpdate = useCallback(async (
    payload: {
      updates?: { role?: string; status?: string; status_tags?: string[] }
      status_tags_op?: 'set' | 'add' | 'remove' | 'clear'
    }
  ) => {
    if (selectedStaffIdList.length === 0) return

    setIsBulkUpdating(true)
    try {
      const res = await fetch('/api/staff/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_ids: selectedStaffIdList,
          ...payload,
        }),
      })
      const json = await res.json()

      if (!res.ok) {
        toast.error(json.error?.message || 'Failed to bulk update staff')
        return
      }

      const updatedCount = Number(json.data?.updated_count ?? selectedStaffIdList.length)
      toast.success(`Updated ${updatedCount} staff`)
      setSelectedStaffIds(new Set())
      setLoadMoreOffset(0)
      setAllStaff([])
      await refetchStaff()
    } catch (error) {
      console.error('Failed to bulk update staff:', error)
      toast.error('Failed to bulk update staff')
    } finally {
      setIsBulkUpdating(false)
    }
  }, [selectedStaffIdList, refetchStaff])

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Staff"
        description={total > 0 ? `${total} team members` : 'View and manage team members'}
      >
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Add Staff</span>
        </Button>
      </PageHeader>

      <EntityListToolbar
        search={search}
        onSearchChange={setSearch}
        statusOptions={statusOptions}
        selectedStatuses={statusFilter}
        onStatusChange={setStatusFilter}
        sortOptions={sortOptions}
        currentSort={sort}
        sortOrder={sortOrder}
        onSortChange={(s, o) => { setSort(s); setSortOrder(o) }}
        resultCount={staff.length}
        totalCount={total}
        placeholder="Search name, email, or code..."
      />

      <div className="px-4 md:px-8 pt-2 pb-1 flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Type:</span>
        <button
          onClick={() => setRoleFilter('all')}
          className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
            roleFilter === 'all'
              ? 'bg-foreground text-background border-foreground'
              : 'text-muted-foreground border-border/60 hover:border-border hover:text-foreground'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setRoleFilter('staff')}
          className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
            roleFilter === 'staff'
              ? 'bg-foreground text-background border-foreground'
              : 'text-muted-foreground border-border/60 hover:border-border hover:text-foreground'
          }`}
        >
          Staff
        </button>
        <button
          onClick={() => setRoleFilter('contractor')}
          className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
            roleFilter === 'contractor'
              ? 'bg-foreground text-background border-foreground'
              : 'text-muted-foreground border-border/60 hover:border-border hover:text-foreground'
          }`}
        >
          Contractor
        </button>

        <span className="text-xs text-muted-foreground ml-2">Activity:</span>
        <button
          onClick={() => setInactiveOnly(prev => !prev)}
          className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
            inactiveOnly
              ? 'bg-foreground text-background border-foreground'
              : 'text-muted-foreground border-border/60 hover:border-border hover:text-foreground'
          }`}
        >
          Inactive {'>'}30 days
        </button>

        {selectedCount > 0 && (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground tabular-nums">
              {selectedCount} selected
            </span>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs" disabled={isBulkUpdating}>
                  Set Role
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                {STAFF_ROLE_TYPES.map(roleType => (
                  <DropdownMenuItem
                    key={roleType}
                    onClick={() => void handleBulkUpdate({ updates: { role: roleType } })}
                  >
                    {formatRole(roleType)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs" disabled={isBulkUpdating}>
                  Set Status
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {STAFF_LIFECYCLE_STATUSES.map(statusValue => (
                  <DropdownMenuItem
                    key={statusValue}
                    onClick={() => void handleBulkUpdate({ updates: { status: statusValue } })}
                  >
                    {formatRole(statusValue)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs" disabled={isBulkUpdating}>
                  Add Tag
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {STAFF_STATUS_TAG_OPTIONS.map(tag => (
                  <DropdownMenuItem
                    key={tag}
                    onClick={() => void handleBulkUpdate({ updates: { status_tags: [tag] }, status_tags_op: 'add' })}
                  >
                    {formatRole(tag)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs" disabled={isBulkUpdating}>
                  Remove Tag
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {STAFF_STATUS_TAG_OPTIONS.map(tag => (
                  <DropdownMenuItem
                    key={tag}
                    onClick={() => void handleBulkUpdate({ updates: { status_tags: [tag] }, status_tags_op: 'remove' })}
                  >
                    {formatRole(tag)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              disabled={isBulkUpdating}
              onClick={() => void handleBulkUpdate({ status_tags_op: 'clear' })}
            >
              Clear Tags
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              disabled={isBulkUpdating}
              onClick={() => setSelectedStaffIds(new Set())}
            >
              Clear Selection
            </Button>
          </div>
        )}
      </div>

      <div className="md:hidden flex items-center justify-between px-4 pt-2 pb-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
              <Settings2 className="h-3.5 w-3.5" />
              Columns
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64 max-h-[420px] overflow-y-auto z-50 p-1.5">
            <TooltipProvider delayDuration={300}>
              <Reorder.Group
                axis="y"
                values={columnOrder}
                onReorder={setColumnOrder}
                className="space-y-0.5"
              >
                {orderedColumns.map((col) => (
                  <DraggableStaffColumnItem
                    key={col.key}
                    col={col}
                    isVisible={visibleColumns.has(col.key)}
                    fieldLineage={fieldLineage}
                    onToggle={() => toggleColumn(col.key)}
                  />
                ))}
              </Reorder.Group>
            </TooltipProvider>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="p-4 md:p-8">
        {loading ? (
          <div className="rounded-xl border bg-card p-1">
            <ShimmerGrid variant="table" rows={10} columns={5} />
          </div>
        ) : staff.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-green-500/10 mb-6">
                <Users className="h-8 w-8 text-green-500" />
              </div>
              <h2 className="text-xl font-semibold mb-2">
                {hasCustomFilters
                  ? 'No staff match your filters'
                  : 'No staff members yet'}
              </h2>
              <p className="text-muted-foreground text-center max-w-md mb-6">
                {hasCustomFilters
                  ? 'Try adjusting your search or filters to find what you\'re looking for.'
                  : 'Staff members will appear here as you map fields through Data Enrichment. Connect a Google Sheet, map your columns, and sync — data flows in automatically.'}
              </p>
              {!hasCustomFilters && (
                <Link href="/admin/data-enrichment">
                  <Button className="gap-2">
                    <Database className="h-4 w-4" />
                    Set Up Data Enrichment
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="rounded-xl border bg-card">
              <div className="hidden md:block sticky top-0 z-20 bg-card border-b border-border/60 rounded-t-xl overflow-hidden">
                <div ref={headerScrollRef} className="overflow-hidden">
                  <div
                    className="flex items-center px-5 py-2.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider md:min-w-full"
                    style={{ minWidth: tableMinWidth }}
                  >
                    <div
                      className="shrink-0 md:sticky md:left-0 md:z-20 md:bg-card flex items-center justify-center"
                      style={{ width: STAFF_SELECT_COL_WIDTH, minWidth: STAFF_SELECT_COL_WIDTH }}
                    >
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleSelectAllVisible}
                        className="h-4 w-4 rounded border-border text-primary focus:ring-ring"
                        aria-label="Select all visible staff"
                      />
                    </div>

                    <div
                      className="flex-1 min-w-0 md:flex-none md:sticky md:z-10 md:bg-card md:pr-4 md:shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]"
                      style={{ left: STAFF_SELECT_COL_WIDTH, width: STAFF_NAME_COL_WIDTH, minWidth: STAFF_NAME_COL_WIDTH }}
                    >
                      Name
                    </div>

                    {orderedColumns.map(col => {
                      if (!visibleColumns.has(col.key)) return null
                      return (
                        <div
                          key={col.key}
                          className={`px-2 ${col.align === 'right' ? 'text-right' : ''}`}
                          style={{ minWidth: col.minWidth, flex: col.flex ?? 1 }}
                        >
                          {col.label}
                        </div>
                      )
                    })}

                    <div
                      className="shrink-0 px-2 flex items-center justify-center"
                      style={{ width: STAFF_ACTION_COL_WIDTH, minWidth: STAFF_ACTION_COL_WIDTH }}
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-muted">
                            <Settings2 className="h-3.5 w-3.5" />
                            <span className="sr-only">Toggle columns</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-64 max-h-[420px] overflow-y-auto z-50 p-1.5">
                          <TooltipProvider delayDuration={300}>
                            <Reorder.Group
                              axis="y"
                              values={columnOrder}
                              onReorder={setColumnOrder}
                              className="space-y-0.5"
                            >
                              {orderedColumns.map((col) => (
                                <DraggableStaffColumnItem
                                  key={col.key}
                                  col={col}
                                  isVisible={visibleColumns.has(col.key)}
                                  fieldLineage={fieldLineage}
                                  onToggle={() => toggleColumn(col.key)}
                                />
                              ))}
                            </Reorder.Group>
                          </TooltipProvider>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto scrollbar-hide" onScroll={handleContentScroll}>
                <div className="divide-y divide-border/60 md:min-w-full" style={{ minWidth: tableMinWidth }}>
                  {staff.map(member => (
                    <StaffRow
                      key={member.id}
                      staff={member}
                      columns={orderedColumns}
                      visibleColumns={visibleColumns}
                      tableMinWidth={tableMinWidth}
                      selected={selectedStaffIds.has(member.id)}
                      isUpdating={updatingStaffId === member.id}
                      onToggleSelect={toggleSelectStaff}
                      onUpdateStaff={handleUpdateStaff}
                    />
                  ))}
                </div>
              </div>
            </div>

            {hasMore && (
              <div className="flex justify-center mt-6">
                <Button
                  variant="outline"
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                  className="gap-2"
                >
                  {isLoadingMore ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  Load More
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
