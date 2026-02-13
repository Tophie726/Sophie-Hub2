# Master Client Staff Tabs Connector Proposal (Codex)

Date: 2026-02-09
Round: 01 (Codex proposal)

## A) Outcome

- Model the master dashboard tabs without losing semantic correctness between:
  - staff identity,
  - client/team role assignments.
- Deliver deterministic mapping + enrichment behavior that is safe for ongoing operations.

## B) Scope

In scope:
- Tab classification contract (person roster vs assignment rows).
- Staff identity mapping sources in `entity_external_ids`.
- Role assignment capture for team tabs.
- Enrichment pipeline for staff fields with non-destructive updates.
- Admin mapping UX updates for staff + assignment conflict handling.

Out of scope:
- Full org-chart redesign.
- Automated HR lifecycle actions.
- Non-related dashboard module work.

## C) Mapping Model + Cardinality

| Mapping Purpose | `source` | External ID | Internal Entity | Cardinality | Enforced In |
|---|---|---|---|---|---|
| Canonical person identity | `master_client_staff_user` | immutable external person id (preferred) | `staff` | 1:1 | DB partial unique + `UNIQUE(source, external_id)` |
| Secondary person key | `master_client_staff_email` | normalized email | `staff` | 1:1 (soft) | app validation + conflict review |
| Assignment row provenance | `master_client_assignment_row` | `{client}:{tab}:{row}` composite key | `partners` or assignment table | 1:N | app logic + row-level uniqueness |

Notes:
- Keep 1:1 strict only for canonical identity source.
- For assignment membership, use dedicated assignment persistence (`partner_assignments` extension or new bridge table) and keep mapping metadata for traceability.

## C1) Column Coverage Policy (Locked)

- We can map all useful columns from each tab even when tabs differ in shape.
- Missing columns for some staff/tabs are treated as normal sparse data, not errors.
- Normalize naming variants through an alias dictionary before mapping to canonical targets.
- Canonical fields should land in `staff` only for stable profile attributes.
- Tab-specific or low-frequency fields should be retained in `source_data` metadata rather than expanding the `staff` table for every source column.
- Promotion rule: only graduate a metadata field into first-class schema when it is stable and operationally required.

## C2) Tab-By-Tab Mapping Matrix (Initial Default)

| Tab | Initial Mode | Primary Entity for Tab Sync | Staff Mapping | Partner Crossover |
|---|---|---|---|---|
| `POD Leader Information` | assignment-heavy | `partners` | map person values to canonical `staff` identity | write `pod_leader` assignment role where partner/client key exists |
| `PPC Manager Information` | assignment-heavy | `partners` | map person values to canonical `staff` identity | write `ppc_specialist` (or final approved role key) |
| `Content Team Information` | mixed team tab | split stream (`staff` + assignment stream) | map all people to `staff` | write team assignments per role/member when partner/client key exists |
| `Conversion Team Information` | mixed team tab | split stream (`staff` + assignment stream) | map all people to `staff` | write conversion role assignments when partner/client key exists |
| `Content Lite Information` | mixed team tab | split stream (`staff` + assignment stream) | map all people to `staff` | write content-lite role assignments when partner/client key exists |
| `Sales Executive Information` | assignment-heavy | `partners` | map person values to canonical `staff` identity | write `sales_rep` assignment role |
| `Additional Team Members Information` | team membership | split stream (`staff` + assignment stream) | map all people to `staff` | write non-primary team member assignments (multi-member) |
| `Marketing Team` | likely team membership | split stream (`staff` + assignment stream) | map all people to `staff` | write marketing role assignments when partner/client key exists |
| `Contractor Members Information` | team membership | split stream (`staff` + assignment stream) | map all people to `staff` with `worker_type=contractor` metadata | write contractor assignment roles when partner/client key exists |

Notes:
- If a tab has no partner/client identifier, run it as pure `staff` enrichment for that pass.
- Alias-normalize columns before mapping (for example: `Name`/`Full Name`/`Staff Name`; `Contract Role`/`Role`).
- Keep unmatched/extra tab columns in `source_data` metadata; do not block sync.

## C3) Operator Safe-Mode (What To Do Right Now)

1. Map identity columns to `staff` across all listed tabs.
2. Set non-identity or uncertain columns to `reference` first.
3. Enable partner crossover only when both are true:
   - partner/client key is present and trusted,
   - role key is mapped to an approved assignment role.
4. Leave unsupported role columns in metadata until role dictionary is finalized.

## D) Tab Classification Rules

Rule 1: If row owner is partner/client, treat person columns as partner reference assignments.

Rule 2: If row owner is person (one row per worker), treat as staff entity data.

Rule 3: If tab mixes both shapes, split ingestion into two internal virtual streams:
- identity stream,
- assignment stream.

## E) Phases

### Phase 1: Mapping Foundation

- Add/confirm source constants for master staff identity mapping.
- Add tab classifier and row owner detector.
- Add mapping endpoints for identity and assignment rows.
- Implement conflict-safe save behavior.

Validation:
- No duplicate canonical person mapping.
- Assignment remap does not leave stale attribution.

### Phase 2: Enrichment

- Add enrichment transform from mapped source rows into `staff`.
- Update only allowed fields (`title`, `phone`, `timezone`, `avatar_url`, role metadata where approved).
- Preserve manual overrides with explicit policy.

Validation:
- Re-running enrichment is idempotent.
- Manual-edited fields remain intact.

### Phase 3: Ops Hardening

- Add sync health/status view.
- Add drift reporting (new rows, missing staff matches, assignment conflicts).
- Add smoke runbook and rollback checklist.

Validation:
- Restart-safe sync behavior.
- Clear operator actions for unresolved conflicts.

## F) onConflict Policy

Identity (`master_client_staff_user`):
- `ON CONFLICT (source, external_id) DO UPDATE` only when explicitly remapping.

Assignment rows:
- Upsert by assignment row key.
- Preserve prior assignee in metadata (`previous_staff_id`, `remapped_at`, `remapped_by`).

## G) Agent Team Split

| Agent | Owns | Depends On |
|---|---|---|
| `schema-sync` | source constants, mapping constraints, assignment schema changes | none |
| `api-integration` | mapping/enrichment routes, classifier, idempotent writes | `schema-sync` contracts |
| `ui-ops` | tab-grouped mapping UI, conflict review UX, status badges | stable API response shapes |
| `qa-review` | smoke matrix, abuse/security edge checks, docs parity | all merge-ready code |

## H) Validation Matrix (Required)

- Happy path:
  - map staff identities,
  - map assignment rows,
  - run enrichment,
  - verify expected staff updates.
- Failure path:
  - conflicting identity keys,
  - missing person key,
  - malformed tab rows.
- Security edge:
  - enforce admin auth on mapping + enrichment routes,
  - prevent cross-client assignment contamination during remap.

## I) Rollout/Rollback

Rollout:
1. Apply migration(s).
2. Deploy mapping endpoints.
3. Enable UI for admin-only test users.
4. Execute smoke runbook.
5. Enable full operator access.

Rollback:
1. Disable UI actions behind feature flag.
2. Halt scheduled sync/enrichment jobs.
3. Revert route exposure.
4. Restore previous assignment snapshots if needed.

## J) Open Questions

1. Confirm canonical key priority: external staff ID vs email.
2. Confirm contractor destination model (`staff` vs separate entity).
3. Confirm whether `Marketing Team` rows are assignment-owned or staff-owned in current source.
4. Confirm role normalization dictionary for all tabs.
