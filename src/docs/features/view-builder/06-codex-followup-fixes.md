# View Builder Follow-up Fixes (Codex)

Date: 2026-02-11
Round: 06 (UX/perf corrections from manual test)

## Issues Reported

1. Profile menu "See As" was very slow to open.
2. Sidebar sometimes still looked admin after switching to partner-type context.
3. `/admin/views/[viewId]` felt forced into full-screen mode instead of normal dashboard layout.
4. Builder iframe could stay in loading shimmer state if bridge readiness message lagged.

## Implemented Fixes

### 1) Fast See-As menu (no giant preload)
- Removed eager prefetch of staff/partner lists on menu open.
- Replaced with debounced server-side search only when typing in search dialog.
- Endpoints:
  - `/api/staff?search=...&limit=25`
  - `/api/partners?search=...&limit=25`
- Result: profile popover opens immediately; network work only happens for explicit search.

File:
- `src/components/layout/admin-mode-control.tsx`

### 2) Deterministic nav role sync from server context
- Sidebar now re-reads `/api/viewer-context` and derives effective role from persisted context.
- Fixes race where initial role-fetch could overwrite impersonation state and show admin nav incorrectly.

File:
- `src/components/layout/sidebar.tsx`

### 3) Reverted forced immersive wrapper for view builder
- Restored normal dashboard chrome behavior for `/admin/views/[viewId]`.
- Fullscreen remains explicit via toolbar toggle only.

Files:
- `src/components/layout/main-layout.tsx`
- `src/app/(dashboard)/admin/views/[viewId]/page.tsx`

### 4) Iframe loading robustness
- Builder iframe now sets `previewReady` on native `onLoad` event, not only postMessage bridge.
- Prevents indefinite shimmer overlays when readiness message is delayed.

File:
- `src/app/(dashboard)/admin/views/[viewId]/page.tsx`

## Validation

- Targeted ESLint on changed files passed:
  - `admin-mode-control.tsx`
  - `sidebar.tsx`
  - `main-layout.tsx`
  - `views/[viewId]/page.tsx`

Note:
- Full workspace `npm run lint` currently fails in unrelated file:
  - `src/app/(dashboard)/admin/products/page.tsx` (`ShoppingCart` unused)
- This is pre-existing and outside this follow-up scope.

## Remaining Product Gap (explicit)

- In-preview drag/resize widget composition (Amazon-builder style) is still not implemented in this round.
- Current behavior remains: real widget rendering in preview, but editing layout remains in module dashboard builder.
