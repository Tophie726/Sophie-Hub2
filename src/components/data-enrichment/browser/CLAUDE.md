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

## Critical Principle: Visual Consistency

**All views must show the same data the same way.** The header status indicator appears in three places:
- SheetTabBar (tab-level navigation)
- TabCard (grid view in Overview)
- TabListRow (list view in Overview)

All three MUST use the same visual language. When adding or changing an indicator, update ALL locations together.

## Header Status Indicator (Universal)

The header status dot is shown consistently everywhere:

| State | Dot Color | Meaning |
|-------|-----------|---------|
| No headers | Grey (`bg-muted-foreground/30`) | No header row identified |
| Auto-detected | Orange (`bg-orange-500`) | System detected header, awaiting confirmation |
| Confirmed | Green (`bg-green-500`) | User confirmed the header row |
| 100% Mapped | Green checkmark | All columns have been classified |

**Progress Ring** (SheetTabBar only):
- Confirmed tabs show a green progress ring around the dot
- Ring fills clockwise as columns are mapped (0-100%)
- At 100%, the dot is replaced with a checkmark icon

## Key Components

### SheetTabBar
Renders tabs for navigating between sheet tabs within a source. Features:
- **Overview tab** (`OVERVIEW_TAB_ID = '__overview__'`): Always first, shows dashboard
- Only shows **active** and **reference** tabs - keeps the bar clean
- Flagged and hidden tabs are only accessible from Overview dashboard
- Status dropdown (Active, Reference, Flagged, Hidden) for changing tab status
- **Header status dot** with progress ring for confirmed tabs

### TabOverviewDashboard
Per-source dashboard showing all tabs at a glance. Features:
- Grid/List view toggle (persisted in state)
- Overall progress bar (calculated from all tab stats)
- Tab cards/rows showing: header status, progress, category breakdown, last edit
- Hidden tabs toggle (only place to access hidden tabs)
- Flagged tabs collapsible section (subtle styling, only place to access flagged tabs)

### TabCard
Card component for grid view. Shows:
- **Header status dot** (grey/orange/green) - NOT entity color
- Tab name and status icons (flag, hidden)
- Progress bar with percentage
- Category breakdown badges (partner/staff/asin counts)
- Footer with header status text + last edited time

### TabListRow
Table row component for list view. Same data as TabCard in compact format:
- **Header status dot** (grey/orange/green) - NOT entity color
- Tab name
- Header status column (text: "Confirmed", "Auto", or "–")
- Progress bar
- Category badges

## Data Flow

1. **Source Selection**: User selects a source → defaults to Overview tab
2. **Overview Dashboard**: Shows all tabs with real stats from database
3. **Tab Selection**: User clicks a tab → SmartMapper loads for that tab
4. **Header Confirmation**: User confirms header → `onHeaderConfirmed` callback updates parent state
5. **Back Navigation**: SmartMapper's "Back" returns to Overview

### State Update on Header Confirmation

When user confirms a header in SmartMapper:
1. SmartMapper calls `POST /api/tab-mappings/confirm-header`
2. SmartMapper calls `onHeaderConfirmed()` callback
3. SourceBrowser updates local `sources` state to set `header_confirmed: true`
4. Tab bar and cards immediately reflect the change (orange → green)

This avoids requiring a full page refresh to see updated status.

## API Integration

### GET /api/data-sources
Returns sources with per-tab stats:
```typescript
{
  sources: [{
    tabs: [{
      id, tab_name, primary_entity, header_row,
      header_confirmed,  // Boolean - user confirmed header
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

### POST /api/tab-mappings/confirm-header
Confirms the header row selection:
```typescript
// Request
{ data_source_id, tab_name, header_row }
// Sets header_confirmed = true in database
```

## Header Detection & Confirmation

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

### Lock Animation

When user clicks "Confirm Header":
1. Animated lock icon appears over the table (shackle closes)
2. Uses `easeOutBack` curve for satisfying bounce
3. "Header Confirmed" text fades in after lock animation
4. Auto-dismisses after ~800ms
5. Tab indicator updates from orange to green

## Animation Philosophy

**No animations on page load.** Use `initial={false}` on motion components to prevent entrance animations when the page renders. Only animate on **state changes** (e.g., when header status changes from auto to confirmed).

```typescript
// GOOD - no animation on mount, only on state change
<motion.div
  initial={false}
  animate={{ scale: 1, opacity: 1 }}
  exit={{ scale: 0.8, opacity: 0 }}
  transition={{ duration: 0.15, ease: easeOut }}
/>

// BAD - animates every time component mounts (flickery on page load)
<motion.div
  initial={{ scale: 0, opacity: 0 }}
  animate={{ scale: 1, opacity: 1 }}
/>
```

### Animation Specs

All animations use `ease-out` curve from `@/lib/animations`: `[0.22, 1, 0.36, 1]`

| Element | Duration | Effect |
|---------|----------|--------|
| Tab switch | 400ms | Sliding background via `layoutId` (spring) |
| Card hover | 200ms | scale(1.02), y: -2 |
| Card click | 150ms | scale(0.98) |
| Progress ring | 400ms | strokeDashoffset change |
| State transitions | 150-200ms | opacity + scale |
| Lock animation | 350ms | scale + rotate with easeOutBack |
| Action sheet | 300ms | y: 100% → 0 |

### Tab Sliding Indicator

SheetTabBar uses a **sliding background pill** that moves between tabs:

```tsx
{isActive && (
  <motion.div
    layoutId="activeSheetTab"
    className="absolute inset-0 bg-background shadow-md rounded-lg ring-1 ring-border/50"
    transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
  />
)}
```

This matches the sidebar's navigation pattern for visual consistency.

## Mobile Long-Press Action Sheet

TabCard and TabListRow support **long-press to reveal actions** on mobile:

**Interaction Pattern:**
- **Long-press (500ms)**: Opens bottom action sheet with haptic feedback
- **Short tap**: Navigates to the tab
- **Touch move**: Cancels long-press (allows scrolling)
- **Right-click (desktop)**: Opens same action sheet

**Action Sheet Features:**
- iOS-style bottom sheet with drag handle
- 44px minimum touch targets (per design guidelines)
- Full-width action buttons: Open, Flag/Unflag, Hide/Unhide
- Cancel button with muted background
- Safe area padding for devices with home indicator

## Field Tags (Domain Classification)

SmartMapper's ClassifyPhase supports **field tags** for cross-cutting domain classification:

- Tags: Finance, Operations, Contact, HR, Product
- Orthogonal to entity types (a Partner field AND a Staff field can both be "Finance")
- Multi-select dropdown in each entity column row
- Tags saved to `column_mapping_tags` junction table

## Confirmation Dialogs

### Back from Preview (header changed)
If user changed the header row in Preview phase and clicks "Back", show confirmation:
- "You have unsaved changes to the header row"
- Options: Cancel, Discard Changes

### Change Header Row from Classify
If user has classified columns and clicks "Change Header Row", show confirmation:
- "You have classified X columns. Changing the header row will reset all classifications."
- Options: Cancel, Change Header Row (destructive)

## Constants

```typescript
export const OVERVIEW_TAB_ID = '__overview__'
const HIGH_CONFIDENCE_THRESHOLD = 80
```

## Critical Constraint

**NO FAKE DATA**: All stats displayed must come from database queries via the API. The dashboard is a window into the database, not static UI. Progress percentages, category counts, and timestamps are all derived from actual `column_mappings` and `tab_mappings` records.

**VISUAL CONSISTENCY**: When the same data is displayed in multiple places, it must look the same everywhere. The header status indicator is the canonical example - grey/orange/green dot appears identically in tab bar, cards, and list rows.
