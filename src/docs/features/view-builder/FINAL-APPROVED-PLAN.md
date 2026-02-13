# View Builder (Inception Mode) — Final Approved Plan

Date: 2026-02-10
Implementation status refreshed: 2026-02-11
Status: PARTIALLY SHIPPED — FOUNDATION + PREVIEW RUNTIME COMPLETE, IN-PREVIEW COMPOSER PENDING

## Approved Scope

1. **Preview-first builder UX for `/admin/views/[viewId]`**
   - full-width inception-style preview as primary surface,
   - thin control toolbar,
   - settings moved to secondary drawer,
   - device modes + fullscreen.

2. **Full app-shell preview rendering**
   - preview route group renders sidebar/header/content shell,
   - dynamic "Modules" nav section from `view_profile_modules`.

3. **Audience simulation and composition controls**
   - Staff -> Role/Person and Partner -> Type/Brand audience switching,
   - module add/remove/reorder flows persisted to view assignments,
   - snapshot default mode with guarded live mode.

4. **In-preview composition authoring (NOT YET COMPLETE)**
   - add/reorder sections from view builder,
   - drag/resize/reposition widgets directly in `/admin/views/[viewId]`,
   - no forced navigation to module builder for common layout edits.

## Source Documents (Locked Sequence)

- `src/docs/features/view-builder/00-context.md`
- `src/docs/features/view-builder/01-codex-proposal.md`
- `src/docs/features/view-builder/02-claude-agent-plan.md`
- `src/docs/features/view-builder/03-codex-review.md`
- `src/docs/features/view-builder/04-claude-revision.md`

## Acceptance Decision

- `03-codex-review.md` Round 05 re-review confirms all prior P1/P2 findings are fixed in `04-claude-revision.md`.
- No unresolved blocking findings remain at plan stage.
- Implementation may proceed under wave/task gates defined in `02-claude-agent-plan.md` and revised by `04-claude-revision.md`.

## Implementation Guardrails

1. **Trust boundary**
   - preview token signing/verification is server-only.
   - no client-side HMAC verification path.

2. **Actor/subject separation**
   - actor auth is authoritative for writes.
   - preview subject affects rendering only.

3. **Admin gating policy**
   - preview impersonation/control plane must use `isTrueAdmin` policy.
   - `operations_admin` remains excluded from impersonation powers.

4. **Token minimization**
   - token payload contains only opaque IDs/shortcodes/timestamps.
   - no emails, names, or labels in token payload.

5. **API contract alignment**
   - audience search uses existing `?search=` routes with debounce + bounded limits.
   - module reorder uses explicit dedicated endpoint.

6. **No drift between preview and app shell**
   - preview shell reuses shared layout/sidebar primitives.
   - avoid parallel forked shell implementations.

## Final Wave Structure

| Wave | Scope | Task Bands | Status |
|---|---|---|---|
| 0 | Contracts + pre-flight | W0.1–W0.2 | COMPLETE |
| 1 | Foundation | VB1–VB10 | COMPLETE |
| 2 | Builder UI | VB11–VB19 (+ VB17a reorder endpoint) | COMPLETE |
| 3 | Hardening + QA | VB20–VB22 | COMPLETE |
| 4 | In-preview section/widget composer | VB23–VB31 | PENDING |

## Sign-off Checklist (Implementation Exit)

- [x] Build/lint/type checks clean on current view-builder changes
- [x] Unit/API/integration suites pass for shipped waves
- [x] Smoke matrix passes for VB22 scope
- [x] Rollback path verified (all changes additive; revert commit = full rollback)
- [x] Audit logging present for preview + module composition events (VB21: `preview.create`, `module.assign`, `module.remove`, `module.reorder`)
- [x] No regressions in non-preview navigation/layout paths (sidebar `navOverride` is opt-in, production nav unchanged)
- [ ] In-preview section CRUD shipped
- [ ] In-preview widget drag/resize shipped
- [ ] In-preview widget config edit flow shipped

## Residual Risks (Monitored)

1. **Preview shell parity drift** — preview shell reuses `SidebarContent` with `navOverride`; parity maintained via shared component.
2. **Rapid audience switching** — token creation + iframe reload on each switch; mitigated by debounce on search, 12-min auto-refresh interval.
3. **Live-mode misuse** — auto-downgrade to snapshot on abstract subject types (self/role/partner_type); API rejects live for abstract types as defense-in-depth.

## Review History

| Round | Gate | Findings | Resolution |
|-------|------|----------|------------|
| 1 | No-Go | 3x P1 (auth scope, preview 404, audience selector), 2x P2 (render state, partial reorder) | All P1s fixed |
| 2 | No-Go | 2x P1 (UUID-only search, live mode breakage), 1x P2 (non-atomic reorder), 1x P3 (bridge source) | All P1s fixed |
| 3 | GO | 1x P2 (non-atomic reorder), 1x P3 (bridge source) | Both fixed: RPC function + event.source checks |

## Implementation Notes

### Files Created (17 files)
- `src/lib/views/preview-session.ts` — HMAC-signed preview token create/verify
- `src/lib/views/preview-bridge.ts` — postMessage bridge with origin + source validation
- `src/lib/views/module-nav.ts` — Module-to-NavSection builder
- `src/app/api/admin/views/preview-session/route.ts` — Preview session API
- `src/app/api/admin/views/[viewId]/preview-context/route.ts` — Builder context API
- `src/app/api/admin/views/[viewId]/modules/reorder/route.ts` — Atomic module reorder API
- `src/app/(preview)/layout.tsx` — Preview route group layout
- `src/app/(preview)/preview/page.tsx` — Preview page (token verification + shell)
- `src/app/(preview)/preview/module/[slug]/page.tsx` — Module nav fallback redirect
- `src/components/views/preview-shell.tsx` — Full app shell for preview iframe
- `src/components/views/preview-context.tsx` — Preview context provider
- `src/components/views/preview-module-content.tsx` — Module content renderer
- `src/components/views/audience-selector.tsx` — Searchable audience picker
- `src/components/views/settings-drawer.tsx` — View settings/rules/module-order drawer
- `src/components/views/add-module-modal.tsx` — Module assignment dialog
- `src/components/views/device-frame.tsx` — Device preview frames
- `src/components/ui/sheet.tsx` — Shadcn Sheet component

### Files Modified (4 files)
- `src/app/(dashboard)/admin/views/[viewId]/page.tsx` — Full rewrite: inception mode toolbar + iframe
- `src/app/(dashboard)/admin/views/[viewId]/use-view-builder-data.ts` — Extracted data hook
- `src/components/layout/sidebar.tsx` — Added `navOverride` prop
- `src/lib/audit/admin-audit.ts` — Added preview + module audit actions/helpers

### Migrations (1 file)
- `supabase/migrations/20260219_reorder_modules_atomic.sql` — `reorder_view_modules()` RPC function

### Tests (2 files)
- `__tests__/preview-session.test.ts` — Token creation/verification (19 tests)
- `__tests__/view-builder-smoke.test.ts` — VB22 smoke matrix (14 tests)

## Next Action

Feature is not complete against current product expectation. Continue with Wave 4 multi-agent implementation.

Potential follow-up items (not in scope):
- VB20 index optimization — deferred (no evidence of query latency > 50ms)
- Drag-to-reorder keyboard accessibility improvements
