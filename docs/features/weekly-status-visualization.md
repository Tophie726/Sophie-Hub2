# Weekly Status Visualization

## Overview

A visual "uptime bar" style indicator showing partner health over time. Inspired by server status pages (e.g., GitHub status, AWS status), this feature provides at-a-glance health history for each partner.

---

## User Stories

1. **As an ops manager**, I want to see a quick visual of each partner's recent health so I can identify at-risk accounts without clicking into each one.

2. **As a pod leader**, I want to see the weekly status history of my assigned partners so I can track trends and address issues early.

3. **As leadership**, I want a dashboard view of overall account health across all partners.

---

## Design Requirements

### Visual Language

- **Inspired by**: Server uptime bars (Statuspage, GitHub Status)
- **Aesthetic**: Minimal, clean, fits Sophie Hub's dark theme
- **Emil-approved**: Smooth rounded blocks, subtle shadows, appropriate spacing

### Status Colors

| Status | Color | Description |
|--------|-------|-------------|
| Active/Healthy | `green-500` | Partner is in good standing |
| Subscribed | `green-500` | Same as active |
| Onboarding | `blue-500` | New partner being onboarded |
| At Risk | `amber-500` | Needs attention |
| Paused | `gray-400` | Temporarily paused |
| Offboarding | `orange-500` | In process of leaving |
| Churned | `red-500` | Left/cancelled |
| No Data | `gray-600` | No status recorded for that week |

---

## Implementation Phases

### Phase 1: Mini Preview Column (Partners List)

**Goal**: Add a "Weekly" column to the partners list showing last 8 weeks as tiny colored blocks.

**Components**:
```
WeeklyStatusPreview
├── 8 small blocks (4px x 12px each)
├── Tooltip on hover showing week date + status
└── Click opens full weekly view
```

**Data Requirements**:
- Fetch last 8 weeks of `weekly_statuses` for each partner in the list
- Batch query to avoid N+1 (similar to pod_leader fetch pattern)

**API Changes**:
- Extend `GET /api/partners` to optionally include `recent_statuses` (last 8 weeks)
- New query param: `?include=weekly_preview`

### Phase 2: Partner Detail - Weekly Status Tab

**Goal**: Full weekly status history on the partner detail page.

**Components**:
```
WeeklyStatusTab
├── TimeRangeSelector (YTD, 3 months, 6 months, 1 year)
├── WeeklyStatusGrid
│   ├── Month labels
│   └── Week blocks (larger than preview, ~12px x 20px)
├── StatusLegend
└── WeeklyStatusTable (optional detailed view)
```

**Features**:
- Year-to-date by default
- Hover shows: Week of [date], Status: [status], Notes: [notes if any]
- Click on block shows detail popover with notes
- Toggle between visual grid and table view

### Phase 3: Dashboard Health Overview

**Goal**: Aggregate view of all partner health.

**Components**:
```
HealthDashboard
├── HealthSummaryCards
│   ├── "X partners healthy"
│   ├── "Y partners at risk"
│   └── "Z partners churned this month"
├── TrendChart (line graph of healthy vs at-risk over time)
└── AtRiskList (partners needing attention)
```

---

## Technical Details

### Database Schema (existing)

```sql
-- weekly_statuses table already exists
CREATE TABLE weekly_statuses (
  id UUID PRIMARY KEY,
  partner_id UUID REFERENCES partners(id),
  week_start_date DATE NOT NULL,
  status TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  UNIQUE(partner_id, week_start_date)
);
```

### Data Flow

1. **Sync**: Weekly columns from Google Sheets are parsed and stored in `weekly_statuses`
2. **API**: Fetch aggregates weekly data for display
3. **UI**: Renders colored blocks based on status

### Sync Engine Changes

The sync engine needs to:
1. Detect weekly columns (already have `isWeeklyColumn()` function)
2. Parse the date from column header (e.g., "1/5/26\nWeek 2" → 2026-01-05)
3. Insert/update `weekly_statuses` table instead of `source_data`

---

## Component Specifications

### WeeklyStatusPreview (Phase 1)

```tsx
interface WeeklyStatusPreviewProps {
  statuses: { week: string; status: string }[] // Last 8 weeks
  onExpand?: () => void
}

// Renders 8 small colored blocks in a row
// Tooltip on hover
// Optional click handler to expand
```

**Dimensions**:
- Block: 4px wide × 12px tall
- Gap: 2px between blocks
- Total width: ~50px

### WeeklyStatusBlock

```tsx
interface WeeklyStatusBlockProps {
  status: string
  date: string
  notes?: string
  size: 'sm' | 'md' | 'lg'
}

// Single status block with appropriate styling
// Size variants for different contexts
```

---

## Open Questions

1. **Week boundaries**: Do weeks start Sunday or Monday? (Need to match Google Sheet convention)

2. **Missing data**: How to handle weeks with no status? Show empty/gray or skip?

3. **Status normalization**: Current sheet has various status values - need mapping:
   - "Subscribed" → active
   - "Waiting To Be Onboarded" → onboarding
   - "Churn" → churned
   - etc.

4. **Historical data**: How far back should we display? Options:
   - Fixed: Always show 52 weeks (1 year)
   - Dynamic: Show all available data
   - Selectable: Let user choose range

---

## Next Steps

1. [ ] Confirm status color mapping with design/leadership
2. [ ] Implement Phase 1: WeeklyStatusPreview component
3. [ ] Update Partners API to include weekly preview data
4. [ ] Add "Weekly" column to partners list
5. [ ] Test with real data
6. [ ] Phase 2: Partner detail weekly tab
7. [ ] Phase 3: Dashboard health overview
