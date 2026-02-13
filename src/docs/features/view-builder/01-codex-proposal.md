# View Builder (Inception Mode) Proposal (Codex)

Date: 2026-02-10  
Round: 01 (Codex proposal)

## A) Outcome

- Business/user outcome:
  - `/admin/views/[viewId]` becomes a real preview-first builder where admins see the full Sophie Hub shell exactly as an audience sees it.
  - Admins can switch audience quickly (staff role/person, partner type/brand), then compose which modules/pages appear for that audience.
- Shipping definition:
  - Preview-first builder shipped with full-width iframe preview, device modes, fullscreen, audience switcher, add-module flow, and hidden settings panel.
  - Preview renders full app shell (sidebar, header, profile area, content routes) in simulated context without mutating real runtime auth.
  - Module assignment/edit actions update `view_profile_modules` and reflect live in preview.
- Non-goals:
  - Full drag-and-drop widget layout editing inside preview (reserve for v2/Puck).
  - Replacing existing module/dashboard builder flows.
  - Non-admin access to preview impersonation controls.

## B) Scope

- In scope:
  - Redesign `/admin/views/[viewId]` to toolbar + full preview surface.
  - Dedicated preview route group and context provider for simulated audience.
  - Dynamic module navigation in preview sidebar from `view_profile_modules`.
  - Audience selector hierarchy:
    - Staff -> Role / Person (searchable)
    - Partner -> Type / Brand (searchable)
  - Data mode toggle for preview (`snapshot` default, optional `live`).
  - Settings drawer (view metadata, audience rules, module ordering).
- Out of scope:
  - End-user page-builder for partners/staff.
  - New widget/query engine.
  - Cross-session persistence of builder audience presets.
- Dependencies:
  - Existing viewer context contracts and role gating.
  - Existing view tables + module tables.
  - Existing dashboard widget renderer and module APIs.

## C) Architecture + Data Impact

- Components touched:
  - `src/app/(dashboard)/admin/views/[viewId]/page.tsx` (major redesign)
  - New preview route group under `src/app/(preview)/preview/...`
  - Shared app-shell layer extracted from current layout components for reuse
  - `src/components/layout/sidebar.tsx` and nav composition helpers (preview-mode dynamic modules)
- API/routes touched:
  - New `POST /api/admin/views/preview-session` (create signed preview session token)
  - New `GET /api/admin/views/[viewId]/preview-context` (resolved payload for toolbar defaults)
  - Existing module assignment routes reused (`/api/admin/views/[viewId]/modules`)
  - Existing audience rules routes reused (`/api/admin/views/[viewId]/rules`)
- DB/migration impact:
  - No mandatory new table for v1 preview engine.
  - Continue using `view_profile_modules.sort_order` as module sidebar order.
  - Optional (if needed in implementation): small migration for `view_profile_modules.dashboard_id` index to speed preview route lookup.
- Backward compatibility notes:
  - Current view resolution path remains unchanged for runtime app users.
  - Preview route is admin-only and isolated from production user session behavior.

### Resolved Open Questions (from `00-context.md`)

1. Preview route architecture:
   - Use separate route group: `src/app/(preview)/preview`.
   - Reason: isolates preview-only context/rendering from regular dashboard route logic, avoids query-param branching everywhere.
2. Module-to-navigation mapping:
   - Add dynamic "Modules" nav section in preview sidebar only.
   - Items come from `view_profile_modules` ordered by `sort_order`.
3. Widget data strategy:
   - Default `snapshot` mode for stable template authoring.
   - Optional `live` mode tied to selected entity in audience switcher.
4. Inline editing scope:
   - v1: no direct in-iframe widget editing.
   - v2: evaluate Puck for structured block editing and drag interactions.
5. Add-module UX:
   - Toolbar `Add module` button opens searchable command-palette modal.
   - Add/remove/reorder persisted via existing modules assignment API.
6. Create-new vs compose-existing:
   - v1 is compose-existing only.
   - Provide "Open Module Builder" shortcut for creation in existing flows.

## D) Phases

### Phase 1: Foundation

- Deliverables:
  - `PreviewSession` contract (subject identity, viewId, dataMode, expiry) with signed token.
  - Admin-only preview-session API and verification utility.
  - New preview route skeleton rendering shared app shell with simulated context.
  - Dynamic module-nav resolver from `view_profile_modules`.
- Risks:
  - Context spoofing if token verification is weak.
  - Shell duplication drift between production and preview layouts.
- Validation gates:
  - Unit tests for token creation/verification.
  - Admin-only authz tests for preview endpoints.
  - Snapshot check proving preview shell uses shared components.

### Phase 2: Main Behavior

- Deliverables:
  - Full redesign of `/admin/views/[viewId]`:
    - thin toolbar
    - full preview iframe
    - device toggle (desktop/tablet/mobile)
    - fullscreen mode
    - settings drawer
  - Audience switcher hierarchy (Staff Role/Person + Partner Type/Brand).
  - Add-module modal + module ordering controls.
  - Iframe postMessage bridge (`ready`, `routeChanged`, `refreshRequested`).
- Risks:
  - Preview load latency and iframe re-render churn on audience switches.
  - UI confusion if settings and composition controls are not clearly separated.
- Validation gates:
  - UX acceptance: preview occupies majority viewport and reflects selected audience quickly.
  - API integration tests for assign/remove/reorder modules.
  - Device frame correctness in desktop/tablet/mobile.

### Phase 3: Hardening + Ops

- Deliverables:
  - Security hardening (token TTL, tamper detection, strict admin checks).
  - Audit log entries for preview session changes and module composition edits.
  - Smoke test matrix evidence + rollback runbook.
  - Documentation updates (`02-claude-agent-plan.md` handoff and implementation notes).
- Risks:
  - Over-logging sensitive audience details.
  - Regression in regular sidebar/navigation logic.
- Validation gates:
  - Security edge smoke tests pass.
  - Regression suite for non-preview navigation passes.
  - Rollback tested: disable preview route and keep existing view management operational.

## E) Agent Team

| Agent | Scope | Owns | Blocked By |
|---|---|---|---|
| `schema-core` | Optional schema/index adjustments + migration hygiene | any DB deltas, migration safety, rollback scripts | architecture contract lock |
| `api-flow` | Preview token/session contracts + resolver APIs | authz, token verification, preview context payload | none |
| `ui-ops` | Builder redesign + iframe preview + controls | toolbar, audience UX, module composition UX, fullscreen/device behavior | api-flow session endpoints |
| `qa-review` | adversarial + regression validation | smoke matrix, performance checks, evidence bundle | prior waves complete |

## F) Task Matrix

| ID | Task | Owner | Depends On | Output |
|---|---|---|---|---|
| VB1 | Define `PreviewSession` type + token payload fields | api-flow | none | TS contract |
| VB2 | Implement `createPreviewSessionToken` and `verifyPreviewSessionToken` | api-flow | VB1 | utility + tests |
| VB3 | Build `POST /api/admin/views/preview-session` | api-flow | VB2 | endpoint |
| VB4 | Build `GET /api/admin/views/[viewId]/preview-context` | api-flow | VB2 | endpoint |
| VB5 | Add preview route group + layout scaffold | ui-ops | VB3 | `/preview` shell |
| VB6 | Extract shared shell primitives from current layout | ui-ops | VB5 | reusable shell layer |
| VB7 | Implement preview context provider for simulated audience | ui-ops | VB4, VB6 | provider + hooks |
| VB8 | Implement module-nav resolver from `view_profile_modules` | api-flow | VB4 | resolver |
| VB9 | Render dynamic modules section in preview sidebar | ui-ops | VB7, VB8 | dynamic nav |
| VB10 | Route module nav clicks to module dashboard pages in preview | ui-ops | VB9 | preview page routing |
| VB11 | Redesign `/admin/views/[viewId]` to full-width preview layout | ui-ops | VB5 | new builder UI |
| VB12 | Add audience selector hierarchy (role/person/type/brand) | ui-ops | VB11 | switcher UI |
| VB13 | Add data mode toggle (`snapshot/live`) | ui-ops | VB11 | toggle UI + state |
| VB14 | Add settings drawer (view metadata + rules) | ui-ops | VB11 | drawer UI |
| VB15 | Add add-module modal with search/filter | ui-ops | VB11 | modal UI |
| VB16 | Connect add/remove module actions to assignment API | ui-ops | VB15 | persisted module composition |
| VB17 | Add module ordering controls + optimistic updates | ui-ops | VB16 | reordered sidebar modules |
| VB18 | Implement iframe postMessage bridge | ui-ops | VB11, VB5 | bridge hooks |
| VB19 | Add fullscreen + device frame behavior polish | ui-ops | VB11 | UX parity |
| VB20 | Add optional index migration if query hotspots found | schema-core | VB8 | migration (conditional) |
| VB21 | Add audit logging for preview and composition changes | api-flow | VB3, VB16 | audit events |
| VB22 | Execute smoke/regression/perf matrix and publish evidence | qa-review | VB1-VB21 | pass/fail artifacts |

## G) Risk Register

- [P1] Context spoofing via forged preview token.
  - Mitigation: HMAC-signed token, short TTL, strict server-side verification, admin-only API issuance.
- [P1] Authorization bleed where preview subject affects write permissions.
  - Mitigation: actor-derived permissions remain authoritative; subject affects rendering only.
- [P2] Navigation drift between preview shell and production shell.
  - Mitigation: shared shell primitives and snapshot test parity.
- [P2] Performance degradation from iframe + full app shell rendering.
  - Mitigation: lazy load preview subtrees, debounce audience switches, lightweight snapshot mode default.
- [P3] Admin UX complexity due to many controls in toolbar.
  - Mitigation: progressive disclosure (settings in drawer, concise defaults, command palette for modules).

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
| Security | 5.5 | 8.5 | `api-flow` + `qa-review` |
| Scalability | 5.0 | 8.0 | `ui-ops` |
| Performance | 5.0 | 7.5 | `ui-ops` + `qa-review` |
| Reliability | 5.5 | 8.0 | `api-flow` |
| Operability | 5.0 | 8.0 | `qa-review` |

## J) Smoke Matrix (Sign-off Required)

| Flow | Scenario | Expected | Evidence |
|---|---|---|---|
| Happy path | Open `/admin/views/[viewId]`, select `Staff -> Role -> PPC Strategist` | Full app preview updates with role-filtered sidebar + module pages | screen capture + resolved context payload |
| Happy path 2 | Add module from toolbar modal | Module appears in preview sidebar immediately and persists after refresh | UI capture + DB row in `view_profile_modules` |
| Failure path | Non-admin hits preview-session API | 403 and no token issued | API log + response snapshot |
| Security edge | Tampered preview token in iframe URL | preview route rejects with safe error state | response + server log |
| Security edge 2 | Subject switched to partner while actor attempts admin write in preview | writes still gated by actor auth, no privilege bleed | request/response logs |
| Mapping integrity | Switch `Partner -> Type -> PPC Basic` then `Partner -> Brand` | Preview context and module nav switch deterministically | UI capture + context payload diff |

## K) Next Loop Handoff

- This proposal is ready for Claude conversion into `02-claude-agent-plan.md` with wave-based execution details.
- Claude should preserve resolved decisions in section **C** and map tasks `VB1..VB22` into waves with dependency gates.
