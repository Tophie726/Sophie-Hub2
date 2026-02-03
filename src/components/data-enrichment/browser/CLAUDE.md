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
- Only receives **active** and **reference** tabs (pre-filtered in SourceBrowser before passing as props)
- Internal `visibleTabs` filter as defense-in-depth
- Flagged and hidden tabs are only accessible from Overview dashboard
- Status dropdown (Active, Reference, Flagged, Hidden) for changing tab status
- **Header status dot** with progress ring for confirmed tabs

### TabOverviewDashboard
Per-source dashboard showing all tabs at a glance. Features:
- Grid/List view toggle (persisted in state)
- Overall progress bar (calculated from all tab stats)
- **Progress flash prevention**: When `isLoadingPreview` is true, shows shimmer animation instead of misleading percentage (DB-only tab count gives inflated %). Subtitle shows "discovering tabs..." with spinner.
- Tab cards/rows showing: header status, progress, category breakdown, last edit
- Hidden tabs toggle (only place to access hidden tabs)
- Flagged tabs collapsible section (subtle styling, only place to access flagged tabs)
- **Compact header controls**: AI Source Analysis (sparkles icon) and Sync History (clock icon) are popover buttons in the header row, not full-width sections

#### AI Source Analysis (Popover)
- Sparkles icon button in header → opens Popover with `AISourceAnalysis compact` mode
- Compact mode: no outer card border (popover provides container), starts expanded, summary + details inline
- Full mode (standalone): collapsible card with trigger row

#### Sync History (Popover)
- Clock icon button in header → opens Popover with `SyncHistoryPanel`
- Compact layout: 360px popover with scrollable history list

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

### Mapping Save → Sync Flow (Continuous)

When the user clicks "Complete Mapping" in MapPhase, a **3-phase full-card takeover** runs automatically with no extra button presses:

1. **Phase 1 — "Saving your mapping..."** (spinner, full card takeover)
   - `handleCompleteWithClear` clears localStorage draft + DB draft
   - Calls `onComplete()` which POSTs to `/api/mappings/save`
2. **Phase 2 — "Mapping Saved"** (animated green checkmark + stat badges)
   - Auto-transitions after save completes
   - Shows field count stats (mapped fields, entity breakdown)
   - 1.2s display before next phase
3. **Phase 3 — "Starting sync..."** (rotating RefreshCw icon)
   - Auto-transitions at 2.0s after Phase 2
   - Calls `onSyncAfterSave()` → `handleSync()` directly
   - **Stays on current tab** — sync dialog opens as modal overlay, no navigation to Overview

**State management:**
```typescript
const [isSavingMapping, setIsSavingMapping] = useState(false)
const [saveMappingSuccess, setSaveMappingSuccess] = useState(false)
const [successPhase, setSuccessPhase] = useState<'complete' | 'syncing'>('complete')
```

**Key design decisions:**
- Full-card takeover replaces tiny button-only feedback
- Continuous flow: save → success → sync with no user interaction needed between phases
- `AnimatePresence mode="wait"` for crossfade between phases
- Spring physics (`bounce: 0.35`) on checkmark entrance
- Error re-thrown from `onComplete` so MapPhase can revert to default state
- If `onSyncAfterSave` not provided, falls back to "Continue to Overview" button

### Sync Flow (Dry Run Preview)

When user clicks "Sync" button or auto-triggered after mapping save:
1. `handleSync` filters to **syncable tabs only**: `columnCount > 0` (has saved mappings)
2. Opens `SyncPreviewDialog` with total tab count for progress tracking
3. For each syncable tab, calls `POST /api/sync/tab/[id]` with `{ dry_run: true }`
4. **Progressive results**: Dialog updates with each tab's results as they complete
5. API returns `EntityChange[]` (creates, updates, skips) without writing to DB
6. Dialog shows summary stats (X creates, Y updates, Z skips) grouped by entity
7. User reviews per-tab changes with expandable field-level detail
8. User clicks "Confirm Sync" → `handleConfirmSync` runs actual sync (no dry_run)
9. Toast shows results, sync status updated

**Important:** `SyncPreviewDialog` renders at the root level of SourceBrowser, not inside any tab view. It works as a modal overlay from any active tab — no navigation required.

**CRITICAL — Header Row Handling:**
The sync engine passes `tab_mappings.header_row` to the Google Sheets connector. Without this, sheets with non-zero header rows (e.g., Master Client Dashboard has headers on row 9) will fail with "Key column not found" errors because the connector would read from row 0.

**Key files:**
- `sync-preview-dialog.tsx` — Dialog with stats, entity sections, change detail, progress bar
- `source-browser.tsx` — `handleSync` (dry run) + `handleConfirmSync` (actual write)

### Tab Ordering

Tabs use **Google Sheets native order** (the order they appear in the actual spreadsheet). The merge logic maps over `previewTabs` (which preserves sheet order) and enriches with DB data where available.

**Shimmer loading state**: While waiting for Google Sheets preview to load, the SheetTabBar shows animated shimmer placeholder tabs. This prevents the jarring "reorder jump" that would occur if we showed DB tabs (alphabetical order) then switched to sheet order when preview arrives. Once preview loads, real tabs appear in correct sheet order immediately.

### Performance Optimizations

**Parallelized Google Sheets API calls** (`src/lib/google/sheets.ts`):
- `getSheetPreview()` fetches metadata and first-tab preview data in parallel via `Promise.all()`
- Range `A1:Z6` without sheet name defaults to first visible sheet
- Saves ~500ms per preview fetch (previously sequential)

**Cache headers on `/api/sheets/preview`**:
- `Cache-Control: private, max-age=300, stale-while-revalidate=600`
- Revisiting the same source within 5 minutes uses cached response
- Previously: no caching, every source switch = fresh 1-3s Google API call

**Client-side caching**:
- `sheetPreviews` state: in-memory cache per source, survives tab switches
- `rawDataCache`: module-level cache in SmartMapper, 5-minute TTL
- `/api/data-sources`: `max-age=30, stale-while-revalidate=60`
- `/api/sheets/raw-rows`: `max-age=60, stale-while-revalidate=120`

**Module-level navigation cache** (`src/lib/data-enrichment/cache.ts`):
- **Purpose**: Instant restore when navigating back to Data Enrichment
- Caches:
  - Data sources list (`data-sources`)
  - Sheet previews (`sheet-preview:{spreadsheetId}`)
  - SmartMapper state per tab (`smart-mapper:{dataSourceId}:{tabName}`)
- 5-minute TTL, survives component unmounts
- On mount: check cache → if fresh, use instantly (no loading spinner) → if stale, fetch
- On mutation: update cache alongside local state
- Helpers: `getCachedSources()`, `setCachedSources()`, `getCachedPreview()`, `setCachedPreview()`, `getCachedMapperState()`, `setCachedMapperState()`

**SmartMapper caching flow**:
1. Mount: Check `getCachedMapperState()` before any API calls
2. If cached: Instant restore of phase, headerRow, columns — no API calls
3. If not cached: Restore from API (saved mappings → drafts → fresh start)
4. On save: Update cache alongside localStorage and DB draft save
5. Result: Switching between tabs restores instantly, no "All (0)" flash

## API Integration

### GET /api/data-sources
Returns sources with per-tab stats:
```typescript
{
  sources: [{
    tabs: [{
      id, tab_name, primary_entity, header_row,
      header_confirmed,  // Boolean - user confirmed header
      columnCount, totalColumns, categoryStats, status, notes, updated_at
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

## Critical Constraints

**NO FAKE DATA**: All stats displayed must come from database queries via the API. The dashboard is a window into the database, not static UI. Progress percentages, category counts, and timestamps are all derived from actual `column_mappings` and `tab_mappings` records.

**ACCURATE PROGRESS**: Progress denominator is `tab_mappings.total_columns` (total columns in the source sheet), NOT `column_mappings.length` (only saved columns). Unsaved columns count as unmapped. Without `total_columns`, a tab with 11/241 columns saved would show 100% (11/11).

**VISUAL CONSISTENCY**: When the same data is displayed in multiple places, it must look the same everywhere. The header status indicator is the canonical example - grey/orange/green dot appears identically in tab bar, cards, and list rows.

---

## CRITICAL INVARIANTS (Read Before Any Change)

These invariants MUST hold true at all times. If a change breaks any of these, it's a regression — no matter how much performance it gains.

### INV-1: All Google Sheet tabs must be visible
**Every tab in the actual Google Sheet must appear in the SheetTabBar.** This requires:
- The Google Sheets preview (`/api/sheets/preview`) must always fetch for tab discovery
- DB tabs show immediately (from `data_sources` API), preview tabs merge in background
- The merge logic at `sheetTabs` must include both DB and preview tabs
- **Violation example**: Skipping preview fetch for sources with DB tabs → only mapped tabs show

### INV-2: Selecting a source must show Overview with data
**Clicking a source tab must always land on Overview with content visible.** This requires:
- `activeTabId` defaults to `OVERVIEW_TAB_ID`
- `sheetTabs.length > 0` before rendering Overview content
- Skeleton shows only when `sheetTabs.length === 0` AND still loading
- **Violation example**: Setting `activeSourceId` before `sources` state is populated → blank page

### INV-3: Saved mappings must persist across visits
**If a user saves column mappings and returns, they must see their saved work.** This requires:
- `restoreDraft()` compares DB draft and localStorage timestamps, uses the **newer** one
- If neither draft exists, Step 3 loads from saved `column_mappings` (critical for post-save visits where drafts are cleared)
- Flush-on-unmount: `pendingDraftRef` fires a POST on component unmount so the DB draft stays current even when the user switches tabs within the 500ms debounce window
- **Violation example**: Removing Step 3 from `restoreDraft()` → fresh state on return
- **Violation example**: Sequential DB→localStorage cascade without timestamp comparison → stale DB draft (debounce cancelled on tab switch) shadows newer localStorage draft, losing the last change (e.g., key designation)

### INV-4: Status indicators must be consistent everywhere
**The same data must look the same in SheetTabBar, TabCard, and TabListRow.** This requires:
- Header status: grey (none) / orange (auto-detected) / green (confirmed) — all three views
- Progress ring on confirmed tabs in SheetTabBar
- When adding or changing an indicator, update ALL three locations

### INV-5: Performance optimizations must not change behavior
**Caching, batching, and parallelization must produce identical results to the unoptimized version.** This requires:
- Cache-Control headers: only on GET/read endpoints, never on mutations
- Client-side caches: must have TTL and invalidation on mutation
- Skipping fetches: ONLY safe when the data is guaranteed to be available elsewhere
- **Critical**: `restoreDraft()` fetches MUST use `cache: 'no-store'` — cached `/api/mappings/load` responses after save will serve stale data (pre-save, missing key columns)
- **Violation example**: Skipping Google preview because "DB tabs exist" → missing unmapped tabs
- **Violation example**: Relying on cached `/api/mappings/load` after save → isKey lost because cached response has no saved mappings

### INV-6: DB tabs show immediately, no blocking on external APIs
**The skeleton loader must clear as soon as DB data is available.** This requires:
- Skeleton condition: `(isLoadingPreview || isLoading) && sheetTabs.length === 0`
- DB tabs populate `sheetTabs` before preview completes
- Preview fetch is fire-and-forget, never awaited in the rendering path

### INV-7: Tab count badge must show the true tab count
**The SourceTabBar badge must reflect all tabs, not just DB-mapped tabs.** This requires:
- `tabCount: Math.max(s.tabs.length, sheetPreviews[s.id]?.tabs.length || 0)`
- Do NOT use `||` — it short-circuits when DB tabs exist (e.g., 11 is truthy), hiding the preview count (e.g., 20+)
- **Violation example**: `s.tabs.length || previewCount` → shows 11 instead of 20+ when 11 DB tabs exist

### INV-8: Tab order must match Google Sheets native order
**Tabs must display in the same order as the actual Google Spreadsheet.** This requires:
- Merged tab list maps over `previewTabs` (which preserves sheet order) then enriches with DB data
- Do NOT sort tabs alphabetically — the real sheet order is the source of truth
- Before preview loads, DB tabs show in API order (brief, acceptable)
- **Violation example**: Adding `.sort((a, b) => a.name.localeCompare(b.name))` → tabs appear alphabetically instead of sheet order

---

## PRE-CHANGE VERIFICATION CHECKLIST

Run through this BEFORE committing any change to the data-enrichment browser:

### Data Visibility
- [ ] All Google Sheet tabs visible in SheetTabBar (not just mapped ones)
- [ ] Overview dashboard shows real stats from database
- [ ] Tab cards show correct header status, progress, categories
- [ ] Unmapped tabs still visible and clickable

### Navigation
- [ ] Clicking a source → lands on Overview with content
- [ ] Clicking a tab → SmartMapper loads with data
- [ ] Clicking "Back" in SmartMapper → returns to Overview
- [ ] Switching sources → Overview with correct tabs

### Persistence
- [ ] Classify columns → Save → Navigate away → Return → Classifications restored
- [ ] Draft saves to DB (check Network tab for POST /api/tab-mappings/draft)
- [ ] Saved mappings load when no draft exists
- [ ] Complete Mapping button: Default → "Saving..." (spinner) → "Mapping Saved" (green) → Overview
- [ ] No auto-sync triggered after save (user must click Sync manually)

### Header Row & Sync
- [ ] Sheets with non-zero header rows sync correctly (header row passed to connector)
- [ ] Only tabs with `columnCount > 0` are synced (not all active tabs)
- [ ] Sync preview shows progressive results as tabs complete

### Performance (verify no regressions)
- [ ] DB tabs render before Google Sheets preview completes
- [ ] Tab revisit within session uses cached data
- [ ] No duplicate API calls in Network tab

### Visual Consistency
- [ ] Header status dot matches in tab bar, grid cards, list rows
- [ ] Progress bars show same percentage everywhere
- [ ] Category badges match between Overview and SmartMapper
