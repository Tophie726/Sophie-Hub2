---
name: feature-rollout-review-loop
description: Plan, review, and execute Sophie Hub feature work (non-connector) with a repeatable Codex<->Claude markdown loop, phased agent teams, validation gates, and evidence-based scorecards.
---

# Feature Rollout Review Loop

## Overview

Use this skill when feature work is larger than a quick patch and needs a repeatable planning + review loop across Codex and Claude.

This skill is for general product/backend/frontend features, not connector-specific rollout.  
For connector work, use `connector-rollout-playbook`.

## Output Location

Create one folder per feature:

- `src/docs/features/{feature-slug}/`

Required files:

- `00-context.md`
- `01-codex-proposal.md`
- `02-claude-agent-plan.md`
- `03-codex-review.md`
- `04-claude-revision.md`
- `FINAL-APPROVED-PLAN.md`

If more rounds are needed, continue `05-*`, `06-*`, etc.

## Intake (max 6 questions)

Ask only blocking questions:

1. What outcome must be true for this feature to be considered shipped?
2. What is in-scope vs explicitly out-of-scope?
3. What user/data risk is unacceptable?
4. What is the target rollout order (backend first, UI first, etc.)?
5. What validation evidence is required before merge?
6. What timeline or release constraints exist?

If unanswered, proceed with explicit assumptions in `00-context.md`.

## Workflow

1. Create `00-context.md` with goals, constraints, assumptions, and known risks.
2. Codex drafts `01-codex-proposal.md` using `references/feature-plan-template.md`.
3. Claude converts proposal into `02-claude-agent-plan.md` with team/waves/tasks.
4. Codex writes strict findings in `03-codex-review.md` (P1/P2/P3 with file-level guidance).
5. Claude addresses findings in `04-claude-revision.md`.
6. Repeat review rounds until no blocking findings remain.
7. Merge accepted plan into `FINAL-APPROVED-PLAN.md`.
8. Only then execute implementation.

## Required Deliverables

Always produce:

1. Feature plan with phase gates.
2. Agent team composition with dependencies and ownership boundaries.
3. Test/validation matrix (unit, API, integration, ops).
4. Rollout and rollback steps.
5. Risk register and mitigations.
6. Baseline and post scorecards using the same rubric.

## Score Truth Policy

Scores are not objective by default.  
A score can only be claimed if:

- baseline and post scores use the same rubric,
- each category has evidence links (tests, logs, metrics, docs),
- residual risks are listed.

Use `references/scorecard-rubric.md`.

## Default Agent Composition

Start with the minimum useful team:

- `schema-core`: migrations, invariants, data model changes
- `api-flow`: API/routes, auth, contracts, error handling
- `ui-ops`: UI behavior, operator states, a11y basics, docs parity
- `qa-review`: adversarial tests, regressions, verification artifacts

Wave order:

1. `schema-core` and `api-flow` in parallel when independent.
2. `ui-ops` after response contracts are stable.
3. `qa-review` after merge-ready implementation.

## Review Gate (must pass before "complete")

- Build, lint, and type-check status are explicit.
- Blocking findings (`P1`) are closed or accepted with documented risk owner.
- Route/schema/docs drift is resolved.
- Rollback path exists for migration/runtime changes.
- Post scorecard references measurable evidence.

## References

- `references/feature-plan-template.md`
- `references/review-loop-template.md`
- `references/claude-execution-prompt.md`
- `references/scorecard-rubric.md`
