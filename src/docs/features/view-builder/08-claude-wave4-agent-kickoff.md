# View Builder Wave 4 Kickoff (Codex -> Claude)

Date: 2026-02-11
Round: 08
Status: READY FOR CLAUDE MULTI-AGENT EXECUTION

## Why This Wave Exists

Waves 0-3 shipped preview infrastructure, audience switching, module assignment/reorder, and hardening.
The remaining product-critical gap is direct page composition in `/admin/views/[viewId]`.

Current behavior:
- real preview rendering works,
- module-level dashboards can be edited elsewhere,
- builder itself cannot add sections or drag/resize widgets inline.

Target behavior:
- compose sections + widgets directly inside view builder preview workflow.

## Wave 4 Scope

1. In-builder section management
- Add section, rename section, reorder sections from `/admin/views/[viewId]`.
- Section list visible in left settings drawer and reflected live in preview.

2. In-builder widget composition
- Add widget to a section from builder page.
- Drag/reposition and resize widgets inline (same UX family as reporting builder).
- Persist to existing `dashboard_widgets` APIs.

3. Widget config/edit flow
- Click widget -> edit title/config in dialog (reuse existing widget config dialog where possible).
- Save updates and live-refresh preview.

4. Audience-aware safety
- Editing controls remain admin-only.
- Preview rendering remains audience-scoped and read-correct.
- No privilege escalation across partner/staff context.

## Multi-Agent Split (Recommended)

### Agent A: Composer UI + interactions
Owns:
- `/admin/views/[viewId]` composer controls,
- section/widget list UI,
- drag/resize interactions,
- toolbar/drawer integration.

### Agent B: Data + API contract adapter
Owns:
- route integrations to existing dashboard/section/widget APIs,
- optimistic updates + rollback behavior,
- live refresh bridge synchronization.

### Agent C: Preview parity + identity UX
Owns:
- preview-shell parity checks,
- audience labels/placeholder clarity,
- profile block positioning + subtle mode indicators,
- regression checks on role/partner-type rendering.

### Agent D: QA + security + docs gate
Owns:
- smoke matrix additions for section/widget composer,
- authz checks (`isTrueAdmin`, actor/subject boundaries),
- audit log coverage validation,
- update docs with final evidence.

## Non-Negotiable Constraints

1. Reuse existing dashboard widget primitives (`WidgetWrapper`, `SectionContainer`, `WidgetRenderer`) rather than rebuilding a second editor.
2. Keep `preview-session` trust model unchanged (server-only verification).
3. Keep `isTrueAdmin` gating on control-plane mutations.
4. Do not regress profile-menu See As performance (search-driven, no large eager preloads).
5. Keep tablet portrait/landscape preview controls working.

## Acceptance Criteria

- Can add section from view builder without leaving page.
- Can add widget to section from view builder.
- Can move + resize widgets inline and persist changes.
- Widget config updates are saved and visible in preview.
- Partner-type/role preview labels remain clear.
- No stuck loading shimmer in iframe path.
- Lint/type checks pass for changed files.
- New tests added for composer interactions + auth boundaries.

## Handoff Message (Send to Claude)

"Run Wave 4 for view-builder using multi-agent execution. Use `src/docs/features/view-builder/FINAL-APPROVED-PLAN.md` (refreshed status) + `src/docs/features/view-builder/08-claude-wave4-agent-kickoff.md` as the source of truth. Deliver in the existing BAM file sequence (`09-claude-agent-plan.md` then implementation evidence), with explicit ownership by 4 agents (Composer UI, Data/API adapter, Preview parity, QA/Security). Keep auth and preview trust boundaries unchanged, and prioritize in-builder section/widget composition (drag/resize/config)."
