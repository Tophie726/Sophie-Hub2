# View Builder (Inception Mode) — Implementation Review Request

Date: 2026-02-11
Round: 05 (Post-implementation code review)
Reviewer: Codex
Scope: Full code review of implemented View Builder against `FINAL-APPROVED-PLAN.md`

---

## What This Is

All four waves of the View Builder (VB1–VB22) have been implemented, reviewed through three in-flight review rounds, and all P1/P2/P3 findings resolved. This document provides a file-by-file implementation map for Codex to review the actual code against the approved plan and guardrails.

## Build Status

- `npm run build`: pass (clean)
- `npm run lint`: pass
- `npx jest`: 305 tests, 16 suites, all pass
- Smoke tests: 14/14 pass (`__tests__/view-builder-smoke.test.ts`)

---

## File Manifest (4,429 lines total)

### Wave 1: Foundation (VB1–VB10)

| File | Lines | Task | Purpose |
|------|------:|------|---------|
| `src/lib/views/preview-session.ts` | 187 | VB1, VB2 | HMAC-signed preview token creation + verification. Compact wire format with shortcodes (HR-8: no PII). Constant-time signature comparison. `server-only` import enforced. |
| `src/app/api/admin/views/preview-session/route.ts` | 144 | VB3 | `POST` endpoint. `isTrueAdmin` gate (HR-7). Resolves subject role from staff table. Rejects live mode for abstract types (HR-9). Calls `logPreviewCreate()` for audit. |
| `src/app/api/admin/views/[viewId]/preview-context/route.ts` | 86 | VB4 | `GET` endpoint. Returns resolved view + assignments for toolbar defaults. |
| `src/lib/views/module-nav.ts` | 93 | VB8 | Converts `view_profile_modules` rows into `NavSection` for sidebar. |
| `src/components/layout/sidebar.tsx` | 405 | VB6 | Modified: added optional `navOverride` prop (~10 lines). When present, replaces role-based nav with provided sections. Production nav unchanged. |
| `src/app/(preview)/layout.tsx` | 23 | VB5 | Minimal layout for preview route group. No sidebar, no dashboard chrome. |
| `src/app/(preview)/preview/page.tsx` | 131 | VB5 | Server component. Extracts token from query string, calls `verifyPreviewToken()` server-side. Rejects invalid/expired tokens. Passes verified payload to `PreviewShell`. |
| `src/app/(preview)/preview/module/[slug]/page.tsx` | 13 | VB10 | Fallback redirect. Module nav is handled client-side via event delegation; this catches direct URL access and redirects to `/admin/views`. |
| `src/components/views/preview-context.tsx` | 91 | VB7 | React context provider. Holds viewId, subjectType, targetId, resolvedRole, dataMode, modules, activeModuleSlug. |
| `src/components/views/preview-shell.tsx` | 153 | VB9, VB10 | Full app shell for preview. Renders shared `SidebarContent` with `navOverride`. Event delegation intercepts `/preview/module/` link clicks to use context state instead of Next.js navigation (prevents token loss). Sends `previewReady` via bridge on mount. |
| `src/components/views/preview-module-content.tsx` | 147 | VB10 | Renders module content in preview. Placeholder for real dashboard widget rendering. |

### Wave 2: Builder UI (VB11–VB19)

| File | Lines | Task | Purpose |
|------|------:|------|---------|
| `src/app/(dashboard)/admin/views/[viewId]/page.tsx` | 387 | VB11 | Full rewrite from 944-line monolith. Toolbar + full-height iframe layout. Token lifecycle: create on load, auto-refresh every 12 min, recreate on audience/mode change. Auto-downgrades `dataMode` to snapshot for abstract types. |
| `src/app/(dashboard)/admin/views/[viewId]/use-view-builder-data.ts` | 352 | VB11 | Extracted data hook. All fetching, mutations, derived state. Consumed by page.tsx and child components. |
| `src/components/views/audience-selector.tsx` | 435 | VB12, VB13 | Searchable audience picker. Debounced search (300ms) hitting existing `/api/staff?search=` and `/api/partners?search=` with 8-result limit. AbortController for in-flight cancellation. Shows staff name/email and partner brand_name/partner_code. Data mode toggle with disabled state for abstract types. Passes `targetLabel` for display. |
| `src/components/views/settings-drawer.tsx` | 466 | VB14, VB17 | Sheet drawer (right, 380–420px). Three collapsible sections: View Settings (name/description/active/default), Audience Rules (list + add form), Module Order (dnd-kit drag-to-reorder with `SortableModuleItem`, `GripVertical` handle, optimistic local state via `useEffect` + `useRef`). |
| `src/components/views/add-module-modal.tsx` | 104 | VB15, VB16 | Dialog with checkbox list. Toggle calls `handleToggleModule()`. Per-module spinner during mutation. |
| `src/components/views/device-frame.tsx` | 68 | VB19 | Desktop (full-width), Tablet (768px, rounded, shadow, notch), Mobile (375px, rounded, shadow, notch). |
| `src/components/ui/sheet.tsx` | 140 | VB14 | Shadcn Sheet component built on `@radix-ui/react-dialog`. |
| `src/lib/views/preview-bridge.ts` | 109 | VB18 | Type-safe postMessage protocol. Channel envelope `sophie-preview-bridge`. Origin + source validation on all listeners. `listenFromPreview` accepts optional `iframeRef` for event.source check. `listenFromParent` checks `event.source === window.parent`. |

### Wave 3: Hardening + QA (VB20–VB22)

| File | Lines | Task | Purpose |
|------|------:|------|---------|
| `src/lib/audit/admin-audit.ts` | 248 | VB21 | Extended `AdminAuditAction` with `preview.create`, `module.assign`, `module.remove`, `module.reorder`. Added 4 convenience helpers: `logPreviewCreate()`, `logModuleAssign()`, `logModuleRemove()`, `logModuleReorder()`. |
| `src/app/api/admin/views/[viewId]/modules/reorder/route.ts` | 72 | VB17a | `PATCH` endpoint. `isTrueAdmin` gate. Calls `supabase.rpc('reorder_view_modules', ...)` for atomic transactional reorder. View existence check before RPC. |
| `supabase/migrations/20260219_reorder_modules_atomic.sql` | 53 | VB17a | `reorder_view_modules()` plpgsql function. Validates all module_ids belong to view, then applies sort_order updates in single transaction. `SECURITY INVOKER`, service_role only. |
| `__tests__/preview-session.test.ts` | 263 | VB2 | 19 tests. Token structure, round-trip, subject type coverage, tamper rejection, expiry, malformed input. |
| `__tests__/view-builder-smoke.test.ts` | 259 | VB22 | 14 tests across 6 smoke categories. PPC Strategist happy path, view binding, non-admin rejection, tampered token, partner role enforcement, deterministic mapping. |

### Modified Existing Routes (audit action upgrades)

| File | Change |
|------|--------|
| `src/app/api/admin/views/[viewId]/modules/route.ts` | POST uses `logModuleAssign()`, DELETE uses `logModuleRemove()` (previously both used `logViewChange('view.update', ...)`) |
| `src/app/api/admin/views/preview-session/route.ts` | Uses `logPreviewCreate()` (previously used `logAdminAudit()` with type-cast `'preview.create' as 'context.switch'`) |

---

## Guardrail Compliance

Review each implementation guardrail from `FINAL-APPROVED-PLAN.md`:

| # | Guardrail | How It's Met | Key File(s) |
|---|-----------|-------------|-------------|
| 1 | Trust boundary: server-only token verification | `preview-session.ts` imports `'server-only'`. Preview page is a server component that calls `verifyPreviewToken()` before rendering. No client-side HMAC path exists. | `preview-session.ts:1`, `preview/page.tsx` |
| 2 | Actor/subject separation | Actor auth (`requireAuth()` + `isTrueAdmin()`) gates all write APIs. Subject only affects rendering context in preview. Token payload includes `actorId` for binding. | `preview-session/route.ts:27-33`, `preview/page.tsx` |
| 3 | Admin gating policy | All preview/module control-plane endpoints use `isTrueAdmin(auth.user.staffRole, auth.user.email)`. `operations_admin` is excluded. | `preview-session/route.ts:31`, `reorder/route.ts:32` |
| 4 | Token minimization | Wire format uses shortcodes: `sub` (subject type), `dm` (data mode), `rol`, `act`, `vid`, `tid`, `sid`, `exp`. No emails, names, or labels. | `preview-session.ts:14-19, 114-123` |
| 5 | API contract alignment | Audience search uses existing `GET /api/staff?search=` and `GET /api/partners?search=` with debounce (300ms) + limit (8). Module reorder uses dedicated `PATCH .../reorder` with atomic RPC. | `audience-selector.tsx:60-61`, `reorder/route.ts` |
| 6 | No drift between preview and app shell | Preview shell renders shared `SidebarContent` component with `navOverride` prop. No forked sidebar implementation. | `preview-shell.tsx:74-79`, `sidebar.tsx` |

---

## Security Measures

| Measure | Implementation |
|---------|---------------|
| HMAC-SHA256 token signing | `createHmac('sha256', NEXTAUTH_SECRET)` with constant-time comparison |
| 15-min token TTL | `PREVIEW_TOKEN_TTL_MS = 15 * 60 * 1000`, checked in `verifyPreviewToken()` |
| Server-only verification | `import 'server-only'` at top of `preview-session.ts` |
| isTrueAdmin gate (HR-7) | All control-plane APIs: preview-session, reorder, module assign/remove |
| Live mode guard (HR-9) | API rejects live mode for self/role/partner_type; client auto-downgrades |
| postMessage origin + source | `listenFromPreview` checks `event.origin` + `event.source` vs iframe ref; `listenFromParent` checks `event.source === window.parent` |
| Atomic reorder | `reorder_view_modules()` plpgsql function in single transaction |
| Audit logging | All preview/module operations logged with typed actions |

---

## Deviations From Plan

| Item | Plan Said | What Was Done | Reason |
|------|-----------|---------------|--------|
| VB20 index | "Create if query latency > 50ms" | Skipped | No measured latency issue |
| Module nav routing | "Route module nav clicks to module dashboard pages" (VB10) | Event delegation intercepts clicks + fallback redirect | Prevents token loss from Next.js navigation in iframe |
| Audience selector | "Two-level hierarchy" | Searchable list with debounced API search | UUID-only input was flagged P1 in review; upgraded to searchable |
| Reorder atomicity | "Batch API call" | Supabase RPC with plpgsql function | Sequential updates were flagged P2 across 3 reviews; upgraded to transactional |

---

## In-Flight Review History

Three review rounds occurred during implementation:

| Round | Blocker Count | Key Findings | Resolution |
|-------|---------------|-------------|------------|
| 1 | 3x P1, 2x P2 | Auth over-scope on reorder endpoint; preview module nav 404s; audience selector missing UUID search + unused props; render-time state updates; non-atomic reorder | All fixed |
| 2 | 2x P1 | UUID-only input (not searchable); live mode can break token for abstract types | Fixed: debounced search + auto-downgrade |
| 3 | 1x P2, 1x P3 | Non-atomic reorder (still sequential); bridge source validation | Fixed: RPC function + event.source checks |

---

## Review Request

Please review the implementation against:

1. **Plan fidelity** — Does the code deliver what `FINAL-APPROVED-PLAN.md` and `02-claude-agent-plan.md` specified?
2. **Security** — Token handling, auth gates, bridge trust boundary, audit completeness.
3. **Code quality** — Patterns, error handling, type safety, component structure.
4. **Residual risks** — Anything not caught in the three prior review rounds.
5. **Sign-off checklist** — Are all 6 items in the checklist genuinely met?

Focus areas where bugs are most likely:
- Token lifecycle edge cases (rapid audience switching, token expiry during active preview)
- Event delegation in preview shell (sidebar link interception)
- Optimistic state in settings drawer (local order vs server state reconciliation)
- RPC function error propagation (plpgsql exception → API response)
