# Data Enrichment - Feature Context

## Branch: dev/data-browser-ux

**This branch experiments with a new "Data Browser" UX paradigm.**

The previous approach used a step-by-step wizard. This new approach uses a **browser-tab metaphor** for more fluid, spatial navigation between data sources.

---

## Purpose

Data Enrichment is the **control room** for bringing external data into Sophie Hub. It replaces the chaotic process of manually updating spreadsheets and running one-off scripts with a visual, intuitive interface.

**Only Admin users have access to this feature.**

---

## CRITICAL PRINCIPLE: No Fake Data

> **Every number, stat, and piece of information displayed in the UI MUST come from the database.**

This is non-negotiable. The UI is a **window into the database**, not a separate thing to maintain.

### What This Means

**DO:**
- Query `column_mappings` to count Partner columns
- Derive progress % from actual mapped vs total columns
- Let stats auto-update when mappings change (same source of truth)

**DON'T:**
- Hardcode numbers in components
- Create separate "progress" fields to maintain
- Display mock/placeholder data that isn't real

### Why This Matters

Without this principle, you end up playing **whack-a-mole** - updating the UI in multiple places when data changes. The database is the single source of truth. The UI reads from it. Period.

### Visual Consistency Corollary

**When the same data appears in multiple places, it must look identical.**

Example: The header status (`header_confirmed`, `hasHeaders`) is shown in:
- Tab bar (SheetTabBar)
- Grid cards (TabCard)
- List rows (TabListRow)

All three MUST show the same colored dot (grey/orange/green). When adding a new indicator to one view, immediately add it to ALL views that show that data.

### Example: Sheets Overview Stats

```
Correct:
  SELECT category, COUNT(*) FROM column_mappings
  WHERE tab_mapping_id IN (SELECT id FROM tab_mappings WHERE data_source_id = ?)
  GROUP BY category
  → UI displays: Partner: 24, Staff: 12, Unmapped: 120

Wrong:
  const stats = { partner: 24, staff: 12, unmapped: 120 } // hardcoded
```

---

## The Problem We're Solving

Sophie Society's data is fragmented across:
- Master Client Dashboard (Google Sheet with 20+ tabs)
- Individual Brand Info sheets (one per partner)
- Pod Leader Dashboards (views + some unique data)
- Google Forms (onboarding, feedback, churn reasons)
- Close IO (sales CRM)
- Zoho (invoicing)
- Amazon APIs (product data)

Previously, data was crawled sheet-by-sheet without understanding what the final tables should look like. This led to 100+ database tables and constant confusion about what's authoritative.

## The New Approach: Data Browser

**Entity-first thinking**: We know we have Partners and Staff. Everything maps to those.

### Design Philosophy: Browser, Not Wizard

The old approach was a step-by-step wizard:
```
Step 1: Pick source → Step 2: Pick tab → Step 3: Classify → Step 4: Review
```

The new approach is a **spatial data browser**:
```
See all sources → Flick between them → Map directly → Everything accessible
```

**Why this is better:**
1. **No "going back"** - everything accessible in one view
2. **Context switching is instant** - flick between sheets like browser tabs
3. **Mental model is familiar** - everyone knows browser tabs
4. **Progressive disclosure** - see all sources at a glance, depth on click

---

## UX Architecture: The Data Browser

### Level 1: Category Hub (Landing Page)

The Data Enrichment landing page shows **categories of data** as beautiful visual blocks:

```
┌─────────────────────────────────────────────────────────┐
│  Data Enrichment                                        │
│                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │     📊      │  │     📝      │  │     📄      │     │
│  │   Sheets    │  │    Forms    │  │    Docs     │     │
│  │  3 sources  │  │   Coming    │  │   Coming    │     │
│  │  12 tabs    │  │    Soon     │  │    Soon     │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
│                                                         │
│  Click any category to dive in                          │
└─────────────────────────────────────────────────────────┘
```

**Design Notes:**
- Large, clickable cards with icons
- Show stats (source count, tab count, mapped fields)
- "Coming Soon" state for future categories
- Subtle hover animations (scale, shadow)

### Level 2: Source Browser (Sheets View)

Inside a category (e.g., Sheets), show all connected sources as **browser-style tabs**:

```
┌─────────────────────────────────────────────────────────┐
│  ← Data Enrichment  /  Sheets                           │
│                                                         │
│  ┌──────────────┬───────────────┬──────────────┬──────┐│
│  │ Master Client│ Pod Dashboard │ Brand Sheets │  +   ││
│  └──────────────┴───────────────┴──────────────┴──────┘│
│       ↑ Active tab                                      │
│       │                                                 │
│  ┌────┴─────────────────────────────────────────────────┐
│  │  Sub-tabs (sheet tabs within this source):          │
│  │  [ Partners ] [ ASINs ] [ Weekly ] [ Team ]         │
│  │       ↑ Active sub-tab                              │
│  ├──────────────────────────────────────────────────────┤
│  │                                                      │
│  │  Column List (ready to classify)                    │
│  │  ┌──────────────────────────────────────────────┐   │
│  │  │ Brand Name       [Partner ▼] [🔑 Key]        │   │
│  │  │ → KING OF SCENTS                             │   │
│  │  ├──────────────────────────────────────────────┤   │
│  │  │ Account Manager  [Staff ▼]                   │   │
│  │  │ → Sarah Johnson                              │   │
│  │  └──────────────────────────────────────────────┘   │
│  │                                                      │
│  └──────────────────────────────────────────────────────┘
└─────────────────────────────────────────────────────────┘
```

**Key UX Elements:**

1. **Source Tabs (Top Row)**
   - Each connected Google Sheet = one tab
   - `+` button to add new source
   - Active tab highlighted, others subtle
   - Can reorder tabs via drag (future)

2. **Sheet Sub-Tabs (Second Row)**
   - Tabs within the active spreadsheet
   - Shows only active/selected tabs from the source
   - Click to switch instantly

3. **Column List (Main Content)**
   - Directly shows columns to classify
   - No wizard steps - just start mapping
   - Same Smart Mapper UI we built (unified dropdown, key management)

### Motion & Animation

Following CLAUDE.md animation guidelines:

**Tab Switching:**
- `ease-out` 200ms for tab activation
- Content fades/slides smoothly
- Active indicator slides along tab bar

**Sub-Tab Switching:**
- `ease-in-out` 150ms content morph
- Column list fades out → in (not hard swap)
- Staggered fade-in for column items

**Hover States:**
- Tabs: subtle background change, scale(1.02)
- Cards: lift with shadow, scale(1.005)

**Adding New Source:**
- `+` button click → modal slides in
- New tab animates in from right
- Smooth insertion into tab bar

---

## CURRENT IMPLEMENTATION STATUS

> **Last Updated: January 26, 2026**

### What's Working ✅

1. **Category Hub** → Click "Sheets" → **SourceBrowser** (direct navigation)
2. **Connect a Google Sheet** - Persists to `data_sources` table
3. **Load sheet tabs** - Fetches from Google Sheets API, shows in sub-tab bar
4. **Tab Status System** - Change status, hide tabs, flag with notes
5. **SmartMapper UI** - Column classification with unified dropdown
6. **Save column mappings** - SmartMapper persists to `column_mappings` table
7. **Draft persistence** - In-progress work saved to DB + localStorage fallback ✓ *Migration verified*
8. **Delightful animations** - Key badge lock, row highlight, count animations
9. **Auto-select first workable tab** - Skips flagged/hidden, selects active/reference tabs
10. **Flagged/hidden tabs on Overview only** - Keeps tab bar clean, access via Overview dashboard
11. **Polished loading states** - Context-aware skeletons with progress bars
12. **Source tab drag-and-drop reorder** - Reorder connected sheets (needs migration for persistence)
13. **Sign out / re-auth flow** - Refresh Google OAuth tokens when expired
14. **Auto header detection with confidence** - Intelligent header row detection with scoring (≥80% = auto-confirm UI)
15. **Sheet Overview Dashboard** - Per-source dashboard showing all tabs with progress, grid/list view toggle
16. **Mapping progress display** - Progress bars and category breakdown from real DB data
17. **Enterprise API patterns** - Zod validation, standardized responses, centralized types
18. **Role-based access control** - Admin-only access via ADMIN_EMAILS env var
19. **Saved mapping restoration** - When no draft exists, SmartMapper loads from `column_mappings` table via `/api/mappings/load` ✓
20. **Entity-centric data flow** - Click entity in Data Flow Map → see actual mapped fields with source badges, authority icons, and tooltip details ✓
21. **Dropdown submenu portal fix** - `DropdownMenuSubContent` wrapped in Portal to prevent ScrollArea clipping ✓
22. **Performance: Client-side raw data cache** - Module-level 5min TTL Map in SmartMapper, tab revisit <50ms vs 400-1000ms ✓
23. **Performance: Parallel Google API** - `values.get()` + `spreadsheets.get()` via Promise.all, saves 200-300ms ✓
24. **Performance: Cache-Control on 7 endpoints** - Browser-level caching on all read-heavy APIs ✓
25. **Performance: Non-blocking preview** - DB tabs show immediately, Google Sheets preview merges in background ✓
26. **Performance: Deferred field tags** - Only fetches on Classify phase entry, not on mount ✓
27. **Quality: Critical invariants + pre-change checklist** - `browser/CLAUDE.md` documents 6 invariants and verification steps ✓

### What's TODO 🚧

1. **Sync data** - Actually import data from sheets to entity tables
2. **Run display_order migration** - Enable persisted source tab ordering

### Recently Implemented Features

#### Universal Header Status Indicator ✅
All views (tab bar, cards, list rows) now show the same header status indicator:

| State | Dot Color | Meaning |
|-------|-----------|---------|
| No headers | Grey | No header row identified |
| Auto-detected | Orange | System detected header, awaiting confirmation |
| Confirmed | Green | User confirmed the header row |
| 100% Mapped | Checkmark | All columns classified |

**Progress Ring** (tab bar only): Confirmed tabs show a green ring that fills as columns are mapped.

**Lock Animation**: When confirming headers, an animated lock icon (shackle closing) appears over the table.

**Key Principle**: Same data = same visual. Never show entity color in one place and header status in another.

#### Auto Header Detection with Confidence ✅
Intelligent header row detection using multiple heuristics with confidence scoring:

**Scoring Heuristics:**
- Header keyword matching (+15 pts each, capped at 45): ID, Name, Email, Status, Date, Brand, Partner, Staff, etc.
- Uniqueness check (+20 pts): All non-empty cells are unique
- All-text row (+15 pts): No pure numbers or dates in the row
- Position bonus (+10 pts row 0, +5 pts row 1)
- Type diversity from next row (+15 pts): Suggests current row is header

**UI Behavior:**
- Always shows full table view for transparency
- Auto-scrolls to detected header row on mount (smooth scroll to center)
- Shows confidence as subtle hint text
- User can click any row to select as header

**API:** `GET /api/sheets/raw-rows` now returns `headerConfidence` (0-100) and `headerReasons` (string[])

**State Update Pattern**: When user confirms header, SmartMapper:
1. Calls `POST /api/tab-mappings/confirm-header` to save to database
2. Calls `onHeaderConfirmed()` callback to update parent state immediately
3. Tab bar reflects change (orange → green) without requiring page refresh

**Files:**
- `src/lib/google/sheets.ts` - `detectHeaderRow()` with `HeaderDetectionResult` type
- `src/components/data-enrichment/smart-mapper.tsx` - Confidence-based PreviewPhase UI

#### Sheet Overview Dashboard ✅
Per-source dashboard showing all tabs at a glance with real database stats:

**Features:**
- Grid/List view toggle (persisted in component state)
- Overall progress bar calculated from all tab stats
- Tab cards showing: entity type, progress bar, category breakdown, header status, last edit time
- Flagged tabs collapsible section with notes
- Hidden tabs toggle
- Defaults to Overview when selecting a source

**Components:**
- `TabOverviewDashboard` - Main dashboard component
- `TabCard` - Grid view card with hover animations
- `TabListRow` - Table row for list view

**API:** `GET /api/data-sources` now includes `updated_at` per tab for "last edited" display

**Files:** See `src/components/data-enrichment/browser/CLAUDE.md` for detailed documentation

#### Field Tags (Cross-Cutting Domain Classification) ✅
Column mappings can now have **domain tags** for cross-cutting classification orthogonal to entity types:

**Available Tags:**
| Tag | Color | Description |
|-----|-------|-------------|
| Finance | Emerald | Financial data: fees, salaries, invoices, billing |
| Operations | Blue | Operational data: status, capacity, assignments |
| Contact | Violet | Contact information: email, phone, address, Slack |
| HR | Amber | Human resources: hire dates, PTO, training |
| Product | Orange | Product data: categories, pricing, inventory |

**Why Tags?**
- Entity types (Partner, Staff, ASIN) answer "whose data is this?"
- Tags answer "what domain/category does this field belong to?"
- A Partner field like "Base Fee" is tagged `Finance`
- A Staff field like "Salary" is also tagged `Finance`
- Later, you can query all Finance fields regardless of entity type

**UI Integration:**
- Tag picker appears on entity columns (Partner, Staff, ASIN) in ClassifyPhase
- Multiple tags can be selected per column
- Tags displayed as colored badges in the classification row
- Dropdown menu with checkboxes for multi-select

**Database Schema:**
```sql
-- Field tags table
CREATE TABLE field_tags (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT 'gray',  -- emerald, blue, violet, amber, orange
  description TEXT
);

-- Junction table for many-to-many
CREATE TABLE column_mapping_tags (
  column_mapping_id UUID REFERENCES column_mappings(id),
  tag_id UUID REFERENCES field_tags(id),
  PRIMARY KEY (column_mapping_id, tag_id)
);
```

**API:**
- `GET /api/field-tags` - Fetch all available tags
- Tags are saved along with column mappings in `POST /api/mappings/save`

**Files:**
- `supabase/migrations/20260122_field_tags.sql` - Database schema
- `src/app/api/field-tags/route.ts` - API endpoint
- `src/types/enrichment.ts` - `FieldTag` type, `tag_ids` in mappings
- `src/components/data-enrichment/smart-mapper.tsx` - Tag picker UI

### Upcoming Features (Planned)

### Simplified Flow (Current)

```
Hub (category cards)
  └── Click "Sheets"
        └── SourceBrowser
              ├── Empty state: "Connect a Google Sheet" button
              ├── Source tabs (top row) - one per connected sheet
              ├── Sheet tabs (sub-row) - includes Overview tab first
              │     ├── Overview (default) → TabOverviewDashboard
              │     └── Regular tabs → SmartMapper
              └── Content area
                    ├── TabOverviewDashboard (when Overview selected)
                    │     ├── Grid/List view toggle
                    │     ├── TabCard (grid) / TabListRow (list)
                    │     └── Flagged section, Hidden toggle
                    └── SmartMapper (when specific tab selected)
                          ├── PreviewPhase (confidence-based)
                          ├── ClassifyPhase
                          └── MapPhase
```

**Note:** Overview tab is always first and selected by default when switching sources. SmartMapper's "Back" returns to Overview.

---

## TAB STATUS SYSTEM

Tabs can have one of four statuses to help manage large spreadsheets:

| Status | Icon | Color | Behavior |
|--------|------|-------|----------|
| **Active** | ✓ Check | Green | Normal - show in tab bar, map columns |
| **Reference** | 📖 BookOpen | Blue | Visible but dimmed - for lookup/reference only |
| **Hidden** | 👁‍🗨 EyeOff | Gray | Hidden from tab bar (toggle to reveal) |
| **Flagged** | 🚩 Flag | Amber | Needs attention - shows badge, stores notes |

### UI Interaction

- **Hover on tab** → Three-dot menu appears
- **Click menu** → Dropdown with status options
- **Select "Flag"** → Modal prompts for notes
- **Hidden tabs** → Counter shows "N hidden" with toggle button

### Database

```sql
-- tab_mappings table
status TEXT NOT NULL DEFAULT 'active'  -- 'active', 'reference', 'hidden', 'flagged'
notes TEXT                              -- Notes for flagged tabs
```

### API

```
PATCH /api/tab-mappings/[id]/status
Body: { status: 'flagged', notes: 'Need to review this with finance team' }
```

---

## DRAFT PERSISTENCE SYSTEM

Mapping progress is automatically saved so users (and other admins) can resume work without losing progress.

### How It Works

**Saving (3 layers):**

1. **Primary Storage: Database**
   - Draft state saved to `tab_mappings.draft_state` (JSONB)
   - Includes: phase, headerRow, columns, timestamp
   - Tracks who last updated: `draft_updated_by`, `draft_updated_at`
   - Enables multi-admin collaboration

2. **Fallback: localStorage**
   - Immediate backup for offline resilience
   - Used when DB save fails or dataSourceId not available
   - 7-day expiry for stale drafts

3. **Debounced Saving**
   - DB saves debounced at 500ms to avoid hammering server
   - localStorage saves immediately for responsiveness

**Restoring (3-step cascade):**

On mount, `restoreDraft()` tries three sources in order:

1. **DB draft** (`GET /api/tab-mappings/draft`) → found & <7 days old? Restore. Done.
2. **localStorage draft** → found & <7 days old? Restore. Done.
3. **Saved column_mappings** (`GET /api/mappings/load?data_source_id=X`) → find matching `tab_mapping` by `tab_name` → convert `ColumnMapping[]` to `ColumnClassification[]` → set phase to `classify` → show toast "Restored saved mappings". Done.
4. **If all fail** → initialize fresh columns.

Step 3 is critical: when the user saves mappings (Classify → Map → Save), the draft is cleared. On return, Steps 1-2 find nothing. Without Step 3, SmartMapper would start fresh, losing the saved work. Step 3 reads from the permanent `column_mappings` table to restore the saved state.

### Database Schema

```sql
-- Added to tab_mappings
draft_state JSONB               -- { phase, headerRow, columns, timestamp }
draft_updated_by TEXT           -- User who last updated
draft_updated_at TIMESTAMPTZ    -- When draft was last updated
```

### API

```
GET /api/tab-mappings/draft?data_source_id=X&tab_name=Y
  Returns: { draft, updatedBy, updatedAt }

POST /api/tab-mappings/draft
  Body: { data_source_id, tab_name, draft_state, updated_by? }

DELETE /api/tab-mappings/draft?data_source_id=X&tab_name=Y
  Clears draft (called when mapping completes)
```

### Draft State Structure

```typescript
interface DraftState {
  phase: 'preview' | 'classify' | 'map'
  headerRow: number
  columns: Array<{
    sourceIndex: number
    sourceColumn: string
    category: 'partner' | 'staff' | 'asin' | 'weekly' | 'computed' | 'skip' | null
    targetField: string | null
    authority: 'source_of_truth' | 'reference'
    isKey: boolean
    computedConfig?: ComputedFieldConfig
  }>
  timestamp: number
}
```

### UX Animations

SmartMapper includes delightful micro-interactions:

1. **Key Badge Lock Animation** - When setting a column as key:
   - Badge springs in with scale animation (500 stiffness, 25 damping)
   - Lock icon rotates from -20° to 0° with spring effect

2. **Row Highlight Animation** - When classifying:
   - Smooth background color transitions (200ms ease-out)
   - Subtle scale tap feedback (0.995)

3. **Category Badge Count Animation** - Stats badges:
   - Pop in/out with spring animation when appearing/disappearing
   - Count numbers slide in from above when changing

---

## DATABASE SCHEMA (Current)

### data_sources
```sql
id UUID PRIMARY KEY
name TEXT NOT NULL
type TEXT DEFAULT 'google_sheet'
spreadsheet_id TEXT              -- Google Sheet ID
spreadsheet_url TEXT             -- Original URL
status TEXT DEFAULT 'active'
connection_config JSONB          -- (legacy, nullable)
created_at, updated_at TIMESTAMPTZ
```

### tab_mappings
```sql
id UUID PRIMARY KEY
data_source_id UUID REFERENCES data_sources(id)
tab_name TEXT NOT NULL
header_row INT DEFAULT 0
primary_entity TEXT              -- 'partners', 'staff', 'asins'
status TEXT DEFAULT 'active'     -- 'active', 'reference', 'hidden', 'flagged'
notes TEXT                       -- Notes for flagged tabs
draft_state JSONB                -- In-progress mapping state (see Draft Persistence)
draft_updated_by TEXT            -- Who last updated the draft
draft_updated_at TIMESTAMPTZ     -- When draft was last updated
is_active BOOLEAN DEFAULT true   -- (legacy)
created_at, updated_at TIMESTAMPTZ
UNIQUE(data_source_id, tab_name)
```

### column_mappings
```sql
id UUID PRIMARY KEY
tab_mapping_id UUID REFERENCES tab_mappings(id)
source_column TEXT NOT NULL
source_column_index INT
category TEXT                    -- 'partner', 'staff', 'asin', 'weekly', 'computed', 'skip'
target_field TEXT
authority TEXT DEFAULT 'source_of_truth'  -- or 'reference'
is_key BOOLEAN DEFAULT false
transform_type TEXT DEFAULT 'none'
created_at TIMESTAMPTZ
UNIQUE(tab_mapping_id, source_column)
```

---

## API ENDPOINTS

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/data-sources` | List all sources with stats |
| POST | `/api/data-sources` | Create new data source |
| POST | `/api/data-sources/reorder` | Reorder source tabs |
| GET | `/api/sheets/search` | Search Google Drive for sheets |
| GET | `/api/sheets/preview?id=X` | Get sheet tabs and metadata |
| GET | `/api/sheets/raw-rows?id=X&tab=Y` | Get raw data from a tab |
| POST | `/api/tab-mappings` | Create tab mapping (for unmapped tabs) |
| PATCH | `/api/tab-mappings/[id]/status` | Update tab status/notes |
| POST | `/api/tab-mappings/confirm-header` | Confirm header row detection |
| GET | `/api/tab-mappings/draft?data_source_id=X&tab_name=Y` | Load draft state |
| POST | `/api/tab-mappings/draft` | Save draft state |
| DELETE | `/api/tab-mappings/draft?data_source_id=X&tab_name=Y` | Clear draft state |
| GET | `/api/mappings/load` | Load existing column mappings |
| POST | `/api/mappings/save` | Save column mappings (full payload) |

### API Patterns

All data-enrichment API routes use standardized patterns:

**Input Validation**: Zod schemas from `src/lib/validations/schemas.ts`
```typescript
const validation = DataSourceSchema.create.safeParse(body)
if (!validation.success) {
  return apiValidationError(validation.error)
}
```

**Response Helpers**: From `src/lib/api/response.ts`
```typescript
return apiSuccess({ source }, 201)
return ApiErrors.forbidden('Missing permission: data-enrichment:write')
```

**Permission Checks**: All routes require `data-enrichment:read` or `data-enrichment:write` permission (admin only)

---

## CRITICAL CONCEPT: Row Entity vs Column Entities

**Real-world spreadsheets are messy.** A single tab often contains mixed data:
- A "Master Client Sheet" has brand info + account manager names + finance contact info
- A "Finance Sheet" has partner billing data + staff approver names
- Each row might reference multiple entities

### The Two-Level Entity Model

1. **Row Entity (the anchor)**: What does each ROW represent?
   - Example: Each row = one Partner
   - The primary key column identifies this row entity

2. **Column Entities (can vary)**: What entity does each COLUMN's data belong to?
   - Can be the SAME as row entity (direct mapping)
   - Can be a DIFFERENT entity (creates a relationship/lookup)

### Example: Master Client Sheet

| Brand Name | Tier | Account Manager | Finance Contact |
|------------|------|-----------------|-----------------|
| AIRONEX    | T1   | Sarah Johnson   | billing@x.com   |

**Row Entity**: Partner (each row = one brand)
**Primary Key**: Brand Name → `partners.brand_name`

**Column Mappings**:
- `Brand Name` → `partners.brand_name` (same entity)
- `Tier` → `partners.tier` (same entity)
- `Account Manager` → `staff.full_name` (DIFFERENT entity - creates assignment)
- `Finance Contact` → `external_contacts.email` (DIFFERENT entity)

---

## CRITICAL CONCEPT: Source Authority (Two-Layer System)

When data exists in multiple places (sheets now, app later), we need to know which source is authoritative.

### Authority Levels

Each mapped column has an **authority** setting:

| Authority | Icon | Meaning | Behavior |
|-----------|------|---------|----------|
| **Source of Truth** | ⭐ | This sheet is THE authoritative source for this field | Data syncs INTO the database, can create/update records |
| **Reference** | 📋 | This is a copy/lookup, not authoritative | Data used for matching/display only, never overwrites |

### Example Scenario

A "Master Client Sheet" has both authoritative data and lookups:

| Column | Maps To | Authority | Why |
|--------|---------|-----------|-----|
| Brand Name | partners.brand_name | ⭐ Source | This IS where brand names are maintained |
| Tier | partners.tier | ⭐ Source | Tier is set here first |
| Account Manager | staff.full_name | 📋 Reference | Staff names come from Staff Master, this is just a lookup |
| Finance Email | external_contacts.email | 📋 Reference | Just for display, actual contact lives elsewhere |

### The Migration Path

This system enables gradual migration from sheets to app:

**Phase 1 (Now):** Most fields = Sheet as Source of Truth
- App displays data from sheets (read-only in app)
- Users get comfortable with the app interface

**Phase 2 (Adoption):** Some fields become app-native
- Admin flips specific fields to "app is source of truth"
- Users start entering data directly in app
- Sheets become reference for those fields

**Phase 3 (Future):** App becomes primary
- Most fields = App as Source of Truth
- Sheets become reference/backup
- Can optionally write BACK to sheets for legacy integrations

### UI in Smart Mapper

When mapping a column to a field, a toggle appears below the dropdown:

```
┌─────────────────────────────────────────────────┐
│  Brand Name  →  partners.brand_name             │
│                                                 │
│  [⭐ Source] [📋 Reference]                     │
│  └─ Toggles authority for this mapping         │
└─────────────────────────────────────────────────┘
```

- Default is "Source of Truth" (assumes sheet is authoritative)
- Toggle to "Reference" for lookup-only columns
- Live preview shows icons next to column headers
- Footer shows count: "5 mapped (3 source, 2 ref)"

---

### How Related Entity Columns Work

When a column maps to a different entity than the row:

1. **Lookup Match**: Try to find existing record by natural key
   - "Sarah Johnson" → Find staff with `full_name = 'Sarah Johnson'`

2. **Match Result Options**:
   - **Found**: Link the row entity to this related record
   - **Not Found**:
     - Create new record (if allowed)
     - Skip with warning
     - Flag for manual review

3. **Relationship Created**:
   - Partner → Staff creates/updates `partner_assignments`
   - Partner → External Contact creates link in `partners.finance_contact_id`

### Import Order Considerations

Related entities may need to be imported in dependency order:
- Staff should exist before Partner assignments reference them
- Partners should exist before ASINs reference them

The system handles this by:
1. First pass: Create/update primary row entities
2. Second pass: Resolve relationships and create links

## Wizard Flow

### Step 1: Connect Source
```
┌─────────────────────────────────────────────────────────┐
│  Add New Data Source                                    │
├─────────────────────────────────────────────────────────┤
│  Source Type: [Google Sheet ▼]                          │
│                                                         │
│  Sheet URL: [_________________________________]         │
│                                                         │
│  Name this source: [_________________________________]  │
│                                                         │
│  [Test Connection]                    [Continue →]      │
└─────────────────────────────────────────────────────────┘
```

**UX Notes:**
- Validate URL format on blur
- "Test Connection" hits Google Sheets API to verify access
- Show sheet name and tab count on successful connection
- Animate success state with subtle check icon

### Step 2: Discover Fields
```
┌─────────────────────────────────────────────────────────┐
│  Master Client Dashboard                                │
│  Found 24 tabs, 156 columns                             │
├─────────────────────────────────────────────────────────┤
│  Select tabs to include:                                │
│  ┌─────────────────────────────────────────────────────┐│
│  │ [✓] Master Client Sheet (52 columns)               ││
│  │ [✓] POD Leader Information (32 columns)            ││
│  │ [ ] Zoho API (legacy, skip)                        ││
│  │ [ ] Quick Links (reference only)                   ││
│  └─────────────────────────────────────────────────────┘│
│                                                         │
│  Preview of "Master Client Sheet":                      │
│  ┌──────────┬───────────┬──────────┬───────────┐       │
│  │ Brand    │ Client    │ Status   │ Tier      │       │
│  ├──────────┼───────────┼──────────┼───────────┤       │
│  │ AIRONEX  │ John D.   │ Active   │ Tier 1    │       │
│  │ EVOLWING │ Sarah M.  │ Churned  │ Tier 2    │       │
│  └──────────┴───────────┴──────────┴───────────┘       │
│                                                         │
│  [← Back]                             [Continue →]      │
└─────────────────────────────────────────────────────────┘
```

**UX Notes:**
- Show preview data (first 5 rows) to help admin understand content
- Expandable rows to see more columns
- Checkbox selection with "Select All" / "Deselect All"
- Gray out tabs that look like views or legacy

### Step 3: Classify Fields
This is the core of the wizard. For each selected tab, walk through the columns.

```
┌─────────────────────────────────────────────────────────┐
│  Classify: Master Client Sheet                          │
│  Column 3 of 52                                         │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Column Name: "Brand Name"                              │
│  Sample Values: AIRONEX, EVOLWING, PROANGENIX           │
│                                                         │
│  ┌─────────────────────────────────────────────────────┐│
│  │  Is this core data we should store?                ││
│  │  ○ Yes, this is important                          ││
│  │  ○ No, skip this column                            ││
│  │  ○ This is derived/calculated (reference only)     ││
│  └─────────────────────────────────────────────────────┘│
│                                                         │
│  [If Yes:]                                              │
│  ┌─────────────────────────────────────────────────────┐│
│  │  What entity does this belong to?                  ││
│  │  ● Partner                                         ││
│  │  ○ Staff                                           ││
│  │  ○ ASIN (product)                                  ││
│  │  ○ Other (specify)                                 ││
│  └─────────────────────────────────────────────────────┘│
│                                                         │
│  ┌─────────────────────────────────────────────────────┐│
│  │  Map to field:                                     ││
│  │  [brand_name ▼]  (existing field)                  ││
│  │  Or: [Create new field...]                         ││
│  └─────────────────────────────────────────────────────┘│
│                                                         │
│  ┌─────────────────────────────────────────────────────┐│
│  │  Is this the authoritative source for this field? ││
│  │  ● Yes - this is the source of truth               ││
│  │  ○ No - there's a better source (specify)          ││
│  └─────────────────────────────────────────────────────┘│
│                                                         │
│  [← Previous Column]  [Skip]  [Save & Next Column →]   │
└─────────────────────────────────────────────────────────┘
```

**UX Notes:**
- Progress bar at top showing completion
- Keyboard shortcuts for power users (Y/N/S for Yes/No/Skip)
- Remember previous selections for similar column names
- AI suggestion (future): "This looks like an email field, map to partner.email?"
- Collapsible "Advanced" section for transforms (date format, currency, etc.)

### Step 4: Review Mappings
Visual summary before staging.

```
┌─────────────────────────────────────────────────────────┐
│  Mapping Summary                                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Partners Table (12 fields mapped)                      │
│  ┌────────────────────┬─────────────────────────┐      │
│  │ Source Column      │ Target Field            │      │
│  ├────────────────────┼─────────────────────────┤      │
│  │ Brand Name         │ partners.brand_name ★   │      │
│  │ Client Name        │ partners.client_name    │      │
│  │ Status             │ partners.status         │      │
│  │ Tier               │ partners.tier           │      │
│  └────────────────────┴─────────────────────────┘      │
│  ★ = Authoritative source                              │
│                                                         │
│  Staff Table (8 fields mapped)                          │
│  [collapsed, click to expand]                           │
│                                                         │
│  Skipped Columns (24)                                   │
│  [collapsed, click to expand]                           │
│                                                         │
│  [← Back to Edit]                    [Stage Data →]     │
└─────────────────────────────────────────────────────────┘
```

### Step 5: Staging Area
Preview what will be created/updated, with diff view.

```
┌─────────────────────────────────────────────────────────┐
│  Staged Changes                      [Refresh] [Clear] │
├─────────────────────────────────────────────────────────┤
│  Ready to Review: 247 changes                           │
│                                                         │
│  [All] [Creates: 12] [Updates: 234] [Conflicts: 1]     │
│                                                         │
│  ┌─────────────────────────────────────────────────────┐│
│  │ ○ Partner: AIRONEX                    [UPDATE]     ││
│  │   tier: Tier 2 → Tier 1                            ││
│  │   base_fee: $2,500 → $3,000                        ││
│  │   Source: Master Client Sheet (row 15)             ││
│  ├─────────────────────────────────────────────────────┤│
│  │ ○ Partner: NEWBRAND                   [CREATE]     ││
│  │   brand_name: NEWBRAND                             ││
│  │   client_name: Mike Johnson                        ││
│  │   status: Onboarding                               ││
│  │   Source: Master Client Sheet (row 156)            ││
│  └─────────────────────────────────────────────────────┘│
│                                                         │
│  [Select All]  [Reject Selected]  [Approve Selected]   │
│                                                         │
│  [Approve All & Commit]                                 │
└─────────────────────────────────────────────────────────┘
```

**UX Notes:**
- Color coding: Green for creates, Yellow for updates, Red for conflicts
- Expandable rows for full detail
- Batch operations for efficiency
- "Conflict" = same field updated from two sources, needs manual resolution

### Step 6: Commit & Lineage
After approval, show what was committed and track lineage.

```
┌─────────────────────────────────────────────────────────┐
│  Sync Complete                                          │
├─────────────────────────────────────────────────────────┤
│  ✓ 12 partners created                                  │
│  ✓ 234 partners updated                                 │
│  ✓ 1 conflict resolved                                  │
│                                                         │
│  Field lineage updated. You can now see where each     │
│  field value originated in the partner detail view.    │
│                                                         │
│  [View Partners]  [Add Another Source]  [Done]         │
└─────────────────────────────────────────────────────────┘
```

## Data Model

### data_sources
```sql
CREATE TABLE data_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'google_sheet', 'google_form', 'api'
  connection_config JSONB NOT NULL, -- URL, credentials ref, etc.
  status TEXT DEFAULT 'active', -- 'active', 'paused', 'error'
  last_synced_at TIMESTAMPTZ,
  sync_schedule TEXT, -- cron expression or 'manual'
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### field_mappings
```sql
CREATE TABLE field_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_source_id UUID REFERENCES data_sources(id),
  source_tab TEXT, -- Sheet tab name
  source_column TEXT NOT NULL, -- Column header
  source_column_index INT, -- Column position (for headerless sheets)
  target_table TEXT NOT NULL, -- 'partners', 'staff', 'asins'
  target_field TEXT NOT NULL, -- Column name in target table
  transform_type TEXT DEFAULT 'none', -- 'none', 'date', 'currency', 'boolean'
  transform_config JSONB, -- Format strings, etc.
  is_authoritative BOOLEAN DEFAULT false, -- Is this THE source for this field?
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### staged_changes
```sql
CREATE TABLE staged_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL, -- Groups related changes
  data_source_id UUID REFERENCES data_sources(id),
  entity_type TEXT NOT NULL, -- 'partner', 'staff', 'asin'
  entity_key TEXT NOT NULL, -- Natural key (brand_name, email, asin_code)
  entity_id UUID, -- FK to existing record if update
  change_type TEXT NOT NULL, -- 'create', 'update', 'delete'
  old_values JSONB,
  new_values JSONB NOT NULL,
  changed_fields TEXT[], -- Which fields changed
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'applied'
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  applied_at TIMESTAMPTZ,
  source_row_ref TEXT, -- "Sheet X, Tab Y, Row Z" for traceability
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### field_lineage
```sql
CREATE TABLE field_lineage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  field_name TEXT NOT NULL,
  current_value TEXT,
  authoritative_source_id UUID REFERENCES data_sources(id),
  last_updated_from_source_at TIMESTAMPTZ,
  history JSONB, -- Array of {value, source_id, timestamp}
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(entity_type, entity_id, field_name)
);
```

---

## UX/UI & Animation Guidelines (Smart Mapper)

### The Design-Led 4-Phase Flow

**Design Principles Applied:**
- Progressive Disclosure: Simple first, complexity later
- Human Language: "What identifies each row?" not "Primary Key"
- Bulk Actions: Respect user's time with multi-select
- Inference: Deduce entity type from user's choices

---

**Phase 1: Preview** — "We found your data!"
- Show spreadsheet with detected header row highlighted
- Allow header row adjustment (up/down arrows)
- Rows before header fade to 50% opacity
- Simple, reassuring, visual confirmation

**Phase 2: Anchor Selection** — "What identifies each row?"
- Show all columns as clickable cards with sample values
- User clicks the column that NAMES each record
- **Key Innovation**: Entity type is INFERRED from selection
  - "Brand Name" → Partners
  - "Full Name" / "Email" → Staff
- Auto-classify other columns based on patterns after selection

**Phase 3: Bulk Classification** — "Classify your columns"
- All columns shown in a list with checkboxes
- Each column has a dropdown: Partner (with ASIN nested) / Staff / Weekly / Skip
- **Multi-select + Bulk Action Bar**:
  - Select multiple columns via checkboxes
  - Apply category to all selected at once
- Auto-detection patterns:
  - Weekly: columns matching `week`, date patterns, `w/`, etc.
  - Staff: columns matching `manager`, `email`, `slack`, etc.
  - Partner: columns matching `brand`, `tier`, `fee`, etc.
- Stats badges show classification breakdown
- Key badge for Partner/Staff anchors (ASIN has no key management)

**Phase 4: Field Mapping** — "Map to database fields"
- Organized by category (3-column layout):
  - Partner columns → Partner field dropdowns
  - Staff columns → Staff field dropdowns
  - Weekly columns → Pivot explanation
- Source/Reference toggle for each mapped field
- Weekly columns explained: "Will be pivoted into weekly_statuses table"

---

### Column Categories & Entity Hierarchy

**Entity Hierarchy:**
```
Partner (top-level client entity)
└── ASIN (products belonging to partners)

Staff (separate entity, team members)
```

**UI Dropdown Structure:**
- **Partner** → submenu with key options
  - ASIN (Product) - nested under Partner, no key management
- **Staff** → submenu with key options
- Weekly, Computed, Skip - flat options

**Field Registry:** All entity fields (names, types, groups, reference relationships) are defined in `src/lib/entity-fields/registry.ts`. The MapPhase uses `getGroupedFieldDefs()` for grouped dropdowns with reference arrows (e.g. "POD Leader -> Staff"). Never define field lists inline - always import from the registry.

| Category | Icon | Color | Behavior | Key Support |
|----------|------|-------|----------|-------------|
| Partner | 🏢 Building2 | Blue | Maps to `partners` table fields | ✓ Key designation |
| └─ ASIN | 📦 Package | Orange | Maps to `asins` table (child of Partner) | No keys (parent/child later) |
| Staff | 👥 Users | Green | Maps to `staff` table fields | ✓ Key designation |
| Weekly | 📅 Calendar | Purple | Pivoted to `weekly_statuses` table | — |
| Computed | 🔢 Calculator | Cyan | Stored in computed_fields registry | — |
| Skip | ⏭️ SkipForward | Gray | Not imported | — |

**Note:** ASIN is nested under Partner in the UI to communicate the entity hierarchy. Parent/child ASIN relationships (variations) will be added later.

---

## CRITICAL CONCEPT: Computed Fields

Some columns in spreadsheets aren't simple data - they're **computed values** that depend on:
- Other columns (formulas)
- Historical/time-series data (aggregations)
- External systems (lookups)
- Complex business logic (custom)

### Why Computed Fields Matter

**Example: "Current Time" column**
- The sheet has a "Time Zone" column (e.g., "America/New_York")
- The "Current Time" column shows the current time in that timezone
- This is calculated by a Google Apps Script - we shouldn't store the value directly

**Instead, we should:**
1. Store the source field (timezone)
2. Compute the derived field on-demand or on schedule
3. Enable hot-swapping the source (e.g., get timezone from Slack later)

### Computation Types

| Type | Icon | Description | Example |
|------|------|-------------|---------|
| **Formula** | 🔢 Calculator | Depends on other fields | Timezone → Current Time |
| **Aggregation** | 🗄️ Database | From time-series data | Latest weekly status, Months subscribed |
| **Lookup** | 🔍 Search | From external system | Payment status from Zoho/Xero |
| **Custom** | 💬 MessageSquare | Complex logic | Needs manual implementation |

### Computed Field Configuration Modal

When marking a column as "Computed", a configuration modal appears:

```
┌─────────────────────────────────────────────────────────────┐
│  Configure Computed Field                                   │
│  "Current Time"                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  How is this computed?                                      │
│  ┌───────────────┐  ┌───────────────┐                      │
│  │ 🔢 Formula    │  │ 🗄️ From History │                    │
│  │ From other    │  │ Aggregated     │                     │
│  │ fields        │  │ data           │                     │
│  └───────────────┘  └───────────────┘                      │
│  ┌───────────────┐  ┌───────────────┐                      │
│  │ 🔍 External   │  │ 💬 Custom      │                     │
│  │ Lookup        │  │ Logic          │                     │
│  │ Zoho, Slack...│  │ Describe it    │                     │
│  └───────────────┘  └───────────────┘                      │
│                                                             │
│  Which entity does this belong to?                          │
│  [Partner] [Staff] [ASIN]                                   │
│                                                             │
│  [Formula-specific options when selected]                   │
│  Depends on: [Time Zone________________]                    │
│  Formula:    [Timezone → Current Time ▼]                    │
│                                                             │
│  💡 Future: You'll be able to hot-swap data sources later  │
│                                                             │
│  [Cancel]                        [Save Configuration]       │
└─────────────────────────────────────────────────────────────┘
```

### Source Priority (Hot-Swapping)

Each computed field can have multiple potential sources with priorities:

```typescript
source_priority: [
  { source: 'sheet', source_ref: 'Master Client Sheet → Time Zone', priority: 1 },
  { source: 'slack', source_ref: 'Slack profile timezone', priority: 2 }
]
```

**Benefits:**
- Primary source (sheet) is used by default
- If unavailable/stale, fall back to secondary (Slack)
- Future: Admin can flip priorities without code changes

### Database Schema: computed_fields

```sql
CREATE TABLE computed_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Target location
  target_table TEXT NOT NULL,             -- 'partners', 'staff', 'asins'
  target_field TEXT NOT NULL,             -- Database column name
  display_name TEXT NOT NULL,             -- Human-friendly name

  -- Computation definition
  computation_type TEXT NOT NULL,         -- 'formula', 'aggregation', 'lookup', 'custom'
  config JSONB NOT NULL DEFAULT '{}',     -- Type-specific configuration

  -- Discovery context
  discovered_in_source_id UUID REFERENCES data_sources(id),
  discovered_in_tab TEXT,
  discovered_in_column TEXT,

  -- Source priority for hot-swapping
  source_priority JSONB NOT NULL DEFAULT '[]',

  -- Implementation status
  description TEXT,
  implementation_notes TEXT,
  is_implemented BOOLEAN NOT NULL DEFAULT false,

  UNIQUE(target_table, target_field)
);
```

### Config Examples

**Formula (Current Time from Timezone):**
```json
{
  "depends_on": ["timezone"],
  "formula": "timezone_to_current_time"
}
```

**Aggregation (Latest Status):**
```json
{
  "source_table": "weekly_statuses",
  "aggregation": "latest",
  "field": "status",
  "order_by": "week_date"
}
```

**Lookup (Payment Status from Zoho):**
```json
{
  "source": "zoho",
  "match_field": "email",
  "lookup_field": "payment_status"
}
```

### Workflow for Computed Fields

1. **Discovery**: Admin marks column as "Computed" in SmartMapper
2. **Configuration**: Admin defines computation type and config
3. **Registry**: Saved to `computed_fields` table
4. **Implementation**: Developer implements the computation logic
5. **Execution**: Computed fields run on schedule or on-demand
6. **Hot-Swap**: Admin can later change source priorities

### Built-in Formulas

| Formula | Description | Depends On | Output |
|---------|-------------|------------|--------|
| `timezone_to_current_time` | Current time in timezone | timezone | Time |
| `days_since` | Days since a date | date | Number |
| `months_between` | Months between dates | start_date, end_date | Number |

New formulas can be added as needed by implementing them in `src/lib/enrichment/computed.ts`.

---

### Animation Principles (Per Project CLAUDE.md)

- **ease-out** for all user interactions: `cubic-bezier(0.22, 1, 0.36, 1)`
- **Duration**: 200-300ms for UI transitions
- **Hover effects**: Use scale(1.005) with container padding to prevent clipping
- **Avoid AnimatePresence** on rapidly-updating content (use opacity toggle instead)
- **Loading states**: Always-rendered with opacity toggle, not conditional render

#### No Animation on Page Load

Use `initial={false}` on motion components to prevent entrance animations when the page renders. Only animate on **state changes** (e.g., header confirmed, column classified).

```typescript
// GOOD - no animation on mount, only animates when state changes
<motion.div
  initial={false}
  animate={{ scale: 1, opacity: 1 }}
  exit={{ scale: 0.8, opacity: 0 }}
  transition={{ duration: 0.15, ease: easeOut }}
/>

// BAD - animates every mount (flickery on page load/navigation)
<motion.div
  initial={{ scale: 0, opacity: 0 }}
  animate={{ scale: 1, opacity: 1 }}
/>
```

**Why?** Initial animations feel gimmicky and slow when loading a page with many elements. Reserve animations for meaningful state transitions that provide feedback.

### Scroll Container Pattern

When cards have hover effects inside ScrollArea:
```tsx
<ScrollArea className="h-[350px]">
  <div className="space-y-2 px-1 py-1 -mx-1 pr-3">
    {/* Cards with hover scale effects */}
  </div>
</ScrollArea>
```
- `px-1 py-1`: Padding for hover effects to breathe
- `-mx-1`: Negative margin to maintain visual alignment
- `pr-3`: Extra right padding for scrollbar

### Keyboard Navigation Standard

All selection interfaces (tabs, columns, options) should support keyboard navigation:

**Arrow Keys:**
- `↑` / `↓`: Navigate between items in vertical lists
- `←` / `→`: Navigate between items in horizontal lists or adjust values
- Focus should be visually indicated with a ring/outline

**Enter/Space:**
- `Enter`: Confirm/select the focused item
- `Space`: Toggle selection or expand/collapse

**Implementation Pattern:**
```tsx
const handleKeyDown = (e: React.KeyboardEvent, items: any[], selectedIndex: number) => {
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault()
      setSelected(Math.min(selectedIndex + 1, items.length - 1))
      break
    case 'ArrowUp':
      e.preventDefault()
      setSelected(Math.max(selectedIndex - 1, 0))
      break
    case 'Enter':
      e.preventDefault()
      confirmSelection(items[selectedIndex])
      break
  }
}
```

**Focus Management:**
- Use `tabIndex={0}` on container for keyboard focus
- Use `useRef` + `scrollIntoView` to keep focused item visible
- Visual focus indicator: `focus:ring-2 focus:ring-primary focus:ring-offset-2`

---

## Component Structure (Data Browser Architecture)

```
src/components/data-enrichment/
├── browser/                     # Data Browser components
│   ├── CategoryHub.tsx          # Level 1: Category cards (Sheets, Forms, Docs)
│   ├── CategoryCard.tsx         # Individual category card with stats
│   ├── SourceBrowser.tsx        # Level 2: Browser-tab interface
│   ├── SourceTabBar.tsx         # Top row: source tabs
│   ├── SheetTabBar.tsx          # Second row: sheet sub-tabs with Overview tab
│   ├── TabOverviewDashboard.tsx # Per-source dashboard with tab stats
│   ├── TabCard.tsx              # Grid view card for dashboard
│   ├── TabListRow.tsx           # List view row for dashboard
│   ├── AddSourceModal.tsx       # Modal for connecting new source
│   ├── CLAUDE.md                # Browser component documentation
│   └── BrowserShell.tsx         # Overall shell with breadcrumb nav
├── smart-mapper/                # Column classification (existing)
│   ├── SmartMapper.tsx          # Main classifier UI (unified dropdown)
│   ├── ColumnCard.tsx           # Individual column with classification
│   ├── KeyManagement.tsx        # Key confirmation and display
│   └── FilterTabs.tsx           # Filter columns by category
├── staging/                     # (unchanged)
│   ├── StagingDashboard.tsx
│   ├── StagedChangesList.tsx
│   ├── StagedChangeCard.tsx
│   ├── ConflictResolver.tsx
│   └── BatchActions.tsx
├── lineage/                     # Data Flow Map (React Flow)
│   ├── DataFlowMap.tsx          # Orchestrator (mobile/desktop switch)
│   ├── FlowCanvas.tsx           # React Flow canvas (desktop)
│   ├── MobileFlowList.tsx       # Card layout (mobile)
│   ├── index.ts                 # Barrel exports
│   ├── nodes/
│   │   ├── types.ts             # EntityNodeData, EntityFieldData, EntityGroupData, etc.
│   │   ├── EntityNode.tsx       # Entity node with field-level detail on expand
│   │   ├── SourceNode.tsx       # Data source node
│   │   └── FieldGroupNode.tsx   # Field group node
│   ├── edges/
│   │   ├── types.ts             # MappingEdgeData, ReferenceEdgeData
│   │   ├── MappingEdge.tsx      # Source-to-entity (solid)
│   │   └── ReferenceEdge.tsx    # Entity-to-entity (dashed)
│   ├── hooks/
│   │   ├── useFlowData.ts       # Fetch + transform API data
│   │   ├── useFlowLayout.ts     # Layout + entity expansion state
│   │   ├── useFlowFilters.ts    # Entity + status filters
│   │   └── usePinnedFields.ts   # Pin state (localStorage)
│   ├── utils/
│   │   ├── transform.ts         # API → React Flow nodes/edges
│   │   ├── layout.ts            # Node positioning
│   │   └── colors.ts            # Entity color map (hex for SVG)
│   └── panels/
│       └── FlowLegend.tsx       # Color coding legend
└── sources/                     # (unchanged)
    ├── SourceList.tsx
    ├── SourceCard.tsx
    └── SyncScheduler.tsx

src/lib/entity-fields/           # Field registry (single source of truth)
├── index.ts                     # Barrel exports
├── types.ts                     # FieldDefinition, ReferenceConfig, FieldGroup
└── registry.ts                  # 47 field definitions + 10 helper functions
```

### New Components to Build

**CategoryHub.tsx**
- Grid of category cards
- Fetches stats from API
- Handles navigation to category view

**SourceBrowser.tsx**
- Main browser interface
- Manages active source tab
- Manages active sheet sub-tab
- Renders SmartMapper for column classification

**SourceTabBar.tsx**
- Horizontal tabs for data sources
- Animated active indicator
- Add source button (`+`)
- Close tab button (if applicable)

**SheetTabBar.tsx**
- Sub-tabs for sheets within active source
- Smaller, secondary styling
- Shows tab completion status (dots/badges)

## API Routes

```
POST /api/data-enrichment/sources
  - Create new data source

GET /api/data-enrichment/sources
  - List all sources with status

POST /api/data-enrichment/sources/[id]/test
  - Test connection to source

POST /api/data-enrichment/sources/[id]/discover
  - Fetch tabs/columns from source

POST /api/data-enrichment/mappings
  - Save field mappings for a source

POST /api/data-enrichment/sync
  - Run sync, populate staged_changes

GET /api/data-enrichment/staged
  - Get pending staged changes

POST /api/data-enrichment/staged/approve
  - Approve changes (batch)

POST /api/data-enrichment/staged/reject
  - Reject changes (batch)

POST /api/data-enrichment/staged/apply
  - Apply approved changes to master tables
```

## Future Enhancements

1. **AI-Assisted Mapping**: Suggest field mappings based on column names and sample data
2. **Form Support**: Google Forms, TypeForm integration
3. **API Connectors**: Close IO, Zoho, Amazon SP-API
4. **Scheduled Syncs**: Cron-based automatic synchronization
5. **Conflict Dashboard**: Dedicated view for managing data conflicts across sources
6. **Rollback**: Ability to undo a sync batch

## Mobile Experience

Data Enrichment supports mobile devices with responsive layouts optimized for touch.

### Column Classification (SmartMapper)

**Desktop**: Table-style list view with horizontal layout
- Columns displayed as rows with inline category dropdown
- Keyboard shortcuts for power users (1-5 for categories)
- Shift/Cmd-click for multi-select

**Mobile**: Card-based stacked layout
- Each column displayed as a card (`MobileColumnCard` component)
- Full-width category dropdown (44px+ touch targets)
- Staggered entry animations (50ms delay per card)
- Key toggle and tag picker as touch-friendly buttons

### Responsive Breakpoints

```
Mobile:  < 768px (md breakpoint)
Desktop: >= 768px
```

### Component Visibility

| Component | Mobile | Desktop |
|-----------|--------|---------|
| Desktop column rows | Hidden | Visible |
| Mobile column cards | Visible | Hidden |
| Keyboard shortcuts legend | Hidden | Visible |
| Bulk action bar | Wrapping layout | Inline layout |
| Filter tabs | Horizontal scroll | Inline |
| Tab bars | Horizontal scroll | Inline |

### Touch Target Guidelines

- Minimum 44px height for interactive elements
- Full-width dropdowns for easier selection
- Buttons: `h-9` on mobile vs `h-7` on desktop
- Selection checkboxes: Large hit areas with padding

### Files

- `src/components/data-enrichment/mobile-column-card.tsx` - Mobile card component
- `src/components/data-enrichment/smart-mapper.tsx` - Responsive ClassifyPhase
- `src/components/data-enrichment/browser/sheet-tab-bar.tsx` - Scrollable tabs

---

## Related Files

- `src/lib/sheets/client.ts` - Google Sheets API wrapper
- `src/lib/enrichment/sync.ts` - Core sync logic
- `src/lib/enrichment/transforms.ts` - Data transformation functions
- `src/types/enrichment.ts` - TypeScript types for this feature
