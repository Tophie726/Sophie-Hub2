# Claude Task: Sophie Marketplace Mini-Site Preview Redesign

Date: 2026-02-11  
Owner: Sophie Hub Product Team  
Target file: `/Users/test/Coding/Sophie-Data-Planning/sophie-hub-v2/src/app/(dashboard)/admin/products/page.tsx`

## Objective
Redesign the **Sophie Marketplace** concept modal so the "Concept" view feels like a polished, real mini-website preview inside the widget (desktop + mobile), with clean UX flow and strong visual quality.

Treat this as a self-contained design task. You can refactor within the page/component as needed.

## Product Context
This is still a **concept placeholder** (not full production feature), but the UI should clearly communicate the future product direction.

Current concept location:
- Admin product page -> Concept Products -> Sophie Marketplace card -> modal popup.

## Must-Have UX Requirements

### 1) Mini-site experience inside modal
- Concept tab should feel like a real website preview, not static blocks.
- Include a listing homepage view and a listing detail view.
- Listing cards on homepage must be clickable.
- Clicking a listing card should open a detail sub-page state.
- Include clear back navigation from detail to homepage.

### 2) Data placement
- Revenue / profit / KPI-heavy info belongs on listing detail view, not homepage.
- Homepage should be more browse-oriented (hero + listings summary + trust/value cues).

### 3) Tabs in modal
Use exactly:
- `Concept`
- `Calculator`
- `Value Proposition`

### 4) Calculator logic (keep exact)
Valuation:
- `sale_value = monthly_profit * multiple`
- Multiple range: `20x` to `45x`

Commission schedule:
- `$0` to `$66,666.66`: fixed `$10,000` minimum commission
- `$66,666.66` to `$700,000`: `15%` on total sale value
- `$700,000` to `$5,000,000`: `15%` on first `$700,000`, then `8%` above `$700,000`
- Above `$5,000,000`: `2.5%` on amount above `$5,000,000`

Sanity examples:
- `$100,000` sale -> `$15,000` commission
- `$1,000,000` sale -> `$129,000` commission
- `$5,000,000` sale -> `$449,000` commission

### 5) Value proposition update (required)
Include **Featuring: Agency Partner Listings** in Value Proposition with the following concept:
- Registered agency partners can list through platform standards.
- Partner keeps majority economics (50%+ share).
- Listings must follow Sophie data/diligence disclosure standards.
- Partner can submit diligence evidence or pay for Sophie due diligence services.

## Copy and Brand Guardrails
- Keep language original and clean (do not copy competitor wording).
- Avoid overexplaining legal/finance caveats in headline areas.
- Keep concise, premium, professional tone.

## Design Quality Bar
- Strong hierarchy and spacing.
- Smooth, intentional interactions.
- Desktop/mobile preview parity.
- Clear affordances (what is clickable, where user is in flow).
- Match existing Sophie Hub visual language.

## Non-Goals
- No backend/API work.
- No real data integration for this concept task.
- No route creation required if state-based subpage flow handles preview behavior well.

## Deliverables
1. Updated UI implementation in target file (or extracted local component files if you prefer).
2. Short summary note with:
   - What changed
   - Why those UX decisions were made
   - Any tradeoffs or unresolved design questions

## Acceptance Checklist
- [ ] Listing cards open detail sub-page state.
- [ ] KPI-heavy data appears on detail, not homepage.
- [ ] Tabs are Concept / Calculator / Value Proposition.
- [ ] Calculator uses exact tiered commission math above.
- [ ] Value Proposition includes "Featuring: Agency Partner Listings".
- [ ] UX feels like a realistic mini-site preview in modal (desktop + mobile).
- [ ] Styling quality is polished enough for internal design review.
