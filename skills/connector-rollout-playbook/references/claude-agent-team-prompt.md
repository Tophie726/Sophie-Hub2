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
2. Create or update `src/docs/{CONNECTOR}-ROLLOUT-PLAN.md` using the rollout template.
3. Propose an agent team split with wave dependencies.
4. Implement in phases, validating each phase before moving on.
5. Keep a delivery log in the rollout plan with files changed and decisions.

Required deliverables:
- Mapping model with explicit `source` values and DB/app enforcement boundaries.
- Phase-by-phase tests and pass/fail evidence.
- Manual setup handoff section (scopes, API keys/secrets, env vars, migrations, first smoke test).
- Final go/no-go checklist and unresolved questions.

Quality bar:
- No undocumented route/schema drift.
- No mapping/remap stale attribution bugs.
- Sync logic safe for overlap/restart/page-cap scenarios.
- Analytics filters exclude system/non-conversation events as defined.
