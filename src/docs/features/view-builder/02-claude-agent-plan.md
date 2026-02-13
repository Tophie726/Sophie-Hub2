# View Builder (Inception Mode) Agent Plan

Date: 2026-02-10
Round: 02 (Claude agent plan)

Source: `01-codex-proposal.md`

---

## Resolved Decisions (Carried Forward from Codex Proposal)

1. **Separate route group** `src/app/(preview)/` for preview rendering — isolates from dashboard layout.
2. **Dynamic "Modules" nav section** in preview sidebar — items from `view_profile_modules` by `sort_order`.
3. **Snapshot mode default** for data — optional live mode tied to audience entity.
4. **No inline widget editing** in v1 — compose-existing modules only.
5. **Add-module via command-palette modal** from toolbar.
6. **Extend existing HMAC signing pattern** from `viewer-session.ts` for preview tokens.
7. **Actor auth remains authoritative** — preview subject only affects rendering, never write permissions.

---

## Hard Rules

| ID | Rule |
|----|------|
| HR-1 | Preview subject NEVER affects write permissions — actor-derived auth is always authoritative |
| HR-2 | Preview tokens are HMAC-signed, short-TTL (15 min), admin-only issuance |
| HR-3 | Preview shell MUST reuse shared layout components — no parallel maintenance of sidebar/nav |
| HR-4 | All module composition mutations audit-logged via `logAdminAudit()` |
| HR-5 | Non-admin requests to preview endpoints return 403, no information leak |

---

## Wave 0: Contracts + Pre-Flight

### W0.1 — PreviewSession Type Contract

**File:** `src/lib/views/preview-session.ts` (new)

```typescript
export interface PreviewSessionPayload {
  viewId: string                // UUID of the view being previewed
  subjectType: 'self' | 'staff' | 'partner' | 'role' | 'partner_type'
  subjectTargetId: string | null
  subjectLabel: string
  resolvedRole: Role            // role used for nav filtering in preview
  dataMode: 'snapshot' | 'live'
  actorId: string               // admin who created the session (for audit)
  actorEmail: string
  issuedAt: number              // epoch ms
  expiresAt: number             // epoch ms (issuedAt + 15 min)
}
```

**Signing:** Reuse the HMAC pattern from `viewer-session.ts`:
- `createPreviewToken(payload: PreviewSessionPayload): string` — base64 payload + `.` + HMAC-SHA256 signature
- `verifyPreviewToken(token: string): PreviewSessionPayload | null` — verify signature, check expiry, parse payload
- Secret: `NEXTAUTH_SECRET` (same as view cookie)

**Tests (4):**
- Creates valid token and verifies it
- Rejects tampered token (modified payload)
- Rejects expired token (issuedAt 20 min ago)
- Returns null for malformed input

### W0.2 — Architecture Decision: Shell Extraction Strategy

The current `MainLayout` renders:
```
<Sidebar />
<MobileHeader />
<main className="pl-0 md:pl-64">
  <ViewerContextBadge />
  <ErrorBoundary>{children}</ErrorBoundary>
</main>
```

**Strategy:** Extract the sidebar rendering into a shared component that accepts a `navSections` prop instead of always calling `getNavigationForRole()` with the real user role. This allows:
- **Production layout:** Passes nav from real role (current behavior, zero changes)
- **Preview layout:** Passes nav computed from simulated role + dynamic module items

**Shared primitives to extract:**
- `SidebarShell` — renders nav sections, profile area, logo (already in `SidebarContent`)
- `AppShell` — sidebar + main area wrapper (thin extraction from `MainLayout`)

**Key constraint (HR-3):** The preview must look identical to production. Any visual drift = bug.

---

## Wave 1: Foundation (VB1–VB8)

### VB1 + VB2: Preview Token Utility

**Owner:** `api-flow`
**File:** `src/lib/views/preview-session.ts`
**Depends on:** W0.1 contract

Implementation:
1. `createPreviewToken(payload)` — `JSON.stringify` → `base64` → HMAC sign → concat with `.`
2. `verifyPreviewToken(token)` — split on `.`, verify HMAC, decode base64, parse JSON, check `expiresAt > Date.now()`
3. `PREVIEW_TOKEN_TTL = 15 * 60 * 1000` (15 minutes)

### VB3: Preview Session API

**Owner:** `api-flow`
**File:** `src/app/api/admin/views/preview-session/route.ts` (new)
**Depends on:** VB2

**`POST /api/admin/views/preview-session`**
- Auth: `requireRole(ROLES.ADMIN)` — HR-5
- Body: `{ viewId, subjectType, subjectTargetId?, subjectLabel?, dataMode? }`
- Validates viewId exists and is active
- Resolves `subjectLabel` and `resolvedRole` from DB (same logic as `viewer-context/route.ts`)
- Creates preview token via `createPreviewToken()`
- Returns `{ token, expiresAt, previewUrl: '/preview?token=...' }`
- Audit log: new action `preview.create`

**`DELETE /api/admin/views/preview-session`**
- Optional: invalidate token (client-side discard is sufficient for v1 since tokens are short-lived)

### VB4: Preview Context API

**Owner:** `api-flow`
**File:** `src/app/api/admin/views/[viewId]/preview-context/route.ts` (new)
**Depends on:** VB2

**`GET /api/admin/views/[viewId]/preview-context`**
- Auth: `requireRole(ROLES.ADMIN)`
- Returns resolved payload for builder toolbar defaults:
  ```json
  {
    "view": { "id", "name", "slug", "is_active", "is_default" },
    "audienceRules": [...],
    "assignedModules": [
      { "module_id", "slug", "name", "icon", "color", "sort_order", "dashboard_id" }
    ],
    "currentSubject": { "type", "targetId", "targetLabel", "resolvedRole" }
  }
  ```
- Module list comes from `view_profile_modules` joined with `modules` table, ordered by `sort_order`

### VB5: Preview Route Group + Layout

**Owner:** `ui-ops`
**File:** `src/app/(preview)/layout.tsx` (new)
**File:** `src/app/(preview)/preview/page.tsx` (new)
**Depends on:** VB3

**Layout** (`src/app/(preview)/layout.tsx`):
```typescript
export default async function PreviewLayout({ children }) {
  // Server-side: verify admin session exists (same NextAuth check)
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login.html')

  // No MainLayout wrapper — preview renders its own shell
  return <>{children}</>
}
```

**Preview Page** (`src/app/(preview)/preview/page.tsx`):
- Client component
- Reads `?token=...` from search params
- Calls `verifyPreviewToken()` client-side (or API call to verify server-side)
- On valid token: renders `<PreviewShell>` with simulated context
- On invalid/expired: shows error state with "Return to builder" link

**`PreviewShell` component** (`src/components/views/preview-shell.tsx`):
```typescript
interface PreviewShellProps {
  session: PreviewSessionPayload
  modules: PreviewModule[]  // from preview-context API
}
```
- Renders the full app shell: sidebar + header + content area
- Sidebar uses `getNavigationForRole(session.resolvedRole)` for base nav
- Appends dynamic "Modules" section with items from `modules` prop
- Content area renders the selected module's dashboard
- Listens for `postMessage` events from parent builder for audience switches

### VB6: Shared Shell Primitives

**Owner:** `ui-ops`
**File:** `src/components/layout/sidebar.tsx` (modify)
**File:** `src/components/layout/app-shell.tsx` (new — thin wrapper)
**Depends on:** VB5

Extract from existing `SidebarContent`:
- Accept optional `navOverride?: NavSection[]` prop
- If provided, use it instead of calling `getNavigationForRole(role)`
- If not provided, behavior is unchanged (current production path)

This is the **minimal extraction** — we don't create a new component, we add one optional prop to the existing sidebar. Diff is ~10 lines.

### VB7: Preview Context Provider

**Owner:** `ui-ops`
**File:** `src/components/views/preview-context.tsx` (new)
**Depends on:** VB4, VB6

```typescript
interface PreviewContextValue {
  viewId: string
  subjectType: string
  subjectTargetId: string | null
  resolvedRole: Role
  dataMode: 'snapshot' | 'live'
  modules: PreviewModule[]
  activeModuleSlug: string | null
  setActiveModule: (slug: string) => void
}

const PreviewContext = createContext<PreviewContextValue | null>(null)
export const usePreviewContext = () => useContext(PreviewContext)
```

Wraps the preview shell. All preview-aware components read from this context.

### VB8: Module-Nav Resolver

**Owner:** `api-flow`
**File:** `src/lib/views/module-nav.ts` (new)
**Depends on:** VB4

```typescript
export interface PreviewModule {
  moduleId: string
  slug: string
  name: string
  icon: string      // Lucide icon name
  color: string
  sortOrder: number
  dashboardId: string | null
}

export function buildModuleNavSection(modules: PreviewModule[]): NavSection {
  return {
    title: 'Modules',
    items: modules.map(m => ({
      name: m.name,
      href: `/preview/module/${m.slug}`,
      icon: resolveIcon(m.icon),  // Map string → LucideIcon
    })),
  }
}
```

**Icon resolver:** Map icon name strings (stored in DB) to Lucide components. Small lookup table for the ~10 icons currently in use.

---

## Wave 2: Builder UI (VB11–VB19)

### VB11: Builder Page Redesign

**Owner:** `ui-ops`
**File:** `src/app/(dashboard)/admin/views/[viewId]/page.tsx` (major rewrite)
**Depends on:** VB5

**New layout:**
```
┌─────────────────────────────────────────────────────────────────────┐
│ ← Back   "Admin" view   [Audience ▾]  [📱💻🖥]  [⚙]  [⛶]        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│                     <iframe src="/preview?token=..." />             │
│                                                                     │
│                     Full-width, full-height preview                  │
│                     (100% of remaining viewport)                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Toolbar items (left to right):**
1. Back button → `/admin/views`
2. View name (click to edit inline)
3. Audience selector (see VB12)
4. Device toggle: Desktop / Tablet / Mobile (reuse dashboard-builder pattern)
5. Settings gear → opens settings drawer (see VB14)
6. Add module button → opens modal (see VB15)
7. Fullscreen toggle

**iframe management:**
- On mount: `POST /api/admin/views/preview-session` → get token → set iframe `src`
- On audience change: new token → update iframe `src` (or postMessage to preview)
- On device change: resize iframe container (375px / 768px / 100%)

**State:**
```typescript
const [previewToken, setPreviewToken] = useState<string | null>(null)
const [previewMode, setPreviewMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop')
const [isFullscreen, setIsFullscreen] = useState(false)
const [settingsOpen, setSettingsOpen] = useState(false)
const [addModuleOpen, setAddModuleOpen] = useState(false)

// Audience state
const [subjectType, setSubjectType] = useState<string>('self')
const [subjectTargetId, setSubjectTargetId] = useState<string | null>(null)
```

### VB12: Audience Selector

**Owner:** `ui-ops`
**File:** `src/components/views/audience-selector.tsx` (new)
**Depends on:** VB11

Two-level hierarchy matching existing viewer-context pattern:
```
[Audience ▾]
├── Staff
│   ├── By Role → [Admin, PPC Strategist, Staff]
│   └── By Person → [searchable staff list]
├── Partner
│   ├── By Type → [PPC Basic, Sophie PPC, CC, FAM, PLI, TTS]
│   └── By Brand → [searchable partner list]
└── Default (no audience filter)
```

- Uses `Popover` with nested sections
- Staff search: `GET /api/staff?q=...` (existing)
- Partner search: `GET /api/partners?q=...` (existing)
- On selection: triggers new preview token creation + iframe refresh

### VB13: Data Mode Toggle

**Owner:** `ui-ops`
**Depends on:** VB11

Simple toggle in toolbar (or inside settings drawer to reduce toolbar clutter):
- `snapshot` (default): widgets show demo/template data
- `live`: widgets fetch real data for the selected audience entity

Implementation: pass `dataMode` in preview token → preview context provider → widgets read from context.

### VB14: Settings Drawer

**Owner:** `ui-ops`
**File:** `src/components/views/settings-drawer.tsx` (new)
**Depends on:** VB11

Slide-in drawer from the right (like Sheet component from shadcn):
- **View Settings section:** name, slug, description, is_active toggle, is_default toggle
  - Save via `PATCH /api/admin/views/[viewId]` (existing)
- **Audience Rules section:** list of rules with tier/target/priority + add/delete
  - CRUD via `/api/admin/views/[viewId]/rules` (existing)
- **Module Order section:** drag-to-reorder assigned modules
  - Update via `PATCH` on sort_order values

### VB15: Add-Module Modal

**Owner:** `ui-ops`
**File:** `src/components/views/add-module-modal.tsx` (new)
**Depends on:** VB11

Command-palette style modal (like cmdk):
- Lists all modules from `GET /api/modules`
- Shows icon, name, description for each
- Checkmark on already-assigned modules
- Toggle to add/remove
- On add: `POST /api/admin/views/[viewId]/modules` → refresh preview
- On remove: `DELETE /api/admin/views/[viewId]/modules` → refresh preview

### VB16: Module Assignment Wiring

**Owner:** `ui-ops`
**Depends on:** VB15

Connect add-module modal to existing CRUD API:
- `POST /api/admin/views/[viewId]/modules { module_id }` — auto-increments sort_order
- `DELETE /api/admin/views/[viewId]/modules { module_id }`
- After mutation: refresh preview context → postMessage to iframe → sidebar updates

### VB17: Module Ordering

**Owner:** `ui-ops`
**Depends on:** VB16

In settings drawer, module list with drag handles:
- Uses existing `@dnd-kit/core` (already a dependency from dashboard builder)
- On reorder: batch `PATCH` sort_order values
- Optimistic update in UI

### VB18: postMessage Bridge

**Owner:** `ui-ops`
**File:** `src/lib/views/preview-bridge.ts` (new)
**Depends on:** VB11, VB5

**Parent → iframe messages:**
```typescript
type ParentMessage =
  | { type: 'audienceChanged'; token: string }     // new preview token
  | { type: 'moduleAdded'; moduleSlug: string }     // refresh module nav
  | { type: 'moduleRemoved'; moduleSlug: string }
  | { type: 'refreshRequested' }                    // full refresh
```

**iframe → parent messages:**
```typescript
type PreviewMessage =
  | { type: 'ready' }                               // preview loaded
  | { type: 'routeChanged'; path: string }           // user navigated in preview
  | { type: 'error'; message: string }               // preview error
```

**Security:** Origin check on all message handlers. Only accept messages from same origin.

### VB19: Fullscreen + Device Frames

**Owner:** `ui-ops`
**Depends on:** VB11

**Fullscreen:**
- `fixed inset-0 z-50 bg-background` overlay
- Minimal header: view name + device toggle + close (X) button
- `Escape` key exits fullscreen
- iframe fills remaining space

**Device frames** (reuse from `dashboard-builder.tsx:488-511`):
- Desktop: full-width, no frame
- Tablet: 768px centered, rounded corners, subtle shadow
- Mobile: 375px centered, rounded corners, status bar notch (4px bar)

---

## Wave 3: Hardening + QA (VB20–VB22)

### VB20: Optional Index Migration

**Owner:** `schema-core`
**Depends on:** VB8

If preview-context query on `view_profile_modules` is slow:
```sql
CREATE INDEX IF NOT EXISTS idx_vpm_view_sort
  ON view_profile_modules (view_id, sort_order);
```

Only create if query latency > 50ms in testing.

### VB21: Audit Logging

**Owner:** `api-flow`
**Depends on:** VB3, VB16

Extend `AdminAuditAction` type in `admin-audit.ts`:
```typescript
| 'preview.create'
| 'module.assign'
| 'module.remove'
| 'module.reorder'
```

Add convenience helpers:
```typescript
export function logPreviewCreate(actorId, actorEmail, viewId, subjectType, subjectTargetId)
export function logModuleAssign(actorId, actorEmail, viewId, moduleId)
export function logModuleRemove(actorId, actorEmail, viewId, moduleId)
```

### VB22: Smoke Tests + Evidence

**Owner:** `qa-review`
**Depends on:** All prior tasks

Execute the smoke matrix from `01-codex-proposal.md` section J:

| # | Flow | Test |
|---|------|------|
| 1 | Happy path | Open builder → select Staff/Role/PPC Strategist → preview updates |
| 2 | Happy path | Add module from modal → appears in preview sidebar + persists |
| 3 | Failure path | Non-admin hits preview-session API → 403 |
| 4 | Security edge | Tampered token in iframe URL → preview rejects |
| 5 | Security edge | Subject=partner, actor attempts admin write → blocked |
| 6 | Mapping integrity | Switch Partner/Type/PPC Basic then Partner/Brand → deterministic |

Evidence: screen captures, API response logs, DB queries.

---

## File Manifest

### New Files

| File | Wave | Owner | Purpose |
|------|------|-------|---------|
| `src/lib/views/preview-session.ts` | 1 | api-flow | Preview token creation + verification |
| `src/lib/views/module-nav.ts` | 1 | api-flow | Module → NavSection builder |
| `src/lib/views/preview-bridge.ts` | 2 | ui-ops | postMessage bridge types + hooks |
| `src/app/api/admin/views/preview-session/route.ts` | 1 | api-flow | Preview session create endpoint |
| `src/app/api/admin/views/[viewId]/preview-context/route.ts` | 1 | api-flow | Builder toolbar context endpoint |
| `src/app/(preview)/layout.tsx` | 1 | ui-ops | Preview route group layout |
| `src/app/(preview)/preview/page.tsx` | 1 | ui-ops | Preview page (renders app shell) |
| `src/app/(preview)/preview/module/[slug]/page.tsx` | 1 | ui-ops | Module dashboard page in preview |
| `src/components/views/preview-shell.tsx` | 1 | ui-ops | Full app shell for preview |
| `src/components/views/preview-context.tsx` | 1 | ui-ops | Preview context provider + hook |
| `src/components/views/audience-selector.tsx` | 2 | ui-ops | Two-level audience picker |
| `src/components/views/settings-drawer.tsx` | 2 | ui-ops | View settings/rules slide-in |
| `src/components/views/add-module-modal.tsx` | 2 | ui-ops | Command-palette module picker |
| `__tests__/preview-session.test.ts` | 1 | api-flow | Token creation/verification tests |

### Modified Files

| File | Wave | Owner | Changes |
|------|------|-------|---------|
| `src/app/(dashboard)/admin/views/[viewId]/page.tsx` | 2 | ui-ops | Major rewrite: toolbar + iframe layout |
| `src/components/layout/sidebar.tsx` | 1 | ui-ops | Add optional `navOverride` prop (~10 lines) |
| `src/lib/audit/admin-audit.ts` | 3 | api-flow | Add preview + module audit actions |

### Unchanged (Reused As-Is)

| File | Why |
|------|-----|
| `src/lib/views/resolve-view.ts` | Used by preview-context API |
| `src/lib/auth/viewer-context.ts` | Types reused for subject building |
| `src/lib/auth/viewer-session.ts` | HMAC pattern referenced (not modified) |
| `src/lib/navigation/config.ts` | `getNavigationForRole()` called in preview shell |
| `src/app/api/admin/views/[viewId]/modules/route.ts` | Module assignment CRUD reused |
| `src/app/api/admin/views/[viewId]/rules/route.ts` | Rules CRUD reused |
| `src/components/reporting/dashboard-builder.tsx` | Device frame pattern referenced |

---

## Dependency Graph

```
W0.1 (contract)
  │
  ├── VB1 (type) → VB2 (token util) → VB3 (session API) ──┐
  │                                    └── VB4 (context API)│
  │                                                         │
  │                                    VB8 (module-nav)     │
  │                                         │               │
  ├── VB6 (sidebar prop) ──────────────────┐│               │
  │                                        ││               │
  └── VB5 (preview route) ────────────── VB7 (provider) ────┤
       │                                   │                │
       │                               VB9 (dynamic nav)    │
       │                                   │                │
       │                               VB10 (module pages)  │
       │                                                    │
       └── VB11 (builder redesign) ────────────────────────┘
            │
            ├── VB12 (audience selector)
            ├── VB13 (data mode toggle)
            ├── VB14 (settings drawer)
            ├── VB15 (add-module modal) → VB16 (CRUD wiring) → VB17 (ordering)
            ├── VB18 (postMessage bridge)
            └── VB19 (fullscreen + device)

VB20 (optional index) ← VB8
VB21 (audit logging) ← VB3, VB16
VB22 (smoke tests) ← all
```

---

## Execution Order (Single-Agent Sequential)

If implementing solo (not team), execute in this order:

1. `src/lib/views/preview-session.ts` + tests (VB1, VB2)
2. `src/app/api/admin/views/preview-session/route.ts` (VB3)
3. `src/app/api/admin/views/[viewId]/preview-context/route.ts` (VB4)
4. `src/lib/views/module-nav.ts` (VB8)
5. Sidebar `navOverride` prop (VB6)
6. `src/app/(preview)/layout.tsx` + `preview/page.tsx` (VB5)
7. `src/components/views/preview-context.tsx` (VB7)
8. `src/components/views/preview-shell.tsx` (VB9, VB10)
9. `src/app/(dashboard)/admin/views/[viewId]/page.tsx` rewrite (VB11)
10. `src/components/views/audience-selector.tsx` (VB12)
11. `src/components/views/add-module-modal.tsx` + wiring (VB15, VB16)
12. `src/components/views/settings-drawer.tsx` (VB14)
13. Module ordering (VB17)
14. postMessage bridge (VB18)
15. Data mode toggle (VB13)
16. Fullscreen + device frames (VB19)
17. Audit logging (VB21)
18. Smoke tests (VB22)

---

## Validation Gates

### Per-Wave

| Wave | Gate | Command |
|------|------|---------|
| 1 | TypeScript compiles | `npm run build` |
| 1 | Preview token tests pass | `npm test preview-session` |
| 1 | Preview route renders without crash | Manual: visit `/preview?token=...` |
| 2 | Builder page loads with iframe | Manual: visit `/admin/views/[id]` |
| 2 | Audience switch updates preview | Manual: toggle audience, verify iframe reloads |
| 2 | Module add/remove persists | Manual: add module, refresh, verify |
| 3 | Security edge tests pass | Smoke matrix rows 3-5 |
| 3 | Non-preview navigation unaffected | Regression: visit all nav items |

### Final

- `npm run build` — clean, no TypeScript errors
- All automated tests pass
- Smoke matrix 6/6 pass with evidence
- No regression in existing views page or sidebar navigation

---

## Rollback Strategy

1. **Preview route group:** Delete `src/app/(preview)/` — zero impact on production routes
2. **Builder page:** Revert `[viewId]/page.tsx` to git HEAD — restores old builder
3. **Sidebar prop:** Remove `navOverride` prop — defaults to production behavior
4. **API routes:** Delete preview-session and preview-context routes — no existing code depends on them
5. **Audit actions:** New actions are additive — no rollback needed

All changes are additive. No existing tables, routes, or components are removed. Full rollback = revert commit.
