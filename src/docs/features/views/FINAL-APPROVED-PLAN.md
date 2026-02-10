# Views Feature — Final Approved Plan

Date: 2026-02-10
Status: IMPLEMENTATION COMPLETE (all 3 waves delivered, 6/6 smoke tests passed as of 2026-02-10)

## Approved Scope

1. **Partner-type foundation (already shipped)**  
   - legacy vs staffing-derived comparison, mismatch visibility, persisted taxonomy fields, reconciliation.
   - evidence: `src/docs/features/views/05-rollout-partner-type.md`

2. **Views + See-As program (approved to implement)**  
   - admin-only `Admin Mode` + `See as` runtime context controls.
   - locked selector hierarchy:
     - `See as Staff` -> `Person` or `Role`
     - `See as Partner` -> `Partner` or `Partner Type`
   - `/admin/views` control-plane (views CRUD + audience assignments).
   - deterministic precedence resolver with 5 tiers.
   - audit logging + smoke evidence gates + rollback strategy.

## Source Documents (Locked Sequence)

- `src/docs/features/views/00-context.md`
- `src/docs/features/views/01-codex-proposal.md`
- `src/docs/features/views/02-claude-agent-plan.md`
- `src/docs/features/views/03-codex-review.md`
- `src/docs/features/views/04-claude-revision.md`
- `src/docs/features/views/05-rollout-partner-type.md`

## Acceptance Decision

- `03-codex-review.md` re-review confirms all prior P1/P2 findings are fixed in `04-claude-revision.md`.
- No unresolved blocking findings remain at plan stage.
- Implementation may proceed under phase/wave gates defined in `02-claude-agent-plan.md` and revised by `04-claude-revision.md`.

## Implementation Guardrails

1. Do not weaken actor-vs-subject auth boundaries: runtime context must be server-derived only.
2. Use existing authoritative partner-type field: `partners.computed_partner_type`.
3. Keep control-plane routes admin-only; runtime reads remain `requireAuth()` with self-subject for non-admins.
4. Do not mark rollout complete without smoke evidence:
   - happy path,
   - failure path,
   - security/abuse edge,
   - mapping integrity.

## Implementation Record

### Waves Completed

| Wave | Description | Tasks | Status |
|------|-------------|-------|--------|
| 0 | Pre-flight (contracts, decisions) | W0.1–W0.4 | Complete |
| 1 | Foundation (migrations + resolver + context API) | V1, V1a, V2, V2a, V2b, V2d, V3, V3a | Complete |
| 2 | Main behavior (CRUD + precedence + UI controls) | V4, V4a, V5a, V5b, V5c, V6, V7, V8 | Complete |
| 3 | Hardening + ops (audit + QA) | V9a, V9b, V9c, V10–V15 | Complete |

### Agent Team

| Agent | Tasks Owned | Waves |
|-------|-------------|-------|
| `schema-core` | W0.1, V2, V2a, V2b, V2d | 0, 1 |
| `api-flow` | W0.2–W0.4, V1, V1a, V3, V3a, V5a, V5b, V6, V7, V9a, V9b, V9c | 0, 1, 2, 3 |
| `ui-ops` | V4, V4a, V5c, V8 | 2 |
| `qa-review` | V10–V15 | 3 |

### Smoke Test Results

| Test | Result |
|------|--------|
| V10: Happy path | PASS |
| V11: Failure path | PASS |
| V12: Security/abuse edge | PASS |
| V13: Mapping integrity | PASS |
| V14: Regression suite | PASS |
| V15: Rollback verification | PASS |

### Key Decisions Made During Implementation

1. **W0.3**: Separate signed httpOnly cookie (`sophie-view`), not extending NextAuth JWT.
2. **W0.4**: `operations_admin` blocked via `staffRole === 'admin'` check on raw value, not mapped ROLES constant.
3. **V2b**: `view_profile_modules` uses plain UUID columns for module_id/dashboard_id (FKs deferred — modules/dashboards tables lack migrations).
4. **V2d**: RLS write policies include `operations_admin` for views CRUD (correct — exclusion is only for See-As impersonation).

### Files Delivered

**Migrations (5):**
- `supabase/migrations/20260215_view_profiles.sql`
- `supabase/migrations/20260215_view_audience_rules.sql`
- `supabase/migrations/20260215_view_profile_modules.sql`
- `supabase/migrations/20260215_view_tables_rls.sql`
- `supabase/migrations/20260215_admin_audit_log.sql`

**Auth/Context (3):**
- `src/lib/auth/viewer-context.ts`
- `src/lib/auth/viewer-session.ts`
- `src/lib/auth/api-auth.ts` (modified — exported AuthUser)

**API Routes (5):**
- `src/app/api/viewer-context/route.ts`
- `src/app/api/admin/views/route.ts`
- `src/app/api/admin/views/[viewId]/route.ts`
- `src/app/api/admin/views/[viewId]/rules/route.ts`
- `src/app/api/admin/views/[viewId]/rules/[ruleId]/route.ts`

**Views Engine (1):**
- `src/lib/views/resolve-view.ts`

**UI Components (4):**
- `src/components/layout/admin-mode-control.tsx`
- `src/components/layout/viewer-context-badge.tsx`
- `src/app/(dashboard)/admin/views/page.tsx`
- `src/components/modules/work-calendar-overview.tsx`

**Modified (3):**
- `src/components/layout/sidebar.tsx`
- `src/components/layout/main-layout.tsx`
- `src/app/api/modules/dashboards/route.ts`

**Audit (1):**
- `src/lib/audit/admin-audit.ts`

**Tests (3):**
- `__tests__/viewer-context.test.ts`
- `__tests__/viewer-session.test.ts`
- `__tests__/resolve-view.test.ts`

**Config (1):**
- `src/lib/navigation/config.ts` (modified — added Views nav entry)
