# SupTask Connector Rollout Plan

## A) Business Goal
- Why this connector exists:
  - Bring ticket workload and support operations data into Sophie Hub.
  - Link ticket requesters/assignees to staff using the existing Slack identity bridge.
- Decisions/metrics this should unlock:
  - Workload by staff and by partner.
  - Ticket volume, closure cadence, and backlog signals.
  - Operational context joins for partner health views.
- Success in the next 2-4 weeks:
  - Stable connection test and ticket ingestion.
  - At least 80% of Slack-sourced tickets resolve to staff via existing Slack mappings.
  - Unresolved identities are visible in review queues (not silently dropped).

## B) Source Model
- External system:
  - SupTask Public API
- Authentication model:
  - API token in `Authorization` header (`Api-Token` primary; `Bearer` fallback)
- Plan/tier constraints:
  - API endpoint from SupTask support: `https://public-api-prod.suptask.com/api/v2/public/`
  - Observed response variance: some ticket numbers can return server-side 500 while others succeed.
- Data pull mode: incremental / snapshot / hybrid
  - Hybrid:
    - Initial backfill by ticket number ranges.
    - Incremental sync by updated timestamp where available.

## C) Linking Points (Identity Graph)
- Link 1: `requesterId` (Slack member ID) -> `staff` via existing `entity_external_ids(source='slack_user')`
- Link 2: `assignee` (Slack member ID) -> `staff` via existing `entity_external_ids(source='slack_user')`
- Link 3: optional email-derived fallback (if present in custom fields) -> `staff.email`

## D) Mapping Rules + Cardinality
| Mapping Purpose | source | External ID | Internal Entity | Cardinality | Enforced In |
|---|---|---|---|---|---|
| Staff identity bridge (requester) | `slack_user` | SupTask `requesterId` | `staff` | 1:1 | DB (existing Slack mapping constraints) |
| Staff identity bridge (assignee) | `slack_user` | SupTask `assignee` | `staff` | 1:1 | DB (existing Slack mapping constraints) |
| Ticket anchor | `suptask_ticket` | `${teamId}:${ticketNumber}` | `suptask_tickets` (new snapshot table) | 1:1 | DB unique index |

- onConflict strategy:
  - `suptask_tickets`: upsert on `team_id,ticket_number`.
  - Keep latest `updated_at` payload; never delete on transient upstream failures.
- Required metadata per mapping:
  - `source` (`slack`/`email`), `requesterId`, `assignee`, `formId`, `queueId`, `status`, `archived`.

## E) Delivery Phases
### Phase 1: Connection + Mapping
- Scope:
  - Add Suptask connector type, env-based auth, and test-connection route.
- Deliverables:
  - `src/lib/suptask/client.ts`
  - `POST /api/suptask/test-connection`
  - connector metadata + registration
- Validation tests:
  - valid token returns reachable API response
  - invalid token returns handled 401 path
  - endpoint and auth scheme are configurable via env
- UI/design checks (if UI in scope, using emil-design-engineering):
  - Suptask card no layout shift
  - keyboard focus and reduced motion respected

### Phase 2: Sync Engine
- Scope:
  - Build ticket pull route and snapshot persistence.
- Deliverables:
  - migration for `suptask_tickets`
  - `POST /api/suptask/sync`
  - `GET /api/suptask/sync/status`
- Validation tests:
  - idempotent upsert
  - partial upstream failures do not wipe local data
  - retry-safe sync cursor behavior
- UI/design checks (if UI in scope, using emil-design-engineering):
  - sync status states are stable and accessible

### Phase 3: Analytics
- Scope:
  - Staff-linked views and unresolved identity reporting.
- Deliverables:
  - resolver pipeline: `requesterId`/`assignee` -> `staff_id`
  - unresolved list for manual follow-up
- Validation tests:
  - staff resolution percentage is measurable
  - unresolved set is explicit and auditable
- UI/design checks (if UI in scope, using emil-design-engineering):
  - staff mapping indicators and filter controls pass accessibility checks

### Phase 4: Operational Readiness
- Scope:
  - setup docs, smoke scripts, and monitorable failure modes.
- Deliverables:
  - setup handoff section complete
  - smoke script for local/prod env validation
- Validation tests:
  - non-author can run setup + smoke flow end-to-end
- UI/design checks (if UI in scope, using emil-design-engineering):
  - status/error messaging remains readable on mobile

## F) Agent-Team Plan
### Wave 1
- Agent: `schema-sync`
- Tasks:
  - migration for Suptask snapshot table
  - sync state persistence
- Blocks/unblocks:
  - unblocks API ingest and status reporting

### Wave 2
- Agent: `api-integration`
- Tasks:
  - Suptask client, test-connection, sync routes, resolver wiring
- Blocks/unblocks:
  - depends on schema availability
  - unblocks UI and analytics wiring

### Wave 3
- Agent: `ui-ops`
- Tasks:
  - Suptask card behavior, sync trigger/status, unresolved identity UX
- Blocks/unblocks:
  - depends on stable API contracts

### Wave 4
- Agent: `analytics`
- Tasks:
  - staff workload aggregations and confidence metrics
- Blocks/unblocks:
  - depends on ingestion + resolver outputs

## G) Risks + Mitigations
- Risk 1:
  - Upstream ticket payload inconsistencies (observed occasional 500).
  - Mitigation: resilient per-ticket error handling + skip/retry queue + no destructive overwrite.
- Risk 2:
  - Missing Slack IDs for some tickets (email-origin or blank requester).
  - Mitigation: unresolved queue + fallback email parsing + manual mapping workflow.
- Risk 3:
  - Token handling leaks if stored in connector config.
  - Mitigation: env-only secret policy.

## H) Manual Setup Handoff (Owner Actions)
- External app creation:
  - SupTask support provides API token.
- Required permissions/scopes:
  - ticket read access for target workspace/team.
- Secrets/env vars (`.env.local` + deployment):
  - `SUPTASK_API_BASE_URL=https://public-api-prod.suptask.com/api/v2/public`
  - `SUPTASK_API_TOKEN=<plaintext token>`
  - `SUPTASK_API_AUTH_SCHEME=api_token`
- Migration files to apply:
  - `supabase/migrations/<timestamp>_suptask_connector.sql`
- First smoke-test sequence:
  1. `POST /api/suptask/test-connection`
  2. `POST /api/suptask/sync` with small ticket range
  3. verify rows in `suptask_tickets`
  4. verify staff resolution counts and unresolved queue

## I) Operational Go/No-Go
- [ ] Auth and connection test pass
- [ ] Mappings validated (manual + auto-match)
- [ ] Sync completes with safe resume behavior
- [ ] Metrics spot-checked against raw source samples
- [ ] Logs/alerts in place for stuck runs and repeated failures

## J) Open Questions and Assumptions
- Q1:
  - Should we support team-scoped sync only, or all teams returned by token?
- Q2:
  - Do we need to ingest ticket replies/comments in phase 1, or ticket headers only?
- Q3:
  - Which date range do we backfill first (e.g., last 90 days vs full history)?
- Assumptions made:
  - Existing Slack mapping (`slack_user`) is the primary staff bridge.
  - Google Workspace remains the canonical email backbone.
  - Suptask token remains env-only and never persisted in connector config.
