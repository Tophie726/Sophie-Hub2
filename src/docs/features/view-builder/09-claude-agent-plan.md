# View Builder Wave 4 — Agent Plan (Section/Widget Composer)

Date: 2026-02-11
Round: 09
Status: PLAN — AWAITING REVIEW
Source: `FINAL-APPROVED-PLAN.md` (Wave 4 pending) + `08-claude-wave4-agent-kickoff.md`

---

## Context

Waves 0–3 shipped the complete preview infrastructure: HMAC-signed tokens, inception-mode iframe, audience switching, module assignment/reorder, device previews, audit logging, and smoke tests. The builder page at `/admin/views/[viewId]` can assign modules and configure audience rules, but **cannot author dashboard content inline**.

Today, composing sections and widgets requires navigating to the separate module builder (`/admin/modules/.../dashboards/[id]`). Wave 4 closes this gap: direct section/widget composition from the view builder.

### What Already Exists

| Primitive | File | What It Does |
|-----------|------|-------------|
| `SectionContainer` | `src/components/reporting/section-container.tsx` | Full dnd-kit context, grid drop targets, drag overlay, collapse, "Add Widget" button |
| `WidgetWrapper` | `src/components/reporting/widget-wrapper.tsx` | Drag handle, pointer-based resize, edit/delete controls, responsive grid placement |
| `WidgetRenderer` | `src/components/reporting/widget-renderer.tsx` | Routes `widget_type` → component (metric, chart, table, text, ai_text, smart_text) |
| `WidgetConfigDialog` | `src/components/reporting/widget-config-dialog.tsx` | Full config UI for all 6 widget types, type selector, size picker |
| `DashboardBuilder` | `src/components/reporting/dashboard-builder.tsx` | Orchestrator: edit mode, save flow, section/widget state, auto-placement |
| `use-grid-occupancy` | `src/hooks/use-grid-occupancy.ts` | 8-col grid occupancy map, placement validation, collision detection |
| Dashboard APIs | `src/app/api/modules/dashboards/[dashboardId]/...` | Full CRUD: sections (POST, PATCH reorder), widgets (POST, PATCH, DELETE) |
| `PreviewModuleContent` | `src/components/views/preview-module-content.tsx` | Renders dashboard sections/widgets in read-only 8-col grid inside preview iframe |
| Preview bridge | `src/lib/views/preview-bridge.ts` | Type-safe postMessage: `refreshRequested`, `activeModuleChanged`, `previewReady`, `previewError` |

### Key Relationship Chain

```
View → view_profile_modules[].dashboard_id → Dashboard → Sections → Widgets
                                                 ↑
                               (null = use module's template dashboard)
```

---

## Architecture

### Design Decision: Where Does Editing Happen?

**In the preview iframe.** The kickoff doc specifies "Drag/reposition and resize widgets inline (same UX family as reporting builder)." The existing `SectionContainer` + `WidgetWrapper` components provide drag/resize out of the box. We render them inside the preview iframe when edit mode is active.

**Parent window orchestrates.** The builder toolbar controls edit mode, section management, and widget config dialogs. The preview iframe handles spatial editing (drag/resize) and communicates back via bridge messages.

```
┌───────────────────────────────────────────────────────────────────────┐
│ Builder Page (parent)                                                  │
│ ┌─────────────────────────────────────────────────────────────────────┐│
│ │ Toolbar: [← Back] [View Name] [Audience ▾] [📱💻🖥] [✏ Edit]      ││
│ │          [⚙ Settings] [+ Add] [⛶ Fullscreen]                       ││
│ └─────────────────────────────────────────────────────────────────────┘│
│ ┌─────────────────────────────────────────────────────────────────────┐│
│ │ Preview iframe (edit mode ON)                                       ││
│ │ ┌─────────────────────────────────────────────────────────────────┐││
│ │ │ SectionContainer (interactive)                                  │││
│ │ │ ┌─────────┐ ┌─────────┐ ┌─────────┐                           │││
│ │ │ │ Widget  │ │ Widget  │ │ Widget  │  ← drag/resize inline      │││
│ │ │ │ (wrap)  │ │ (wrap)  │ │ (wrap)  │                           │││
│ │ │ └─────────┘ └─────────┘ └─────────┘                           │││
│ │ │ [+ Add Widget]                                                 │││
│ │ └─────────────────────────────────────────────────────────────────┘││
│ └─────────────────────────────────────────────────────────────────────┘│
│                                                                        │
│ ┌──── Widget Config Dialog (in parent, opened via bridge) ──────────┐ │
│ │ Type selector → Config panel → Save → bridge refresh              │ │
│ └───────────────────────────────────────────────────────────────────┘ │
│                                                                        │
│ ┌──── Settings Drawer (extended) ───────────────────────────────────┐ │
│ │ View Settings │ Audience Rules │ Module Order │ ★ Sections ★      │ │
│ │ Section: add / rename / delete / reorder (per active module)      │ │
│ └───────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────┘
```

### Fork-on-Edit Pattern

When a view module's `dashboard_id` is null (using module template), the first edit forks a copy:

1. Clone the template dashboard → new dashboard row with `is_template: false`
2. Clone all sections and widgets with new UUIDs
3. Update `view_profile_modules.dashboard_id` to point to the fork
4. Subsequent edits go to the fork without affecting the template

This preserves template dashboards as shared blueprints while allowing per-view customization.

---

## Implementation Steps (9 steps)

### Step 1: Bridge Protocol Extension (VB23)

**Modify:** `src/lib/views/preview-bridge.ts`

Add new message types:

```typescript
/** Parent → iframe */
export type ParentMessage =
  | { type: 'refreshRequested' }
  | { type: 'activeModuleChanged'; slug: string }
  | { type: 'editModeChanged'; enabled: boolean }                    // NEW
  | { type: 'openWidgetConfig'; widget: DashboardWidget | null;      // NEW
      sectionId: string; dashboardId: string }

/** iframe → parent */
export type ChildMessage =
  | { type: 'previewReady' }
  | { type: 'previewError'; message: string }
  | { type: 'widgetEditRequested'; widget: DashboardWidget;          // NEW
      sectionId: string; dashboardId: string }
  | { type: 'compositionSaved' }                                     // NEW
  | { type: 'addWidgetRequested'; sectionId: string;                 // NEW
      dashboardId: string }
```

~15 lines changed.

### Step 2: Fork-on-Edit API (VB24)

**New file:** `src/app/api/admin/views/[viewId]/fork-dashboard/route.ts` (~90 lines)

`POST` endpoint. `isTrueAdmin` gate.

Request: `{ moduleAssignmentId: string }`

Logic:
1. Look up `view_profile_modules` row by ID
2. If `dashboard_id` is already set, return it (no-op)
3. Find the module's template dashboard (`dashboards.is_template = true AND module_id = X`)
4. Clone dashboard row → `is_template: false`, `partner_id: null`
5. Clone all sections with new UUIDs, preserving `sort_order`
6. Clone all widgets with new UUIDs, preserving grid positions and configs
7. Update `view_profile_modules.dashboard_id` → new dashboard ID
8. Return `{ dashboardId: string, forked: boolean }`

### Step 3: Preview Edit Mode (VB25)

**Modify:** `src/components/views/preview-context.tsx`

Add to `PreviewContextValue`:
```typescript
isEditMode: boolean
setEditMode: (enabled: boolean) => void
activeDashboardId: string | null
```

**Modify:** `src/components/views/preview-shell.tsx`

Extend `listenFromParent` handler:
- `editModeChanged` → `setEditMode(msg.enabled)`
- `openWidgetConfig` → forward to active module content (via context or callback)

**Modify:** `src/components/views/preview-module-content.tsx` (~major, +150 lines)

When `isEditMode` is true, replace the read-only grid with interactive `SectionContainer` + `WidgetWrapper`:

```typescript
// Read-only mode (existing)
<div className="grid" style={{ gridTemplateColumns: 'repeat(8, 1fr)' }}>
  {widgets.map(w => <div style={gridPlacement(w)}><WidgetRenderer .../></div>)}
</div>

// Edit mode (new)
<SectionContainer
  section={section}
  dateRange={dateRange}
  partnerId={effectivePartnerId}
  dataMode={effectiveDataMode}
  refreshTick={0}
  forceRefreshToken={0}
  isEditMode={true}
  onAddWidget={(sectionId) => sendToParent({ type: 'addWidgetRequested', sectionId, dashboardId })}
  onEditWidget={(widget) => sendToParent({ type: 'widgetEditRequested', widget, sectionId, dashboardId })}
  onDeleteWidget={handleDeleteWidget}
  onToggleCollapse={handleToggleCollapse}
  onMoveWidget={handleMoveWidget}
  onResizeWidget={handleResizeWidget}
/>
```

Widget move/resize handlers call the dashboard APIs directly from the iframe (same-origin, authenticated session) and update local state optimistically.

### Step 4: Edit Mode Toggle in Builder (VB26)

**Modify:** `src/app/(dashboard)/admin/views/[viewId]/page.tsx` (~+60 lines)

Add to toolbar:
- `isEditMode` state + `Pencil`/`PencilOff` toggle button
- On toggle: call fork-on-edit API if needed → send `editModeChanged` via bridge
- Show save indicator when iframe has unsaved changes

Add `WidgetConfigDialog` render:
- `widgetConfigOpen` state, `editingWidget` state, `targetSectionId` state, `targetDashboardId` state
- Opened when iframe sends `widgetEditRequested` or `addWidgetRequested`
- On save: call widget API (POST or PATCH) → send `refreshRequested` to iframe

### Step 5: Section Management in Settings Drawer (VB27)

**Modify:** `src/components/views/settings-drawer.tsx` (~+120 lines)

Add a fourth collapsible section: **Dashboard Sections** (only visible when a module is selected and has a dashboard).

Props additions:
```typescript
activeDashboardId?: string | null
dashboardSections?: DashboardSection[]
onAddSection?: (title: string) => void
onRenameSection?: (sectionId: string, title: string) => void
onDeleteSection?: (sectionId: string) => void
onReorderSections?: (order: Array<{ id: string; sort_order: number }>) => void
```

UI: List of sections with inline rename, delete button, drag-to-reorder (reuse `@dnd-kit/sortable` pattern from module order section), "Add Section" form at bottom.

**Modify:** `src/app/(dashboard)/admin/views/[viewId]/page.tsx`

Add section CRUD handlers that call existing APIs:
- `POST /api/modules/dashboards/${dashboardId}/sections` → add section
- `PATCH /api/modules/dashboards/${dashboardId}/sections` → reorder
- `DELETE` handled via dashboard section endpoint
- After mutation: `sendToPreview(iframeRef, { type: 'refreshRequested' })`

### Step 6: Dashboard Data in View Builder Hook (VB28)

**Modify:** `src/app/(dashboard)/admin/views/[viewId]/use-view-builder-data.ts` (~+60 lines)

Add:
```typescript
const [activeDashboard, setActiveDashboard] = useState<DashboardWithChildren | null>(null)

const fetchDashboard = useCallback(async (dashboardId: string) => {
  const res = await fetch(`/api/modules/dashboards/${dashboardId}`)
  if (!res.ok) return
  const json = await res.json()
  setActiveDashboard(json.data?.dashboard ?? null)
}, [])
```

Expose `activeDashboard`, `fetchDashboard`, and derived `dashboardSections` in the return value. Fetched when user enters edit mode for a module.

### Step 7: Widget Config Integration (VB29)

**Modify:** `src/app/(dashboard)/admin/views/[viewId]/page.tsx` (~+40 lines)

Import `WidgetConfigDialog` from reporting system. Wire it up:

```typescript
<WidgetConfigDialog
  open={widgetConfigOpen}
  onOpenChange={setWidgetConfigOpen}
  widget={editingWidget}
  onSave={handleWidgetConfigSave}
/>
```

`handleWidgetConfigSave`:
1. If `editingWidget` → PATCH existing widget
2. If new (from `addWidgetRequested`) → POST new widget with auto-placement via `findFirstAvailable()`
3. After API success: `data.fetchDashboard(targetDashboardId)` + `sendToPreview(iframeRef, { type: 'refreshRequested' })`

### Step 8: Audit Logging for Composition (VB30)

**Modify:** `src/lib/audit/admin-audit.ts`

Add actions:
```typescript
| 'section.create'
| 'section.delete'
| 'section.reorder'
| 'widget.create'
| 'widget.update'
| 'widget.delete'
| 'dashboard.fork'
```

Add convenience helpers: `logSectionCreate()`, `logWidgetCreate()`, `logDashboardFork()`, etc.

**Modify:** Fork-dashboard route and widget/section mutation handlers to call audit helpers.

### Step 9: Smoke Tests (VB31)

**New file:** `__tests__/view-builder-wave4-smoke.test.ts` (~200 lines)

| # | Test | What It Verifies |
|---|------|-----------------|
| 1 | Fork-on-edit creates new dashboard | Template cloned, assignment updated |
| 2 | Fork-on-edit is idempotent | Second call returns same dashboard |
| 3 | Section CRUD round-trip | Create → list → rename → delete |
| 4 | Widget create with auto-placement | New widget placed at first available cell |
| 5 | Widget move persists grid position | Move → fetch → verify coordinates |
| 6 | Widget resize persists dimensions | Resize → fetch → verify col_span/row_span |
| 7 | Non-admin rejected from fork endpoint | `isTrueAdmin` gate on fork-dashboard |
| 8 | Edit mode bridge message round-trip | Parent sends → iframe receives correctly |

---

## Files Summary

| # | File | Action | Step | Agent |
|---|------|--------|------|-------|
| 1 | `src/lib/views/preview-bridge.ts` | Modify (+15 lines) | 1 | A |
| 2 | `src/app/api/admin/views/[viewId]/fork-dashboard/route.ts` | Create (~90 lines) | 2 | B |
| 3 | `src/components/views/preview-context.tsx` | Modify (+15 lines) | 3 | A |
| 4 | `src/components/views/preview-shell.tsx` | Modify (+20 lines) | 3 | A |
| 5 | `src/components/views/preview-module-content.tsx` | Modify (+150 lines) | 3 | A |
| 6 | `src/app/(dashboard)/admin/views/[viewId]/page.tsx` | Modify (+100 lines) | 4, 7 | A |
| 7 | `src/components/views/settings-drawer.tsx` | Modify (+120 lines) | 5 | A |
| 8 | `src/app/(dashboard)/admin/views/[viewId]/use-view-builder-data.ts` | Modify (+60 lines) | 6 | B |
| 9 | `src/lib/audit/admin-audit.ts` | Modify (+50 lines) | 8 | D |
| 10 | `__tests__/view-builder-wave4-smoke.test.ts` | Create (~200 lines) | 9 | D |

**Estimated delta:** ~820 new lines across 10 files (2 new, 8 modified).

---

## Agent Ownership

| Agent | Role | Owns Steps | Primary Files |
|-------|------|-----------|---------------|
| **A: Composer UI** | Bridge messages, edit mode, interactive preview, section drawer, toolbar | 1, 3, 4, 5 | preview-bridge, preview-context, preview-shell, preview-module-content, page.tsx, settings-drawer |
| **B: Data/API** | Fork-on-edit endpoint, dashboard data hook, widget config wiring | 2, 6, 7 | fork-dashboard/route.ts, use-view-builder-data.ts, page.tsx (widget config only) |
| **C: Preview Parity** | Verify edit mode doesn't break read-only preview, audience labels, device modes, regression testing | Cross-cutting | All preview files (read-only verification) |
| **D: QA/Security** | Audit actions, smoke tests, auth boundary checks, docs gate | 8, 9 | admin-audit.ts, smoke test file |

### Dependency Graph

```
Step 1 (bridge) ──→ Step 3 (edit mode) ──→ Step 4 (toggle + config dialog)
                                         ──→ Step 5 (section drawer)
Step 2 (fork API) ──→ Step 4 (toggle calls fork)
                   ──→ Step 6 (data hook)
Step 6 (data hook) ──→ Step 7 (config integration)
Steps 1-7 ──→ Step 8 (audit)
Steps 1-8 ──→ Step 9 (smoke tests)
```

**Parallelizable:** Steps 1+2 can run in parallel. Steps 3+6 can overlap. Step 8 can start as soon as the action types are defined.

---

## Non-Negotiable Constraints (from kickoff)

1. Reuse existing `WidgetWrapper`, `SectionContainer`, `WidgetRenderer` — no second editor.
2. `preview-session` trust model unchanged (server-only HMAC verification).
3. `isTrueAdmin` gate on all control-plane mutations (fork, section CRUD, widget CRUD).
4. Search-driven audience picker unchanged (no eager preloads).
5. Tablet portrait/landscape preview controls remain working.
6. Edit mode only affects active module's dashboard — other modules' content unchanged.

---

## Risks

| Risk | Mitigation |
|------|-----------|
| `SectionContainer` assumes parent manages save flow | In iframe, we auto-save on each move/resize (immediate API call) rather than batch save. Matches the view builder's per-action persistence pattern. |
| Fork-on-edit creates orphan dashboards if user navigates away | Forked dashboard is a valid entity. No cleanup needed — it's assigned to the view_profile_module. Only risk is if the module assignment is later deleted, but that's existing behavior. |
| Bridge message ordering during rapid edits | Use `refreshTick` counter (existing pattern in DashboardBuilder) to debounce refresh requests. |
| Widget config dialog references `moduleSlug` for data view alias | Pass `moduleSlug` through bridge message context so config dialog can resolve available views. |
| Edit mode in iframe + device preview interaction | Disable edit mode when switching to mobile preview (grid is too narrow for meaningful editing). Re-enable on desktop/tablet. |

---

## Verification

1. **Edit mode toggle:** Click pencil → iframe shows drag handles and resize controls on widgets
2. **Section CRUD:** Add section from drawer → appears in preview. Rename/delete/reorder reflected.
3. **Widget add:** Click "+" per section (in preview or parent) → config dialog → save → widget appears in grid
4. **Widget drag/resize:** Drag widget to new cell → persisted. Resize → persisted. Both reflected immediately.
5. **Widget config edit:** Click widget in edit mode → config dialog in parent → save → widget updates
6. **Fork-on-edit:** First edit on template-backed module → forks dashboard → subsequent edits go to fork
7. **Audience switching in edit mode:** Switch audience → edit mode disabled → preview reloads read-only
8. **Device mode:** Tablet/mobile → edit mode auto-disabled (read-only preview). Desktop → edit mode available.
9. **Build check:** `npm run build` passes, `npx jest` all green
