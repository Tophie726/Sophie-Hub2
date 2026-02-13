# Master Client Staff Tabs Connector — Claude Agent Plan (Draft Seed)

Date: 2026-02-09
Round: 02 (Awaiting Claude-produced revision)

This file is seeded by Codex so the loop can start immediately.
Replace with Claude's full plan output in the next round.

## Proposed Waves

### Wave 1 (parallel): Schema + Classification

- `schema-sync`
  - Confirm `entity_external_ids` source set for master staff identity.
  - Add/adjust partial unique index for strict 1:1 identity source.
  - Introduce/extend assignment storage for row-level provenance.

- `analytics` (light)
  - Define drift counters for unresolved identities and assignment conflicts.

### Wave 2: API Integration

- `api-integration`
  - Add tab classifier route/helpers.
  - Add identity mapping CRUD + auto-match.
  - Add assignment mapping CRUD/upsert.
  - Add enrichment route with non-destructive update policy.

### Wave 3: UI + Ops

- `ui-ops`
  - Build grouped-tab mapping UX in data enrichment.
  - Add conflict review surfaces and assignment provenance visibility.
  - Add sync health widget and unresolved queue indicators.

### Wave 4: QA/Review Gate

- `qa-review`
  - Run smoke matrix (happy/failure/security-edge).
  - Verify no route/schema/docs drift.
  - Confirm rollback instructions are executable.

## Required Evidence Before FINAL Approval

- Mapping correctness sample across at least 3 tabs:
  - one single-owner role tab,
  - one multi-member tab,
  - one contractor/additional-members tab.
- Conflict and remap behavior logs.
- Enrichment idempotency evidence.
- Operator runbook evidence from non-author execution.
