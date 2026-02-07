# Connector Playbook (Reusable Kickoff Template)

Use this file when starting any new connector so you do not need to re-explain context.

For full implementation details, see:
- `src/docs/CONNECTOR-GUIDE.md` (architecture and coding patterns)
- `src/docs/SLACK-CONNECTOR.md` (reference for multi-entity connector design)

---

## 1. How To Use This

1. Copy the template in Section 2 into a new rollout doc: `src/docs/{CONNECTOR}-ROLLOUT-PLAN.md`.
2. Fill in only the connector-specific fields.
3. Use Section 5 to split work into agent tasks.
4. Keep this playbook unchanged; update only your connector rollout file.

---

## 2. Connector Kickoff Template

```md
# {ConnectorName} Connector Rollout Plan

## A) Business Goal
- Why this connector exists:
- What decisions/metrics it should unlock:
- What "success" looks like in 2-4 weeks:

## B) Source Model
- External system: {e.g., Slack, HubSpot, Close, Notion}
- Auth model: {bot token / OAuth / API key / service account}
- Plan limits known: {API tiers, retention windows, scope limits}
- Pull style: {incremental, full snapshot, hybrid}

## C) Linking Points (Identity Graph)
- Linking point 1: {external field} -> {internal entity + key}
- Linking point 2: {external field} -> {internal entity + key}
- Linking point 3: {external field} -> {internal entity + key}

## D) Mapping Rules + Cardinality
- Source key: {source value in entity_external_ids}
- Cardinality: {1:1 or 1:N}
- DB-enforced? {yes/no}
- onConflict strategy:
- Required metadata fields:

## E) Phase Plan
- Phase 1 (Connection + Mapping):
- Phase 2 (Sync Engine):
- Phase 3 (Analytics/Derivations):
- Phase 4 (Operational Readiness):

## F) Risks
- Risk 1 + mitigation:
- Risk 2 + mitigation:
- Risk 3 + mitigation:

## G) Open Questions
- Q1:
- Q2:
- Q3:
```

---

## 3. Mapping Design Matrix (Fill Per Connector)

Use this to avoid ambiguity on "what maps to what".

| Mapping Purpose | `source` | External ID | Internal Entity | Cardinality | Enforced In |
|---|---|---|---|---|---|
| Primary business link | `{source_a}` | `{external id}` | `{partners/staff/...}` | `{1:1 or 1:N}` | `{DB partial unique / app}` |
| Secondary link | `{source_b}` | `{external id}` | `{entity}` | `{1:1 or 1:N}` | `{DB/app}` |
| Tertiary link | `{source_c}` | `{external id}` | `{entity}` | `{1:1 or 1:N}` | `{DB/app}` |

Rule of thumb:
- Use DB constraints for invariants that must never drift (true 1:1).
- Use app logic for flexible mappings (1:N, evolving ownership).

---

## 4. Phase Blueprint (Standard)

### Phase 1: Connection + Mapping
- Connector type/config + registration
- External API client + rate limits + pagination
- Mapping endpoints (manual + auto-match)
- Mapping UI (filters, confidence, conflict-safe saves)

### Phase 2: Sync Engine
- Sync state table(s) + idempotent upsert model
- Backfill + incremental watermarks
- Retry + lease/lock + crash recovery
- Chunking model for scale (cron/background worker)

### Phase 3: Analytics
- Derived table(s) + algorithm versioning
- Recompute API + scheduled compute
- Edge-case matrix (threads, edits, bots, deletes, no-reply)
- Query endpoints for UI cards/charts/tables

### Phase 4: Operational Readiness
- App setup checklist (scopes/env vars)
- Integration smoke tests against live source
- Go/no-go criteria
- Monitoring + retry SOP + stale-run alerts

---

## 5. Agent Team Composition Template

Use this split unless the connector is very small:

| Agent | Owns | Typical Tasks |
|---|---|---|
| `schema-sync` | DB + sync core | migrations, sync state, watermark/lease logic |
| `api-integration` | API routes + validation | test-connection, mappings, sync/analytics endpoints |
| `analytics` | metric correctness | algorithm, edge cases, recompute jobs |
| `ui-ops` | admin UX + observability | mapping UI, status views, error states, docs alignment |

Wave sequencing:
1. `schema-sync` + `analytics` start first.
2. `api-integration` starts once schemas/core contracts are stable.
3. `ui-ops` starts once API shapes are stable.
4. Final strict review pass across all phases.

---

## 6. "Ready For Review" Gate

Do not mark complete until all are true:
- Lint clean for connector files
- Build compiles
- Sync engine tested for restart/overlap/page-cap edge cases
- Mapping remap paths validated (no stale attribution)
- Docs reflect actual routes/methods/scopes (no drift)
- Rollout plan includes open questions and explicit follow-ups

---

## 7. Fast-Start Prompt (Copy/Paste)

Use this to start a new connector quickly with Claude or Codex:

```md
Use `src/docs/CONNECTOR-PLAYBOOK.md` and `src/docs/CONNECTOR-GUIDE.md`.
Create `src/docs/{CONNECTOR}-ROLLOUT-PLAN.md` using the kickoff template.

Context:
- Business goal: {goal}
- External system: {system}
- Linking points: {list}
- Cardinality expectations: {1:1 / 1:N}
- Scale expectations: {records/channels/users}
- First phase priority: {mapping vs sync vs analytics}

Then propose:
1) phase plan,
2) schema/mapping model,
3) agent-team split with task dependencies,
4) top risks and required validation gates.
```

