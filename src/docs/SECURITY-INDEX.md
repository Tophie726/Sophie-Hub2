# Security Documentation Index

Updated: 2026-02-10
Purpose: single index for active security posture, audits, and execution plans

---

## Core posture

1. `src/docs/SECURITY-FOUNDATION-ANALYSIS.md`
   - Current baseline, risk register, Phase A/B/C roadmap, and continuous scan model.

2. `docs/SECURITY-STATUS-SHARE-2026-02-11.md`
   - Share-ready status snapshot of implemented controls, live automations, and queued hardening work.

3. `SECURITY.md`
   - Historical + operational security checklist.
   - Use alongside the foundation analysis doc for implementation tracking.

4. `docs/STABILITY-SCALABILITY-STATUS-SHARE-2026-02-11.md`
   - Companion operations snapshot focused on reliability, runtime stability, and scale readiness.

---

## Audit reports and sweep artifacts

1. `src/docs/audits/2026-02-07-reactor-security-sweep.md`
   - Baseline findings and target controls.

2. `src/docs/audits/2026-02-07-reactor-security-sweep-results.md`
   - Post-sweep outcomes, score deltas, and residual risks.

3. `src/docs/audits/2026-02-08-reactor-sweep-code-review.md`
   - Reviewer checklist and guardrail verification matrix.

4. `src/docs/WIDGET-SECURITY-PERF.md`
   - Widget-system-focused security and performance audit.

---

## Accepted risk and policy docs

1. `src/docs/audits/csp-accepted-risk.md`
   - Rationale and review triggers for current CSP tradeoffs.

2. `src/docs/audits/raw-profile-retention-policy.md`
   - Data retention policy for Google Workspace raw profile payloads.

---

## How to use this index

1. For strategy and next actions, start with `src/docs/SECURITY-FOUNDATION-ANALYSIS.md`.
2. For detailed implementation evidence, open the relevant audit report(s).
3. For release decisions, confirm:
   - no open P1 issues,
   - required CI security gates are green,
   - accepted risks are current and explicitly reviewed.
