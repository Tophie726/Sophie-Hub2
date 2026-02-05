# Health Heatmap Feature

The Health Heatmap visualizes partner status history over time in a GitHub-style contribution graph format.

## Current Features

### Core Visualization
- **156 weeks** (~3 years) of history on desktop, 52 weeks on mobile
- **Color-coded cells** by status bucket (Healthy, Onboarding, Needs Attention, Paused, Offboarding, Churned, No Data)
- **Partner names** as clickable links to partner detail pages
- **Summary row** showing aggregate health per week

### Time Headers
- Year, Quarter (with year suffix: "Q4 '24"), Month, and ISO Week Number rows
- **Click to highlight** - Click any year/quarter/month to highlight that time period
- Cells outside highlighted range fade to 20% opacity
- Click again or "Clear" button to remove highlight

### Sorting Options
- Name (A-Z)
- Highest Risk First (current status)
- Most Turbulent (frequent status changes)
- Healthiest (consistently good status)
- Most Data (partners with most recorded weeks)

### Performance Optimizations
- **Event delegation** for hover tooltips (single event listener for 80k+ cells)
- **Module-level caching** for data persistence between tab switches
- **Scroll position restoration** when returning to heatmap view
- **No transition animations** on cells for instant highlight response

---

## Planned Improvements

### High Priority

- [ ] **Year label sticky** - Make year labels stick horizontally as you scroll (complex CSS challenge, deferred)
- [x] **Shimmer animation** - Individual cells animate with diagonal wave pattern
- [x] **Year on quarters** - Quarters show year suffix (Q4 '24) so you know which year

### Medium Priority

- [ ] **Time period stats on hover** - When hovering year/quarter/month header, show quick stats:
  - % healthy weeks
  - % at-risk weeks
  - Trend direction (improving/declining/stable)
  - Number of partners with data

- [ ] **Right-click context menu** for time periods:
  - "Show summary for Q3 '25"
  - "Compare to previous quarter"
  - "Export this period's data"

### Future Ideas

- [ ] **Sentiment analysis** - Calculate overall sentiment for a time period based on status distribution
- [ ] **Anomaly detection** - Highlight weeks with unusual status patterns
- [ ] **Partner comparison** - Select multiple partners to compare side-by-side
- [ ] **Time period drill-down** - Click a cell to see that partner's detail for that specific week
- [ ] **Custom date range** - Filter to specific date ranges
- [ ] **Export heatmap** - Download as image or CSV

---

## Technical Notes

### Files
- `src/components/partners/health-heatmap.tsx` - Main component
- `src/components/ui/shimmer-grid.tsx` - HeatmapShimmer loading state
- `src/lib/status-colors.ts` - Status bucket colors and labels

### Data Flow
1. Fetches partners with `source_data` JSONB from `/api/partners`
2. Extracts weekly status columns matching pattern `M/D/YY Week N`
3. Maps to ISO week dates for consistent alignment
4. Groups by year/quarter/month for headers

### Performance Considerations
- ~280 partners × ~156 weeks = ~43,000 cells
- Use event delegation, not individual event listeners
- Avoid CSS transitions on cells (causes lag with thousands of elements)
- Cache data at module level, not component level
