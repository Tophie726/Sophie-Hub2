# Sophie Marketplace Concept Review Brief

Date: 2026-02-11  
Owner: Product UI placeholder exploration (`admin/products` modal concept)

## Goal
Review the Sophie Marketplace concept popup as a high-quality visual placeholder for a potential future product.

This is not a production workflow yet. It should clearly communicate:
- Consumer-facing brokerage experience
- Listing card -> listing detail page behavior
- Sophie-managed team and due diligence differentiators
- Valuation + commission logic in a dedicated calculator view

## Current Expectations (Product Direction)

### Navigation + Information Architecture
- Concept tab should behave like a mini website preview.
- Listing cards should be clickable and open a listing detail sub-page view.
- Revenue/profit/KPI details should appear on listing detail pages, not on the main listing homepage.
- Include a "Featuring: Agency Partner Listings" roadmap concept on the homepage view.
- Agency partner concept should communicate:
  - partner keeps majority economics (50%+)
  - listing must follow Sophie data/diligence standards
  - optional paid Sophie due diligence service

### Tabs
- Keep tabs as:
  - `Concept`
  - `Calculator`
  - `Value Proposition`

### Calculator Logic
- Valuation formula:
  - `sale value = monthly profit x multiple`
  - Multiple range is `20x` to `45x`
- Commission schedule for concept:
  - `$0` to `$66,666.66`: fixed `$10,000` minimum
  - `$66,666.66` to `$700,000`: `15%` on total value
  - `$700,000` to `$5,000,000`: `15%` on first `$700,000`, then `8%` above that
  - Above `$5,000,000`: `2.5%` above `$5,000,000`
- Example sanity check:
  - `$100,000` sale => `$15,000` commission

### Copy/Tone
- Avoid lifting external marketplace wording verbatim.
- Use neutral, original phrasing for fee schedule and value statements.

### Content To Remove
- Remove the section titled:
  - `What this prototype demonstrates`

## Review Checklist
- Does the concept preview feel like a real browsing experience?
- Is the card -> detail transition clear and intuitive?
- Is the visual hierarchy polished (spacing, typography, contrast, interaction states)?
- Is calculator math accurate across tier boundaries?
- Is language original and commercially safe?

## File Under Review
- `/Users/test/Coding/Sophie-Data-Planning/sophie-hub-v2/src/app/(dashboard)/admin/products/page.tsx`
