# Security Status Share (2026-02-11)

Purpose: share-ready snapshot of what is done, what is running continuously, and what is next.
Canonical file location: `docs/SECURITY-STATUS-SHARE-2026-02-11.md`
Companion stability/scalability share: `docs/STABILITY-SCALABILITY-STATUS-SHARE-2026-02-11.md`

---

## Executive Summary

- Security foundation is established and documented.
- Phase A security-reliability items are complete.
- Continuous validation is live for Google Workspace connector paths.
- Reactor and widget security/performance sweep fixes are reflected in code (including Slack run exclusivity and BigQuery guardrails).
- Core next step is Phase B/C: distributed rate limiting, API regression security tests, and broader PR/nightly/post-deploy security pipelines.

---

## 1) What Has Been Done (Implemented)

| Area | Status | What is in place | Evidence |
|---|---|---|---|
| Security source of truth | LIVE | Central index + foundation analysis + root doc pointer | `src/docs/SECURITY-INDEX.md`, `src/docs/SECURITY-FOUNDATION-ANALYSIS.md`, `SECURITY.md` |
| Auth + RBAC enforcement | LIVE | Centralized `requireAuth`, `requireRole`, `requirePermission`, `canAccessPartner` used across API routes | `src/lib/auth/api-auth.ts` |
| Header/CSP hardening | LIVE | Security headers, CSP, HSTS on Vercel, `poweredByHeader: false` | `next.config.mjs` |
| Injection hardening helper | LIVE | PostgREST-safe search escaping helper | `src/lib/api/search-utils.ts` |
| Search whitespace guard | DONE (Phase A) | `.or()` search only executes when escaped value is non-empty | `src/app/api/staff/route.ts`, `src/app/api/partners/route.ts`, `src/lib/partners/partner-type-reconciliation.ts` |
| Jest coverage wiring | DONE (Phase A) | Jest now includes colocated tests in `src/**/__tests__` | `jest.config.js`, `src/lib/api/__tests__/search-utils.test.ts` |
| Cron auth fail-closed | DONE (Phase A) | Cron handlers return 500 if `CRON_SECRET` missing, 401 for invalid token | `src/app/api/cron/slack-sync/route.ts`, `src/app/api/cron/slack-analytics/route.ts`, `src/app/api/cron/partner-type-reconciliation/route.ts` |
| GWS smoke semantic checks | DONE (Phase A) | Smoke script checks response invariants, not just HTTP codes | `scripts/smoke-google-workspace.sh` |
| GWS capture semantic checks | DONE (Phase A) | Capture script validates semantic fields and summary extraction | `scripts/gws-sync-capture.sh` |
| CI semantic gate for GWS | LIVE | Workflow enforces lint/tests + semantic endpoint checks + artifact + fail alert | `.github/workflows/sync-validation.yml` |
| Data minimization | LIVE | Browser-facing GWS users route excludes `raw_profile` | `src/app/api/google-workspace/users/route.ts` |
| Health endpoint posture | LIVE | DB-backed health check with no-store cache policy | `src/app/api/health/route.ts` |
| Attachment URL safety | LIVE | Allowlist validation for attachment URLs | `src/lib/security/attachment-url.ts` |
| Slack sync race-condition hardening | LIVE | Partial unique index + atomic RPC for sync-run creation; stale-run recovery in same transaction | `supabase/migrations/20260213_slack_sync_run_exclusivity.sql`, `src/lib/slack/sync.ts`, `src/docs/audits/2026-02-07-reactor-security-sweep-results.md` |
| BigQuery error leakage hardening | LIVE | Generic error responses in production; detailed internals not returned to clients in prod paths | `src/app/api/bigquery/query/route.ts`, `src/app/api/bigquery/portfolio-query/route.ts`, `src/docs/WIDGET-SECURITY-PERF.md` |
| BigQuery query abuse guardrails | LIVE | Strict rate limits for portfolio queries and `partner_ids` max length of 100 | `src/app/api/bigquery/portfolio-query/route.ts`, `src/docs/WIDGET-SECURITY-PERF.md` |
| Widget config validation hardening | LIVE | Config size (10KB) and nesting depth checks (max depth 3) on widget create/update APIs | `src/app/api/modules/dashboards/[dashboardId]/widgets/route.ts`, `src/docs/WIDGET-SECURITY-PERF.md` |
| Admin audit logging | LIVE | Dedicated admin audit log table + logging helpers used in view/rule/module admin routes | `supabase/migrations/20260215_admin_audit_log.sql`, `src/lib/audit/admin-audit.ts`, `src/app/api/admin/views/route.ts`, `src/app/api/admin/views/[viewId]/route.ts`, `src/app/api/admin/views/[viewId]/modules/route.ts`, `src/app/api/admin/views/[viewId]/rules/route.ts` |
| Rate limiting | PARTIAL | In-memory limiter implemented; distributed limiter still planned | `src/lib/rate-limit/index.ts` |

---

## 2) Ongoing Automation Running Now

| Automation | Cadence / Trigger | Purpose | Evidence |
|---|---|---|---|
| Vercel cron: Slack sync | `*/5 * * * *` | Chunked Slack message sync with run-state checks | `vercel.json`, `src/app/api/cron/slack-sync/route.ts` |
| Vercel cron: Slack analytics | `0 6 * * *` | Daily rolling response-time analytics computation | `vercel.json`, `src/app/api/cron/slack-analytics/route.ts` |
| Vercel cron: Partner type reconciliation | `20 6 * * *` | Nightly taxonomy reconciliation safety pass | `vercel.json`, `src/app/api/cron/partner-type-reconciliation/route.ts` |
| GitHub Action: Sync Validation | PR + push(main) for GWS paths + manual dispatch | Lint, unit tests, GWS capture, semantic assertion gate, artifact upload, Slack failure notify | `.github/workflows/sync-validation.yml` |

---

## 3) What Is Lined Up Next (As We Build / After Build)

Source roadmap: `src/docs/SECURITY-FOUNDATION-ANALYSIS.md`

| Item | Phase | Status | Target artifact |
|---|---|---|---|
| Distributed rate limiting for heavy/admin routes | Phase B | PLANNED | Redis/DB-backed limiter integration |
| DB-native filter/pagination for heavy list endpoints | Phase B | PLANNED | Route query refactors + index plans |
| API auth/injection regression suite | Phase B | PLANNED | `scripts/security/api-regression.sh` + API tests |
| Required env boot checks | Phase B | PLANNED | `scripts/security/check-env.sh` |
| Security PR gate workflow | Phase B | PLANNED | `.github/workflows/security-pr.yml` |
| Nightly security scans (SAST/deps/DAST smoke) | Phase C | PLANNED | `.github/workflows/security-nightly.yml` |
| Post-deploy semantic security smoke | Phase C | PLANNED | `.github/workflows/security-postdeploy.yml` |
| Cron auth behavior tests | Phase B | PLANNED | `__tests__/api/cron-auth.test.ts` |
| Route-level search hardening tests | Phase B | PLANNED | `__tests__/api/search-hardening.test.ts` |
| Scheduled posture governance | Phase C | PLANNED | Weekly/monthly/quarterly cadence in foundation doc |
| SECURITY.md checklist reconciliation | Phase B | PLANNED | Refresh stale checklist statuses against current implementation evidence |
| RLS coverage + drift verification | Phase B/C | PLANNED | Policy coverage audit across application tables + migration guardrails |
| Remove `allowedDevOrigins` before production cutover | Phase B | PLANNED | `next.config.mjs` hardening cleanup |
| Source map exposure decision (`productionBrowserSourceMaps`) | Phase B | PLANNED | Explicit production setting and deployment policy |
| Session lifetime policy review | Phase B | PLANNED | Align security doc language with actual `maxAge` and target risk posture |
| Low-risk legacy findings revalidation (IDOR/ReDoS notes) | Phase C | PLANNED | Re-test and close or re-prioritize with evidence |

---

## 4) Validation Snapshot (Current)

- Lint: passing.
- Unit tests: passing.
- Search hardening tests included in default Jest run.
- Cron handlers fail closed when secret is missing.
- GWS smoke/capture and CI gates now include semantic assertions.
- Slack sync run exclusivity uses DB-enforced single-active-run + atomic RPC.
- BigQuery guardrails include strict rate limiting, capped partner list size, and widget config size/depth checks.

---

## 5) Documentation Drift Notes

- `SECURITY.md` still contains checklist entries that are partially stale versus implemented code in some areas. Keep it as historical context, but use this status doc + foundation analysis as the current execution snapshot until reconciliation is complete.
- Session timeout is configured in NextAuth (`maxAge` currently set), but policy-level target should still be explicitly agreed and documented.
- This file lives only in `docs/` to avoid duplicate-document drift.

---

## 6) Recommended Attachment Pack for Internal Share

1. `docs/SECURITY-STATUS-SHARE-2026-02-11.md` (this file)
2. `src/docs/SECURITY-FOUNDATION-ANALYSIS.md`
3. `src/docs/SECURITY-INDEX.md`
4. `SECURITY.md`
5. `src/docs/audits/2026-02-07-reactor-security-sweep-results.md`
6. `src/docs/audits/2026-02-08-reactor-sweep-code-review.md`
7. `src/docs/WIDGET-SECURITY-PERF.md`
8. `src/docs/audits/csp-accepted-risk.md`
9. `src/docs/audits/raw-profile-retention-policy.md`
10. `docs/STABILITY-SCALABILITY-STATUS-SHARE-2026-02-11.md`

---

## 7) Suggested Send Text (Short)

Security and reliability update: we have a strong implemented baseline and completed Phase A hardening focused on enforcement reliability (test wiring, fail-closed cron auth, search edge-case fixes, and semantic validation checks in smoke/CI). We also closed key reactor/widget hardening items, including Slack sync run exclusivity (partial unique index + atomic RPC), BigQuery query guardrails, and admin audit logging coverage for view-management flows. Continuous automation is live via scheduled cron jobs and connector CI semantic gates. Next, we are executing Phase B/C to add distributed rate limiting, API security regression suites, and dedicated PR/nightly/post-deploy security workflows so scanning remains active during build and after release.
