# Feature Review Loop (Non-Connector)

Use this for general Sophie Hub features that need multi-round planning/review.

For connector-specific work, use:

- `src/docs/connectors/CONNECTOR-REVIEW-LOOP.md`

## Folder Layout

Create one folder per feature:

- `src/docs/features/{feature-slug}/`

Required files:

- `00-context.md`
- `01-codex-proposal.md`
- `02-claude-agent-plan.md`
- `03-codex-review.md`
- `04-claude-revision.md`
- `FINAL-APPROVED-PLAN.md`

If additional rounds are needed, continue `05-*`, `06-*`, etc.

## Quality Gate

Do not start implementation until:

1. `FINAL-APPROVED-PLAN.md` exists.
2. `P1` findings are closed or explicitly accepted by owner.
3. Validation gates are defined (build/lint/type/tests/runtime checks).
4. Rollback path is documented.

## Scorecard Policy

Scores are valid only when baseline and post use the same rubric and include evidence.  
Use:

- `skills/feature-rollout-review-loop/references/scorecard-rubric.md`
