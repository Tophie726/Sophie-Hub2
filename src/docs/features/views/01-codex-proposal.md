# Views + See-As Proposal (Codex)

Date: 2026-02-09  
Round: 01 (Codex proposal)

## A) Outcome

- Business/user outcome:
  - Admins can preview the product exactly as different audiences see it, without logging in/out or mutating access rights.
  - Teams can define reusable `Views` mapped to audiences (person, role, partner, partner type, default) so UI composition scales as Sophie Hub grows.
- Shipping definition:
  - Admin-only `See as` + `Admin Mode` shipped with deterministic context resolution.
  - `Views` assignment model defined and integrated with existing modules/dashboards engine.
  - Assignment precedence and auditability documented and tested.
- Non-goals:
  - Full custom dashboard buildout for every partner/staff persona in first release.
  - Full calendar product scope beyond first reusable module shell.

## B) Scope

- In scope:
  - Runtime viewer-context resolver (`actor` vs `subject`).
  - Admin-only sidebar control (`See as`, `Admin Mode`).
  - Views control plane and assignment precedence.
  - Initial `Views` admin surface for create/assign/activate.
  - First reusable module contract: `Work Calendar Overview` as composable widget/module.
- Out of scope:
  - Partner self-serve dashboard editor.
  - Non-admin impersonation.
  - Broad redesign of module/widget rendering engine.
- Dependencies:
  - Existing auth/session (`requireAuth`, role mapping).
  - Existing navigation + sidebar profile UI.
  - Existing modules/dashboards tables and APIs.
  - Products catalog as canonical taxonomy source.

## C) Architecture + Data Impact

- Components touched:
  - `src/components/layout/sidebar.tsx` (entry point for admin controls)
  - Auth/context middleware utilities (`src/lib/auth/*`)
  - New `Views` admin route(s) under `/admin`
  - Module/dashboard resolution layer for audience-aware rendering
- API/routes touched:
  - New viewer context endpoints (set/get/clear see-as state).
  - New views assignment endpoints (CRUD + audience targeting).
  - Read routes for dashboard/module resolution using effective audience context.
- DB/migration impact:
  - Add view-control tables (proposed):
    - `view_profiles` (named reusable view definitions)
    - `view_audience_rules` (who gets what view, with priority)
    - `view_profile_modules` (module/widget composition links)
  - Canonical partner/product normalization:
    - Add normalized `partner_type` enrichment field from `Partner type`.
    - Add canonical product reference field (`product_id` or `product_slug`) resolved from products catalog.
    - Ignore `Content Subscriber` for taxonomy classification.
    - Preserve raw source values for audit/debug.
- Backward compatibility notes:
  - Existing admin module builder remains source of composition truth.
  - If no matching view assignment exists, runtime falls back to default current behavior.

### Partner Type Canonicalization Rules

- Source of truth:
  - Canonical labels and IDs come from products catalog (`/admin/products`).
- Primary mapping:
  - `PPC Premium` -> `Sophie PPC Package`
  - `Content Premium (only content)` -> `CC`
  - `FAM` -> `FAM`
  - `T0 / Product Incubator` -> `PLI`
- Fallback inference (when direct `Partner type` value is missing/ambiguous):
  - `POD Leader` present -> PPC Basic
  - `POD Leader` + `Conversion Strategist` -> Sophie PPC Partnership product
  - `Brand Manager` present -> includes FAM ownership
  - `Brand Manager` + `POD Leader` -> shared FAM + PPC Basic
  - `Brand Manager` without `POD Leader` -> FAM handles PPC
  - `Brand Manager` without `Conversion Strategist` -> FAM handling CC under pod
- Forward-compat:
  - New product families (for example `TTS` / TikTok Shop) must be onboarded by catalog entry, not hard-coded in role logic.

## D) Phases

### Phase 1: Foundation

- Deliverables:
  - Viewer context contract:
    - `actor` = real authenticated user (permissions always derived here).
    - `subject` = target audience identity for rendering only.
  - Admin-only sidebar control for:
    - `Admin Mode` toggle,
    - `See as` selector (partner/staff role/staff person/partner type).
  - Context persistence as session-only (signed cookie/session-scoped store) with clear reset path.
  - Role gate:
    - `admin` gets full see-as controls,
    - `operations_admin` does not automatically inherit `admin` see-as scope.
- Risks:
  - Mixing actor permissions with subject filters.
  - Context leaks across tabs or sessions.
- Validation gates:
  - Unit tests for context resolution and precedence.
  - Non-admin cannot access/set impersonation context.
  - Admin can always exit back to own admin context in one click.

### Phase 2: Main Behavior

- Deliverables:
  - `Views` control plane:
    - create/edit view,
    - assign audiences,
    - set active/default.
  - Deterministic assignment precedence:
    1. person
    2. role
    3. partner
    4. partner type
    5. default
  - Integrate audience-to-view resolution with existing module/dashboard render path.
- Risks:
  - Rule conflicts causing nondeterministic UI.
  - Partner-type/product mapping drift from products catalog.
- Validation gates:
  - Conflict detection + explicit tie-break logging.
  - API tests for each assignment tier.
  - Snapshot of resolved view context visible in UI for debugging.

### Phase 3: Hardening + Ops

- Deliverables:
  - Audit logging for context switches and view assignment updates.
  - Smoke matrix automation + manual runbook.
  - Initial reusable module shell: `Work Calendar Overview` attachable to views.
- Risks:
  - Sensitive context info over-logged.
  - Calendar module overreach before core controls are stable.
- Validation gates:
  - Redaction policy in logs.
  - Rollback path for new tables/routes.
  - Release checklist with owner sign-off.

## E) Agent Team

| Agent | Scope | Owns | Blocked By |
|---|---|---|---|
| `schema-core` | view-control schema + precedence encoding | migrations, constraints, fallback behavior | canonical product IDs/slugs from catalog |
| `api-flow` | viewer context + view assignment APIs | authz guardrails, context resolver, API contracts | schema-core contracts |
| `ui-ops` | sidebar controls + views admin UX | admin mode UX, see-as selector, view assignment UI | api-flow endpoints |
| `qa-review` | adversarial + regression validation | authz abuse tests, smoke evidence, rollout checklist | all prior waves |

## F) Task Matrix

| ID | Task | Owner | Depends On | Output |
|---|---|---|---|---|
| V1 | Define viewer-context object and actor/subject invariants | `api-flow` | none | context contract doc + tests |
| V2 | Add migrations for `view_profiles`, `view_audience_rules`, `view_profile_modules` | `schema-core` | none | migration SQL + rollback plan |
| V2a | Add partner taxonomy normalization fields (`partner_type`, canonical product ref) | `schema-core` | none | migration + mapping notes |
| V3 | Build context set/get/reset endpoints (admin-only) | `api-flow` | V1 | API routes + auth tests |
| V4 | Add sidebar `Admin Mode` + `See as` controls | `ui-ops` | V3 | production UI control |
| V5 | Build `/admin/views` create/assign workflow | `ui-ops` | V2, V2a, V3 | views management UI |
| V6 | Implement precedence resolver for effective view | `api-flow` | V2, V2a, V3 | resolver utility + API integration |
| V7 | Hook resolved view to module/dashboard runtime | `api-flow` | V6 | audience-aware rendering path |
| V8 | Add `Work Calendar Overview` module contract shell | `ui-ops` | V7 | reusable module baseline |
| V9 | Execute smoke + security-edge validation | `qa-review` | V4-V8 | evidence bundle |

## G) Risk Register

- [P1] Privilege escalation if subject context influences authorization checks.
- [P1] Data leak if admin-client queries do not enforce effective audience filters.
- [P2] Assignment-rule conflicts create unpredictable "what does user see" behavior.
- [P2] Incorrect partner-type/product normalization from enrichment inputs causes wrong view exposure.
- [P3] Sidebar control complexity harms mobile usability without progressive disclosure.

## H) Verification Checklist

- [ ] Build/lint/type checks
- [ ] Unit/API/integration tests
- [ ] Smoke tests (happy path, failure path, security edge) with evidence links
- [ ] Failure mode checks
- [ ] Rollback path tested
- [ ] Docs updated

## I) Scoring Baseline

Use `references/scorecard-rubric.md`.

| Category | Baseline | Target | Evidence Owner |
|---|---:|---:|---|
| Security | 5 | 8 | `qa-review` |
| Scalability | 4 | 8 | `schema-core` |
| Performance | 6 | 7 | `api-flow` |
| Reliability | 5 | 8 | `api-flow` |
| Operability | 4 | 8 | `ui-ops` |

## J) Smoke Test Matrix (Required Before Sign-off)

| Flow | Scenario | Expected | Evidence |
|---|---|---|---|
| Happy path | Admin toggles `Admin Mode OFF`, selects `See as -> Staff Role: PPC`, opens dashboard | UI resolves to PPC-assigned view/modules with visible context badge | Screen recording + API context response |
| Failure path | Non-admin user attempts to access `See as` control or context API | Control hidden; API returns 403 | Screenshot + API logs |
| Security edge | Admin selects `See as partner` for unassigned sensitive partner and attempts privileged admin action | Rendering follows subject scope, but admin-only write actions still require actor admin and are audited | Request/response logs + audit entry |
| Mapping integrity | Partner with `Partner type = PPC Premium` and matching staffing columns is normalized to canonical product mapping | Resolved audience tag matches canonical product mapping from products catalog | Test fixture + resolver logs |

## Decisions Confirmed

1. Partner type is first-class and normalized to products catalog taxonomy.
2. `See as` persistence is session-only first.
3. `operations_admin` remains separate from top-level `admin` for see-as scope.

## Open Questions

1. Confirm exact product catalog slugs/IDs for:
   - `Sophie PPC Package`
   - `Sophie PPC Partnership`
   - `CC`
   - `FAM`
   - `PLI`
   - `TTS`
