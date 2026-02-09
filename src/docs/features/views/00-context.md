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
- Keep a persistent `Admin Mode` toggle:
  - `Admin Mode ON`: admin can return to full admin behavior at any time.
  - `Admin Mode OFF`: admin sees normal role-based experience (or selected "see as" target).
- Non-admin users must never see or use impersonation controls.
- Long-term direction: a dedicated `Views` capability where admins can create views, assign audience, and reuse modules/widgets.
- Candidate first reusable module: `Work Calendar Overview` module for partner-facing schedules (meetings/work items), reusable across multiple audiences.

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
- Missing canonical partner-type taxonomy in current data model may block clean partner-type targeting unless normalized.

## Open Questions

1. Canonical list of partner types and ownership of that taxonomy.
2. Whether "See as" state should persist only per browser session or across devices.
3. Expected behavior when an admin has both personal default view and role default view (tie-break policy).
4. Whether pod leaders should eventually get limited "see as team member" in phase 2+ (currently assumed no; admin-only).

