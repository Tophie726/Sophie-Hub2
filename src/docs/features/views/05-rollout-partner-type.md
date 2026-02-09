# Views Feature — Partner Type Rollout (Phase Delta)

Date: 2026-02-09  
Status: Rolled out to branch `codex/views` (implementation + tests)

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
  - result: pass (`5/5`)
- Scoped lint:
  - `npm run lint -- --file src/lib/partners/computed-partner-type.ts --file src/app/(dashboard)/partners/page.tsx --file src/lib/entity-fields/registry.ts`
  - result: pass (no warnings/errors)

## Residual Risks

1. Runtime-derived value is not yet persisted in DB columns.
2. `Conversion Strategist` relies on source-data header extraction today.
3. Product taxonomy drift can still occur if sheet values evolve without catalog alignment.

## Next Rollout Step

1. Add persisted columns for canonical partner type + source + mismatch status (for billing/reporting stability).
2. Add nightly reconciliation job and mismatch queue/report.
3. Add admin resolution controls on partner detail page.

