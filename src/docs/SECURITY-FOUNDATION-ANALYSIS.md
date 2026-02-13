# Security Foundation Analysis

Updated: 2026-02-10
Status: Active working document
Scope: Sophie Hub v2 application, API routes, connector workflows, and delivery pipeline controls

---

## 1. Executive Summary

Sophie Hub has moved beyond ad-hoc hardening and now has a meaningful security baseline:
- Role/permission checks are consistently present in critical routes.
- High-impact vulnerabilities (auth bypass, feedback XSS/URL injection, error leakage, sync race conditions) have been fixed in recent sweeps.
- Security and reliability are now explicitly documented in multiple audit artifacts.

The main remaining risk is not "no security work was done." The main risk is **consistency and repeatability**:
- some documented checks are not yet continuously enforced in CI,
- some protections are local-instance only (rate limiting cache),
- some edge-case tests are present in docs but not fully wired into the default test pipeline.

This document defines what is already done, what to do next, and how to keep security checks running continuously during development and after deployment.

---

## 2. Concerns Mapped to Current Reality

This section maps the core leadership concerns (reliability, sloppy code drift, breakage risk, scalability/security) to observable implementation status.

### Reliability and stability
- **Partially addressed:** error boundaries, health endpoint, sync safeguards, and connector smoke scripts are in place.
- **Gap:** some reliability assurances are process-based rather than enforced gates (for example, CI scope and specific edge-case tests).

### Code quality and maintainability
- **Addressed in part:** strict TypeScript, linting, standardized API response helpers, and architecture docs exist.
- **Gap:** several large files and high-complexity routes still increase regression probability if ownership and refactor cadence are not enforced.

### Need for experienced developer oversight
- **Addressed:** recent git history shows recurring review and hardening passes, not just feature pushes.
- **Gap:** security review quality still depends on disciplined human review because not every check is currently automated.

### Potential for breakage while moving fast
- **Addressed:** rate limiting, sync lease controls, and audit docs reduce blast radius.
- **Gap:** full "rock-solid" posture needs stronger always-on validation in CI/nightly/post-deploy checks.

### Scalability and security
- **Addressed:** key routes include auth, permission checks, and input validation patterns.
- **Gap:** some read paths still rely on in-memory filtering/caps and process-local protections, which do not scale perfectly.

---

## 3. Security Controls Already Implemented

### Authentication and authorization
- NextAuth + Google OAuth with domain restriction support.
- Centralized role/permission system.
- Route-level `requireAuth()`, `requireRole()`, and `requirePermission()` patterns.
- Partner-level subject scoping through access checks.

### Injection and input hardening
- Zod schema validation across core API flows.
- Search hardening helper for PostgREST filter safety.
- Parameterized query usage and allowlists in BigQuery query paths.

### XSS and content safety
- Prior `document.write`-based vector removed in feedback flows.
- Attachment URL validation centralized with protocol/type allowlist.
- CSP defined in `next.config.mjs` (with accepted-risk note for current inline-script compatibility constraints).

### Error handling and data exposure
- Internal/database API errors standardized to generic client-safe responses.
- Google Workspace browser-facing user endpoint excludes `raw_profile`.
- Health endpoint implemented with no-cache response policy.

### Anti-abuse and operational safety
- Rate limiting helpers introduced and used on several expensive routes.
- Slack sync run exclusivity and stale-run recovery improvements documented and implemented.
- Connector smoke/capture scripts and workflow pipeline for Google Workspace checks added.

### Verification artifacts already present
- `src/docs/audits/2026-02-07-reactor-security-sweep.md`
- `src/docs/audits/2026-02-07-reactor-security-sweep-results.md`
- `src/docs/WIDGET-SECURITY-PERF.md`
- `src/docs/audits/raw-profile-retention-policy.md`
- `src/docs/audits/csp-accepted-risk.md`

---

## 4. Current Gaps and Risk Register

Severity definitions:
- P1: high-confidence, high-impact risk
- P2: important risk or reliability/security blind spot
- P3: improvement opportunity that should be scheduled

### P1-01: Search hardening tests are not in default Jest execution path
- Risk: regressions in search escaping can land unnoticed.
- Why: Jest is configured to run tests from top-level `__tests__`, while search utility tests currently live under `src/lib/api/__tests__`.
- Action: move or mirror tests into top-level Jest roots, or expand Jest config roots/testMatch to include `src/**/__tests__`.

### P1-02: Cron secret checks should fail closed when env is missing
- Risk: misconfiguration could unintentionally permit cron endpoint execution.
- Action: explicitly reject requests if `CRON_SECRET` is missing before header comparison.

### P2-01: Whitespace search edge case in `.or()` assembly
- Risk: invalid PostgREST filter fragments and noisy failures on edge input.
- Action: only apply `.or()` when escaped search pattern is non-empty after sanitization.

### P2-02: Process-local rate limiting is partial protection
- Risk: multi-instance deployment can bypass in-memory counters.
- Action: migrate heavy-route rate limits to Redis/DB-backed centralized limiter.

### P2-03: Some heavy list endpoints use in-memory filtering and fixed caps
- Risk: latency and memory growth with scale; potential truncation above cap.
- Action: push more filter/sort/pagination to database and add indexed query plans.

### P2-04: Smoke/CI checks rely heavily on HTTP status codes
- Risk: workflows may pass when payload reports logical failure with 2xx.
- Action: parse and assert semantic fields (`success`, counters, expected invariants), not only status.

### P3-01: Local runtime drift from declared Node version
- Risk: "works on my machine" mismatch and subtle runtime behavior differences.
- Action: enforce Node 20 in local/dev shell and CI parity checks.

### P3-02: Primary `SECURITY.md` has stale checklist items
- Risk: team confusion between implemented controls and historical TODO text.
- Action: align the root security doc with current implemented state and link to this analysis doc.

---

## 5. What Needs To Be Done Next

### Phase A (next 7 days)
1. Wire missing tests into default CI execution (especially search hardening and route-level edge-case tests).
2. Add fail-closed guard for missing `CRON_SECRET` in all cron handlers.
3. Patch whitespace search guard in all callers.
4. Update GWS smoke/capture validation to assert semantic success fields, not just 2xx.
5. Publish a single "security source of truth" index page linking all active audit docs.

### Phase B (next 30 days)
1. Introduce centralized distributed rate limiting for admin-heavy and expensive routes.
2. Convert high-volume in-memory list/filter logic to DB-level paging and indexed search.
3. Add API security regression tests for injection payloads and auth boundary checks.
4. Add environment boot checks for required secrets and deployment mode.
5. Update security docs to separate "implemented", "accepted risk", and "future hardening."

### Phase C (next 60-90 days)
1. Add periodic external-style DAST smoke suite against staging.
2. Add dependency/security update automation with escalation path and SLA.
3. Add policy checks for schema/RLS drift in migration pipeline.
4. Schedule quarterly security architecture review and incident simulation.

---

## 6. Continuous Security Scanning Program (Build-Time + Run-Time)

Goal: every change is scanned during development, and the deployed system is scanned repeatedly after release.

### A. During development (local and branch work)

Recommended controls:
1. Pre-commit:
   - lint on changed files
   - fast unit tests for touched modules
   - secrets scan on staged changes
2. Pre-push:
   - full unit test pass
   - type check
3. Branch protection:
   - block merge unless required security checks are green

### B. Pull request / CI gates (every PR)

Required jobs:
1. `security-pr-core`:
   - lint, typecheck, unit tests, production build
2. `security-pr-sast`:
   - static analysis (rule-based + semantic where possible)
3. `security-pr-secrets`:
   - repository secret scanning on diff
4. `security-pr-deps`:
   - dependency vulnerability audit with policy thresholds
5. `security-pr-api-regression`:
   - route-level injection/auth regression suite for critical APIs

### C. Nightly and scheduled scans (post-merge)

Nightly jobs:
1. full SAST scan on default branch
2. dependency and supply-chain audit
3. auth-required DAST smoke run on staging
4. connector health and data-integrity scan (semantic checks, not just status)

Weekly jobs:
1. permission boundary review tests
2. stale accepted-risk review (confirm each accepted risk is still valid)

### D. Post-deploy runtime monitoring (continuous)

1. error and security event telemetry with alert routing
2. health endpoint and critical route uptime checks
3. anomaly alerts for expensive endpoint spikes
4. sync run failure-rate alerts and stale-run detection alerts

---

## 7. Suggested Automation Backlog (Concrete Build List)

Create/extend the following:

1. `.github/workflows/security-pr.yml`
   - mandatory PR gate for lint/test/build/SAST/secret scan
2. `.github/workflows/security-nightly.yml`
   - scheduled nightly scan + report artifact
3. `.github/workflows/security-postdeploy.yml`
   - staging/prod smoke + semantic assertions
4. `scripts/security/check-env.sh`
   - fail if required security env vars are missing
5. `scripts/security/api-regression.sh`
   - auth + injection + edge-case endpoint checks
6. `scripts/security/dast-smoke-auth.sh`
   - authenticated endpoint smoke and invariant assertions
7. `__tests__/api/search-hardening.test.ts`
   - route-level grammar/wildcard/whitespace coverage
8. `__tests__/api/cron-auth.test.ts`
   - explicit fail-closed auth behavior tests

---

## 8. Release Security Gates (Definition of Done)

A release is "security-ready" only if all are true:

1. Required PR security checks are green.
2. No open P1 items.
3. Accepted-risk items are explicitly documented and reviewed in current cycle.
4. Post-deploy smoke checks pass with semantic assertions.
5. Rollback plan exists and is tested for critical routes.

---

## 9. Ownership, Cadence, and Reporting

Suggested ownership model:
- Platform team: pipeline automation, secrets, dependency management, runtime monitors
- Feature teams: route validation, auth boundaries, regression tests
- Security champion (rotating): weekly triage of scan findings and accepted-risk review

Suggested reporting cadence:
- Weekly: "security delta" (new findings, closed items, aging risks)
- Monthly: trend metrics (P1/P2 aging, MTTR, scan coverage)
- Quarterly: architecture-level security posture review

---

## 10. Success Metrics

Track these to measure foundation strength:

1. P1 open count (target: 0)
2. Mean time to remediate security findings by severity
3. % of critical API routes covered by security regression tests
4. % of merges blocked by security gates (should trend down as hygiene improves)
5. Nightly scan pass rate
6. Post-deploy smoke pass rate

---

## 11. Bottom Line

The foundation is promising and materially better than a typical fast-moving prototype, but "rock solid" requires converting current good intent and periodic sweeps into always-on automated controls.

Primary priority is now: **enforcement reliability** (tests, fail-closed auth checks, semantic CI assertions), followed by **scale-ready controls** (distributed rate limiting, DB-native filtering, scheduled DAST/SAST operations).
