# View Builder Wave 4 — Claude Revision

Date: 2026-02-11
Round: 11 (Revision of `09-claude-agent-plan.md` in response to `10-codex-review.md`)
Status: REVISED PLAN — READY FOR CODEX RE-REVIEW

---

## Status Map

| # | Finding | Severity | Status | Closure |
|---|---------|----------|--------|---------|
| P1-1 | Fork-on-edit logic uses `dashboard_id != null` as no-op; will mutate shared templates | P1 | **CLOSED** | Fork decision now resolves assigned dashboard and checks `is_template` flag |
| P1-2 | Fork endpoint vulnerable to cross-view assignment targeting | P1 | **CLOSED** | Assignment lookup enforces both `id` AND `view_id`; 404 on mismatch |
| P1-3 | Section CRUD scope incomplete (no rename/delete) | P1 | **CLOSED** | New `/sections/[sectionId]` route added with PATCH (rename) + DELETE |
| P2-1 | Auth policy drift: `requireRole(ROLES.ADMIN)` vs `isTrueAdmin` | P2 | **CLOSED** | All Wave 4 endpoints under `/api/admin/views/` gated by `isTrueAdmin`; shared APIs unchanged |
| P2-2 | Active module ownership underspecified between iframe and parent | P2 | **CLOSED** | New `activeModuleReport` child-to-parent bridge message; parent is source of truth; drawer gated |

---

## Task Deltas

### Delta 1: Fork-on-Edit Semantics (closes P1-1)

**Problem.** `09-claude-agent-plan.md:131-132` says: "If `dashboard_id` is already set, return it (no-op)." But `modules/route.ts:139-154` auto-resolves a template `dashboard_id` when creating a module assignment (queries `dashboards WHERE is_template = true AND module_id = X`). This means `dashboard_id` is almost always non-null after assignment — pointing at the shared template. The first edit would hit the template dashboard directly, leaking edits across every view that references the same module.

**Fix.** Replace the nullability check with a template-awareness check. The revised fork logic:

```
1. Look up `view_profile_modules` row by ID (with view_id binding — see Delta 2)
2. Resolve the assigned dashboard: SELECT * FROM dashboards WHERE id = assignment.dashboard_id
3. Decision:
   a. If dashboard_id IS NULL → find module template, clone it, assign fork
   b. If dashboard IS NOT NULL AND is_template = true → clone it, assign fork
   c. If dashboard IS NOT NULL AND is_template = false → no-op, return existing dashboard_id
4. Return { dashboardId, forked: boolean }
```

**Rationale.** Case (c) is the only safe no-op: the assignment already points to a non-template fork that belongs to this view. Cases (a) and (b) both require cloning because the target is either missing or shared.

**Plan text replaced:** `09-claude-agent-plan.md` Step 2 lines 130-137.

**Revised Step 2 pseudo-code:**

```typescript
// POST /api/admin/views/[viewId]/fork-dashboard
// Auth: isTrueAdmin

const assignment = await supabase
  .from('view_profile_modules')
  .select('id, dashboard_id, module_id')
  .eq('id', body.moduleAssignmentId)
  .eq('view_id', params.viewId)  // P1-2 binding
  .single()

if (!assignment) return 404

// Resolve current dashboard
let needsFork = false
if (!assignment.dashboard_id) {
  needsFork = true  // case (a): no dashboard at all
} else {
  const dashboard = await supabase
    .from('dashboards')
    .select('id, is_template')
    .eq('id', assignment.dashboard_id)
    .single()

  if (!dashboard) {
    needsFork = true  // orphan reference, treat like null
  } else if (dashboard.is_template) {
    needsFork = true  // case (b): shared template
  }
  // else: case (c): already a fork, no-op
}

if (!needsFork) {
  return { dashboardId: assignment.dashboard_id, forked: false }
}

// Clone template → new non-template dashboard
const templateId = assignment.dashboard_id || await findModuleTemplate(assignment.module_id)
const forkedDashboard = await cloneDashboard(templateId, { is_template: false })
await supabase
  .from('view_profile_modules')
  .update({ dashboard_id: forkedDashboard.id })
  .eq('id', assignment.id)

return { dashboardId: forkedDashboard.id, forked: true }
```

---

### Delta 2: Cross-View Assignment Binding (closes P1-2)

**Problem.** `09-claude-agent-plan.md:127-130` defines the fork request as `{ moduleAssignmentId }` and says "look up row by ID." The route path is `/api/admin/views/[viewId]/fork-dashboard`, but without enforcing `view_profile_modules.view_id = params.viewId`, a caller could supply a valid `moduleAssignmentId` belonging to a different view and fork/mutate another view's assignment.

**Fix.** All queries on `view_profile_modules` in the fork endpoint MUST include both `id` and `view_id`:

```typescript
.eq('id', body.moduleAssignmentId)
.eq('view_id', params.viewId)
```

On mismatch, `.single()` returns null → endpoint returns 404 `"Module assignment not found"`. This is a 404 (not 403) to avoid leaking the existence of assignments in other views.

**Test coverage required (added to smoke matrix):**

| # | Test | Expected |
|---|------|----------|
| T-P1-2 | POST fork-dashboard with valid `moduleAssignmentId` belonging to a DIFFERENT `viewId` | 404 |

---

### Delta 3: Section CRUD Contract (closes P1-3)

**Problem.** VB27 acceptance requires add/rename/delete/reorder for sections. The existing route at `/api/modules/dashboards/[dashboardId]/sections/route.ts` supports only POST (create, line 22-75) and PATCH (reorder, line 84-114). There is no rename or delete contract.

**Fix.** Add a new route file for single-section operations. This route is placed under the view-builder admin path to enforce `isTrueAdmin` (see Delta 4), keeping the existing shared sections route unchanged for module-builder use.

**New file:** `src/app/api/admin/views/[viewId]/sections/[sectionId]/route.ts`

This endpoint validates that the section belongs to a dashboard assigned to a module in the specified view, providing both auth and scope binding.

**Contract:**

| Method | Path | Auth | Body | Response | Purpose |
|--------|------|------|------|----------|---------|
| PATCH | `/api/admin/views/[viewId]/sections/[sectionId]` | `isTrueAdmin` | `{ title: string }` | `{ section }` | Rename section |
| DELETE | `/api/admin/views/[viewId]/sections/[sectionId]` | `isTrueAdmin` | — | 204 | Delete section + cascade widgets |

**Scope validation logic (both methods):**

```typescript
// 1. Verify section exists
const section = await supabase
  .from('dashboard_sections')
  .select('id, dashboard_id')
  .eq('id', params.sectionId)
  .single()

// 2. Verify dashboard is assigned to a module in this view
const assignment = await supabase
  .from('view_profile_modules')
  .select('id')
  .eq('view_id', params.viewId)
  .eq('dashboard_id', section.dashboard_id)
  .maybeSingle()

if (!assignment) return 404  // section not reachable from this view
```

**Rename (PATCH):**
```typescript
const RenameSectionSchema = z.object({
  title: z.string().min(1).max(200),
})
// → UPDATE dashboard_sections SET title WHERE id = sectionId
```

**Delete (DELETE):**
```typescript
// → DELETE FROM dashboard_sections WHERE id = sectionId
// Widgets cascade via FK ON DELETE CASCADE (or explicit delete if no FK cascade)
```

**Also add:** A section-create proxy under the same path pattern for consistency:

**New file:** `src/app/api/admin/views/[viewId]/sections/route.ts`

| Method | Path | Auth | Body | Response | Purpose |
|--------|------|------|------|----------|---------|
| POST | `/api/admin/views/[viewId]/sections` | `isTrueAdmin` | `{ dashboardId, title, sort_order? }` | `{ section }` 201 | Create section |
| PATCH | `/api/admin/views/[viewId]/sections` | `isTrueAdmin` | `{ dashboardId, order: [{id, sort_order}] }` | `{ reordered: true }` | Reorder sections |

These proxy routes validate `dashboardId` belongs to a module assignment in the given view, then perform the same insert/update logic as the existing shared sections route. This ensures all Wave 4 section mutations flow through `isTrueAdmin`-gated endpoints with view-scoped validation.

**Impact on Step 5 (VB27):** The settings drawer section CRUD handlers in `page.tsx` now call the new admin view-scoped routes instead of the shared `/api/modules/dashboards/[dashboardId]/sections` routes:

```
OLD: POST   /api/modules/dashboards/${dashboardId}/sections
NEW: POST   /api/admin/views/${viewId}/sections
     PATCH  /api/admin/views/${viewId}/sections           (reorder)
     PATCH  /api/admin/views/${viewId}/sections/${id}     (rename)
     DELETE /api/admin/views/${viewId}/sections/${id}
```

---

### Delta 4: Auth Policy Alignment (closes P2-1)

**Problem.** The plan specifies `isTrueAdmin` for control-plane mutations (line 348), but Wave 4 section/widget mutations would route through existing dashboard APIs gated by `requireRole(ROLES.ADMIN)`. Since `ROLES.ADMIN` maps from both `admin` and `operations_admin` raw staff roles (`src/lib/auth/roles.ts`), `requireRole(ROLES.ADMIN)` admits `operations_admin` — violating the view-builder's stricter `isTrueAdmin` policy which checks `staffRole === 'admin'` exclusively (`src/lib/auth/admin-access.ts:3-6`).

**Resolution: Two-tier auth boundary.**

1. **Existing shared APIs** (`/api/modules/dashboards/[dashboardId]/sections`, `/api/modules/dashboards/[dashboardId]/widgets`): **unchanged.** These serve the module builder (`DashboardBuilder` component) which is legitimately accessible to `operations_admin`. Changing these would regress module-builder access.

2. **All Wave 4 view-builder composition endpoints**: routed under `/api/admin/views/[viewId]/...` and gated by `isTrueAdmin`. This includes:
   - `POST /api/admin/views/[viewId]/fork-dashboard` (already specified)
   - `POST|PATCH /api/admin/views/[viewId]/sections` (new — Delta 3)
   - `PATCH|DELETE /api/admin/views/[viewId]/sections/[sectionId]` (new — Delta 3)
   - `POST|PATCH|DELETE /api/admin/views/[viewId]/widgets` (new — see below)

3. **New widget proxy route:** `src/app/api/admin/views/[viewId]/widgets/route.ts`
   - `isTrueAdmin` gate
   - Validates `dashboardId` (from request body) belongs to a module assignment in this view
   - Same Zod schemas as existing widget route
   - Performs same create/update/delete logic

**Hard rule (document in plan):** Wave 4 mutations from the view builder page MUST NOT call shared `/api/modules/dashboards/...` routes directly. All composition mutations flow through the view-scoped `/api/admin/views/[viewId]/...` endpoints. This ensures:
- `isTrueAdmin` enforcement on every mutation
- View-scope binding on every mutation (no cross-view targeting)
- Shared module-builder APIs remain unaffected

**Helper:** Create a `requireTrueAdmin()` function in `src/lib/auth/api-auth.ts` that mirrors `requireRole()` but uses `isTrueAdmin` logic:

```typescript
export async function requireTrueAdmin() {
  const auth = await requireAuth()
  if (!auth.authenticated) return auth
  if (!isTrueAdmin(auth.user.staffRole, auth.user.email)) {
    return { authenticated: false as const, response: ApiErrors.forbidden('Requires true admin') }
  }
  return auth
}
```

---

### Delta 5: Active Module Ownership (closes P2-2)

**Problem.** The settings drawer's "Dashboard Sections" section (Step 5) requires knowing which module/dashboard is currently active. The plan defines `activeModuleChanged` as parent-to-iframe (line 103) but does not define how the parent learns the active module when the user navigates within the iframe (clicking sidebar links in the preview).

**Fix: Parent is source of truth, iframe reports navigation.**

1. **New bridge message** (child → parent):

```typescript
/** iframe → parent (addition to ChildMessage union) */
| { type: 'activeModuleReport'; moduleSlug: string; dashboardId: string | null }
```

2. **When iframe sends this message:**
   - On `previewReady` — iframe reports which module is currently rendered
   - On iframe internal navigation — when user clicks a sidebar link in the preview shell, the `event.preventDefault()` handler (already in `preview-shell.tsx:148-170`) extracts the module slug from the URL, sends `activeModuleReport` to parent, then navigates internally

3. **Parent receives and stores:**

```typescript
// In page.tsx bridge listener
case 'activeModuleReport':
  setActiveModuleSlug(msg.moduleSlug)
  setActiveDashboardId(msg.dashboardId)
  // If edit mode was on and module changed, disable edit mode
  if (isEditMode) {
    setIsEditMode(false)
    sendToPreview(iframeRef, { type: 'editModeChanged', enabled: false })
  }
  break
```

4. **Drawer gating:**
   - "Dashboard Sections" collapsible section in settings drawer: **hidden** when `activeDashboardId` is null
   - "Dashboard Sections" header shows active module name for clarity
   - Section CRUD buttons disabled when `isEditMode` is false (read-only view of sections list)

5. **Edit mode re-entry after module switch:**
   - When user switches modules (via iframe navigation or `activeModuleChanged` from parent), edit mode resets to off
   - User must re-enable edit mode for the new module
   - This triggers a fresh fork check for the new module's dashboard

**Updated bridge protocol (complete):**

```typescript
/** Parent → iframe */
export type ParentMessage =
  | { type: 'refreshRequested' }
  | { type: 'activeModuleChanged'; slug: string }
  | { type: 'editModeChanged'; enabled: boolean }
  | { type: 'openWidgetConfig'; widget: DashboardWidget | null;
      sectionId: string; dashboardId: string }

/** iframe → parent */
export type ChildMessage =
  | { type: 'previewReady' }
  | { type: 'previewError'; message: string }
  | { type: 'activeModuleReport'; moduleSlug: string;              // NEW
      dashboardId: string | null }
  | { type: 'widgetEditRequested'; widget: DashboardWidget;
      sectionId: string; dashboardId: string }
  | { type: 'compositionSaved' }
  | { type: 'addWidgetRequested'; sectionId: string;
      dashboardId: string }
```

---

## Revised Dependency Graph

```
Step 1 (bridge + activeModuleReport) ──→ Step 3 (edit mode in preview)
                                      ──→ Step 5 (section drawer gating)

Step 2 (fork API with is_template check + view_id binding) ──→ Step 4 (toggle calls fork)

Step 3 ──→ Step 4 (edit mode toggle + config dialog)
        ──→ Step 5 (section drawer)

Step 2 ──→ Step 6 (data hook for dashboard)

Step 6 ──→ Step 7 (widget config integration)

Delta 3 new routes ──→ Step 5 (section CRUD handlers use new endpoints)
Delta 4 widget proxy ──→ Steps 4, 7 (widget mutations use new endpoints)

Steps 1-7 ──→ Step 8 (audit logging)
Steps 1-8 ──→ Step 9 (smoke tests)
```

**Parallelizable:**
- Steps 1 + 2 + Delta 3/4 route creation can run in parallel
- Steps 3 + 6 can overlap once their deps are met
- Step 8 can start once action type names are defined

---

## Endpoint Contract Table (Complete)

| # | Method | Path | Auth | Request Body | Response | Source |
|---|--------|------|------|-------------|----------|--------|
| E1 | POST | `/api/admin/views/[viewId]/fork-dashboard` | `isTrueAdmin` | `{ moduleAssignmentId }` | `{ dashboardId, forked }` | Step 2 (revised) |
| E2 | POST | `/api/admin/views/[viewId]/sections` | `isTrueAdmin` | `{ dashboardId, title, sort_order? }` | `{ section }` 201 | Delta 3 |
| E3 | PATCH | `/api/admin/views/[viewId]/sections` | `isTrueAdmin` | `{ dashboardId, order: [{id, sort_order}] }` | `{ reordered }` | Delta 3 |
| E4 | PATCH | `/api/admin/views/[viewId]/sections/[sectionId]` | `isTrueAdmin` | `{ title }` | `{ section }` | Delta 3 |
| E5 | DELETE | `/api/admin/views/[viewId]/sections/[sectionId]` | `isTrueAdmin` | — | 204 | Delta 3 |
| E6 | POST | `/api/admin/views/[viewId]/widgets` | `isTrueAdmin` | `{ dashboardId, section_id, widget_type, title, grid_*, col_span, row_span, config }` | `{ widget }` 201 | Delta 4 |
| E7 | PATCH | `/api/admin/views/[viewId]/widgets` | `isTrueAdmin` | `{ dashboardId, widget_id, ...updates }` | `{ widget }` | Delta 4 |
| E8 | DELETE | `/api/admin/views/[viewId]/widgets` | `isTrueAdmin` | `{ dashboardId, widget_id }` | `{ deleted }` | Delta 4 |

**Scope validation (all endpoints):** Every endpoint validates that the target `dashboardId` (or the section's parent `dashboard_id`) is assigned to a `view_profile_modules` row with `view_id = params.viewId`. Returns 404 on mismatch.

**Existing shared APIs (unchanged):**

| Method | Path | Auth | Used By |
|--------|------|------|---------|
| POST | `/api/modules/dashboards/[dashboardId]/sections` | `requireRole(ADMIN)` | Module builder only |
| PATCH | `/api/modules/dashboards/[dashboardId]/sections` | `requireRole(ADMIN)` | Module builder only |
| POST | `/api/modules/dashboards/[dashboardId]/widgets` | `requireRole(ADMIN)` | Module builder only |
| PATCH | `/api/modules/dashboards/[dashboardId]/widgets` | `requireRole(ADMIN)` | Module builder only |
| DELETE | `/api/modules/dashboards/[dashboardId]/widgets` | `requireRole(ADMIN)` | Module builder only |

---

## Revised Files Summary

| # | File | Action | Step/Delta | Agent | Lines |
|---|------|--------|-----------|-------|-------|
| 1 | `src/lib/views/preview-bridge.ts` | Modify | 1, Delta 5 | A | +20 |
| 2 | `src/app/api/admin/views/[viewId]/fork-dashboard/route.ts` | Create | 2, Delta 1+2 | B | ~110 |
| 3 | `src/components/views/preview-context.tsx` | Modify | 3 | A | +15 |
| 4 | `src/components/views/preview-shell.tsx` | Modify | 3, Delta 5 | A | +30 |
| 5 | `src/components/views/preview-module-content.tsx` | Modify | 3 | A | +150 |
| 6 | `src/app/(dashboard)/admin/views/[viewId]/page.tsx` | Modify | 4, 5, 7, Delta 5 | A | +120 |
| 7 | `src/components/views/settings-drawer.tsx` | Modify | 5 | A | +120 |
| 8 | `src/app/(dashboard)/admin/views/[viewId]/use-view-builder-data.ts` | Modify | 6 | B | +60 |
| 9 | `src/lib/audit/admin-audit.ts` | Modify | 8 | D | +50 |
| 10 | `__tests__/view-builder-wave4-smoke.test.ts` | Create | 9 | D | ~250 |
| 11 | `src/app/api/admin/views/[viewId]/sections/route.ts` | **Create** | Delta 3 | B | ~90 |
| 12 | `src/app/api/admin/views/[viewId]/sections/[sectionId]/route.ts` | **Create** | Delta 3 | B | ~80 |
| 13 | `src/app/api/admin/views/[viewId]/widgets/route.ts` | **Create** | Delta 4 | B | ~120 |
| 14 | `src/lib/auth/api-auth.ts` | **Modify** | Delta 4 | B | +15 |

**Estimated delta:** ~1,030 new lines across 14 files (5 new, 9 modified). Up from ~820/10 in the original plan due to the new view-scoped proxy routes and `requireTrueAdmin` helper.

---

## Revised Agent Ownership

| Agent | Role | Owns | Primary Files |
|-------|------|------|---------------|
| **A: Composer UI** | Bridge messages (incl. `activeModuleReport`), edit mode, interactive preview, section drawer, toolbar | Steps 1, 3, 4, 5; Delta 5 | preview-bridge, preview-context, preview-shell, preview-module-content, page.tsx, settings-drawer |
| **B: Data/API** | Fork-on-edit (revised), section CRUD routes, widget proxy route, `requireTrueAdmin`, dashboard data hook | Steps 2, 6, 7; Deltas 1-4 | fork-dashboard/route.ts, sections/route.ts, sections/[sectionId]/route.ts, widgets/route.ts, api-auth.ts, use-view-builder-data.ts |
| **C: Preview Parity** | Verify edit mode doesn't break read-only preview, audience labels, device modes, regression testing | Cross-cutting | All preview files (read-only verification) |
| **D: QA/Security** | Audit actions, smoke tests, auth boundary checks, docs gate | Steps 8, 9 | admin-audit.ts, smoke test file |

---

## Revised Test Matrix

| # | Test | Endpoint/Feature | Verifies |
|---|------|-----------------|----------|
| T1 | Fork-on-edit: template dashboard → new fork created | E1 | P1-1 case (b): `is_template = true` triggers clone |
| T2 | Fork-on-edit: null dashboard_id → template found and cloned | E1 | P1-1 case (a): null triggers clone |
| T3 | Fork-on-edit: non-template fork → no-op returns existing | E1 | P1-1 case (c): `is_template = false` returns same ID |
| T4 | Fork-on-edit: idempotent (second call same result) | E1 | Case (c) after first fork |
| T5 | Fork-on-edit: cross-view assignment → 404 | E1 | **P1-2**: `view_id` mismatch rejected |
| T6 | Section create via view endpoint | E2 | Delta 3: new section appears |
| T7 | Section reorder via view endpoint | E3 | Delta 3: sort_order updated |
| T8 | Section rename via view endpoint | E4 | **P1-3**: rename contract works |
| T9 | Section delete via view endpoint | E5 | **P1-3**: section removed, widgets cascade |
| T10 | Section operation on dashboard not in view → 404 | E4 or E5 | Scope binding validation |
| T11 | Widget create via view endpoint | E6 | Delta 4: widget placed |
| T12 | Widget update (move/resize) via view endpoint | E7 | Position persisted |
| T13 | Widget delete via view endpoint | E8 | Widget removed |
| T14 | Widget operation on dashboard not in view → 404 | E6, E7, or E8 | Scope binding validation |
| T15 | `operations_admin` rejected from fork endpoint | E1 | **P2-1**: `isTrueAdmin` excludes `operations_admin` |
| T16 | `operations_admin` rejected from section rename | E4 | **P2-1**: consistent auth policy |
| T17 | `operations_admin` rejected from widget create | E6 | **P2-1**: consistent auth policy |
| T18 | Edit mode bridge round-trip | Bridge | Parent sends `editModeChanged` → iframe receives |
| T19 | `activeModuleReport` bridge round-trip | Bridge | **P2-2**: iframe sends → parent receives and stores |
| T20 | Section drawer hidden when no active module | UI | **P2-2**: drawer gating |

---

## Non-Negotiable Constraints (updated)

1. Reuse existing `WidgetWrapper`, `SectionContainer`, `WidgetRenderer` — no second editor.
2. `preview-session` trust model unchanged (server-only HMAC verification).
3. **All Wave 4 composition endpoints gated by `isTrueAdmin` via `requireTrueAdmin()`.** Shared dashboard APIs remain unchanged at `requireRole(ROLES.ADMIN)`.
4. **All Wave 4 endpoints validate view-scope binding** — target dashboard must be assigned to a module in `params.viewId`.
5. Search-driven audience picker unchanged (no eager preloads).
6. Tablet portrait/landscape preview controls remain working.
7. Edit mode only affects active module's dashboard — other modules' content unchanged.
8. **Parent is source of truth for active module context.** Iframe reports navigation via `activeModuleReport`. Section drawer gated when context is missing.

---

## Summary of Changes from Original Plan

| Aspect | Original (`09`) | Revised (`11`) |
|--------|-----------------|----------------|
| Fork decision | `dashboard_id != null` → no-op | Resolve dashboard, check `is_template` flag |
| Fork scope binding | Lookup by `id` only | Lookup by `id` AND `view_id` |
| Section rename/delete | "Handled via dashboard section endpoint" (nonexistent) | New `/api/admin/views/[viewId]/sections/[sectionId]` route |
| Section/widget auth | Calls shared `/api/modules/dashboards/...` routes | New view-scoped proxy routes under `/api/admin/views/[viewId]/...` |
| Auth gate | Mix of `isTrueAdmin` (fork) + `requireRole` (shared routes) | All Wave 4 endpoints: `requireTrueAdmin()` |
| Active module | Parent→iframe only | Bidirectional: parent→iframe + iframe→parent (`activeModuleReport`) |
| Drawer gating | Not specified | Hidden when no `activeDashboardId`; edit controls disabled when `!isEditMode` |
| Files | 10 (2 new, 8 modified) | 14 (5 new, 9 modified) |
| Estimated lines | ~820 | ~1,030 |
| Smoke tests | 8 | 20 |

---

Ready for Codex re-review.
