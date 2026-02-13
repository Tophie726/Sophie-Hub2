# Suptask Connector Proposal (Codex)

## Scope

Build one parent connector: `suptask` with staff-resolution-first delivery.

## Why This Shape

- Slack IDs in Suptask payloads are the fastest reliable bridge to staff.
- Existing `slack_user` mappings already encode 1:1 identity constraints.
- This avoids introducing redundant or conflicting user mapping sources.

## Mapping Model

| Mapping Purpose | source | External ID | Internal Entity | Cardinality | Enforced In |
|---|---|---|---|---|---|
| Requester identity bridge | `slack_user` | `requesterId` from Suptask | `staff` | 1:1 | Existing DB constraints |
| Assignee identity bridge | `slack_user` | `assignee` from Suptask | `staff` | 1:1 | Existing DB constraints |
| Ticket anchor | `suptask_ticket` | `${teamId}:${ticketNumber}` | `suptask_tickets` | 1:1 | DB unique index |

Proposed matching precedence:
1. exact Slack ID match via `slack_user`
2. fallback email-derived match (if available)
3. unresolved queue

## Phase Plan

### Phase 1: Connector + Connectivity

- Add `suptask` connector type/config and metadata.
- Add env-based Suptask client wrapper.
- Add routes:
  - `POST /api/suptask/test-connection`
  - `GET /api/suptask/ticket/[ticketNumber]` (debug/smoke route)
- Add Suptask card state from `comingSoon` -> active connector panel.

Validation:
- token errors are explicit and redacted
- test route returns stable success/failure envelope

### Phase 2: Sync + Snapshot Storage

- Add `suptask_tickets` snapshot table + sync state.
- Add routes:
  - `POST /api/suptask/sync`
  - `GET /api/suptask/sync/status`
- Upsert by `(team_id, ticket_number)`; record per-ticket failures without aborting full run.

Validation:
- idempotent reruns
- safe resume after interruption
- ticket-level failure isolation

### Phase 3: Staff Resolution + Unresolved Queue

- Resolve `requesterId`/`assignee` to `staff.id` via `slack_user` mappings.
- Persist resolution outcomes in snapshot metadata and resolver outputs.
- Add unresolved review endpoint/UI panel.

Validation:
- resolution rate reported
- unresolved records are queryable and actionable

### Phase 4: Analytics + Ops

- Add basic workload metrics by staff and queue.
- Add operator docs + smoke scripts.

Validation:
- metrics reconcile with sampled raw payloads
- setup handoff is executable by non-author

## Agent Team Proposal

### Wave 1

- `schema-sync`: ticket snapshot table + sync state migration
- `api-integration`: Suptask client + test-connection

### Wave 2

- `api-integration`: sync + status routes
- `ui-ops`: activate Suptask connector UX panel

### Wave 3

- `analytics`: staff resolution summaries + workload aggregates
- `review-hardening`: edge-case tests + docs parity

## Manual Setup Handoff (Preview)

- Env vars:
  - `SUPTASK_API_BASE_URL`
  - `SUPTASK_API_TOKEN`
  - `SUPTASK_API_AUTH_SCHEME`
- Smoke flow:
  1. test connection
  2. fetch known ticket numbers
  3. run short sync range
  4. inspect resolved vs unresolved staff links

## Open Questions

1. Do we include ticket replies/comments in MVP or defer?
2. What backfill range do we commit to for initial release?
3. Should unresolved records feed `staff_approval_queue` or a Suptask-specific queue first?
