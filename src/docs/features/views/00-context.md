# Views + See-As Context

Date: 2026-02-09  
Round: 00 (Context capture)

## Request Summary

- Add an admin-only "See as" capability from the current user/profile control (where name + `Admin` is shown today).
- Let admins preview the experience as:
  - a specific partner,
  - a partner type,
  - a staff role,
  - a specific staff person.
- Role examples for planning: `CC`, `PPC`, `FAM` (not `BBC`).
- Keep a persistent `Admin Mode` toggle:
  - `Admin Mode ON`: admin can return to full admin behavior at any time.
  - `Admin Mode OFF`: admin sees normal role-based experience (or selected "see as" target).
- Non-admin users must never see or use impersonation controls.
- Long-term direction: a dedicated `Views` capability where admins can create views, assign audience, and reuse modules/widgets.
- Candidate first reusable module: `Work Calendar Overview` module for partner-facing schedules (meetings/work items), reusable across multiple audiences.

## Decisions Locked (2026-02-09)

1. Partner type is a first-class enriched data point (not inferred-only metadata).
2. `Products` page/catalog is source of truth for canonical product taxonomy.
3. `See as` persistence is session-only first (not cross-device/cross-session).
4. `operations_admin` is a separate tier and does not automatically inherit full `admin` see-as powers.

## Partner Type Inputs + Mapping Rules

### Source Inputs

- Primary enrichment input column: `Partner type`.
- Column explicitly ignored for taxonomy mapping: `Content Subscriber`.
- Supporting staffing inputs used for rule-based fallback:
  - `POD Leader`
  - `Conversion Strategist`
  - `Brand Manager`

### Raw Partner Type Values Seen

- `PPC Client`
- `PPC Premium`
- `Content Premium (only content)`
- `FAM`
- `T0 / Product Incubator`
- Future/extended product examples include `TTS (TikTok Shop)` from products catalog.

### Canonical Mapping Intent (Initial)

- `PPC Premium` -> `Sophie PPC Package`
- `Content Premium (only content)` -> `CC`
- `FAM` -> `FAM`
- `T0 / Product Incubator` -> `PLI`

### Staffing-Derived Fallback Rules (When Needed)

- If `POD Leader` exists (PPC basic pod leader): classify as PPC Basic.
- If `POD Leader` and `Conversion Strategist` both exist: classify as Sophie PPC Partnership product.
- If `Brand Manager` exists: always includes FAM ownership.
- Shared partner case:
  - `Brand Manager` + `POD Leader` => shared FAM + PPC Basic.
  - `Brand Manager` without `POD Leader` => FAM handles PPC too.
  - `Brand Manager` without `Conversion Strategist` => FAM handling CC under pod.

## Intake Answers (From Prompt + Assumptions)

1. Shipping outcome:
   - Admin can reliably switch perspective ("see as") and preview exactly what partner/staff/role audiences will see.
2. In scope:
   - View-context switching, admin mode behavior, audience assignment model, initial `Views` control-plane design.
3. Out of scope for this first planning loop:
   - Full implementation of every audience-specific dashboard.
   - Full calendar data model and scheduling backend.
4. Unacceptable risk:
   - Any privilege escalation or data leak where impersonation grants unauthorized access.
5. Rollout order (assumed):
   - auth/context foundation -> audience/view assignment model -> UI and first reusable module wiring.
6. Required validation evidence before merge (assumed):
   - authz tests, context-resolution tests, role/partner smoke flows, and abuse-edge verification.

## Current System Reality (Relevant to Design)

- Role hierarchy exists in code: `admin > pod_leader > staff > partner`.
- Navigation is role-filtered (`src/lib/navigation/config.ts`) and sidebar profile area is the best insertion point for `See as` + `Admin Mode`.
- Dashboard rendering primitives already exist (`modules`, `dashboards`, `dashboard_sections`, `dashboard_widgets`) and are admin-managed in `/admin/modules`.
- Existing APIs use server-side auth + role checks; many reads/writes currently run via admin Supabase client, so explicit context filtering discipline is required.

## Key Design Direction

- Treat this as two coordinated capabilities:
  1. **Runtime viewer context** (`who am I seeing as right now?`), admin-only control.
  2. **Views control plane** (`which audience should see which module composition?`), reusable and assignable.
- Reuse existing module/widget system for rendering where possible; avoid creating a second dashboard engine.
- Add deterministic assignment precedence to keep behavior scalable and debuggable as audiences grow.

Proposed precedence (highest to lowest):
1. Explicit person assignment
2. Explicit role assignment
3. Explicit partner assignment
4. Partner-type assignment
5. Global/default assignment

## Known Risks

- Permission confusion between actor (real signed-in admin) and subject (target "see as" identity).
- Drift between `Views` assignment model and existing module/dashboard ownership.
- Product mapping drift if `Partner type` values diverge from products catalog without normalization.

## Open Questions

1. What exact product IDs/slugs in the products catalog should each mapped label use (`Sophie PPC Package`, `PLI`, `CC`, etc.)?
2. Expected behavior when an admin has both personal default view and role default view (tie-break policy).
3. Whether pod leaders should eventually get limited "see as team member" in phase 2+ (currently assumed no; admin-only).
