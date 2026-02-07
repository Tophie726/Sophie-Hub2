Use the connector-rollout-playbook workflow for Sophie Hub.

Inputs:
- Connector name: {CONNECTOR}
- Business goal: {GOAL}
- Linking points: {LINKS}
- Cardinality expectations: {CARDINALITY}
- Scale estimate: {SCALE}
- Priority phase: {PRIORITY}

Execution rules:
1. Ask at most 5 blocking intake questions. If unanswered, proceed with explicit assumptions.
2. Read `skills/connector-rollout-playbook/references/project-doc-map.md` and load only relevant project MDs.
3. Create or update `src/docs/{CONNECTOR}-ROLLOUT-PLAN.md` using the rollout template.
4. Create connector loop folder `src/docs/connectors/{connector-slug}/` and maintain numbered round files.
5. Propose an agent team split with wave dependencies.
6. Implement in phases, validating each phase before moving on.
7. Keep a delivery log in the rollout plan with files changed and decisions.
8. If any UI/frontend work is in scope, apply the `emil-design-engineering` skill and include its checklist in validation.

Required deliverables:
- Mapping model with explicit `source` values and DB/app enforcement boundaries.
- Phase-by-phase tests and pass/fail evidence.
- Manual setup handoff section (scopes, API keys/secrets, env vars, migrations, first smoke test).
- UI quality checklist and findings when UI is in scope (layout shift, touch/hover behavior, a11y, reduced motion, transition specificity).
- Numbered Codex/Claude loop files plus `FINAL-APPROVED-PLAN.md` in `src/docs/connectors/{connector-slug}/`.
- Final go/no-go checklist and unresolved questions.

Quality bar:
- No undocumented route/schema drift.
- No mapping/remap stale attribution bugs.
- Sync logic safe for overlap/restart/page-cap scenarios.
- Analytics filters exclude system/non-conversation events as defined.
