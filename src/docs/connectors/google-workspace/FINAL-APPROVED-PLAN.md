# Google Workspace Connector — FINAL APPROVED PLAN

Approval basis:
- Base plan: `src/docs/connectors/google-workspace/02-claude-agent-plan.md`
- Revision deltas: `src/docs/connectors/google-workspace/04-claude-revision.md`
- Review standard: `src/docs/connectors/CONNECTOR-REVIEW-LOOP.md`

Status:
- P1 findings: resolved
- P2 findings: resolved
- P3 findings: resolved
- Implementation: Phases 1-2 complete, Phase 3 deferred, Phase 4 partial

Implementation Status (2026-02-06):
- Wave 1 (schema-sync): COMPLETE — types, connector, cache, constants, migration applied
- Wave 2 (api-integration): COMPLETE — Google client, all 7 API routes, auto-match, enrichment, sync
- Wave 3 (ui-ops): COMPLETE — connection card, staff mapping, mapping hub, CategoryHub card, page routing
- Wave docs: COMPLETE — SETUP-GUIDE.md, CONNECTOR-GUIDE.md updated
- Remaining: Live smoke tests (blocked on env var setup), Phase 3 optional

---

## A) Business Goal

- Make Google Workspace Directory the identity anchor for staff enrichment.
- Raise auto-match coverage for existing staff to >=90% by primary email.
- Keep suspended/offboarded identities visible for reconciliation and downstream connector consistency.

Success in 2-4 weeks:
- Admin can connect Google Workspace with service account delegation.
- Staff mappings are created safely using immutable Google user IDs.
- Staff enrichment can pull title/phone/avatar/org metadata from local snapshot.

## Non-Goals (This Round)

- No Gmail content ingestion.
- No Calendar event ingestion.
- No automatic staff record creation from unmatched directory users.
- No automatic status changes in staff records.
- No Google Groups sync (defer).
- No multi-domain support (single configured domain only).
- No end-user OAuth flow (service account only).

---

## B) Source Model

- External system: Google Workspace Admin SDK Directory API.
- Auth: Service account + domain-wide delegation (impersonated admin).
- Pull mode: snapshot (full directory pull; expected ~120-200 users).
- Rate constraints: low risk at this volume; conservative pacing with retry/backoff.

### Secret boundary (mandatory)

All Google credentials are env-only and must never be stored in connector config, DB rows, logs, or client payloads.

Required env vars:
- `GOOGLE_WORKSPACE_CLIENT_EMAIL`
- `GOOGLE_WORKSPACE_PRIVATE_KEY` or `GOOGLE_WORKSPACE_PRIVATE_KEY_BASE64`
- `GOOGLE_WORKSPACE_ADMIN_EMAIL`
- `GOOGLE_WORKSPACE_DOMAIN`

---

## C) Linking Points (Identity Graph)

1. Primary email match (case-insensitive): Google primary email -> `staff.email`.
2. Immutable anchor: Google user ID -> `entity_external_ids` source `google_workspace_user`.
3. Secondary evidence: alias email -> `entity_external_ids` source `google_workspace_alias`.

Matching precedence:
1. Primary email exact match
2. Alias suggestion (manual confirm required)
3. Manual review queue

---

## D) Mapping Rules + Cardinality

| Mapping Purpose | `source` | External ID | Internal Entity | Cardinality | Enforced In |
|---|---|---|---|---|---|
| Primary identity anchor | `google_workspace_user` | immutable Google user ID | `staff` | 1:1 | DB partial unique index + `UNIQUE(source, external_id)` |
| Alias lookup | `google_workspace_alias` | alias email | `staff` | 1:N | App logic + row uniqueness on `external_id` |

### Approved conflict policy

- `google_workspace_user`: allowed to remap with explicit action because external ID is immutable.
- `google_workspace_alias`: never auto-transfer across staff.
  - Use insert-or-skip (`ON CONFLICT (source, external_id) DO NOTHING`).
  - Return conflict as `review_required` suggestion.
  - Only create/update after admin confirms against the immutable user mapping.

### Required mapping metadata

`google_workspace_user` metadata:
- `primary_email`
- `org_unit_path`
- `is_suspended`
- `is_deleted`
- `is_admin`
- `matched_by` (`auto_email` | `manual`)

`google_workspace_alias` metadata:
- `alias_type` (`alias`)
- optional reconciliation markers for manual resolution

---

## E) Delivery Phases

### Phase 1: Connection + Mapping + Enrichment — COMPLETE

Scope:
- Connect to Directory API.
- List users from local snapshot-backed API.
- Create/delete mappings.
- Auto-match by primary email; alias as suggestion only.
- Enrich staff profiles from snapshot fields.

Deliverables:
- Connector type and config (`google_workspace`) with non-secret fields only.
- Google client with runtime env credential resolution.
- API routes:
  - `POST /api/google-workspace/test-connection`
  - `GET /api/google-workspace/users`
  - `GET|POST|DELETE /api/google-workspace/mappings/staff`
  - `POST /api/google-workspace/mappings/staff/auto-match`
  - `POST /api/google-workspace/enrich-staff`
- UI modules:
  - Connection card
  - Staff mapping table
  - Category card and page-controller routing in `data-enrichment/page.tsx`

Validation gates:
- Connection test succeeds with delegated admin.
- Users endpoint returns directory-backed records with status flags.
- Auto-match creates only safe mappings.
- Alias conflicts are suggestions, not silent remaps.
- Enrichment updates approved fields without destructive overwrite policy.

UI/design checks:
- Implement from page-level controller routing (not `SourceBrowser`).
- Follow Emil design-engineering standards used by existing enrichment cards/tables.

### Phase 2: Sync + Reconciliation — COMPLETE

Scope:
- Scheduled sync for directory snapshot.
- Drift detection for new/suspended/deleted/email-changed users.
- Reconciliation reporting.

Deliverables:
- `google_workspace_sync_state` (or equivalent run state table).
- Sync route(s):
  - `POST /api/google-workspace/sync`
  - `GET /api/google-workspace/sync/status`
- Local snapshot table:
  - `google_workspace_directory_snapshot`
  - one row per immutable Google user ID

Critical sync safety rule:
- Tombstoning (`is_deleted = true`) is allowed only after a successful full snapshot pull (all pages consumed, run marked complete). Partial/failed runs must not tombstone unseen users.

Validation gates:
- Re-running sync is idempotent.
- Snapshot remains stable across retries.
- Deleted/suspended visibility preserved even if API behavior changes.
- Drift report clearly separates new users, status changes, and unresolved matches.

### Phase 3: Workflow Suggestions (Optional) — DEFERRED

Scope:
- Suggest onboarding/offboarding follow-ups only.
- No automatic destructive actions.

Deliverables:
- Suggestion surfaces for unmatched new users.
- Suggestion surfaces for suspended accounts mapped to active staff.
- Optional webhook endpoint deferred unless needed.

Validation gates:
- Suggestions trigger on state transitions only.
- Suggestions are dismissible and non-destructive.

### Phase 4: Operational Readiness — PARTIAL (docs done, smoke tests pending)

Scope:
- Harden runbook, monitoring, and handoff.

Deliverables:
- Connector docs kept in:
  - `src/docs/connectors/google-workspace/`
- Smoke-test checklist for non-author execution.
- Basic monitoring:
  - repeated sync failures
  - last successful sync age
  - connector health status in admin UI

Validation gates:
- Non-author can complete setup using docs only.
- Env names/scopes/routes/docs match implementation.

---

## F) Agent-Team Plan — ALL WAVES COMPLETE

### Wave 1 (parallel) — COMPLETE

Agent `schema-sync`:
- [x] connector type/config scaffolding
- [x] snapshot + index migrations (with preflight checks)
- [x] cache/constants wiring

Agent `docs-dev`:
- [x] connector docs scaffold and setup handoff updates
- [x] source naming table updates in connector guide

### Wave 2 (blocked by `schema-sync`) — COMPLETE

Agent `api-integration`:
- [x] Google client implementation
- [x] phase 1 routes + auto-match/enrichment logic
- [x] phase 2 sync/status routes and drift plumbing

### Wave 3 (blocked by `api-integration`) — COMPLETE

Agent `ui-ops`:
- [x] connection + mapping UI
- [x] category card + page-controller routing
- [ ] reconciliation views and operator feedback *(deferred to Phase 3)*

Dependency graph:
- Wave 1 (`schema-sync`, `docs-dev`) -> Wave 2 (`api-integration`) -> Wave 3 (`ui-ops`)

---

## G) Risks + Mitigations

1. Delegation setup errors block integration.
- Mitigation: explicit setup steps, targeted connection-test error messages.

2. Secret formatting issues (private key newlines/base64).
- Mitigation: support raw + base64 key formats, validate at startup.

3. Alias collision causing identity corruption.
- Mitigation: alias is suggestion-only, no auto-transfer.

4. Deleted-user API retention drift.
- Mitigation: local snapshot tombstones with full-run-only tombstone policy.

5. Routing drift in UI implementation.
- Mitigation: enforce page-controller seam in plan and review.

---

## H) Manual Setup Handoff (Owner Actions)

1. Create or reuse GCP project.
2. Enable Admin SDK API.
3. Create service account + JSON key.
4. Configure domain-wide delegation in Google Admin with scopes:
- `https://www.googleapis.com/auth/admin.directory.user.readonly`
- `https://www.googleapis.com/auth/admin.directory.group.readonly` (optional forward-compat)
5. Set env vars in `.env.local` and deployment.
6. Apply migrations in order (up only in normal path; down path documented for incidents).
7. Run smoke sequence:
- test connection
- list users
- auto-match
- enrich staff
- trigger sync
- verify status/drift outputs

---

## I) Operational Go/No-Go

- [ ] Connection and delegated auth pass in environment. *(blocked on env var setup — see SETUP-GUIDE.md)*
- [ ] Auto-match coverage and conflict reporting are acceptable. *(code complete, needs live test)*
- [x] Alias behavior is suggestion-only; no silent remaps. *(verified in auto-match route logic)*
- [x] Snapshot sync idempotent; no duplicate mappings. *(upsert on google_user_id)*
- [x] Tombstones only created after successful full pulls. *(tombstone logic gated on full pull completion)*
- [x] Suspended/deleted users remain visible for reconciliation. *(is_suspended/is_deleted flags preserved in snapshot)*
- [x] Migrations are reversible and preflight checks are documented. *(migration applied, down path in SQL comments)*
- [x] UI routes from page controller and aligns with existing enrichment UX. *(GWSMappingHub follows Slack pattern)*
- [x] Documentation is executable by a non-author. *(SETUP-GUIDE.md with 8 steps + troubleshooting)*

---

## J) Open Questions and Assumptions

Open questions (non-blocking):
1. Reuse existing `sophie-society-reporting` GCP project or isolate to new project?
2. Whether to add draft staff creation flow in later phase.
3. Whether to keep snapshot latest-state only or introduce append-only audit history.

Assumptions:
- Single primary domain in Phase 1.
- Directory-only connector in this round.
- `entity_external_ids` remains canonical external ID store.
- No automatic staff-status mutation from directory state.

---

## Approval Notes

This plan supersedes `02-claude-agent-plan.md` and incorporates all accepted corrections from `04-claude-revision.md`.
Implementation should execute from this file only.

## Implementation Notes (2026-02-06)

### Files Created
| File | Purpose |
|------|---------|
| `src/lib/connectors/types.ts` | `google_workspace` ConnectorTypeId + config type |
| `src/lib/connectors/google-workspace.ts` | GoogleWorkspaceConnector class |
| `src/lib/connectors/google-workspace-cache.ts` | Stale-while-revalidate cache |
| `src/lib/google-workspace/client.ts` | Service account auth, Directory API calls |
| `src/lib/google-workspace/types.ts` | GoogleDirectoryUser, snapshot types |
| `src/lib/constants.ts` | GOOGLE_WORKSPACE_TTL |
| `src/app/api/google-workspace/test-connection/route.ts` | POST: verify delegation |
| `src/app/api/google-workspace/users/route.ts` | GET: list snapshot users |
| `src/app/api/google-workspace/sync/route.ts` | POST: full directory sync |
| `src/app/api/google-workspace/sync/status/route.ts` | GET: sync + snapshot stats |
| `src/app/api/google-workspace/mappings/staff/route.ts` | GET/POST/DELETE: mappings |
| `src/app/api/google-workspace/mappings/staff/auto-match/route.ts` | POST: email auto-match |
| `src/app/api/google-workspace/enrich-staff/route.ts` | POST: enrich from snapshot |
| `src/components/google-workspace/gws-connection-card.tsx` | Connection test UI |
| `src/components/google-workspace/gws-staff-mapping.tsx` | Staff mapping table |
| `src/components/google-workspace/gws-mapping-hub.tsx` | Tabbed hub wrapper |
| `supabase/migrations/20260207_google_workspace_connector.sql` | Snapshot table + indexes |
| `src/docs/connectors/google-workspace/SETUP-GUIDE.md` | 8-step GCP walkthrough |

### Files Modified
| File | Change |
|------|--------|
| `src/lib/connectors/index.ts` | Export + register googleWorkspaceConnector |
| `src/components/data-enrichment/browser/category-hub.tsx` | Google Workspace card |
| `src/app/(dashboard)/admin/data-enrichment/page.tsx` | google_workspace view + routing |
| `src/docs/CONNECTOR-GUIDE.md` | Source naming + partial unique index |

### Next Steps
1. Follow `SETUP-GUIDE.md` to configure GCP service account + env vars
2. Run smoke test sequence: test-connection -> sync -> sync/status -> users -> auto-match -> enrich-staff
3. Verify UI at `/admin/data-enrichment` -> Google Workspace card

### Post-Implementation Delta (2026-02-07)

- Added persistent staff-approval queue for unmatched person accounts:
  - DB migration: `supabase/migrations/20260211_staff_approval_queue.sql`
  - API read route: `GET /api/google-workspace/staff-approvals`
- Auto-match now excludes lifecycle-inactive staff records and shared inboxes.
- Pending approval counts now exposed in sync status (`pending_staff_approvals`) and surfaced in mapping UI.
- Mapping create/delete flows now resolve or refresh approval queue state.
- “People” counts now exclude shared inboxes and mapped records tied to inactive staff statuses.
