# View Builder Wave 4 — Codex Implementation Review

Date: 2026-02-11  
Round: 13 (Review of implemented Wave 4 code)

## Findings

### P1

1. **Fork cloning uses a non-existent section column and silently drops cloned content.**
   - References:
     - `/Users/test/Coding/Sophie-Data-Planning/sophie-hub-v2/src/app/api/admin/views/[viewId]/fork-dashboard/route.ts:141`
     - `/Users/test/Coding/Sophie-Data-Planning/sophie-hub-v2/src/app/api/admin/views/[viewId]/fork-dashboard/route.ts:146`
     - `/Users/test/Coding/Sophie-Data-Planning/sophie-hub-v2/sql/modules-schema.sql:62`
   - Why this is blocking:
     - The fork inserts `is_collapsed`, but schema uses `collapsed`.
     - Section insert failures are swallowed (`continue`), so the endpoint can return success while producing an empty/incomplete forked dashboard.
   - Required fix:
     - Write `collapsed` (not `is_collapsed`), and fail the request on section/widget clone errors (or wrap clone/update in one transaction/RPC).

2. **Edit mode does not implement inline drag/resize/widget composition; core Wave 4 capability is missing.**
   - References:
     - `/Users/test/Coding/Sophie-Data-Planning/sophie-hub-v2/src/components/views/preview-module-content.tsx:157`
     - `/Users/test/Coding/Sophie-Data-Planning/sophie-hub-v2/src/components/views/preview-module-content.tsx:176`
     - `/Users/test/Coding/Sophie-Data-Planning/sophie-hub-v2/src/app/(dashboard)/admin/views/[viewId]/page.tsx:226`
     - `/Users/test/Coding/Sophie-Data-Planning/sophie-hub-v2/src/app/(dashboard)/admin/views/[viewId]/page.tsx:229`
   - Why this is blocking:
     - Preview still renders a read-only CSS grid, not `SectionContainer`/`WidgetWrapper` editing.
     - Widget edit/add bridge events only show toasts; no `WidgetConfigDialog` wiring and no create/update/delete flow from the builder.
   - Required fix:
     - Integrate `SectionContainer` in preview edit mode and wire full widget CRUD/config flow via the view-scoped widget endpoints.

3. **Active module reporting is nondeterministic in inline mode and can target the wrong module for edits.**
   - References:
     - `/Users/test/Coding/Sophie-Data-Planning/sophie-hub-v2/src/components/views/preview-shell.tsx:152`
     - `/Users/test/Coding/Sophie-Data-Planning/sophie-hub-v2/src/components/views/preview-module-content.tsx:60`
     - `/Users/test/Coding/Sophie-Data-Planning/sophie-hub-v2/src/app/(dashboard)/admin/views/[viewId]/page.tsx:214`
     - `/Users/test/Coding/Sophie-Data-Planning/sophie-hub-v2/src/app/(dashboard)/admin/views/[viewId]/page.tsx:320`
   - Why this is blocking:
     - When dashboard view renders multiple modules inline, each `PreviewModuleContent` emits `activeModuleReport` on mount.
     - Parent state becomes “last component rendered,” not a user-selected module, so fork/edit actions can apply to an unintended module/dashboard.
   - Required fix:
     - Report active module only from explicit user selection/focus, and gate edit-mode entry on that explicit selection.

### P2

1. **Wave 4 smoke tests are mostly contract-style constants and do not validate route/component behavior.**
   - References:
     - `/Users/test/Coding/Sophie-Data-Planning/sophie-hub-v2/__tests__/view-builder-wave4-smoke.test.ts:88`
     - `/Users/test/Coding/Sophie-Data-Planning/sophie-hub-v2/__tests__/view-builder-wave4-smoke.test.ts:142`
     - `/Users/test/Coding/Sophie-Data-Planning/sophie-hub-v2/__tests__/view-builder-wave4-smoke.test.ts:195`
   - Risk:
     - Tests pass even when implementation has functional defects (as seen above), giving a false release signal.
   - Required fix:
     - Add API-route tests (mocked Supabase + request/response assertions) and at least one UI behavior test for module selection/edit-mode target resolution.

## Gate Decision

**No-Go** for Wave 4 completion claim.  
Blocking P1 issues must be fixed before this can be marked shipped.

