# View Builder Wave 4 — Codex Review

Date: 2026-02-11  
Round: 10 (Review of `09-claude-agent-plan.md`)

## Findings

### P1

1. **Fork-on-edit logic will not fork for most current assignments and can mutate shared templates.**
   - References:
     - `src/docs/features/view-builder/09-claude-agent-plan.md:131`
     - `src/docs/features/view-builder/09-claude-agent-plan.md:132`
     - `src/app/api/admin/views/[viewId]/modules/route.ts:139`
     - `src/app/api/admin/views/[viewId]/modules/route.ts:161`
   - Why this is blocking:
     - The plan says “if `dashboard_id` is already set, return no-op.”
     - Current assignment creation already writes a template `dashboard_id` by default, so this condition will usually be true.
     - Result: first edit will hit the template dashboard directly instead of forking, leaking edits across views.
   - Required fix:
     - Fork decision must be based on assigned dashboard type, not nullability.
     - Resolve assigned dashboard row and fork when `is_template = true` (and/or when assignment points at shared template).
     - Only no-op when assigned dashboard is already a non-template fork intended for that assignment.

2. **Fork endpoint contract is vulnerable to cross-view assignment targeting unless view binding is explicit.**
   - References:
     - `src/docs/features/view-builder/09-claude-agent-plan.md:127`
     - `src/docs/features/view-builder/09-claude-agent-plan.md:130`
   - Why this is blocking:
     - Request payload uses `moduleAssignmentId` and the plan text only says “look up row by ID.”
     - Route path includes `[viewId]`; without enforcing `view_profile_modules.view_id = params.viewId`, a wrong assignment ID can mutate/fork another view’s module assignment.
   - Required fix:
     - In fork route, fetch assignment by both `id` and `view_id`.
     - Return 404 on mismatch and include test coverage for cross-view ID rejection.

3. **Section CRUD scope does not match existing API surface (rename/delete endpoints are not defined).**
   - References:
     - `src/docs/features/view-builder/09-claude-agent-plan.md:216`
     - `src/docs/features/view-builder/09-claude-agent-plan.md:220`
     - `src/docs/features/view-builder/09-claude-agent-plan.md:223`
     - `src/app/api/modules/dashboards/[dashboardId]/sections/route.ts:4`
     - `src/app/api/modules/dashboards/[dashboardId]/sections/route.ts:84`
   - Why this is blocking:
     - VB27 acceptance requires add/rename/delete/reorder.
     - Existing sections route supports POST (create) and PATCH (reorder) only; no rename and no delete contract.
   - Required fix:
     - Add explicit section mutation contracts before implementation:
       - either extend `/sections` with typed PATCH modes + DELETE,
       - or add `/sections/[sectionId]` for rename/delete.
     - Update task matrix and smoke tests to validate full section CRUD.

### P2

1. **Auth policy drift: plan requires `isTrueAdmin` for all control-plane mutations, but edit-mode writes are routed through APIs gated by `requireRole(ROLES.ADMIN)`.**
   - References:
     - `src/docs/features/view-builder/09-claude-agent-plan.md:348`
     - `src/app/api/modules/dashboards/[dashboardId]/sections/route.ts:26`
     - `src/app/api/modules/dashboards/[dashboardId]/widgets/route.ts:52`
   - Risk:
     - `requireRole(ROLES.ADMIN)` currently includes `operations_admin`; this violates the strict See-As admin policy used for preview control plane.
   - Required fix:
     - Choose one explicit path:
       - add dedicated view-builder composition endpoints gated by `isTrueAdmin`, or
       - tighten existing mutation routes to `requireAuth + isTrueAdmin` if acceptable across module-builder flows.
     - Document the chosen policy so Wave 4 does not regress prior hard rules.

2. **Active-module ownership is underspecified between iframe and parent for section drawer operations.**
   - References:
     - `src/docs/features/view-builder/09-claude-agent-plan.md:108`
     - `src/docs/features/view-builder/09-claude-agent-plan.md:186`
     - `src/docs/features/view-builder/09-claude-agent-plan.md:228`
   - Risk:
     - The drawer’s “Dashboard Sections” requires a concrete active dashboard/module context.
     - Plan does not define how parent receives authoritative active module changes from iframe navigation.
   - Required fix:
     - Add explicit bridge event child → parent for active module/dashboard context changes (or move active-module source of truth to parent and drive iframe from it).
     - Gate section CRUD UI when active module context is missing.

## Review Summary

- Blocking findings: **3 P1**
- Required non-blocking fixes: **2 P2**
- Wave 4 should stay at **No-Go** until these are reflected in a revised plan document.

