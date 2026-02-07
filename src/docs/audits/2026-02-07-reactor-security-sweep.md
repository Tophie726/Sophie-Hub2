# Reactor Security Sweep — Baseline Audit (2026-02-07)

## Scope
- Security posture
- Scalability risks
- Speed/performance bottlenecks
- Delivery/operational readiness

## Baseline Scorecard (Pre-sweep)
- Security: **6.4 / 10**
- Scalability: **6.1 / 10**
- Performance: **6.8 / 10**
- Reliability: **7.0 / 10**
- Operability: **6.2 / 10**
- Overall: **6.5 / 10**

Use this baseline to compare against post-sweep.

---

## Findings (Ordered by Severity)

### P1 — Search filter injection risk in staff API
- File: `/Users/test/Coding/Sophie-Data-Planning/sophie-hub-v2/src/app/api/staff/route.ts:67`
- Issue:
  The `search` string is interpolated directly into PostgREST `.or(...)` syntax:
  `full_name.ilike.%${search}%,...`.
  This can allow query grammar injection/breakage and unexpected filter behavior.
- Impact:
  Potential data overexposure or filter tampering for authenticated users.
- Fix direction:
  Escape PostgREST special characters in `search`, or replace with separate `.ilike(...)` clauses (no raw `.or` string assembly).

### P1 — Sensitive/oversized directory payload sent to browser
- File: `/Users/test/Coding/Sophie-Data-Planning/sophie-hub-v2/src/app/api/google-workspace/users/route.ts:34`
- Issue:
  `.select('*')` returns all snapshot fields, including `raw_profile` JSON.
  This sends unnecessary sensitive identity metadata to frontend and increases response size.
- Impact:
  Larger payloads, slower UI loads, higher memory, wider PII exposure surface.
- Fix direction:
  Return a strict projection for UI list endpoints; keep `raw_profile` server-only.

### P1 — Slack sync run creation is race-prone
- Files:
  - `/Users/test/Coding/Sophie-Data-Planning/sophie-hub-v2/src/lib/slack/sync.ts:480`
  - `/Users/test/Coding/Sophie-Data-Planning/sophie-hub-v2/src/lib/slack/sync.ts:494`
  - `/Users/test/Coding/Sophie-Data-Planning/sophie-hub-v2/supabase/migrations/20260208_slack_messages.sql:64`
- Issue:
  `createSyncRun()` does read-then-insert without a DB uniqueness guard. Two callers can create parallel pending runs.
- Impact:
  Duplicate work, inconsistent progress counters, possible lease contention edge cases.
- Fix direction:
  Add DB-level guard (partial unique index for active statuses or advisory lock) and handle conflict in API.

### P2 — Raw profile retention has no minimization/retention policy
- File: `/Users/test/Coding/Sophie-Data-Planning/sophie-hub-v2/src/app/api/google-workspace/sync/route.ts:158`
- Issue:
  Full Google `raw_profile` is stored indefinitely by default.
- Impact:
  Increased compliance burden and blast radius if DB exposure occurs.
- Fix direction:
  Add retention strategy (TTL/archive), PII classification, and explicit fields allowlist for long-term storage.

### P2 — Google sync upserts are fully sequential
- File: `/Users/test/Coding/Sophie-Data-Planning/sophie-hub-v2/src/app/api/google-workspace/sync/route.ts:132`
- Issue:
  One upsert per user in a loop; no batching.
- Impact:
  Slow sync growth as user counts increase; longer API runtimes.
- Fix direction:
  Batch upsert users per chunk (e.g., 50-200 records), and keep tombstone pass separate.

### P2 — Production CSP still permits `unsafe-inline` scripts
- File: `/Users/test/Coding/Sophie-Data-Planning/sophie-hub-v2/next.config.mjs:40`
- Issue:
  Production CSP includes `'unsafe-inline'` in `script-src`.
- Impact:
  Reduced XSS mitigation strength.
- Fix direction:
  Move to nonce/hash-based script policy where possible; keep exceptions tightly scoped.

### P3 — High-cost admin endpoints have no explicit rate limiting/backpressure
- Representative files:
  - `/Users/test/Coding/Sophie-Data-Planning/sophie-hub-v2/src/app/api/google-workspace/sync/route.ts`
  - `/Users/test/Coding/Sophie-Data-Planning/sophie-hub-v2/src/app/api/slack/sync/start/route.ts`
  - `/Users/test/Coding/Sophie-Data-Planning/sophie-hub-v2/src/app/api/slack/analytics/recompute/route.ts`
- Issue:
  Admin auth exists, but no per-user/per-endpoint throttling on expensive operations.
- Impact:
  Easy accidental overload; noisy retries can amplify load.
- Fix direction:
  Add idempotency keys + request throttles + queue depth controls.

---

## Sweep Checklist (What “Done” Looks Like)
- [ ] Search path hardened against query grammar injection.
- [ ] GWS user list endpoint strips `raw_profile` and other non-UI fields.
- [ ] DB constraint ensures max one active Slack sync run.
- [ ] Raw profile retention policy implemented and documented.
- [ ] GWS sync migrated to batched upserts with measured runtime gains.
- [ ] CSP hardened (nonce/hash path documented and partially implemented).
- [ ] Heavy admin operations rate-limited and idempotent.
- [ ] Baseline scorecard recomputed and compared against this file.

---

## Claude Agent Team Plan (Up to 10 Agents)

## Wave 1 (Blockers first)
- `schema-guard`:
  - Add DB constraints/indexes for Slack active-run exclusivity.
  - Add migration safety checks.
- `api-hardener`:
  - Fix staff search injection path.
  - Restrict GWS users projection (remove `raw_profile` from list API).
- `security-policy`:
  - Draft CSP hardening plan with phased rollout (report-only first if needed).

## Wave 2 (Performance + resilience)
- `sync-perf`:
  - Batch GWS snapshot upserts and benchmark before/after.
- `throttle-control`:
  - Add rate limiting/backpressure + idempotency for expensive admin endpoints.
- `retention-privacy`:
  - Implement raw-profile retention rules + redaction/archival path.

## Wave 3 (Validation + operations)
- `qa-adversarial`:
  - Injection tests, concurrency tests, and overlap tests.
- `load-sim`:
  - Stress API routes and sync paths with realistic payload sizes.
- `observability`:
  - Add metrics/logging for sync duration, queue depth, and failures.
- `docs-governance`:
  - Update runbooks, migration order, and security controls docs.

---

## Copy/Paste Prompt For Claude Team

```
Create an agent team to execute `src/docs/audits/2026-02-07-reactor-security-sweep.md`.

Team goals:
1) Resolve all P1 findings first.
2) Then resolve P2 findings.
3) Implement tests/validation for each fix.
4) Update docs and output a post-sweep scorecard using the same categories.

Agent constraints:
- No schema-destructive shortcuts.
- Keep migrations reversible.
- For each agent, log:
  - files changed
  - tests run
  - residual risks

Wave plan:
- Wave 1: schema-guard, api-hardener, security-policy
- Wave 2: sync-perf, throttle-control, retention-privacy
- Wave 3: qa-adversarial, load-sim, observability, docs-governance

Output files:
- `src/docs/audits/2026-02-07-reactor-security-sweep-results.md`
- `src/docs/audits/2026-02-07-reactor-security-sweep-scorecard-post.md`
```

