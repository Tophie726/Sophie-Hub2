# View Builder (Inception Mode) — Codex Review

Date: 2026-02-10  
Round: 03 (Review of `02-claude-agent-plan.md`)

## Findings

### P1

1. **Preview token verification is defined on the client path, which breaks the trust boundary.**
   - References:
     - `src/docs/features/view-builder/02-claude-agent-plan.md:164`
     - `src/docs/features/view-builder/02-claude-agent-plan.md:56`
   - Why this is blocking:
     - The plan says preview page is a client component and may call `verifyPreviewToken()` directly.
     - Verifying HMAC tokens must remain server-only; otherwise implementation pressure leads to exposing signing logic/secret assumptions in client code or unverifiable client-side checks.
   - Required fix:
     - Force server-only verification path.
     - Client page should send token to a server endpoint (or server component action) that verifies signature + expiry and returns sanitized preview context.

2. **Preview route access control is weaker than the endpoint policy and allows token replay across authenticated users.**
   - References:
     - `src/docs/features/view-builder/02-claude-agent-plan.md:152`
     - `src/docs/features/view-builder/02-claude-agent-plan.md:154`
     - `src/docs/features/view-builder/02-claude-agent-plan.md:48`
   - Why this is blocking:
     - Route layout currently checks only session existence, not admin entitlement or actor-token binding.
     - Token payload includes `actorId`, but the plan does not require matching it to the current authenticated actor.
     - Any authenticated user with a leaked token URL could open preview.
   - Required fix:
     - Enforce admin gate on preview route using the same strict policy as See-As.
     - On token verification, require `payload.actorId === auth.user.id`.
     - Reject mismatches with a safe unauthorized state.

3. **Admin gating in preview-session API conflicts with existing top-level-admin-only policy.**
   - References:
     - `src/docs/features/view-builder/02-claude-agent-plan.md:110`
     - `src/docs/features/view-builder/02-claude-agent-plan.md:113`
   - Why this is blocking:
     - Plan uses `requireRole(ROLES.ADMIN)` but also says it will follow viewer-context logic.
     - In this codebase, `requireRole(ROLES.ADMIN)` includes `operations_admin` via role mapping, while current See-As policy explicitly excludes `operations_admin`.
   - Required fix:
     - Reuse the exact `isTrueAdmin` gate pattern already used in viewer-context routes.
     - Document this as a non-negotiable invariant in Hard Rules.

### P2

1. **Module reorder contract is incomplete: plan depends on a PATCH flow that does not exist in the declared reused route.**
   - References:
     - `src/docs/features/view-builder/02-claude-agent-plan.md:347`
     - `src/docs/features/view-builder/02-claude-agent-plan.md:380`
     - `src/docs/features/view-builder/02-claude-agent-plan.md:518`
   - Risk:
     - VB17 cannot ship deterministically if `view_profile_modules` reorder writes are not backed by an explicit API contract.
   - Required fix:
     - Add a dedicated reorder endpoint/task (for example `PATCH /api/admin/views/[viewId]/modules/reorder`) with request schema and optimistic concurrency behavior.

2. **Audience search query params do not match existing API contracts.**
   - References:
     - `src/docs/features/view-builder/02-claude-agent-plan.md:320`
     - `src/docs/features/view-builder/02-claude-agent-plan.md:321`
   - Risk:
     - Existing APIs use `search`, not `q`; implementation will silently fail or return unfiltered large lists.
   - Required fix:
     - Update plan and tasks to use `?search=`.
     - Add explicit debounce + max result window in selector behavior to avoid loading large partner datasets.

3. **Preview token payload currently contains unnecessary PII and is transported in URL/postMessage.**
   - References:
     - `src/docs/features/view-builder/02-claude-agent-plan.md:45`
     - `src/docs/features/view-builder/02-claude-agent-plan.md:49`
     - `src/docs/features/view-builder/02-claude-agent-plan.md:115`
     - `src/docs/features/view-builder/02-claude-agent-plan.md:392`
   - Risk:
     - Query-string tokens are logged in browser history, network logs, screenshots, and support captures.
   - Required fix:
     - Minimize token payload to opaque identifiers only (no emails/labels).
     - Prefer short opaque session IDs mapped server-side where feasible.

## Open Questions / Assumptions

1. Should preview sessions be single-use or renewable within a fixed actor-bound window (for frequent audience switching)?
2. For `live` mode, do we hard-require a concrete partner/staff target before allowing dashboard data fetches to avoid accidental broad reads?

## Review Summary

- Blocking findings: **3 P1**
- Required non-blocking fixes: **3 P2**
- `04-claude-revision.md` should explicitly close each finding with line-level plan deltas before moving to `FINAL-APPROVED-PLAN.md`.

## Round 05 Re-Review (2026-02-10)

Reviewed `04-claude-revision.md` against all six findings above.

- P1.1: fixed (server-only token verification path; preview page shifted to server component flow)
- P1.2: fixed (actor binding enforced on verified payload before render)
- P1.3: fixed (`isTrueAdmin` gate standardized for preview endpoints)
- P2.1: fixed (explicit reorder endpoint added to plan and task graph)
- P2.2: fixed (search contract aligned to existing `?search=` APIs with debounce + limit)
- P2.3: fixed (token payload minimized to opaque IDs/shortcodes; no labels/emails)

### Re-Review Outcome

- Unresolved P1: **0**
- Unresolved P2: **0**
- No new blocking findings introduced.
- Plan can move to `FINAL-APPROVED-PLAN.md` merge gate.
