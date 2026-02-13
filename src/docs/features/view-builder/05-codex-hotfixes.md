# View Builder Hotfixes (Codex)

Date: 2026-02-11
Round: 05 (stability + fidelity fixes)

## Scope Fixed

1. Module assignment/load failures
- Removed fragile relation-dependent reads from `view_profile_modules`.
- Added direct module lookup by `module_id` in API handlers.
- Removed ordering by non-existent `created_at` on `view_profile_modules`.
- Result: fixes `Failed to load view builder` and `Failed to update module assignment` caused by schema mismatch.

2. Default dashboard resolution for module previews
- On module assignment, API now auto-binds `dashboard_id` to the module's newest template dashboard when one exists.
- Preview loader now also resolves a fallback dashboard when assignment has null `dashboard_id`.
- Result: module sections can render real dashboard content instead of placeholder-only blocks.

3. Preview fidelity improvements
- Preview sidebar now shows profile controls and a target-audience identity override (name/role) instead of admin controls.
- Preview badge remains subtle.
- Preview module content now renders real widgets via `WidgetRenderer` with scoped partner context when subject type is `partner`.

4. Immersive builder shell
- Main app sidebar/header are hidden for `/admin/views/[viewId]`.
- Builder now runs as full-canvas experience (`h-screen`) so admins do not confuse parent admin nav with preview nav.

## Files Changed

- `src/app/api/admin/views/[viewId]/modules/route.ts`
- `src/app/api/admin/views/[viewId]/preview-context/route.ts`
- `src/app/(preview)/preview/page.tsx`
- `src/components/views/preview-module-content.tsx`
- `src/components/views/preview-shell.tsx`
- `src/components/layout/sidebar.tsx`
- `src/components/layout/main-layout.tsx`
- `src/app/(dashboard)/admin/views/[viewId]/page.tsx`

## Validation

- `npm run lint` -> PASS
- `npm run build` -> PASS
- `npm test -- view-builder-smoke --runInBand` -> PASS (14/14)

## Remaining Product Gap (Not Implemented In This Hotfix)

- True drag/resize widget composition directly inside the view-builder preview canvas ("Amazon reporting style" editing in-place).
- Current behavior renders real widgets read-only from assigned dashboards; editing widgets remains in module dashboard builder.

## Recommended Next Wave

1. Add "Edit layout" mode in preview canvas backed by `dashboard_sections` + `dashboard_widgets` mutations.
2. Reuse `WidgetWrapper` + dnd-kit move/resize logic from reporting builder in this mode.
3. Keep preview mode read-only by default; explicit edit mode toggle to prevent accidental writes.
