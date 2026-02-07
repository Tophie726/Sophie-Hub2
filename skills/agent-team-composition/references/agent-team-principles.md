# Agent Team Principles

Use these principles when deciding whether to launch a team and how to split work.

## When to Use Agent Teams

Use a team when:

- there are independent tracks that can run safely in parallel,
- the task has enough surface area to justify coordination overhead,
- you need faster turnaround without sacrificing review depth,
- context decay is likely in a long, single-thread implementation.

Avoid a team when:

- the change is tightly coupled across the same files,
- success depends on one continuous architectural decision loop,
- parallelism would mostly create merge conflicts.

## Composition Rules

- Prefer focused agents with narrow responsibilities.
- Keep ownership boundaries explicit and non-overlapping.
- Start only unblocked agents in Wave 1.
- Spin up blocked agents only after prerequisite artifacts exist.
- Shut down agents as soon as their scope is complete.

## Dependency Discipline

- Model dependencies explicitly before launch.
- Do not assign blocked tasks to active agents.
- Use wave execution for serial dependencies.
- Record handoff contracts between waves (types, routes, schema, env assumptions).

## Quality Controls

- Require each agent to produce file-level evidence.
- Run lint/type-check/tests on changed areas before handoff.
- Require a final strict review pass after merges.
- Distinguish newly introduced failures from pre-existing ones.

## Cost and Context Hygiene

- Keep team size minimal for the problem.
- Favor larger tasks per agent over micro-fragmentation.
- Reuse shared templates/checklists to reduce repeated prompting.
- Keep review notes concise, actionable, and source-linked.

## Recommended Review Cadence

1. Wave launch check: ownership + dependencies + blockers.
2. Mid-wave check: integration assumptions and risk drift.
3. End-wave check: correctness evidence and unresolved blockers.
4. Final go/no-go check: operational readiness gates.
