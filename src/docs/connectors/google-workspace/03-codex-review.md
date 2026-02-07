# Google Workspace Connector — Codex Review (Round 03)

Reviewed plan:
- `src/docs/connectors/google-workspace/02-claude-agent-plan.md`

Review standard:
- `src/docs/connectors/CONNECTOR-REVIEW-LOOP.md`

## Findings

### [P1] Secret boundary is not strict enough in connector config

- **Location:** `src/docs/connectors/google-workspace/02-claude-agent-plan.md:111`, `src/docs/connectors/google-workspace/02-claude-agent-plan.md:413`
- **Issue:** The plan puts private-key-related fields into connector config design, which risks secrets being serialized, logged, or persisted.
- **Impact:** Credential leakage risk and inconsistent secret handling across environments.
- **Required fix:** Define an explicit rule that **all Google credentials are env-only** (never persisted in connector config, DB, or client payloads). Connector config should contain only non-secret selector fields (for example, domain or mode flags).

### [P1] Alias upsert/remap strategy can incorrectly reassign staff identity

- **Location:** `src/docs/connectors/google-workspace/02-claude-agent-plan.md:77`, `src/docs/connectors/google-workspace/02-claude-agent-plan.md:79`, `src/docs/connectors/google-workspace/02-claude-agent-plan.md:324`
- **Issue:** `ON CONFLICT (source, external_id) DO UPDATE entity_id = $new` for alias rows allows silent ownership transfer of alias emails.
- **Impact:** A reused or corrected alias can auto-reassign staff linkage to the wrong person.
- **Required fix:** Treat aliases as secondary evidence only. Do not auto-transfer alias ownership across staff without a guard tied to immutable `google_workspace_user` anchor and explicit reconciliation step.

### [P2] UI routing dependency points at the wrong integration seam

- **Location:** `src/docs/connectors/google-workspace/02-claude-agent-plan.md:335`
- **Issue:** The plan says to handle `'google_workspace'` category in `SourceBrowser`, but category routing currently happens in the data enrichment page controller.
- **Impact:** Implementation drift and wasted rework in UI integration.
- **Required fix:** Update plan to route category state in the page-level controller first, then mount Google Workspace UI modules from that state.

### [P2] Deleted-user behavior is underspecified relative to API semantics

- **Location:** `src/docs/connectors/google-workspace/02-claude-agent-plan.md:116`, `src/docs/connectors/google-workspace/02-claude-agent-plan.md:170`, `src/docs/connectors/google-workspace/02-claude-agent-plan.md:230`
- **Issue:** Plan assumes deleted users are always available in list/sync flows.
- **Impact:** Historical integrity goal ("never dropped") can fail if API retention/window behavior differs.
- **Required fix:** Add explicit retention strategy: preserve historical state from prior snapshots and mark tombstones locally even when directory no longer returns the deleted account.

### [P2] Migration plan is not explicitly reversible/safe

- **Location:** `src/docs/connectors/google-workspace/02-claude-agent-plan.md:63`, `src/docs/connectors/google-workspace/02-claude-agent-plan.md:433`
- **Issue:** Index change is given as drop/create only; no rollback path or preflight duplicate checks are specified.
- **Impact:** Harder rollback during incidents and potential migration failure surprises.
- **Required fix:** Include preflight validation SQL and explicit down migration steps in the plan.

### [P3] Missing explicit non-goals section for the round

- **Location:** entire file
- **Issue:** Scope is present, but explicit non-goals are missing.
- **Impact:** Increased chance of phase creep (especially Gmail/Calendar) during implementation.
- **Suggested fix:** Add a short non-goals block (for example: "no Gmail/Calendar ingestion in Phase 1-2").

### [P3] Documentation location strategy is inconsistent

- **Location:** `src/docs/connectors/google-workspace/02-claude-agent-plan.md:269`, `src/docs/connectors/google-workspace/02-claude-agent-plan.md:270`
- **Issue:** Plan mixes root-level docs with connector-folder convention used by the review loop.
- **Impact:** Harder discoverability and inconsistent collaboration loop history.
- **Suggested fix:** Keep rollout and round documents under `src/docs/connectors/google-workspace/`; reserve root-level docs only for stable long-term references if needed.

## Open Questions For Claude Revision

1. For alias matching, should unmatched alias candidates be "suggested only" unless confirmed against immutable user ID?
2. Should we store a compact snapshot table for directory state to guarantee historical visibility independent of API deleted-user behavior?
3. Should `google_workspace_user` mappings be auto-created only for staff-confirmed matches, or should we support draft/unlinked directory records in a separate table?

## Gate Status

- **P1 blockers:** 2
- **Decision:** Not ready for `FINAL-APPROVED-PLAN.md` yet. Address P1 and P2 findings in `04-claude-revision.md`, then re-review.
