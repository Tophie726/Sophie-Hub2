# {ConnectorName} Connector Rollout Plan

## A) Business Goal
- Why this connector exists:
- Decisions/metrics this should unlock:
- Success in the next 2-4 weeks:

## B) Source Model
- External system:
- Authentication model:
- Plan/tier constraints:
- Data pull mode: incremental / snapshot / hybrid

## C) Linking Points (Identity Graph)
- Link 1: {external field} -> {internal entity + key}
- Link 2: {external field} -> {internal entity + key}
- Link 3: {external field} -> {internal entity + key}

## D) Mapping Rules + Cardinality
| Mapping Purpose | source | External ID | Internal Entity | Cardinality | Enforced In |
|---|---|---|---|---|---|
| Primary | {source_a} | {id} | {entity} | {1:1/1:N} | {DB/app} |
| Secondary | {source_b} | {id} | {entity} | {1:1/1:N} | {DB/app} |
| Tertiary | {source_c} | {id} | {entity} | {1:1/1:N} | {DB/app} |

- onConflict strategy:
- Required metadata per mapping:

## E) Delivery Phases
### Phase 1: Connection + Mapping
- Scope:
- Deliverables:
- Validation tests:

### Phase 2: Sync Engine
- Scope:
- Deliverables:
- Validation tests:

### Phase 3: Analytics
- Scope:
- Deliverables:
- Validation tests:

### Phase 4: Operational Readiness
- Scope:
- Deliverables:
- Validation tests:

## F) Agent-Team Plan
### Wave 1
- Agent:
- Tasks:
- Blocks/unblocks:

### Wave 2
- Agent:
- Tasks:
- Blocks/unblocks:

### Wave 3
- Agent:
- Tasks:
- Blocks/unblocks:

## G) Risks + Mitigations
- Risk 1:
- Risk 2:
- Risk 3:

## H) Manual Setup Handoff (Owner Actions)
- External app creation:
- Required permissions/scopes:
- Secrets/env vars (`.env.local` + deployment):
- Migration files to apply:
- First smoke-test sequence:

## I) Operational Go/No-Go
- [ ] Auth and connection test pass
- [ ] Mappings validated (manual + auto-match)
- [ ] Sync completes with safe resume behavior
- [ ] Metrics spot-checked against raw source samples
- [ ] Logs/alerts in place for stuck runs and repeated failures

## J) Open Questions and Assumptions
- Q1:
- Q2:
- Q3:
- Assumptions made:
