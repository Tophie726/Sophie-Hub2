---
name: agent-team-composition
description: Design and review multi-agent execution plans for Claude/Codex coding work. Use when breaking a feature, bugfix, migration, QA sweep, or operational rollout into parallel agent tasks with dependencies, ownership boundaries, and verification gates.
---

# Agent Team Composition

## Quick Start

1. Define the exact deliverable and go/no-go criteria.
2. Split the work into independent tracks.
3. Assign the smallest useful set of specialized agents.
4. Sequence blocked work into waves.
5. Require explicit verification artifacts before declaring complete.

For decision heuristics, read `references/agent-team-principles.md`.

## Choose Team Size

Use the minimum set that keeps critical paths parallel:

- `1 agent`: single-file or tightly coupled change.
- `2 agents`: implementation + validation/review.
- `3 agents`: backend/data + API/integration + docs/QA.
- `4 agents`: schema/sync + analytics + API/cron + UI/ops.
- `5+ agents`: only when ownership boundaries are strict and merge risk is low.

## Partition Work

Slice by ownership boundary, not by arbitrary file count:

- Data/schema: migrations, constraints, indexes, state models.
- Engine/core logic: sync, analytics, calculation rules, retries.
- API/integration: routes, auth, cron handlers, request/response contracts.
- UI/ops: operator status, error surfacing, run controls, lag/stall indicators.
- QA/review: edge-case tests, correctness checks, regression checks.

Avoid assigning multiple agents to the same primary file in the same wave.

## Build the Plan

Produce these sections in order:

1. Goal and constraints.
2. Team composition table.
3. Task matrix (task, owner, depends on, output files).
4. Dependency graph and wave plan.
5. Risk register with explicit mitigations.
6. Verification checklist and pass/fail gates.
7. Handoff note for review.

## Required Output Template

Use this structure exactly when proposing an agent team:

```md
## Agent Team Plan

### Goal
- ...

### Team
| Agent | Scope | Owns | Blocked By |
|---|---|---|---|

### Tasks
| ID | Task | Owner | Depends On | Output |
|---|---|---|---|---|

### Waves
- Wave 1: ...
- Wave 2: ...
- Wave 3: ...

### Risks
- [P1] ... mitigation ...
- [P2] ... mitigation ...

### Verification Gates
- [ ] Lint/type-check status
- [ ] Critical path tests
- [ ] Runtime/cron checks
- [ ] Docs updated

### Handoff Message
- Paste-ready summary for reviewer
```

## Operational Readiness Pattern (Sophie Slack)

When phase code is complete but not production-ready, use this 4-agent composition:

- `ops-setup`: migrations, env vars, first run execution.
- `sync-qa`: sync correctness, lease/conflict/page-cap recovery.
- `analytics-qa`: response-time correctness on sampled channels.
- `ui-ops`: operational visibility (errors, stalled runs, lag).

Do not start QA agents that require live data before setup/env/migrations are complete.

## Review-First Guardrails

- Require absolute file references for every critical finding.
- Keep findings ordered by severity (`P1` to `P3`).
- Confirm whether failures are pre-existing vs introduced.
- Do not mark complete if a blocking gate fails.
- Update the rollout plan/doc with a dated review delta section.
