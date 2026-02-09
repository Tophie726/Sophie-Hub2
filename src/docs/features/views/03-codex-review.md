# Views Feature — Codex Review

Date: 2026-02-10  
Round: 03 (Review of `02-claude-agent-plan.md`)

## Findings

### P1

1. **Client-supplied `viewerContext` on runtime read path creates spoofing risk.**  
   - Reference: `src/docs/features/views/02-claude-agent-plan.md:155`
   - Why this is blocking:
     - The plan says `/api/modules/dashboards` will accept optional `viewerContext` from request input.
     - That lets request payload influence effective subject selection unless every caller path hard-disables it, which is fragile and high-risk.
   - Required fix:
     - Runtime routes must derive viewer context server-side only (auth session + signed context store).
     - Request payload must not be trusted for actor/subject identity.

2. **Resolver algorithm uses fields not present in the declared identity contract.**  
   - References:
     - Contract: `src/docs/features/views/02-claude-agent-plan.md:111`
     - Algorithm usage: `src/docs/features/views/02-claude-agent-plan.md:161`, `src/docs/features/views/02-claude-agent-plan.md:167`
   - Why this is blocking:
     - `SubjectIdentity` defines `{ type, targetId, targetLabel, resolvedRole }`, but resolver logic depends on `identity.userId` and `identity.partnerTypeSlug`.
     - This creates ambiguous implementation paths and high odds of incorrect precedence resolution.
   - Required fix:
     - Define one normalized resolver input contract with explicit optional fields (`staffId`, `roleSlug`, `partnerId`, `partnerTypeSlug`) and deterministic construction rules per subject type.
     - Update all resolver tests to match that single contract.

3. **Partner taxonomy model in plan conflicts with already-shipped canonical fields.**  
   - References:
     - New columns proposed: `src/docs/features/views/02-claude-agent-plan.md:42`
     - Mapping checks tied to new column: `src/docs/features/views/02-claude-agent-plan.md:412`
   - Why this is blocking:
     - Plan introduces `canonical_product_id`/`partner_type_raw`, while rollout already shipped persisted taxonomy fields (`computed_partner_type`, source, mismatch flags) and backfill.
     - Running both models in parallel will create dual sources of truth for billing/view resolution.
   - Required fix:
     - Rebase plan on existing persisted taxonomy fields as primary source.
     - If product FK is still needed, define explicit coexistence/deprecation path and one authoritative read field per use case.

### P2

1. **`view_audience_rules` constraints are insufficient for deterministic rule selection.**  
   - References: `src/docs/features/views/02-claude-agent-plan.md:64`, `src/docs/features/views/02-claude-agent-plan.md:66`, `src/docs/features/views/02-claude-agent-plan.md:72`
   - Risk:
     - `tier` and `target_type` can drift without a consistency check.
     - `UNIQUE(view_id, target_type, target_id)` does not enforce singleton default semantics when `target_id` is `NULL`.
   - Required fix:
     - Add DB checks tying each `target_type` to allowed `tier`.
     - Add partial unique index(es) for active default behavior and active-rule uniqueness guarantees.

2. **Rollback plan drops partner taxonomy columns without data-preservation controls.**  
   - Reference: `src/docs/features/views/02-claude-agent-plan.md:430`
   - Risk:
     - Dropping taxonomy fields after rollout risks irreversible operational/billing data loss.
   - Required fix:
     - Use a safe rollback approach: disable feature paths first, preserve columns/data, and require explicit operator migration/backout steps before destructive drops.

3. **Global route auth constraint over-scopes admin requirement.**  
   - Reference: `src/docs/features/views/02-claude-agent-plan.md:541`
   - Risk:
     - "All new API routes must use `requireRole('admin')`" conflicts with runtime audience-aware read flows that non-admin users must access.
   - Required fix:
     - Split API classes in plan:
       - Control-plane routes (`/api/admin/views*`, context mutation): admin-only.
       - Runtime read routes: `requireAuth()` + server-resolved viewer context + subject-scope filtering.

## Open Questions / Assumptions

1. Should partner-type view assignment read from `computed_partner_type` only, or permit fallback to legacy raw labels in edge cases?
2. Do we require one global active default view or one default per audience class (staff vs partner)?

## Review Summary

- Blocking findings: **3 P1**
- Non-blocking but required before approval: **3 P2**
- `FINAL-APPROVED-PLAN.md` should not advance until P1 items are resolved in `04-claude-revision.md` with explicit file-level plan changes.
