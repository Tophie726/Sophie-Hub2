# Views Feature — Staff Grid Parity (Phase Epsilon)

Date: 2026-02-11  
Status: Rolled out in current branch (UI + API + schema migration)

## What Shipped

1. Sticky table behavior parity (`/staff`, `/partners`)
   - Sticky first column remains locked during horizontal scroll.
   - Header row remains sticky without data rows visually jumping above headers.
2. Staff list controls parity with Partners
   - Column picker (show/hide + reorder).
   - Source lineage tooltip for mapped sheet fields.
   - Dynamic source-data columns from `source_data.gsheets`.
3. Staff lifecycle operations from list view
   - Row actions now support primary lifecycle status updates.
   - Row actions now support secondary status tags (multi-select).
   - Staff type filter (`All`, `Staff`, `Contractor`) and inactivity filter (`>30 days`) remain available.
4. Staff lifecycle data model extension
   - Added `staff.status_tags` (`TEXT[]`) via migration.
   - `GET /api/staff` returns normalized `status_tags`.
   - `PATCH /api/staff/:id` accepts and persists `status_tags`.

## Files Added/Updated

- `supabase/migrations/20260218_staff_status_tags.sql`
- `src/app/(dashboard)/staff/page.tsx`
- `src/app/(dashboard)/partners/page.tsx`
- `src/app/api/staff/route.ts`
- `src/app/api/staff/[id]/route.ts`
- `src/app/(dashboard)/staff/[id]/page.tsx`
- `src/components/entities/status-badge.tsx`
- `src/types/entities.ts`

## Validation

- Scoped lint passed for touched files (staff/partners pages, staff APIs, shared entity/status components).

## Residual Risks

1. Existing DB-level `staff.status` constraints (if present in deployed environments) must include new lifecycle values before operators use them broadly.
2. Existing users with previously saved local column preferences may need one refresh to pick up updated defaults.

## Next Step

1. Add bulk lifecycle operations (multi-row update) with audit entries for HR/admin workflows.
