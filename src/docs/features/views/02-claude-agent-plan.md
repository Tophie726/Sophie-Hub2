# Views + See-As — Claude Agent Execution Plan

Date: 2026-02-10
Round: 02 (Claude agent planning pass)

---

## Summary

This document converts the Codex proposal (`01-codex-proposal.md`) into a wave-based execution plan with parallel task scheduling, dependency graphs, implementation checkpoints, validation ownership, and evidence requirements. No code is produced in this round.

---

## A) Wave-Based Execution Model

### Wave 0: Pre-flight (serial, blocking)

**Goal:** Lock contracts and confirm assumptions before any agent writes code.

| Step | Action | Owner | Output |
|------|--------|-------|--------|
| W0.1 | Confirm canonical product slugs in `/admin/products` match proposal mapping (`sophie_ppc`, `cc`, `fam`, `pli`, `tiktok`) | `schema-core` | Verified slug list or amendment |
| W0.2 | Define viewer-context TypeScript contract (`ViewerContext`, `ActorIdentity`, `SubjectIdentity`) | `api-flow` | `src/lib/auth/viewer-context.ts` type exports |
| W0.3 | Agree on session storage mechanism (signed httpOnly cookie vs server-side session store) | `api-flow` | Decision record in this doc or context addendum |
| W0.4 | Confirm `operations_admin` does NOT get see-as scope | `api-flow` | Assertion in auth test suite |

**Gate:** All four items confirmed before Wave 1 starts.

---

### Wave 1: Foundation (parallel tracks)

Two agents work in parallel on independent deliverables.

#### Track A — `schema-core`

| ID | Task | Output | Depends On |
|----|------|--------|------------|
| V2 | Migration: `view_profiles` table | SQL migration + rollback script | W0.1 |
| V2a | Migration: `view_audience_rules` table with `priority` column encoding precedence tiers | SQL migration + rollback script | W0.1 |
| V2b | Migration: `view_profile_modules` junction table linking views to `modules`/`dashboards` | SQL migration + rollback script | V2 |
| V2c | Migration: add `canonical_product_id` (FK to products) and `partner_type_raw` (text, preserved source) columns to `partners` | SQL migration + rollback script | W0.1 |
| V2d | RLS policies for new tables: admin-only write, role-filtered read | SQL in migration | V2, V2a, V2b |

**Table designs (proposed):**

```
view_profiles
─────────────
id            uuid PK default gen_random_uuid()
slug          text UNIQUE NOT NULL
name          text NOT NULL
description   text
is_default    boolean DEFAULT false
is_active     boolean DEFAULT true
created_by    uuid FK → staff(id)
created_at    timestamptz DEFAULT now()
updated_at    timestamptz DEFAULT now()

view_audience_rules
───────────────────
id            uuid PK default gen_random_uuid()
view_id       uuid FK → view_profiles(id) ON DELETE CASCADE
tier          smallint NOT NULL CHECK (tier BETWEEN 1 AND 5)
              -- 1=person, 2=role, 3=partner, 4=partner_type, 5=default
target_type   text NOT NULL CHECK (target_type IN
              ('staff','partner','role','partner_type','default'))
target_id     text          -- NULL when target_type='default'
priority      smallint DEFAULT 0  -- tie-break within same tier
is_active     boolean DEFAULT true
created_at    timestamptz DEFAULT now()
UNIQUE(view_id, target_type, target_id)

view_profile_modules
────────────────────
id            uuid PK default gen_random_uuid()
view_id       uuid FK → view_profiles(id) ON DELETE CASCADE
module_id     uuid FK → modules(id) ON DELETE CASCADE
dashboard_id  uuid FK → dashboards(id) ON DELETE SET NULL
sort_order    smallint DEFAULT 0
config        jsonb DEFAULT '{}'
```

**Rollback:** Each migration has a paired `down` script that drops the table/column. Migrations are applied sequentially and rolled back in reverse order.

#### Track B — `api-flow`

| ID | Task | Output | Depends On |
|----|------|--------|------------|
| V1 | Implement `ViewerContext` resolver utility | `src/lib/auth/viewer-context.ts` + unit tests | W0.2 |
| V3 | Context set/get/clear API routes (admin-only) | `src/app/api/viewer-context/route.ts` + auth tests | V1, W0.4 |
| V3a | Session storage adapter (cookie-based, httpOnly, SameSite=Strict) | `src/lib/auth/viewer-session.ts` | W0.3 |

**ViewerContext contract:**

```typescript
interface ViewerContext {
  actor: ActorIdentity      // real authenticated user — never mutated
  subject: SubjectIdentity  // rendering target — admin-controlled
  isImpersonating: boolean  // derived: actor.id !== subject.id
  adminModeOn: boolean      // true = full admin UX; false = subject's UX
}

interface ActorIdentity {
  userId: string
  email: string
  role: Role               // always the REAL role
  permissions: string[]
}

interface SubjectIdentity {
  type: 'self' | 'staff' | 'partner' | 'role' | 'partner_type'
  targetId: string | null   // staff/partner UUID, role slug, or product slug
  targetLabel: string       // human-readable label for UI badge
  resolvedRole: Role        // effective role for navigation/rendering
}
```

**API endpoints:**

| Method | Route | Auth | Body/Query | Response |
|--------|-------|------|------------|----------|
| GET | `/api/viewer-context` | admin | — | Current `ViewerContext` |
| POST | `/api/viewer-context` | admin | `{ type, targetId }` | Updated `ViewerContext` |
| DELETE | `/api/viewer-context` | admin | — | Reset to self, 204 |

**Invariants (enforced in code + tests):**

1. `actor.role` is NEVER derived from subject.
2. All write/mutate API calls check `actor.permissions`, never `subject`.
3. `subject` only affects read-path rendering and navigation filtering.
4. `operations_admin` role returns 403 on context-set endpoint.
5. Context cookie is scoped to the session; cleared on logout.

**Wave 1 gate:**

- [ ] Migrations apply cleanly and rollback cleanly in dev
- [ ] `ViewerContext` resolver returns correct identity for all role types
- [ ] Context API returns 403 for non-admin and operations_admin
- [ ] Context API returns 403 for partner/staff roles
- [ ] Context persists across requests within session, clears on DELETE
- [ ] No new lint/type errors introduced

---

### Wave 2: Main Behavior (serial on Wave 1)

#### Track C — `api-flow` (continues)

| ID | Task | Output | Depends On |
|----|------|--------|------------|
| V5a | Views CRUD API routes | `src/app/api/admin/views/route.ts`, `[viewId]/route.ts` | V2, V2a, V2b |
| V5b | Audience rule assignment API | `src/app/api/admin/views/[viewId]/rules/route.ts` | V2a |
| V6 | Precedence resolver: given a user identity, resolve the single effective `view_profile` | `src/lib/views/resolve-view.ts` + comprehensive tests | V2a, V5a |
| V7 | Hook resolver into module/dashboard read path: `/api/modules/dashboards` accepts optional `viewerContext` to filter | Modified existing route | V6 |

**Precedence resolution algorithm:**

```
resolveEffectiveView(identity: SubjectIdentity): ViewProfile | null
  1. Query view_audience_rules WHERE target_type='staff' AND target_id=identity.userId
     → if match, return view_profile (tier 1: person)
  2. Query WHERE target_type='role' AND target_id=identity.resolvedRole
     → if match, return view_profile (tier 2: role)
  3. Query WHERE target_type='partner' AND target_id=identity.targetId
     → if match, return view_profile (tier 3: partner)
  4. Query WHERE target_type='partner_type' AND target_id=identity.partnerTypeSlug
     → if match, return view_profile (tier 4: partner type)
  5. Query WHERE target_type='default' AND is_active=true
     → if match, return view_profile (tier 5: default)
  6. Return null → existing behavior (no view override)
```

Within each tier, if multiple rules match, use `priority` column (lower = higher priority). If still tied, use `created_at ASC` (oldest wins). Log tie-break decisions at `info` level.

#### Track D — `ui-ops` (starts after V3 stable)

| ID | Task | Output | Depends On |
|----|------|--------|------------|
| V4 | Sidebar `Admin Mode` toggle + `See as` selector | `src/components/layout/admin-mode-control.tsx` | V3 |
| V4a | Context badge in header showing current "seeing as" state | `src/components/layout/viewer-context-badge.tsx` | V3 |
| V5c | `/admin/views` management page: list, create, edit, assign audiences | `src/app/(dashboard)/admin/views/page.tsx` + sub-components | V5a, V5b |
| V8 | `Work Calendar Overview` module contract shell (placeholder rendering, attachable to view) | `src/components/modules/work-calendar-overview.tsx` | V7 |

**Sidebar insertion point:**

The current sidebar profile area (`sidebar.tsx` lines 162-231) renders user avatar + name + role label + action buttons. The `Admin Mode` toggle and `See as` dropdown will be inserted between the profile info and action buttons, visible only when `actor.role === 'admin'`.

```
┌──────────────────────────┐
│ [Avatar] Name            │
│          Admin           │
│ ┌──────────────────────┐ │  ← NEW: Admin-only section
│ │ Admin Mode  [ON/OFF] │ │
│ │ See as: [Self ▾]     │ │
│ │   └ Staff Role       │ │
│ │   └ Staff Person     │ │
│ │   └ Partner          │ │
│ │   └ Partner Type     │ │
│ └──────────────────────┘ │
│ [Feedback] [Settings] [⏏]│
└──────────────────────────┘
```

**Progressive disclosure:** The `See as` selector is collapsed by default. Clicking it opens a popover with searchable lists grouped by target type. On mobile, this opens as a sheet/drawer instead of a popover.

**Wave 2 gate:**

- [ ] Views CRUD: create, read, update, delete view profiles works end-to-end
- [ ] Audience rules: assign person/role/partner/partner_type/default and verify precedence
- [ ] Precedence resolver: unit tests cover all 5 tiers + tie-break + null fallback
- [ ] Sidebar control: Admin Mode toggle works, See-as sets viewer context via API
- [ ] Context badge: shows current subject label; clears on reset
- [ ] Dashboard/module resolution respects active view when impersonating
- [ ] Non-admin sidebar: admin controls are completely absent from DOM (not just hidden)
- [ ] No regressions in existing module/dashboard admin functionality

---

### Wave 3: Hardening + Ops (serial on Wave 2)

#### Track E — `api-flow` + `ui-ops` (shared)

| ID | Task | Output | Depends On |
|----|------|--------|------------|
| V9a | Audit logging for context switches (who, when, from-subject, to-subject) | `src/lib/audit/viewer-context-log.ts` + API integration | V3 |
| V9b | Audit logging for view assignment changes | Integrated into views CRUD API | V5a |
| V9c | Redaction policy: never log session tokens or full request bodies in audit | Code review + test | V9a, V9b |

#### Track F — `qa-review` (starts when V4-V8 are merge-ready)

| ID | Task | Output | Depends On |
|----|------|--------|------------|
| V10 | Happy-path smoke test execution | Evidence bundle (screenshots + API logs) | V4, V5c, V7, V8 |
| V11 | Failure-path smoke test execution | Evidence bundle (screenshots + 403 logs) | V4, V7 |
| V12 | Security/abuse edge smoke test execution | Evidence bundle (request/response logs + audit entries) | V4, V7, V9a |
| V13 | Mapping integrity test: partner type normalization roundtrip | Test fixtures + resolver output logs | V2c, V6 |
| V14 | Regression suite: existing admin module builder, partner list, staff list unaffected | Test output + visual diff | All |
| V15 | Rollback verification: drop new tables, remove routes, confirm app stability | Rollback script output + smoke evidence | All |

**Wave 3 gate:**

- [ ] All audit log entries for context switches verified
- [ ] Redaction policy confirmed (no tokens/secrets in logs)
- [ ] All 4 smoke matrix scenarios pass with evidence
- [ ] Rollback script tested and confirmed clean
- [ ] No regressions in existing features
- [ ] Build, lint, type-check all pass

---

## B) Complete Task Matrix

| ID | Task | Owner | Depends On | Wave | Output |
|----|------|-------|------------|------|--------|
| W0.1 | Verify product catalog slugs | `schema-core` | — | 0 | Slug confirmation |
| W0.2 | Define ViewerContext TS contract | `api-flow` | — | 0 | Type exports |
| W0.3 | Decide session storage mechanism | `api-flow` | — | 0 | Decision record |
| W0.4 | Confirm operations_admin exclusion | `api-flow` | — | 0 | Auth test assertion |
| V1 | ViewerContext resolver utility | `api-flow` | W0.2 | 1B | Utility + tests |
| V2 | Migration: `view_profiles` | `schema-core` | W0.1 | 1A | SQL + rollback |
| V2a | Migration: `view_audience_rules` | `schema-core` | W0.1 | 1A | SQL + rollback |
| V2b | Migration: `view_profile_modules` | `schema-core` | V2 | 1A | SQL + rollback |
| V2c | Migration: partner canonical fields | `schema-core` | W0.1 | 1A | SQL + rollback |
| V2d | RLS policies for new tables | `schema-core` | V2, V2a, V2b | 1A | SQL in migration |
| V3 | Context set/get/clear API | `api-flow` | V1, W0.4 | 1B | Routes + auth tests |
| V3a | Session storage adapter | `api-flow` | W0.3 | 1B | Adapter module |
| V4 | Sidebar Admin Mode + See-as controls | `ui-ops` | V3 | 2D | UI component |
| V4a | Viewer context badge | `ui-ops` | V3 | 2D | UI component |
| V5a | Views CRUD API | `api-flow` | V2, V2a, V2b | 2C | Routes + tests |
| V5b | Audience rule assignment API | `api-flow` | V2a | 2C | Routes + tests |
| V5c | `/admin/views` management page | `ui-ops` | V5a, V5b | 2D | Admin page |
| V6 | Precedence resolver | `api-flow` | V2a, V5a | 2C | Resolver + tests |
| V7 | Hook resolver into dashboard read path | `api-flow` | V6 | 2C | Modified route |
| V8 | Work Calendar Overview module shell | `ui-ops` | V7 | 2D | Module component |
| V9a | Audit logging: context switches | `api-flow` | V3 | 3E | Audit module |
| V9b | Audit logging: view assignments | `api-flow` | V5a | 3E | Integrated logging |
| V9c | Redaction policy enforcement | `api-flow` | V9a, V9b | 3E | Code review + test |
| V10 | Smoke: happy path | `qa-review` | V4, V5c, V7, V8 | 3F | Evidence bundle |
| V11 | Smoke: failure path | `qa-review` | V4, V7 | 3F | Evidence bundle |
| V12 | Smoke: security/abuse edge | `qa-review` | V4, V7, V9a | 3F | Evidence bundle |
| V13 | Smoke: mapping integrity | `qa-review` | V2c, V6 | 3F | Test + logs |
| V14 | Regression suite | `qa-review` | All | 3F | Test output |
| V15 | Rollback verification | `qa-review` | All | 3F | Rollback evidence |

### Dependency Graph (visual)

```
W0.1 ─┬─→ V2 ──→ V2b ──→ V2d ─┐
      ├─→ V2a ──────────→ V2d ─┤
      ├─→ V2c                   │
      │                         ├─→ V5a ──→ V6 ──→ V7 ──→ V8
W0.2 ─┤                         │    │              │       │
      └─→ V1 ──┐               │    V5b ──→ V5c   │       │
W0.3 ──→ V3a ──┤               │                   │       │
W0.4 ──────────┴─→ V3 ─────────┤──→ V4 ───────────│───────│──→ V10
                                │    V4a            │       │      V11
                                │    V9a ──→ V9c   │       │      V12
                                │    V9b ──→ V9c   │       │      V13
                                │                   │       │      V14
                                └───────────────────┴───────┴──→   V15
```

---

## C) Agent Team Composition

| Agent | Scope | Owns | Blocked By | Wave Coverage |
|-------|-------|------|------------|---------------|
| `schema-core` | View-control schema, partner canonicalization, RLS, migration rollback | V2, V2a, V2b, V2c, V2d, W0.1 | Product catalog slug confirmation | 0, 1A |
| `api-flow` | Viewer context contract, session adapter, context API, views CRUD, precedence resolver, dashboard hook, audit logging | W0.2, W0.3, W0.4, V1, V3, V3a, V5a, V5b, V6, V7, V9a, V9b, V9c | `schema-core` table contracts (V2*) | 0, 1B, 2C, 3E |
| `ui-ops` | Sidebar controls, context badge, views admin page, calendar module shell | V4, V4a, V5c, V8 | `api-flow` endpoint contracts (V3, V5a, V5b, V7) | 2D |
| `qa-review` | Adversarial authz tests, smoke matrix execution, regression suite, rollback verification | V10, V11, V12, V13, V14, V15 | All implementation waves complete | 3F |

### Agent Boundaries (non-negotiable)

1. `schema-core` does NOT write API routes or UI components.
2. `api-flow` does NOT modify database schema files or UI components.
3. `ui-ops` does NOT modify auth utilities, API routes, or migrations.
4. `qa-review` does NOT fix bugs — it reports findings. Fixes loop back to the owning agent.
5. All agents share the same `ViewerContext` type contract defined in W0.2.

---

## D) Validation Gates Per Phase

### Phase 1 Gate (Wave 0 + Wave 1)

| Check | Method | Pass Criteria | Owner |
|-------|--------|---------------|-------|
| Migrations apply | `supabase db push` or equivalent | Zero errors, tables exist with correct constraints | `schema-core` |
| Migrations rollback | Run down scripts | Tables dropped, no orphan references | `schema-core` |
| RLS policies | Direct Supabase query as non-admin | Select returns empty; insert returns 403 | `schema-core` |
| ViewerContext types | `npm run build` (tsc) | No type errors | `api-flow` |
| Context API auth | `curl` as non-admin | 403 response | `api-flow` |
| Context API auth | `curl` as operations_admin | 403 response | `api-flow` |
| Context API happy path | `curl` as admin | 200 with correct ViewerContext | `api-flow` |
| Context session persistence | Set context, make subsequent request | Same subject returned | `api-flow` |
| Context reset | DELETE context, make subsequent request | Subject = self | `api-flow` |
| Build/lint/type | `npm run build && npm run lint` | Zero errors | all |

### Phase 2 Gate (Wave 2)

| Check | Method | Pass Criteria | Owner |
|-------|--------|---------------|-------|
| Views CRUD | API tests | Create, read, update, delete all return correct data | `api-flow` |
| Audience assignment | API tests | All 5 tier types assignable and queryable | `api-flow` |
| Precedence tier 1 (person) | Unit test | Person rule overrides all others | `api-flow` |
| Precedence tier 2 (role) | Unit test | Role rule overrides partner/type/default | `api-flow` |
| Precedence tier 3 (partner) | Unit test | Partner rule overrides type/default | `api-flow` |
| Precedence tier 4 (partner_type) | Unit test | Partner-type rule overrides default | `api-flow` |
| Precedence tier 5 (default) | Unit test | Default used when no other match | `api-flow` |
| Precedence null fallback | Unit test | No rules → null → existing behavior | `api-flow` |
| Tie-break logging | Log inspection | Tie-break logged at info level with rule IDs | `api-flow` |
| Sidebar: admin controls present | Visual inspection (admin login) | Toggle + selector visible | `ui-ops` |
| Sidebar: controls absent for non-admin | Visual inspection (staff login) | No admin controls in DOM | `ui-ops` |
| Context badge | Visual inspection | Shows "Viewing as: [label]" when impersonating | `ui-ops` |
| Dashboard resolution with view | API test | `/api/modules/dashboards` returns view-filtered modules | `api-flow` |
| Existing module builder unaffected | Manual regression | Create/edit dashboard still works | `ui-ops` |

### Phase 3 Gate (Wave 3)

| Check | Method | Pass Criteria | Owner |
|-------|--------|---------------|-------|
| Audit log: context switch | DB query after switch | Row with actor, from-subject, to-subject, timestamp | `api-flow` |
| Audit log: view assignment | DB query after assignment | Row with view_id, rule details, actor | `api-flow` |
| Audit log: no secrets | Log grep | No session tokens, cookies, or passwords in log entries | `api-flow` |
| Smoke: happy path | See smoke matrix | Pass with evidence | `qa-review` |
| Smoke: failure path | See smoke matrix | Pass with evidence | `qa-review` |
| Smoke: security edge | See smoke matrix | Pass with evidence | `qa-review` |
| Smoke: mapping integrity | See smoke matrix | Pass with evidence | `qa-review` |
| Rollback clean | Run rollback, restart app | App functions as pre-feature state | `qa-review` |
| Final build | `npm run build && npm run lint` | Zero errors, zero warnings | all |

---

## E) Smoke Test Matrix

### E.1 Happy Path

| Step | Action | Expected Result | Evidence Required |
|------|--------|-----------------|-------------------|
| 1 | Admin logs in | Dashboard loads, sidebar shows Admin Mode toggle | Screenshot |
| 2 | Admin toggles `Admin Mode OFF` | Admin-specific nav items hidden, context badge appears "Admin Mode: Off" | Screenshot |
| 3 | Admin opens `See as` → selects `Staff Role: PPC Strategist` | Context badge updates to "Viewing as: PPC Strategist" | Screenshot + `GET /api/viewer-context` response JSON |
| 4 | Admin navigates to dashboard | UI resolves to PPC-role-assigned view/modules | Screenshot showing view-specific modules |
| 5 | Admin clicks `Admin Mode ON` (or resets) | Full admin nav restored, context badge cleared | Screenshot |

### E.2 Failure Path

| Step | Action | Expected Result | Evidence Required |
|------|--------|-----------------|-------------------|
| 1 | Staff user (non-admin) logs in | No `Admin Mode` toggle, no `See as` selector in sidebar DOM | Screenshot + DOM inspector showing absence |
| 2 | Non-admin sends `POST /api/viewer-context` | 403 Forbidden response | `curl` output with response body |
| 3 | Non-admin sends `GET /api/admin/views` | 403 Forbidden response | `curl` output |
| 4 | `operations_admin` sends `POST /api/viewer-context` | 403 Forbidden response | `curl` output |

### E.3 Security / Abuse Edge

| Step | Action | Expected Result | Evidence Required |
|------|--------|-----------------|-------------------|
| 1 | Admin sets `See as: Partner X` (a sensitive/high-tier partner) | Rendering shows Partner X's view, admin sees what partner sees | Screenshot of rendered view |
| 2 | While impersonating Partner X, admin attempts to delete a partner via API | Delete succeeds (actor is admin) — but audit log records the action with both actor and subject context | `DELETE` response (200) + audit log DB row showing actor_id, subject context, action |
| 3 | While impersonating Partner X, admin attempts to access Partner Y's data via direct URL | Access is determined by actor permissions (admin = full access), but rendered view stays scoped to Partner X's view assignment | API response showing data access + UI rendering scoped to Partner X view |
| 4 | Attempt to set `See as` to a non-existent staff/partner UUID | API returns 400 with validation error, context unchanged | `POST` response body with error message |
| 5 | Attempt to manipulate session cookie directly (tamper with subject) | Signed cookie validation fails, context resets to self | Modified cookie → `GET /api/viewer-context` returns actor as subject |

### E.4 Mapping Integrity

| Step | Action | Expected Result | Evidence Required |
|------|--------|-----------------|-------------------|
| 1 | Partner with `source_data.Partner type = "PPC Premium"` and `pod_leader` + `conversion_strategist` staffing columns | `canonical_product_id` resolves to `sophie_ppc` | Test fixture input → resolver output log |
| 2 | Partner with `source_data.Partner type = "FAM"` and `Brand Manager` staffing | `canonical_product_id` resolves to `fam`, staffing confirms | Test fixture input → resolver output log |
| 3 | Partner with no `Partner type` but `pod_leader` present (no `conversion_strategist`) | Fallback: `canonical_product_id` resolves to `ppc_basic` | Test fixture input → resolver output log |
| 4 | See-as by partner type `sophie_ppc` → view assigned to `partner_type: sophie_ppc` | Correct view profile returned by precedence resolver | Resolver function output + API response |

---

## F) Rollback Strategy

### Migration Rollback

Each migration produces a paired rollback script. Rollback order is reverse of apply order.

| Migration | Rollback Action | Risk |
|-----------|----------------|------|
| `view_profile_modules` | `DROP TABLE view_profile_modules` | None (new table, no existing data dependency) |
| `view_audience_rules` | `DROP TABLE view_audience_rules` | None |
| `view_profiles` | `DROP TABLE view_profiles` | None |
| `canonical_product_id` on `partners` | `ALTER TABLE partners DROP COLUMN canonical_product_id, DROP COLUMN partner_type_raw` | Minimal (new columns, no existing code depends on them) |
| RLS policies | `DROP POLICY ... ON view_profiles` (etc.) | None |

**Rollback script location:** `sql/rollback/views-feature-rollback.sql`

### Runtime Rollback

| Component | Rollback Action | Recovery Time |
|-----------|----------------|---------------|
| Context API routes | Delete route files, redeploy | < 5 min |
| Sidebar admin controls | Remove component import, redeploy | < 5 min |
| Views admin page | Remove route directory, redeploy | < 5 min |
| Precedence resolver in dashboard path | Revert to unconditional module listing, redeploy | < 5 min |
| Session cookie | Cookie expires naturally (session-scoped); no manual cleanup needed | Immediate |

### Rollback Trigger Criteria

- P1 security finding (privilege escalation or data leak) confirmed in production
- Migration causes data corruption in existing tables
- Performance degradation > 200ms on dashboard load (measured)
- Build failure on main branch after merge

### Rollback Verification Test

`qa-review` must execute:
1. Apply all migrations → verify app works
2. Run rollback script → verify all new tables/columns removed
3. Restart app → verify all existing pages load without error
4. Run existing test suite → zero failures

---

## G) Residual Risk Register

| ID | Severity | Risk | Mitigation | Residual Status | Owner |
|----|----------|------|------------|-----------------|-------|
| R1 | P1 | Privilege escalation: subject context influences write-path authorization | Enforce actor-only auth checks in all mutating endpoints; test with impersonation active | Mitigated by design; verify with V12 | `api-flow` |
| R2 | P1 | Data leak: admin Supabase client bypasses RLS when fetching as subject | New view-resolution queries use anon/role-scoped client, NOT admin client, for data reads | Mitigated by implementation; verify with V12 | `api-flow` |
| R3 | P2 | Nondeterministic view assignment from rule conflicts | Deterministic precedence with explicit tie-break (priority, then created_at); log conflicts at info level | Low residual; monitor logs post-launch | `api-flow` |
| R4 | P2 | Partner-type / product mapping drift | Canonical mapping sourced from products catalog (single source of truth); raw value preserved in `partner_type_raw` for audit | Low residual; operational process to sync catalog | `schema-core` |
| R5 | P2 | Context leak across browser tabs | Session cookie is shared across tabs (expected browser behavior); document that switching context in one tab affects all tabs | Accepted risk for v1; cross-tab sync deferred | `api-flow` |
| R6 | P3 | Mobile usability: sidebar control complexity | Progressive disclosure (collapsed by default); mobile uses sheet/drawer instead of popover | Low residual; validate in V10 | `ui-ops` |
| R7 | P3 | Audit log volume if admins switch frequently | Log only to DB, not stdout; add retention policy (90 days default) in follow-up | Deferred to post-launch ops | `api-flow` |
| R8 | P2 | operations_admin scope creep: future requests to grant partial see-as | Current design explicitly blocks; documented as intentional. Future change requires new planning round | Accepted; documented | `api-flow` |

---

## H) Verification Checklist

- [ ] Build passes (`npm run build`) — zero errors
- [ ] Lint passes (`npm run lint`) — zero errors
- [ ] TypeScript strict mode — zero type errors
- [ ] Unit tests: ViewerContext resolver (all identity types)
- [ ] Unit tests: Precedence resolver (all 5 tiers + tie-break + null)
- [ ] API tests: Context set/get/clear (admin, non-admin, operations_admin)
- [ ] API tests: Views CRUD (create, read, update, delete)
- [ ] API tests: Audience rule assignment (all target types)
- [ ] Integration test: Dashboard resolution with active view
- [ ] Smoke: Happy path (E.1) with evidence links
- [ ] Smoke: Failure path (E.2) with evidence links
- [ ] Smoke: Security/abuse edge (E.3) with evidence links
- [ ] Smoke: Mapping integrity (E.4) with evidence links
- [ ] Regression: Existing admin module builder unchanged
- [ ] Regression: Partner list page unchanged
- [ ] Regression: Staff list page unchanged
- [ ] Rollback: Migration rollback tested (V15)
- [ ] Rollback: Runtime rollback tested (V15)
- [ ] Audit logs: Context switch logging verified
- [ ] Audit logs: Redaction policy verified (no secrets)
- [ ] Documentation: API contracts documented
- [ ] Documentation: Rollback runbook written

---

## I) Scorecard — Baseline + Target

Reference: `references/scorecard-rubric.md`

| Category | Weight | Baseline | Target | Delta | Evidence Owner | Evidence Required |
|----------|--------|----------|--------|-------|----------------|-------------------|
| Security | 30% | 5 | 8 | +3 | `qa-review` | Authz tests for all roles (admin, operations_admin, pod_leader, staff, partner); impersonation abuse-edge tests (V12); cookie tampering test (E.3.5); audit log verification (V9a) |
| Scalability | 20% | 4 | 8 | +4 | `schema-core` | Precedence resolver query plan (EXPLAIN); indexed lookups on `view_audience_rules(target_type, target_id)`; batch-safe resolution (no N+1 in dashboard list) |
| Performance | 20% | 6 | 7 | +1 | `api-flow` | Context API response time < 50ms (measured); precedence resolution < 100ms for 100 rules (measured); dashboard load time delta < 50ms vs baseline (measured) |
| Reliability | 20% | 5 | 8 | +3 | `api-flow` | Null-fallback behavior when no rules match; session cookie expiry handling; graceful degradation when view_profiles table is empty; idempotent context-set (same request twice = same result) |
| Operability | 10% | 4 | 8 | +4 | `ui-ops` | Rollback runbook with step-by-step commands; audit log query examples; admin views management page with clear UX; context badge for immediate admin feedback |

**Weighted baseline:** `5(0.3) + 4(0.2) + 6(0.2) + 5(0.2) + 4(0.1) = 1.5 + 0.8 + 1.2 + 1.0 + 0.4 = 4.9`

**Weighted target:** `8(0.3) + 8(0.2) + 7(0.2) + 8(0.2) + 8(0.1) = 2.4 + 1.6 + 1.4 + 1.6 + 0.8 = 7.8`

**Target delta: +2.9** (4.9 → 7.8)

Scores above are estimates. Post-implementation scores require evidence links per category. No category may claim 9+ without comprehensive evidence and trivial residual risk.

---

## J) Open Questions (Carried Forward)

1. **TTS product slug:** Confirm whether `TTS (TikTok Shop)` normalizes to existing `tiktok` slug or requires a new `tts` entry in products catalog. **Blocked by:** Product team decision. **Impact:** V2c migration and mapping rules.

2. **Tie-break policy for personal + role rules:** If an admin has both a personal view assignment AND a role-based view assignment, the personal assignment wins (tier 1 > tier 2). Confirm this is acceptable or if admins should see a merged/composite view.

3. **Pod leader see-as (future):** Confirmed out of scope for v1. Document as candidate for v2 planning round.

4. **Cross-tab context behavior:** Session cookie means all tabs share one context. Document this as known behavior. Cross-tab isolation deferred.

---

## K) Implementation Constraints

1. **No coding until `FINAL-APPROVED-PLAN.md` exists** — per feature-rollout-review-loop protocol.
2. **All new API routes** must use `requireAuth()` + `requireRole('admin')` from `src/lib/auth/api-auth.ts`.
3. **All new API routes** must use standardized response helpers from `src/lib/api/response.ts`.
4. **All new UI components** must follow design philosophy in CLAUDE.md (progressive disclosure, ease-out animations, no fake data).
5. **All new tables** must have RLS policies and `entity_versions` triggers for audit trail.
6. **Migration files** must include both `up` and `down` scripts.
7. **No changes to existing auth middleware** — viewer context is additive, not a modification of existing role checks.
