# Views Feature — Partner Type Rollout (Phase Delta)

Date: 2026-02-09  
Status: Rolled out to branch `codex/views` (runtime + persistence + reconciliation)

## What Shipped

1. Computed partner type resolver:
   - compares legacy `Partner type` vs staffing-derived logic
   - outputs canonical type, source, mismatch flag, shared-partner flag, and reason text
2. Partners API enrichment:
   - returns computed partner-type fields for UI and downstream billing/view logic usage
3. Partner list UI:
   - new default-visible `Partner Type` column
   - badge + tooltip with mismatch warning
4. Naming update:
   - user-facing `Pod Leader` label changed to `PPC Strategist` where relevant
   - backend assignment role/key remains `pod_leader` for compatibility
5. Persistence + reconciliation:
   - migration adds canonical partner-type columns to `partners` for billing/reporting stability
   - sync engine writes partner-type computed fields on create/update (inline during connector sync)
   - single-partner sync endpoint also writes computed fields
   - admin reconciliation endpoint added:
     - `GET /api/admin/partners/partner-type-reconciliation` (report, drift + mismatch visibility)
     - `POST /api/admin/partners/partner-type-reconciliation` (dry-run default; can persist updates)
   - nightly cron safety pass added:
     - `POST /api/cron/partner-type-reconciliation` (runs with `dry_run=false`, reconciles persisted drift)

## Canonical Mapping Active in Code

- `PPC Premium` -> `sophie_ppc` (`The Sophie PPC Partnership`)
- `Content Premium (only content)` -> `cc` (`CC`)
- `FAM` -> `fam` (`FAM`)
- `T0 / Product Incubator` -> `pli` (`PLI`)
- `TTS`/`TikTok` -> `tiktok` (`TTS`)
- `Content Subscriber` is ignored for partner-type classification.

## Validation Evidence

- Test:
  - `npm test -- computed-partner-type.test.ts`
  - result: pass (`6/6`)
- Scoped lint:
  - `npm run lint -- --file src/lib/partners/computed-partner-type.ts --file src/lib/partners/partner-type-reconciliation.ts --file src/lib/sync/engine.ts --file src/app/api/partners/[id]/sync/route.ts --file src/app/api/admin/partners/partner-type-reconciliation/route.ts --file src/app/api/cron/partner-type-reconciliation/route.ts`
  - result: pass (no warnings/errors)

## Residual Risks

1. `Conversion Strategist` still relies on source-data header extraction today.
2. Product taxonomy drift can still occur if sheet values evolve without catalog alignment.

## Next Rollout Step

1. Add admin resolution controls on partner detail page.
2. Wire billing pipelines to read canonical `computed_partner_type` directly.
