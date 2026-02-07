# Connector Review Loop (Codex <-> Claude)

Use this loop for every new connector so planning is consistent and reviewable.

## Folder Convention

Create one folder per connector:

- `src/docs/connectors/{connector-slug}/`

Inside that folder, keep numbered files:

- `00-context.md` -- business goals, constraints, known limits
- `01-codex-proposal.md` -- first plan draft from Codex
- `02-claude-agent-plan.md` -- Claude plan mode + agent decomposition
- `03-codex-review.md` -- strict review findings and recommendations
- `04-claude-revision.md` -- Claude response and fixes to findings
- `FINAL-APPROVED-PLAN.md` -- merged final plan before implementation

If more rounds are needed, continue numbering (`05-*`, `06-*`, etc.).

### Sub-feature Convention

If a connector has distinct sub-features (for example `directory`, `calendar`, `gmail`),
create nested folders:

- `src/docs/connectors/{connector-slug}/subfeatures/{subfeature-slug}/`

Use the same numbered loop inside each subfeature folder:

- `00-context.md`
- `01-codex-proposal.md`
- `02-claude-agent-plan.md`
- `03-codex-review.md`
- `04-claude-revision.md`
- `FINAL-APPROVED-PLAN.md`

## Loop Steps

1. Codex writes `01-codex-proposal.md`.
2. Claude consumes it and writes `02-claude-agent-plan.md`.
3. Codex reviews that file and writes `03-codex-review.md`.
4. Claude addresses review and writes `04-claude-revision.md`.
5. Repeat until no blocking findings remain.
6. Publish `FINAL-APPROVED-PLAN.md`.
7. Run implementation from the approved file only.

## Required Sections For Each Round

Every planning/review file should include:

- Scope and non-goals
- Mapping model (`source`, `external_id`, internal entity, cardinality)
- Phase breakdown (mapping, sync, analytics, ops)
- Agent split and dependency waves
- Phase test gates
- Open questions and explicit assumptions
- Manual setup handoff (scopes, API keys, env vars, migrations, smoke test)

## Acceptance Criteria For `FINAL-APPROVED-PLAN.md`

- No unresolved P1/P2 findings
- Clear ownership and order of agent tasks
- Migration order is explicit and reversible
- Setup handoff is executable by someone who did not write the plan
- UI work references Emil design-engineering standards when applicable
