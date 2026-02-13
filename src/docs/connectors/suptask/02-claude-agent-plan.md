# Suptask Connector — Claude Agent Plan

Round 02 of the Codex <-> Claude review loop.
Inputs:
- `src/docs/connectors/suptask/00-context.md`
- `src/docs/connectors/suptask/01-codex-proposal.md`
- `src/docs/SUPTASK-ROLLOUT-PLAN.md`

## Implementation Objective

Implement Phase 1 + Phase 2 end-to-end:
- connector registration
- secure env-only auth client
- connection test route
- ticket snapshot schema + sync routes
- minimal admin UX activation for Suptask connector card/panel

## Hard Rules

1. Never serialize `SUPTASK_API_TOKEN` to DB, API responses, logs, or client payloads.
2. Keep sync idempotent (`upsert`) and restart-safe.
3. Do not fail the whole sync when one ticket returns upstream 500.
4. Reuse existing identity bridge (`slack_user`) rather than adding duplicate staff mapping sources.
5. Touch only Suptask-related files unless required for shared type plumbing.

## Required Deliverables

1. Connector plumbing
- Add `suptask` type/config in:
  - `src/lib/connectors/types.ts`
  - `src/lib/connectors/index.ts`
- Add connector implementation:
  - `src/lib/connectors/suptask.ts`

2. Suptask API client
- Create `src/lib/suptask/client.ts` with:
  - env validation (`SUPTASK_API_BASE_URL`, `SUPTASK_API_TOKEN`, `SUPTASK_API_AUTH_SCHEME`)
  - request helper with redacted error messages
  - methods:
    - `testConnection()`
    - `getTicketByNumber(ticketNumber)`

3. API routes
- `POST /api/suptask/test-connection`
- `POST /api/suptask/sync`
- `GET /api/suptask/sync/status`
- Optional debug route:
  - `GET /api/suptask/ticket/[ticketNumber]`

4. Schema/migrations
- Add migration for `suptask_tickets` and sync state table.
- Unique constraint by `team_id,ticket_number`.
- Store raw payload JSONB + normalized fields used by resolver/analytics.

5. UI activation
- Enable Suptask card from placeholder to active state in enrichment browser.
- Add minimal panel with:
  - test connection
  - sync trigger
  - sync status summary

6. Tests
- Unit tests for client auth header selection and error handling.
- Route tests for success + invalid token + partial sync failures.

## Suggested File Targets

- `src/lib/connectors/types.ts`
- `src/lib/connectors/index.ts`
- `src/lib/connectors/suptask.ts`
- `src/lib/suptask/client.ts`
- `src/app/api/suptask/test-connection/route.ts`
- `src/app/api/suptask/sync/route.ts`
- `src/app/api/suptask/sync/status/route.ts`
- `src/components/data-enrichment/...` (Suptask panel)
- `supabase/migrations/<timestamp>_suptask_connector.sql`
- `__tests__/suptask-*.test.ts`

## Acceptance Checks

- [ ] `POST /api/suptask/test-connection` succeeds with configured env and fails cleanly without leaking secret.
- [ ] `POST /api/suptask/sync` is idempotent and handles ticket-specific upstream failures gracefully.
- [ ] Suptask UI panel can run test + sync from admin enrichment screen.
- [ ] `npm run build` and relevant tests pass.
- [ ] Docs updated where routes and setup changed.

## Output Required Back To Codex

In `src/docs/connectors/suptask/04-claude-revision.md` provide:
1. Changed files list
2. Route contracts added/updated
3. Migration summary
4. Test evidence (command + pass/fail)
5. Known limitations and follow-up items
