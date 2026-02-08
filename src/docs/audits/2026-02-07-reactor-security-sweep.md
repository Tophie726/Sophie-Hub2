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

## Sweep Checklist (What "Done" Looks Like)
- [x] Search path hardened against query grammar injection.
- [x] GWS user list endpoint strips `raw_profile` and other non-UI fields.
- [x] DB constraint ensures max one active Slack sync run.
- [x] Raw profile retention policy implemented and documented.
- [x] GWS sync migrated to batched upserts with measured runtime gains.
- [x] CSP hardened (nonce/hash path documented and partially implemented).
- [x] Heavy admin operations rate-limited and idempotent.
- [x] Baseline scorecard recomputed and compared against this file.

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

---

## Codex Pre-Execution Gate (2026-02-08)

Status: **Do not execute Claude sweep yet. Update the plan first with these deltas.**

### Blocking deltas (must be applied before implementation)

1. **Raw profile policy must keep no-data-loss behavior**
   - Do **not** replace `raw_profile` with a narrow allowlist if this breaks Sophie Hub no-data-loss policy.
   - Keep `raw_profile` server-side only (never in list APIs), then apply retention/access policy controls.
   - Expected implementation shape:
     - keep `raw_profile` in snapshot table
     - remove it from browser-facing responses
     - add policy doc + retention controls (TTL/archive/redaction process)

2. **Slack sync exclusivity needs stale-run recovery, not just unique index**
   - A partial unique index for active runs is required, but insufficient alone.
   - Add run-recovery logic before insert:
     - detect expired lease on stale `pending/running`
     - atomically mark stale run `failed` or `cancelled`
     - then insert new run
   - API must return deterministic conflict semantics (`409`) only when a genuinely active run exists.

### High-priority deltas (should be included in same sweep)

3. **Search hardening tests must cover wildcard and grammar behavior**
   - Include explicit tests for:
     - grammar-like payloads (`test,status.eq.admin`)
     - wildcard payloads (`%`, `_`)
     - parentheses/comma/dot handling
   - Goal: prevent PostgREST grammar injection without breaking expected search UX.

4. **Rate limiting note must acknowledge in-memory scope**
   - Current limiter is process-local.
   - Keep local throttles for now, but document this as partial protection and add follow-up for shared store (Redis/DB) if multi-instance.

5. **Migration ordering**
   - Use a strictly newer timestamped migration filename for sync-run exclusivity/recovery changes to avoid ordering ambiguity.

### Claude acceptance criteria update

- No-data-loss policy remains intact for Google snapshot payloads.
- Only one active Slack run is possible, with stale-run recovery verified.
- Search hardening has regression tests for grammar/wildcards.
- Heavy endpoint throttling added, with infra limitations documented.
- Post-sweep scorecard includes residual risk notes where controls are partial.

### Final execution guardrails (add before implementation starts)

1. **Slack stale-run recovery must be atomic**
   - Recovery of stale runs + creation of new run must happen in one transactional boundary (single SQL transaction or RPC).
   - Prevents two concurrent callers from both recovering + both inserting.

2. **Slack exclusivity migration must include deterministic duplicate cleanup**
   - If multiple active runs exist, keep newest active candidate and mark older ones `cancelled` with explicit reason.
   - Migration must be reversible and idempotent.

3. **Search hardening needs API-level verification (not only unit utility tests)**
   - Add route-level tests for `/api/staff` and `/api/partners` using grammar-like payloads.
   - Assert no filter injection and no 500 on special characters.

4. **Payload reduction should be measured and recorded**
   - Capture before/after response size for `/api/google-workspace/users`.
   - Include measured delta in post-sweep results document.

5. **Rate-limit residual risk must be explicit in results**
   - Mark in-memory limiter as **single-instance protection only**.
   - Add follow-up item for shared-store limiter (Redis/DB) with owner and target phase.
