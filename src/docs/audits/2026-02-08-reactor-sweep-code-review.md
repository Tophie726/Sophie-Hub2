# Reactor Security Sweep — Code Review Guide

**PR:** #1 (`codex/reactor-security-sweep`)
**Commit:** `514c40c`
**Date:** 2026-02-08
**Executed by:** Claude agent team (4 agents, 3 parallel waves)
**Scope:** 16 files changed, 626 insertions, 76 deletions

---

## How to Review

Each section below corresponds to one agent's work scope. Review independently and flag issues per section. The pre-execution gate deltas and final guardrails from the audit MD were applied — verify compliance in each section.

**Reference files:**
- Audit: `src/docs/audits/2026-02-07-reactor-security-sweep.md`
- Results: `src/docs/audits/2026-02-07-reactor-security-sweep-results.md`
- Plan: Codex gate at line 172 + guardrails at line 218 of the audit MD

---

## Section 1: Search Filter Injection (agent: search-hardener)

**Finding:** P1 — PostgREST query grammar injection via raw `.or()` interpolation

**Files to review:**
| File | Change |
|------|--------|
| `src/lib/api/search-utils.ts` | **New** — `escapePostgrestValue()` utility |
| `src/lib/api/__tests__/search-utils.test.ts` | **New** — 9 unit tests |
| `src/app/api/staff/route.ts` | Line 67 — `search` param now quoted |
| `src/app/api/partners/route.ts` | Line 77 — `search` param now quoted |

**Review checklist:**
- [ ] PostgREST double-quoting used (not backslash-escaping — `.or()` does not support `\` escaping)
- [ ] ILIKE wildcards (`%`, `_`) escaped with `\` inside the double-quoted value
- [ ] Double-quote delimiter (`"`) escaped as `""` inside the value
- [ ] Result format: `"%value%"` (quotes and ILIKE wildcards wrapped together)
- [ ] Callers do NOT add their own `%` wildcards (function includes them)
- [ ] Empty/whitespace input returns empty string
- [ ] Normal search terms (`John Smith`) → `"%John Smith%"`
- [ ] Apostrophe handling (`o'hara`) — no parser break (guardrail #3)
- [ ] Grammar injection payload (`test,status.eq.admin`) → `"%test,status.eq.admin%"` (Codex delta #3)
- [ ] `.or()` filter strings remain syntactically valid after quoting
- [ ] Import added correctly in both route files
- [ ] 9 unit tests passing (grammar, wildcards, parens, apostrophe, double-quote, empty, backslash)
- [ ] No other search paths missed (check: are there other `.or()` with user input?)

---

## Section 2: GWS Users Payload Reduction (agent: api-hardener)

**Finding:** P1 — `select('*')` sends `raw_profile` JSONB (~1.5-3KB/user) to browser

**Files to review:**
| File | Change |
|------|--------|
| `src/app/api/google-workspace/users/route.ts` | `select('*')` → explicit 24-column projection |
| `src/lib/connectors/google-workspace-cache.ts` | Cache type → `Omit<DirectorySnapshotRow, 'raw_profile'>` |

**Review checklist:**
- [ ] Column list matches all `DirectorySnapshotRow` fields except `raw_profile`
- [ ] No column missed or misspelled in the select string
- [ ] `DirectoryUserRow` type alias correctly defined as `Omit<DirectorySnapshotRow, 'raw_profile'>`
- [ ] `as unknown as DirectoryUserRow[]` cast is safe (Supabase returns generic type for string selects)
- [ ] Cache getter/setter types updated consistently
- [ ] `raw_profile` still stored in DB during sync (no-data-loss — Codex delta #1)
- [ ] `raw_profile` never reaches browser in any code path (cached or fresh)
- [ ] No other endpoints that return `raw_profile` to browser (check: enrich, mappings, staff-approvals?)

---

## Section 3: Slack Sync Race Condition (agent: schema-guard)

**Finding:** P1 — Check-then-insert without DB guard; stale runs can block permanently

**Files to review:**
| File | Change |
|------|--------|
| `supabase/migrations/20260213_slack_sync_run_exclusivity.sql` | **New** — migration with index + RPC |
| `src/lib/slack/sync.ts` | `createSyncRun()` rewritten to call atomic RPC |

**Review checklist — Migration:**
- [ ] Duplicate cleanup is deterministic: `ORDER BY created_at DESC, id DESC` (guardrail #2)
- [ ] Older active runs marked `cancelled` with explicit reason string
- [ ] Partial unique index: `WHERE status IN ('pending', 'running')` on `((true))`
- [ ] `IF NOT EXISTS` on index creation (idempotent)
- [ ] `CREATE OR REPLACE` on function (idempotent)
- [ ] Reversible: can be undone with `DROP INDEX` + `DROP FUNCTION`

**Review checklist — RPC function:**
- [ ] `SECURITY INVOKER` (not DEFINER) — runs as calling role (guardrail final #1)
- [ ] `REVOKE ALL ... FROM PUBLIC` (guardrail final #1)
- [ ] `GRANT EXECUTE ... TO service_role` (guardrail final #1)
- [ ] Stale-run recovery: handles both lease-expired AND never-started pending runs
- [ ] Stale threshold: `now() - interval '15 minutes'` matches `LEASE_DURATION_MINUTES`
- [ ] Recovery + insert in same transaction (atomic — guardrail #1)
- [ ] Returns UUID of new run

**Review checklist — App code:**
- [ ] Old check-then-insert pattern fully removed
- [ ] `supabase.rpc('create_sync_run_atomic', ...)` called correctly
- [ ] `23505` error code caught and thrown as "already active" (→ caller returns 409)
- [ ] Channel count still queried before RPC call
- [ ] No leftover dead code from old implementation

---

## Section 4: GWS Batch Upserts (agent: sync-perf)

**Finding:** P2 — One upsert per user (700 round trips)

**Files to review:**
| File | Change |
|------|--------|
| `src/app/api/google-workspace/sync/route.ts` | Per-user loop → batch upsert in chunks of 50 |

**Review checklist:**
- [ ] `import { SYNC } from '@/lib/constants'` added
- [ ] Drift detection loop unchanged (new_user, email_changed, suspended, reinstated)
- [ ] `upsertRecords[]` array built in loop (no DB writes inside loop)
- [ ] Batch loop uses `SYNC.UPSERT_BATCH_SIZE` (50) from constants
- [ ] `onConflict: 'google_user_id'` on batch upsert
- [ ] Schema error still caught per-batch (`isSnapshotSchemaError`)
- [ ] `raw_profile: user.rawProfile || null` still included in upsert records (no-data-loss)
- [ ] `upserted` counter increments by `batch.length` on success
- [ ] Tombstone section unchanged (still operates on `existingByGoogleId` map)
- [ ] Step numbering updated in comments (3→build, 4→batch, 5→tombstone)

---

## Section 5: Rate Limiting (lead agent)

**Finding:** P3 — No throttle on expensive admin sync/recompute operations

**Files to review:**
| File | Change |
|------|--------|
| `src/lib/rate-limit/index.ts` | `ADMIN_HEAVY` preset added |
| `src/app/api/google-workspace/sync/route.ts` | Rate limit check before business logic |
| `src/app/api/slack/sync/start/route.ts` | Rate limit check before business logic |

**Review checklist:**
- [ ] `ADMIN_HEAVY: { maxRequests: 2, windowMs: 5 * 60 * 1000 }` — reasonable for sync ops?
- [ ] JSDoc documents in-memory/process-local limitation (Codex delta #4)
- [ ] JSDoc mentions Redis/DB follow-up for multi-instance (Codex delta #4)
- [ ] Rate check happens after `requireRole(ROLES.ADMIN)` auth but before `try` block
- [ ] 429 response includes `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` (guardrail final #5)
- [ ] 429 response includes `Retry-After` header (guardrail final #5)
- [ ] Uses `NextResponse.json()` for custom headers (not `ApiErrors.rateLimited()`)
- [ ] GWS sync uses action key `'gws:sync'`, Slack uses `'slack:sync'` (separate limits)
- [ ] `rateLimitHeaders()` imported from `@/lib/rate-limit`

---

## Section 6: Documentation (lead agent)

**Files to review:**
| File | Change |
|------|--------|
| `src/docs/audits/raw-profile-retention-policy.md` | **New** — retention policy |
| `src/docs/audits/csp-accepted-risk.md` | **New** — CSP accepted risk |
| `next.config.mjs` | Comment added at CSP line |
| `src/docs/audits/2026-02-07-reactor-security-sweep.md` | Checklist items checked off |
| `src/docs/audits/2026-02-07-reactor-security-sweep-results.md` | **New** — results + scorecard |

**Review checklist:**
- [ ] Retention policy preserves no-data-loss philosophy (Codex delta #1)
- [ ] Retention tiers documented (active/archive/purge)
- [ ] Sensitive field redaction listed as future work
- [ ] CSP accepted risk rationale is sound (Next.js constraint, internal app, auth gate)
- [ ] CSP review triggers documented (Next.js nonce support, external access, incident)
- [ ] All follow-up items have owner (`platform-team`) and target (`Phase 6`)
- [ ] Scorecard before/after numbers are justified
- [ ] Residual risks explicitly listed with severity
- [ ] Rate-limit residual risk calls out single-instance limitation (guardrail #5)
- [ ] All 8 checklist items marked `[x]` in audit MD

---

## Codex Gate + Guardrail Compliance Matrix

Verify each was satisfied:

| # | Requirement | Where to Check |
|---|-------------|----------------|
| Gate #1 | No-data-loss for raw_profile | Section 2 (select), Section 4 (upsert still has raw_profile) |
| Gate #2 | Stale-run recovery in sync | Section 3 (RPC function) |
| Gate #3 | Search tests for grammar + wildcards | Section 1 (test file) |
| Gate #4 | In-memory rate-limit documented | Section 5 (JSDoc on preset) |
| Gate #5 | Migration timestamp > 20260212 | Section 3 (filename: 20260213) |
| Guard #1 | Atomic recovery + create | Section 3 (single PL/pgSQL function) |
| Guard #2 | Deterministic duplicate cleanup | Section 3 (ORDER BY created_at DESC, id DESC) |
| Guard #3 | API-level search verification | Section 1 (smoke test plan in results doc) |
| Guard #4 | Measured GWS payload delta | Section 6 (results doc — to be measured on live) |
| Guard #5 | Rate-limit residual risk explicit | Section 6 (results doc follow-up table) |
| Final #1 | RPC permissions locked down | Section 3 (REVOKE PUBLIC, GRANT service_role) |
| Final #2 | Tie-safe duplicate winner | Section 3 (id DESC tiebreaker) |
| Final #3 | Apostrophe test case | Section 1 (o'hara test) |
| Final #4 | JSON byte length measurement | Section 6 (results doc methodology) |
| Final #5 | Rate limit response headers | Section 5 (X-RateLimit-* + Retry-After) |
