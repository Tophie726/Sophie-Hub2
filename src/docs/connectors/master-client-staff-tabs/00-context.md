# Master Client Staff Tabs Connector Context

Date: 2026-02-09
Round: 00 (Context capture)

## Request Summary

- Group a set of staff-focused tabs under one master client dashboard flow.
- Tabs in scope (from intake screenshots):
  - `POD Leader Information`
  - `PPC Manager Information`
  - `Content Team Information`
  - `Conversion Team Information`
  - `Content Lite Information`
  - `Sales Executive Information`
  - `Additional Team Members Information`
  - `Marketing Team`
  - `Contractor Members Information`
- Map rows to staff records where appropriate.
- Enrich staff data from these tabs without corrupting existing canonical staff attributes.

## Core Design Decision (Locked)

Use a two-layer model:

1. Identity mapping layer
- Maps external person identity to internal `staff`.
- Uses `entity_external_ids` with connector-specific `source` values.
- Enforces strict 1:1 only for canonical person identity sources.

2. Role assignment layer
- Captures which staff are assigned to which client/team role/tab rows.
- Supports 1:N and many-to-many role relationships.
- Should not overwrite canonical staff identity/profile fields.

## Intake Clarification (Locked, 2026-02-09)

- Map people from all scoped staff/team tabs into canonical `staff` identities first.
- Cross over to partner-facing assignment columns only where role context applies.
- Different tabs can carry different column sets; sparse/missing fields per tab are acceptable.
- Column name variance is expected and handled via alias normalization (for example `Name`, `Full Name`, `Staff Name`; `Contract Role`, `Role`).
- Keep canonical `staff` schema focused; avoid adding every tab-specific column as a physical `staff` table column.
- Preserve non-canonical tab-specific attributes in source metadata (`source_data`) for no-data-loss and later promotion decisions.

## Important Existing Repo Rules

- Row ownership determines category.
- Staff names appearing on partner-owned rows (for example `POD Leader`) should map as partner reference assignments, not as raw staff entity columns.
- Relevant guidance already exists in:
  - `src/components/data-enrichment/ROADMAP.md`
  - `src/lib/ai/mapping-sdk.ts`
  - `src/app/api/ai/analyze-tab/route.ts`

## Constraints

- Some tabs may look "staff-like" but still be partner-owned assignment data.
- Some tabs may be true staff roster/person tabs.
- We must support mixed cardinality:
  - single-owner roles,
  - multi-member team roles,
  - contractors/additional members.
- Manual edits in `staff` should not be clobbered by enrichment syncs.

## Intake Assumptions (To Validate)

- Master dashboard has a stable row identifier per tab (or enough fields to derive one).
- At least one reliable person key exists (email preferred; else external employee ID).
- Some tabs are assignment tabs tied to client/partner rows.
- Role labels can be normalized to a canonical role set.

## Initial Success Criteria (2-4 weeks)

- >90% of resolvable people in these tabs map to existing `staff` records.
- Assignment rows are captured with provenance (`tab`, `role`, `source_row_key`) and no duplicate ownership drift.
- Enrichment is additive-only for selected profile fields and preserves manual overrides.
- Remapping a person does not leave stale assignment attribution.

## Open Questions

1. Which tabs are true staff roster tabs vs partner-owned assignment tabs?
2. What is the canonical person key in this source (email, employee ID, both)?
3. Do contractors belong in `staff` or a separate workforce entity with bridge mapping?
4. For single-owner roles, what should win on conflict: latest row, explicit manual override, or locked assignment?
5. Should assignment history be versioned (effective dates) in phase 1 or phase 2?

## Branching Note

- Parallel features should use separate branches per workstream.
- Recommended pattern for this rollout:
  - connector branch: `codex/connector-master-client-staff-tabs`
  - separate feature/UI branches for unrelated concurrent workstreams.
