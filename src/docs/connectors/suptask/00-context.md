# Suptask Connector Context

## Request Summary

- Build the Suptask connector now and use Slack IDs as the first-class identity bridge.
- Keep Google Workspace as staff backbone (email + profile), then enrich Slack and resolve Suptask staff joins through Slack IDs.
- Deliver in lego-block order:
  1. Google Workspace backbone
  2. Slack enrichment (`staff.slack_id`)
  3. Suptask ingestion + staff linking

## Verified API State (2026-02-10)

- SupTask support provided endpoint:
  - `https://public-api-prod.suptask.com/api/v2/public/`
- Local smoke tests confirmed API is reachable with current token.
- Ticket API behavior observed:
  - Success (`200`) for multiple ticket numbers (`2`, `3`, `10`, `100`, `1000`, `2075`).
  - Occasional upstream `500` for certain tickets (`1`: `Failed to fetch ticket form fields`).
- Conclusion: integration is viable; connector must tolerate per-ticket upstream failures.

## Current Environment Setup

- Local env file updated:
  - `.env.local` contains `SUPTASK_API_BASE_URL`, `SUPTASK_API_TOKEN`, `SUPTASK_API_AUTH_SCHEME`.
- Vercel env vars updated for:
  - `development`, `preview`, `production`.

## Current Codebase State

- Suptask is present in enrichment UI as a placeholder card/icon only.
- No Suptask connector class/routes/client yet.
- Existing identity graph already supports Slack and Google Workspace mappings via `entity_external_ids`.

## Identity Strategy

- Primary resolution for Suptask ticket ownership:
  - `requesterId` and `assignee` (Slack member IDs) -> `entity_external_ids(source='slack_user')` -> `staff.id`.
- Secondary/fallback resolution:
  - email from custom fields (if available) -> `staff.email` / Google Workspace mappings.

## Constraints

- Do not persist secrets/tokens in connector config.
- Keep sync idempotent and restart-safe.
- Do not lose historical ticket records on upstream errors.

## Open Questions

1. Initial backfill window: 90 days, 180 days, or full history?
2. Phase 1 scope: ticket headers only, or include replies/comments?
3. Should email-only tickets create unresolved identity records immediately or only on demand?
