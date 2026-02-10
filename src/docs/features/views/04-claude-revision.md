# Views Feature — Claude Revision

Date: 2026-02-10
Round: 04 (Response to `03-codex-review.md`)

---

## Revision Summary

All 3 P1 findings: **fixed** with plan-level edits.
All 3 P2 findings: **fixed** with plan-level edits.
Both open questions: **answered** with design decisions.

No blocking items remain. This revision is ready for `FINAL-APPROVED-PLAN.md` merge.

---

## P1 Findings

### P1.1 — Client-supplied `viewerContext` on runtime read path creates spoofing risk

**Status: Fixed**

**Finding:** The plan described V7 as `/api/modules/dashboards` accepting optional `viewerContext` from request input, allowing request payloads to influence subject selection.

**Plan edits:**

1. **V7 description revised.** The dashboards route does NOT accept `viewerContext` from request body or query params. Instead, the route handler calls a server-side utility that reads the signed session cookie to derive the effective viewer context.

   Old (02-claude-agent-plan.md line 155):
   ```
   V7: Hook resolver into module/dashboard read path:
   `/api/modules/dashboards` accepts optional `viewerContext` to filter
   ```

   New:
   ```
   V7: Hook resolver into module/dashboard read path:
   `/api/modules/dashboards` derives viewer context server-side from
   signed session cookie via `getServerViewerContext(request)`. No
   client-supplied identity fields are accepted.
   ```

2. **New invariant added to the contract (Section A, Wave 1B invariants):**

   ```
   6. Runtime read routes MUST derive viewer context server-side from
      the signed session cookie. Request payload, query params, and
      headers MUST NOT be trusted for actor or subject identity.
   ```

3. **Smoke test E.3 updated.** Add scenario:

   | Step | Action | Expected Result | Evidence Required |
   |------|--------|-----------------|-------------------|
   | 6 | Non-admin sends `GET /api/modules/dashboards` with forged `viewerContext` in request body | Request body is ignored; response uses server-derived context (self) | API request + response showing body ignored |

---

### P1.2 — Resolver algorithm uses fields not present in the declared identity contract

**Status: Fixed**

**Finding:** `SubjectIdentity` defines `{ type, targetId, targetLabel, resolvedRole }`, but the resolver references `identity.userId` (not in contract) and `identity.partnerTypeSlug` (not in contract).

**Plan edits:**

1. **`SubjectIdentity` retained as the user-facing contract. New `ViewResolverInput` type added as the resolver's internal input.** The resolver never consumes `SubjectIdentity` directly — a builder function maps it to `ViewResolverInput` first.

   Existing contract (unchanged):
   ```typescript
   interface SubjectIdentity {
     type: 'self' | 'staff' | 'partner' | 'role' | 'partner_type'
     targetId: string | null
     targetLabel: string
     resolvedRole: Role
   }
   ```

   New resolver input contract (added):
   ```typescript
   /**
    * Normalized input to the view precedence resolver.
    * Constructed deterministically from SubjectIdentity + lookup.
    */
   interface ViewResolverInput {
     staffId: string | null       // set when type='staff' or type='self'
     roleSlug: string | null      // set when type='role', or derived from resolvedRole
     partnerId: string | null     // set when type='partner'
     partnerTypeSlug: string | null // set when type='partner_type', or looked up from partner's computed_partner_type
   }
   ```

2. **Construction rules (deterministic, per subject type):**

   | SubjectIdentity.type | staffId | roleSlug | partnerId | partnerTypeSlug |
   |----------------------|---------|----------|-----------|-----------------|
   | `self` | actor.userId | actor.role | null | null |
   | `staff` | targetId | lookup staff.role | null | null |
   | `partner` | null | null | targetId | lookup partner.computed_partner_type |
   | `role` | null | targetId (role slug) | null | null |
   | `partner_type` | null | null | null | targetId (product slug) |

3. **Resolver algorithm updated to use `ViewResolverInput` fields exclusively:**

   ```
   resolveEffectiveView(input: ViewResolverInput): ViewProfile | null
     1. if input.staffId:   query WHERE target_type='staff'   AND target_id=input.staffId        → tier 1
     2. if input.roleSlug:  query WHERE target_type='role'    AND target_id=input.roleSlug       → tier 2
     3. if input.partnerId: query WHERE target_type='partner' AND target_id=input.partnerId      → tier 3
     4. if input.partnerTypeSlug: query WHERE target_type='partner_type' AND target_id=input.partnerTypeSlug → tier 4
     5. query WHERE target_type='default' AND is_active=true                                      → tier 5
     6. return null
   ```

4. **New task added:** V1a — `buildViewResolverInput(subject: SubjectIdentity, actor: ActorIdentity): ViewResolverInput` utility with tests covering all 5 subject types. Owner: `api-flow`. Depends on: V1. Output: utility + tests.

5. **V6 depends updated:** V6 now depends on V1a (resolver input builder) in addition to V2a and V5a.

---

### P1.3 — Partner taxonomy model in plan conflicts with already-shipped canonical fields

**Status: Fixed**

**Finding:** The plan proposed new columns `canonical_product_id` (FK to products) and `partner_type_raw` on the partners table, but the already-shipped `05-rollout-partner-type.md` delivered 8 persisted taxonomy columns including `computed_partner_type`, `computed_partner_type_source`, `legacy_partner_type_raw`, `legacy_partner_type`, `partner_type_matches`, `partner_type_is_shared`, `partner_type_reason`, and `partner_type_computed_at`. Running both creates dual sources of truth.

**Plan edits:**

1. **V2c removed entirely.** The migration to add `canonical_product_id` and `partner_type_raw` to partners is dropped. These columns are not needed because:
   - `computed_partner_type` already stores the canonical type slug (`ppc_basic`, `sophie_ppc`, `cc`, `fam`, `pli`, `tiktok`) — this IS the canonical product reference.
   - `legacy_partner_type_raw` already preserves the raw source value for audit.
   - The reconciliation engine + nightly cron already keep persisted values aligned.

2. **Authoritative read field per use case (single source of truth):**

   | Use Case | Read Field | Why |
   |----------|-----------|-----|
   | View assignment (partner-type tier) | `partners.computed_partner_type` | Already canonical, reconciled nightly |
   | UI display | `computed_partner_type` + API-enriched label | Already shipped in partners API |
   | Mismatch detection | `partners.partner_type_matches` | Already shipped with badge + tooltip |
   | Audit / debug | `partners.legacy_partner_type_raw` + `partner_type_reason` | Already preserved |
   | Billing (future) | `partners.computed_partner_type` | Documented in 05-rollout as next step |

3. **View resolver reads `computed_partner_type` directly.** When resolving tier 4 (partner-type), the precedence resolver queries:
   ```sql
   SELECT vp.* FROM view_audience_rules var
   JOIN view_profiles vp ON vp.id = var.view_id
   WHERE var.target_type = 'partner_type'
     AND var.target_id = partner.computed_partner_type
     AND var.is_active = true
   ORDER BY var.priority ASC, var.created_at ASC
   LIMIT 1
   ```

4. **Task matrix impact:**
   - V2c: **deleted**
   - V13 (smoke: mapping integrity): **revised** to test `computed_partner_type` field directly, not a new column
   - Dependency graph: V2c removed; no other tasks depended solely on V2c

5. **Smoke test E.4 revised:**

   | Step | Action | Expected Result | Evidence Required |
   |------|--------|-----------------|-------------------|
   | 1 | Partner with `computed_partner_type = 'sophie_ppc'` (persisted by sync engine) | View resolver queries tier 4 with `target_id = 'sophie_ppc'` and returns matching view | DB query showing partner's `computed_partner_type` + resolver output |
   | 2 | Partner with `partner_type_matches = false` (legacy/staffing mismatch) | View assignment uses `computed_partner_type` (authoritative), not `legacy_partner_type_raw` | Resolver log showing which field was read |
   | 3 | After reconciliation endpoint runs | All partners' `computed_partner_type` fields are current; view assignment reflects latest state | Reconciliation API response + resolver output for previously-drifted partner |

---

## P2 Findings

### P2.1 — `view_audience_rules` constraints are insufficient for deterministic rule selection

**Status: Fixed**

**Finding:** `tier` and `target_type` can drift without a consistency check. `UNIQUE(view_id, target_type, target_id)` doesn't enforce singleton default semantics when `target_id IS NULL`.

**Plan edits:**

1. **Add CHECK constraint tying `target_type` to `tier`:**

   ```sql
   ALTER TABLE view_audience_rules ADD CONSTRAINT chk_tier_target_type CHECK (
     (tier = 1 AND target_type = 'staff') OR
     (tier = 2 AND target_type = 'role') OR
     (tier = 3 AND target_type = 'partner') OR
     (tier = 4 AND target_type = 'partner_type') OR
     (tier = 5 AND target_type = 'default')
   );
   ```

2. **Add CHECK constraint for `target_id` nullability:**

   ```sql
   ALTER TABLE view_audience_rules ADD CONSTRAINT chk_target_id_required CHECK (
     (target_type = 'default' AND target_id IS NULL) OR
     (target_type != 'default' AND target_id IS NOT NULL)
   );
   ```

3. **Add partial unique index for singleton active default per view:**

   ```sql
   CREATE UNIQUE INDEX uq_view_audience_rules_active_default
   ON view_audience_rules (view_id)
   WHERE target_type = 'default' AND is_active = true;
   ```

   This ensures at most one active default rule per view profile. Multiple defaults can exist (for history/deactivation) but only one can be active.

4. **Replace the existing UNIQUE constraint** to handle NULL correctly:

   Old:
   ```sql
   UNIQUE(view_id, target_type, target_id)
   ```

   New:
   ```sql
   -- For non-default rules (target_id IS NOT NULL):
   CREATE UNIQUE INDEX uq_view_audience_rules_target
   ON view_audience_rules (view_id, target_type, target_id)
   WHERE target_id IS NOT NULL;

   -- For default rules (target_id IS NULL), covered by
   -- uq_view_audience_rules_active_default above
   ```

5. **V2a migration updated** to include all four constraint additions. Rollback script drops them in reverse.

6. **New validation gate added to Phase 1:**

   | Check | Method | Pass Criteria | Owner |
   |-------|--------|---------------|-------|
   | Tier/type constraint | `INSERT INTO view_audience_rules(tier=1, target_type='role', ...)` | Rejected by CHECK | `schema-core` |
   | Null target_id for non-default | `INSERT INTO view_audience_rules(target_type='staff', target_id=NULL, ...)` | Rejected by CHECK | `schema-core` |
   | Duplicate active default | Insert two `target_type='default', is_active=true` for same view | Rejected by unique index | `schema-core` |

---

### P2.2 — Rollback plan drops partner taxonomy columns without data-preservation controls

**Status: Fixed**

**Finding:** The rollback plan included `ALTER TABLE partners DROP COLUMN canonical_product_id, DROP COLUMN partner_type_raw`, which would cause irreversible data loss for operational/billing data.

**Plan edits:**

1. **V2c is already removed (per P1.3)**, so there are no new partner columns to drop. The existing 8 partner-type columns shipped in `05-rollout-partner-type.md` are NOT part of the Views feature rollback scope — they belong to the partner-type rollout and have their own lifecycle.

2. **Rollback strategy revised to two-phase approach for all Views tables:**

   **Phase 1 — Soft disable (immediate, reversible):**
   - Remove API route files for viewer context and views CRUD
   - Remove sidebar admin controls component import
   - Remove precedence resolver hook from dashboard read path
   - Redeploy. App functions as pre-feature. Tables remain but are unused.

   **Phase 2 — Hard cleanup (operator-initiated, after confirmation period):**
   - Run `sql/rollback/views-feature-rollback.sql` which drops `view_profile_modules`, `view_audience_rules`, `view_profiles` (in order).
   - Requires explicit operator execution — never automated.
   - Minimum 7-day hold between Phase 1 and Phase 2 to allow data export if needed.

3. **Rollback table updated:**

   | Migration | Phase 1 (Soft) | Phase 2 (Hard) | Risk |
   |-----------|---------------|----------------|------|
   | `view_profile_modules` | Table unused (no code reads it) | `DROP TABLE` | None (new data only) |
   | `view_audience_rules` | Table unused | `DROP TABLE` | None (new data only) |
   | `view_profiles` | Table unused | `DROP TABLE` | None (new data only) |
   | Partner taxonomy columns | NOT IN SCOPE — belongs to partner-type rollout | N/A | N/A |

4. **V15 (rollback verification) updated** to test both phases:
   - Phase 1: remove code paths, verify app stability
   - Phase 2: run DROP scripts, verify no orphan references

---

### P2.3 — Global route auth constraint over-scopes admin requirement

**Status: Fixed**

**Finding:** The implementation constraint "All new API routes must use `requireRole('admin')`" conflicts with runtime read paths that non-admin users need to access.

**Plan edits:**

1. **Implementation constraint K.2 revised.** Split into two API classes:

   Old:
   ```
   All new API routes must use requireAuth() + requireRole('admin')
   ```

   New:
   ```
   K.2a — Control-plane routes (admin-only):
     /api/viewer-context      (POST, DELETE) — requireRole('admin')
     /api/admin/views/*       (all methods)  — requireRole('admin')

   K.2b — Runtime read routes (any authenticated user):
     /api/viewer-context      (GET)          — requireAuth() + server-derived context
     /api/modules/dashboards  (GET, existing) — requireAuth() + server-resolved view
   ```

2. **Security invariant preserved:** Runtime read routes derive viewer context server-side from the signed session cookie. Non-admin users always resolve to `subject = self` (the cookie is only set by admin-gated POST endpoint). This means non-admin users get their natural view without any impersonation capability.

3. **Flow for non-admin users:**
   ```
   Non-admin → GET /api/modules/dashboards
     → getServerViewerContext(req) reads session cookie
     → no impersonation cookie set (only admin can set it)
     → subject = self (natural identity)
     → resolveEffectiveView(buildViewResolverInput(selfSubject, actor))
     → returns view assigned to this user's person/role/partner-type/default
     → dashboard response filtered by resolved view
   ```

4. **Flow for admin users (impersonating):**
   ```
   Admin → POST /api/viewer-context { type: 'role', targetId: 'pod_leader' }
     → requireRole('admin') passes
     → signed session cookie set with subject context

   Admin → GET /api/modules/dashboards
     → getServerViewerContext(req) reads session cookie
     → subject = { type: 'role', targetId: 'pod_leader', ... }
     → resolveEffectiveView(buildViewResolverInput(subject, actor))
     → returns view assigned to pod_leader role
     → dashboard response filtered by resolved view
   ```

5. **Task matrix impact:** V7 description updated to clarify that the existing `/api/modules/dashboards` route uses `requireAuth()` (already present), not `requireRole('admin')`.

---

## Open Questions Answered

### Q1: Should partner-type view assignment read from `computed_partner_type` only, or permit fallback to legacy raw labels?

**Decision: `computed_partner_type` only. No fallback to legacy raw labels.**

Rationale:
- `computed_partner_type` is the canonical, reconciled value — already maintained by the sync engine, single-partner sync, and nightly cron.
- Falling back to `legacy_partner_type_raw` would create a secondary resolution path that bypasses the reconciliation engine.
- If a partner has `computed_partner_type = NULL` (unknown), they get no tier-4 match and fall through to tier 5 (default) or null. This is correct behavior — it surfaces partners needing classification rather than hiding them behind a guess.

### Q2: Do we require one global active default view or one default per audience class (staff vs partner)?

**Decision: One global active default view per `view_profiles` entry. No audience-class partitioning of defaults in v1.**

Rationale:
- The partial unique index (`uq_view_audience_rules_active_default`) enforces at most one active default rule per view profile.
- In v1, there is one primary default view that catches all unmatched identities.
- Audience-class defaults (e.g., "default for staff" vs "default for partners") can be modeled in v2 by adding a `default_audience_class` column to `view_audience_rules` and updating the partial unique index. This is additive and doesn't require schema rework.
- For v1, differentiation between staff and partner defaults is achieved via tier 2 (role) and tier 4 (partner_type) rules, which are more specific than the global default.

---

## Revised Task Matrix (incorporating all changes)

| ID | Task | Owner | Depends On | Wave | Status vs 02 |
|----|------|-------|------------|------|--------------|
| W0.1 | Verify product catalog slugs | `schema-core` | — | 0 | unchanged |
| W0.2 | Define ViewerContext + ViewResolverInput TS contracts | `api-flow` | — | 0 | **revised** (ViewResolverInput added) |
| W0.3 | Decide session storage mechanism | `api-flow` | — | 0 | unchanged |
| W0.4 | Confirm operations_admin exclusion | `api-flow` | — | 0 | unchanged |
| V1 | ViewerContext resolver utility | `api-flow` | W0.2 | 1B | unchanged |
| **V1a** | **`buildViewResolverInput` utility + tests** | **`api-flow`** | **V1** | **1B** | **new** |
| V2 | Migration: `view_profiles` | `schema-core` | W0.1 | 1A | unchanged |
| V2a | Migration: `view_audience_rules` with CHECK + partial unique indexes | `schema-core` | W0.1 | 1A | **revised** (constraints added per P2.1) |
| V2b | Migration: `view_profile_modules` | `schema-core` | V2 | 1A | unchanged |
| ~~V2c~~ | ~~Migration: partner canonical fields~~ | — | — | — | **deleted** (per P1.3) |
| V2d | RLS policies for new tables | `schema-core` | V2, V2a, V2b | 1A | unchanged |
| V3 | Context set/get/clear API (POST/DELETE admin-only; GET any auth) | `api-flow` | V1, W0.4 | 1B | **revised** (GET split to requireAuth per P2.3) |
| V3a | Session storage adapter | `api-flow` | W0.3 | 1B | unchanged |
| V4 | Sidebar Admin Mode + See-as controls | `ui-ops` | V3 | 2D | unchanged |
| V4a | Viewer context badge | `ui-ops` | V3 | 2D | unchanged |
| V5a | Views CRUD API | `api-flow` | V2, V2a, V2b | 2C | unchanged |
| V5b | Audience rule assignment API | `api-flow` | V2a | 2C | unchanged |
| V5c | `/admin/views` management page | `ui-ops` | V5a, V5b | 2D | unchanged |
| V6 | Precedence resolver (uses `ViewResolverInput`) | `api-flow` | V1a, V2a, V5a | 2C | **revised** (depends on V1a; uses new input type) |
| V7 | Hook resolver into dashboard read path (server-derived context only) | `api-flow` | V6 | 2C | **revised** (no client input; server-side context per P1.1) |
| V8 | Work Calendar Overview module shell | `ui-ops` | V7 | 2D | unchanged |
| V9a | Audit logging: context switches | `api-flow` | V3 | 3E | unchanged |
| V9b | Audit logging: view assignments | `api-flow` | V5a | 3E | unchanged |
| V9c | Redaction policy enforcement | `api-flow` | V9a, V9b | 3E | unchanged |
| V10 | Smoke: happy path | `qa-review` | V4, V5c, V7, V8 | 3F | unchanged |
| V11 | Smoke: failure path | `qa-review` | V4, V7 | 3F | unchanged |
| V12 | Smoke: security/abuse edge (+ forged body test) | `qa-review` | V4, V7, V9a | 3F | **revised** (new scenario E.3.6 per P1.1) |
| V13 | Smoke: mapping integrity (reads `computed_partner_type`) | `qa-review` | V6 | 3F | **revised** (tests existing field per P1.3; V2c dep removed) |
| V14 | Regression suite | `qa-review` | All | 3F | unchanged |
| V15 | Rollback verification (two-phase) | `qa-review` | All | 3F | **revised** (soft then hard rollback per P2.2) |

**Total tasks:** 27 (was 28; V2c deleted, V1a added)

---

## Revised Dependency Graph

```
W0.1 ─┬─→ V2 ──→ V2b ──→ V2d ─┐
      ├─→ V2a ──────────→ V2d ─┤
      │                         ├─→ V5a ──→ V6 ──→ V7 ──→ V8
W0.2 ─┤                         │    │       ↑      │       │
      └─→ V1 ──→ V1a ──────────│────│───────┘      │       │
W0.3 ──→ V3a ──┐               │    V5b ──→ V5c    │       │
W0.4 ──────────┴─→ V3 ─────────┤──→ V4 ────────────│───────│──→ V10
                                │    V4a             │       │      V11
                                │    V9a ──→ V9c     │       │      V12
                                │    V9b ──→ V9c     │       │      V13
                                │                    │       │      V14
                                └────────────────────┴───────┴──→   V15
```

Key change: V1 → V1a → V6 chain (new V1a feeds the resolver input builder).

---

## Revised Residual Risk Register

| ID | Severity | Risk | Residual Status | Change from 02 |
|----|----------|------|-----------------|----------------|
| R1 | P1 | Privilege escalation via subject context | Mitigated (actor-only auth + server-derived context) | Strengthened by P1.1 fix |
| R2 | P1 | Data leak via admin Supabase client | Mitigated (role-scoped client for reads) | Unchanged |
| R3 | P2 | Nondeterministic view assignment | Mitigated (CHECK constraints + partial unique indexes) | Strengthened by P2.1 fix |
| R4 | P2 | Partner-type / product mapping drift | Mitigated (reads `computed_partner_type` only; reconciliation engine active) | Strengthened by P1.3 fix |
| R5 | P2 | Context leak across browser tabs | Accepted for v1 | Unchanged |
| R6 | P3 | Mobile sidebar complexity | Low residual | Unchanged |
| R7 | P3 | Audit log volume | Deferred to post-launch ops | Unchanged |
| R8 | P2 | operations_admin scope creep | Accepted; documented | Unchanged |

No new residual risks introduced by revisions.

---

## Finding Resolution Matrix

| Finding | Severity | Status | Key Change |
|---------|----------|--------|------------|
| P1.1 — Context spoofing via request body | P1 | **fixed** | V7 derives context server-side; new invariant #6; new smoke E.3.6 |
| P1.2 — Resolver/contract field mismatch | P1 | **fixed** | New `ViewResolverInput` type; new task V1a; deterministic construction rules per subject type |
| P1.3 — Taxonomy model conflicts with shipped fields | P1 | **fixed** | V2c deleted; plan rebased on existing `computed_partner_type` (8 shipped columns); single authoritative read field per use case |
| P2.1 — Insufficient constraints for deterministic rules | P2 | **fixed** | CHECK(tier↔target_type); CHECK(target_id nullability); partial unique index for active defaults; split unique index for NULL handling |
| P2.2 — Rollback drops columns without data controls | P2 | **fixed** | Two-phase rollback (soft-disable then operator-initiated hard cleanup); partner columns explicitly out of scope |
| P2.3 — Over-scoped admin auth on all routes | P2 | **fixed** | Split into K.2a (control-plane, admin-only) and K.2b (runtime reads, requireAuth + server-derived context) |
