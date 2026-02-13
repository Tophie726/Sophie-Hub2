# View Builder UX Polish (Codex)

Date: 2026-02-11
Round: 07 (manual-test UX adjustments)

## Addressed Feedback

1. Preview profile block appeared to float above the bottom.
2. Preview identity needed clearer audience-type labeling.
3. No obvious way in builder to add sections or edit/move widgets.

## Changes

### 1) Bottom profile positioning
- Removed safe-area bottom padding in preview-sidebar mode so the profile card sits flush at the bottom.
- Safe-area padding remains enabled for standard app sidebar behavior.

File:
- `src/components/layout/sidebar.tsx`

### 2) Clear audience-type placeholder/label
- Partner-type previews now show role label `Partner Type` instead of generic `Partner`.
- Role-based template previews now show role label `Role Template`.

File:
- `src/app/(preview)/preview/page.tsx`

### 3) Section/widget editing entry points from builder
- Added a new "Section + Widget Tools" block in the settings drawer under Module Order.
- Per module:
  - `Edit Widgets` (opens `/admin/modules/[slug]/[dashboardId]`)
  - `Add Section` (POST to `/api/modules/dashboards/[dashboardId]/sections`)
- Added success/error feedback for section creation.

File:
- `src/components/views/settings-drawer.tsx`

## Validation

- Targeted ESLint pass on changed files.

## Explicit Scope Note

- This does **not** yet provide in-preview drag/resize widget composition on `/admin/views/[viewId]`.
- It adds direct controls so you can quickly edit widgets/sections in the module dashboard builder today.
