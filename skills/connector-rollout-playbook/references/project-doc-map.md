# Sophie Hub Connector Doc Map

Use this map to load only the MD files needed for the current connector phase.

## Core (always read first)

- `src/docs/CONNECTOR-GUIDE.md` — connector architecture, conventions, checklists
- `src/docs/CONNECTOR-PLAYBOOK.md` — kickoff template + agent split defaults
- `src/docs/connectors/CONNECTOR-REVIEW-LOOP.md` — Codex/Claude planning-review loop

## Slack reference (read when connector has similar shape)

- `src/docs/SLACK-CONNECTOR.md` — full reference for multi-entity connector
- `src/docs/SLACK-ROLLOUT-PLAN.md` — example of phased plan + strict review iteration

Use these when the new connector needs:
- multiple linking points (staff + partner + channel/object)
- incremental sync + analytics pipeline
- operational setup handoff and runbook

## Connector-specific planning docs

For each new connector, create:

- `src/docs/connectors/{connector-slug}/00-context.md`
- `src/docs/connectors/{connector-slug}/01-codex-proposal.md`
- `src/docs/connectors/{connector-slug}/02-claude-agent-plan.md`
- `src/docs/connectors/{connector-slug}/03-codex-review.md`
- `src/docs/connectors/{connector-slug}/04-claude-revision.md`
- `src/docs/connectors/{connector-slug}/FINAL-APPROVED-PLAN.md`

## UI/design (when UI is in scope)

Apply `emil-design-engineering` skill and ensure rollout docs include UI quality checks:
- no layout shift
- touch-first interactions
- keyboard + accessibility checks
- reduced-motion support
- transition specificity (no `transition: all`)

