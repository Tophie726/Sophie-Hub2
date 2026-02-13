# Suptask Connector — Codex Re-Review (Round 05)

Reviewed:
- `/Users/test/Coding/Sophie-Data-Planning/sophie-hub-v2/src/docs/connectors/suptask/02-claude-agent-plan.md`
- `/Users/test/Coding/Sophie-Data-Planning/sophie-hub-v2/src/docs/connectors/suptask/04-claude-revision.md`
- Round 05 implementation files in `src/lib/suptask`, `src/app/api/suptask/*`, migration `supabase/migrations/20260210_suptask_sync_run_exclusivity.sql`, and tests `__tests__/suptask-connector.test.ts`

Closed from prior round:
- Prior P1 findings #1 and #2: **closed**
- Prior P2 finding #3 and #4: **closed**

## Findings

1. [P2] Failed sync runs are still surfaced as UI success  
   Files/lines:
   - `/Users/test/Coding/Sophie-Data-Planning/sophie-hub-v2/src/app/api/suptask/sync/route.ts:130`
   - `/Users/test/Coding/Sophie-Data-Planning/sophie-hub-v2/src/app/api/suptask/sync/route.ts:132`
   - `/Users/test/Coding/Sophie-Data-Planning/sophie-hub-v2/src/components/suptask/suptask-panel.tsx:68`
   - `/Users/test/Coding/Sophie-Data-Planning/sophie-hub-v2/src/components/suptask/suptask-panel.tsx:70`
   Issue:
   - Route now correctly computes `finalStatus = 'failed'` for systemic failures, but still returns `apiSuccess(...)` (HTTP 200, `success: true`) in that branch.
   - The panel only checks `json.success`, so it shows a success toast even when `data.status === 'failed'`.
   Risk:
   - Operators can misread a failed sync as successful and miss auth/connectivity incidents.
   Required fix:
   - Either return an error response when `finalStatus === 'failed'`, or update panel logic to treat `json.data.status === 'failed'` as failure UI.

2. [P2] Planned route-test coverage is still not implemented  
   Files/lines:
   - `/Users/test/Coding/Sophie-Data-Planning/sophie-hub-v2/src/docs/connectors/suptask/02-claude-agent-plan.md:63`
   - `/Users/test/Coding/Sophie-Data-Planning/sophie-hub-v2/src/docs/connectors/suptask/02-claude-agent-plan.md:64`
   - `/Users/test/Coding/Sophie-Data-Planning/sophie-hub-v2/__tests__/suptask-connector.test.ts:1`
   Issue:
   - Current tests are useful unit tests for sanitization/header/classification, but do not cover route behaviors requested in the plan (`test-connection`, `sync` success path, invalid token path, partial sync failure path).
   - This leaves API contract behavior and status semantics unguarded.

## Open Questions

1. For `/api/suptask/sync`, should systemic failures be returned as non-2xx, or do we keep 200 + `{ data.status: 'failed' }` and enforce client-side handling?

## Gate Status

- P1 blockers: **0**
- P2 issues: **2**
- Decision: **changes required before final approval**
