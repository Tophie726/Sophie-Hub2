# Google Workspace Connector Proposal (Codex)

## Scope

Build one parent connector: `google_workspace`, starting with a Directory module.

## Why This Shape

- One auth path and one setup handoff for Google APIs.
- Cleaner future expansion (Calendar/Gmail as sub-modules, not separate root connectors).
- Identity-first delivery gives immediate value and lowers downstream mapping risk.

## Mapping Model

| Mapping Purpose | source | External ID | Internal Entity | Cardinality | Enforced In |
|---|---|---|---|---|---|
| Primary staff identity | `google_workspace_user` | Google user ID | `staff` | 1:1 | DB partial unique |
| Email aliases (optional) | `google_workspace_alias` | alias email | `staff` | 1:N | App logic |

Proposed matching precedence:
1. exact primary email match
2. exact alias match
3. manual review queue

## Phase Plan

### Phase 1: Directory Connector + Mapping

- Add connector type/config for `google_workspace`.
- Add Google directory client wrapper.
- Add routes:
  - `POST /api/google-workspace/test-connection`
  - `GET /api/google-workspace/users`
  - `POST /api/google-workspace/mappings/staff/auto-match`
  - `POST /api/google-workspace/enrich-staff`
- UI card + mapping table + enrichment action.

Validation:
- Connection test passes with service account credentials.
- Auto-match report returns matched/unmatched/skipped counts.
- Offboarded users are visible and flagged, not dropped.

### Phase 2: Incremental Sync + Reconciliation

- Add sync state table for directory snapshots.
- Add incremental pull and drift report (new users, removed users, email changes).
- Add manual review queue for unmatched or conflicting identities.

Validation:
- Re-running sync is idempotent.
- Email changes do not create duplicate staff links.
- Suspended/deleted users remain queryable for history.

### Phase 3: Workflow Hooks (Optional)

- Add hooks for onboarding/offboarding suggestions in staff workflows.
- Optional automation starter for welcome/offboarding playbooks.

Validation:
- Workflow suggestions fire only on explicit state transitions.
- No automatic destructive changes on first rollout.

### Phase 4: Operational Readiness

- Document full setup handoff.
- Add smoke test runbook.
- Add monitoring for sync errors/stalls.

Validation:
- Go/no-go checklist complete.
- Non-author can execute setup using docs only.

## Agent Team Proposal

### Wave 1

- `schema-sync`: connector types, DB mapping/sync schema
- `api-integration`: directory client + core routes

### Wave 2

- `ui-ops`: connector card, mapping UI, reconciliation UI
- `analytics` (light): reconciliation metrics and summary endpoints

### Wave 3

- `review-hardening`: edge-case tests, docs parity, operational runbook

## Manual Setup Handoff (Preview)

- Create Google Cloud project and service account.
- Enable Admin SDK API.
- Configure domain-wide delegation.
- Minimum scopes:
  - Directory users read-only
  - Directory groups read-only (optional initial)
- Env vars (example names):
  - `GOOGLE_WORKSPACE_CLIENT_EMAIL`
  - `GOOGLE_WORKSPACE_PRIVATE_KEY`
  - `GOOGLE_WORKSPACE_IMPERSONATED_ADMIN`
- Apply connector migrations.
- Run smoke sequence:
  1. test connection
  2. list users (small page)
  3. run auto-match
  4. run enrich
  5. review unmatched queue

## Open Questions

1. Should unmatched Google users auto-create draft staff records?
2. Should non-`@sophiesociety.com` accounts be included by default?
3. Should suspended accounts auto-set staff status, or suggest-only?
