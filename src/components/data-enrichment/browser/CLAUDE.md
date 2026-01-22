# Data Enrichment Browser Components

This directory contains the browser-style UI for navigating and mapping data sources in Sophie Hub.

## Architecture

```
SourceBrowser
├── SourceTabBar (source-level tabs)
├── SheetTabBar (tab-level navigation with Overview)
│   ├── Overview tab (first, always visible)
│   └── Regular sheet tabs
└── Content Area
    ├── TabOverviewDashboard (when Overview selected)
    │   ├── TabCard (grid view)
    │   └── TabListRow (list view)
    └── SmartMapper (when specific tab selected)
```

## Key Components

### SheetTabBar
Renders tabs for navigating between sheet tabs within a source. Features:
- **Overview tab** (`OVERVIEW_TAB_ID = '__overview__'`): Always first, shows dashboard
- Only shows **active** and **reference** tabs - keeps the bar clean
- Flagged and hidden tabs are only accessible from Overview dashboard
- Status dropdown (Active, Reference, Flagged, Hidden) for changing tab status

### TabOverviewDashboard
Per-source dashboard showing all tabs at a glance. Features:
- Grid/List view toggle (persisted in state)
- Overall progress bar (calculated from all tab stats)
- Tab cards/rows showing: entity type, progress, category breakdown, last edit
- Hidden tabs toggle (only place to access hidden tabs)
- Flagged tabs collapsible section (subtle styling, only place to access flagged tabs)

### TabCard
Card component for grid view. Shows:
- Entity color dot (blue=partners, green=staff, orange=asins)
- Tab name and status icons
- Progress bar with percentage
- Category breakdown badges
- Header status indicator
- Relative timestamp for last edit

### TabListRow
Table row component for list view. Same data as TabCard in compact format.

## Data Flow

1. **Source Selection**: User selects a source → defaults to Overview tab
2. **Overview Dashboard**: Shows all tabs with real stats from database
3. **Tab Selection**: User clicks a tab → SmartMapper loads for that tab
4. **Back Navigation**: SmartMapper's "Back" returns to Overview

## API Integration

### GET /api/data-sources
Returns sources with per-tab stats:
```typescript
{
  sources: [{
    tabs: [{
      id, tab_name, primary_entity, header_row,
      columnCount, categoryStats, status, notes, updated_at
    }]
  }]
}
```

### GET /api/sheets/raw-rows
Returns header detection with confidence:
```typescript
{
  rows, totalRows,
  detectedHeaderRow,
  headerConfidence,  // 0-100
  headerReasons      // Human-readable explanations
}
```

## Header Detection Confidence

The `detectHeaderRow()` function in `src/lib/google/sheets.ts` scores rows based on:
- Header keyword matching (+15 pts each, capped at 45)
- Uniqueness of values (+20 pts)
- All-text content (+15 pts)
- Position bonus (+10 pts row 0, +5 pts row 1)
- Type diversity from next row (+15 pts)

**UI Behavior:**
- Always shows full table view for transparency
- Auto-scrolls to detected header row on mount (smooth scroll to center)
- Shows confidence as subtle hint text below header
- User can click any row to select as header

## Animation Specs

All animations use `ease-out` curve: `[0.22, 1, 0.36, 1]`

| Element | Duration | Effect |
|---------|----------|--------|
| Tab switch | 200ms | opacity fade |
| Card hover | 200ms | scale(1.02), y: -2 |
| Card click | 150ms | scale(0.98) |
| Card stagger | 300ms + 50ms delay | y: 10 → 0 |
| Progress bar | 300ms | width fill |
| View toggle | 200ms | opacity crossfade |
| Collapsible | 200ms | height expand |

## Constants

```typescript
export const OVERVIEW_TAB_ID = '__overview__'
const HIGH_CONFIDENCE_THRESHOLD = 80
```

## Critical Constraint

**NO FAKE DATA**: All stats displayed must come from database queries via the API. The dashboard is a window into the database, not static UI. Progress percentages, category counts, and timestamps are all derived from actual `column_mappings` and `tab_mappings` records.
