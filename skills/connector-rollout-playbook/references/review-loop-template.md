# Connector Collaboration Loop Template

For connector `{connector-slug}`, keep files in:

- `src/docs/connectors/{connector-slug}/`

## Required Files

- `00-context.md`
- `01-codex-proposal.md`
- `02-claude-agent-plan.md`
- `03-codex-review.md`
- `04-claude-revision.md`
- `FINAL-APPROVED-PLAN.md`

Add `05-*`, `06-*` etc. if more rounds are needed.

## Sub-feature Files

If the connector splits into subfeatures, use:

- `src/docs/connectors/{connector-slug}/subfeatures/{subfeature-slug}/`

Inside each subfeature folder, reuse the same required files list and round rules.

## Round Rules

1. Each round file starts with date, author, and decision summary.
2. Codex review files list findings by severity with concrete fixes.
3. Claude revision files map each finding to status: fixed/partial/deferred.
4. Open questions stay explicit; do not bury assumptions.
5. Do not start implementation until final plan is approved.

## Quality Gate For Final Plan

- Phase order and dependencies are explicit.
- Agent ownership is explicit.
- Mapping cardinality and enforcement boundaries are explicit.
- Setup handoff is complete (scopes/secrets/env/migrations/smoke test).
- Validation tests are defined per phase.
