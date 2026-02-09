# Views Feature — Final Approved Plan

Date: 2026-02-10  
Status: APPROVED FOR IMPLEMENTATION (BAM review loop complete as of 2026-02-10)

## Approved Scope

1. **Partner-type foundation (already shipped)**  
   - legacy vs staffing-derived comparison, mismatch visibility, persisted taxonomy fields, reconciliation.
   - evidence: `src/docs/features/views/05-rollout-partner-type.md`

2. **Views + See-As program (approved to implement)**  
   - admin-only `Admin Mode` + `See as` runtime context controls.
   - locked selector hierarchy:
     - `See as Staff` -> `Person` or `Role`
     - `See as Partner` -> `Partner` or `Partner Type`
   - `/admin/views` control-plane (views CRUD + audience assignments).
   - deterministic precedence resolver with 5 tiers.
   - audit logging + smoke evidence gates + rollback strategy.

## Source Documents (Locked Sequence)

- `src/docs/features/views/00-context.md`
- `src/docs/features/views/01-codex-proposal.md`
- `src/docs/features/views/02-claude-agent-plan.md`
- `src/docs/features/views/03-codex-review.md`
- `src/docs/features/views/04-claude-revision.md`
- `src/docs/features/views/05-rollout-partner-type.md`

## Acceptance Decision

- `03-codex-review.md` re-review confirms all prior P1/P2 findings are fixed in `04-claude-revision.md`.
- No unresolved blocking findings remain at plan stage.
- Implementation may proceed under phase/wave gates defined in `02-claude-agent-plan.md` and revised by `04-claude-revision.md`.

## Implementation Guardrails

1. Do not weaken actor-vs-subject auth boundaries: runtime context must be server-derived only.
2. Use existing authoritative partner-type field: `partners.computed_partner_type`.
3. Keep control-plane routes admin-only; runtime reads remain `requireAuth()` with self-subject for non-admins.
4. Do not mark rollout complete without smoke evidence:
   - happy path,
   - failure path,
   - security/abuse edge,
   - mapping integrity.
