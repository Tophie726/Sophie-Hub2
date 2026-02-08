# Feature Review Loop (Non-Connector)

Use this for general Sophie Hub features that need multi-round planning/review.

For connector-specific work, use:

- `src/docs/connectors/CONNECTOR-REVIEW-LOOP.md`

Shortcut alias:

- Say `BAM` and use `skills/bam-loop/SKILL.md` to trigger this loop quickly.

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

## Local Skill Sync (Codex + Claude)

To install/update local Sophie Hub skills into both runtimes:

```bash
cd /Users/test/Coding/Sophie-Data-Planning/sophie-hub-v2
scripts/sync-local-skills.sh --target both
```

Dry run first:

```bash
scripts/sync-local-skills.sh --target both --dry-run
```

Sync only specific skills:

```bash
scripts/sync-local-skills.sh --target both --skills bam-loop,feature-rollout-review-loop
```

Then restart Codex/Claude so updated skills are picked up.
