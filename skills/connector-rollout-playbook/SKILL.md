---
name: connector-rollout-playbook
description: Plan, review, and execute Sophie Hub data enrichment connectors with a repeatable rollout method (mapping model, sync strategy, analytics, operational readiness, and setup handoff). Use when starting a connector from scratch, refining an existing rollout plan, defining entity_external_ids mapping cardinality, or decomposing connector work into agent-team tasks for Codex or Claude.
---

# Connector Rollout Playbook

## Overview

Use this skill to make connector rollout planning near one-shot for Sophie Hub. Produce a connector plan, agent-team task graph, phase-by-phase tests, and a final setup handoff for secrets and environment configuration.

## Sophie Hub Defaults

Assume these unless the user says otherwise:

- Project patterns come from `src/docs/CONNECTOR-GUIDE.md` and `src/docs/CONNECTOR-PLAYBOOK.md`.
- External identity mappings use `entity_external_ids` with explicit `source` values.
- API routes are under `src/app/api/{connector}/...` with auth and validation.
- UI work lands in data enrichment/admin mapping flows.
- Rollout plan file is `src/docs/{CONNECTOR}-ROLLOUT-PLAN.md`.

## Intake Policy (Minimal Questions)

Ask only blocking questions first. Max 5 upfront.

1. What are the required linking points (external -> internal entities)?
2. What cardinality is required per linking point (1:1 or 1:N)?
3. Which phase is most urgent (mapping, sync, analytics, ops)?
4. What source plan limits matter (rate limits, retention, scopes)?
5. What does success look like in the first 2-4 weeks?

If answers are incomplete, proceed with explicit assumptions and mark them in the rollout plan under "Open Questions".

## Workflow

1. Capture connector scope and success criteria.
2. Design linking points and cardinality using the mapping matrix.
3. Choose implementation pattern: tabular connector or custom connector methods.
4. Build phased delivery plan (mapping, sync, analytics, ops readiness).
5. Split work into agent tasks with dependency waves.
6. Add phase-level validation checks.
7. Add setup handoff checklist (API keys/scopes/env/migrations).
8. Apply review gate before declaring complete.

## Required Outputs

Produce these outputs unless the user asks for a subset:

1. Rollout plan markdown using `references/rollout-template.md`.
2. Agent-team task split with dependencies (Wave 1/2/3).
3. Phase validation checklist with pass/fail evidence.
4. Setup handoff section with exact manual steps.
5. Claude handoff prompt using `references/claude-agent-team-prompt.md`.

## Mapping Rules

- Define each external identity link as a `source` in `entity_external_ids`.
- Explicitly state cardinality per source (`1:1` vs `1:N`).
- Enforce strict `1:1` in DB where required (partial unique indexes).
- Keep flexible `1:N` mappings in app logic when ownership can evolve.
- Document `onConflict` behavior per mutation route.

## Agent Team Composition

Use this default split unless the connector is very small:

- `schema-sync`: migrations, sync engine, state/lease/watermark correctness
- `api-integration`: endpoints, validation, auth, idempotent writes
- `analytics`: metric logic, recompute behavior, edge cases
- `ui-ops`: mapping UX, status/health indicators, documentation alignment

Execution order:

1. Start `schema-sync` and `analytics` in parallel.
2. Start `api-integration` when data contracts are stable.
3. Start `ui-ops` when API responses are stable.
4. Run strict review after merges.

## Setup Handoff Requirements

Always include a "Manual Setup Handoff" section containing:

- External app creation steps (if needed)
- Required scopes/permissions
- Required secrets and exact env var names
- Where to set each env var (local and deploy)
- Migration files to apply
- First smoke-test sequence (ordered)

## Review Gate

Do not mark complete until all are true:

- Connector-specific lint/type/build checks pass.
- Mapping/remap flows do not leave stale attribution.
- Sync logic handles restart, overlap, and pagination cap safely.
- Metrics exclude non-conversation/system noise as defined.
- Documentation exactly matches routes, methods, scopes, and migration state.
- Setup handoff is complete and executable by a non-author.

## References

- Use `references/rollout-template.md` for the connector plan skeleton.
- Use `references/claude-agent-team-prompt.md` for Claude handoff prompts.
- For deep implementation details in this repo, use `src/docs/CONNECTOR-GUIDE.md` and `src/docs/CONNECTOR-PLAYBOOK.md`.
