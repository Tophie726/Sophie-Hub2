# Data Enrichment - Feature Context

## Branch: dev/data-browser-ux

**This branch experiments with a new "Data Browser" UX paradigm.**

The previous approach used a step-by-step wizard. This new approach uses a **browser-tab metaphor** for more fluid, spatial navigation between data sources.

---

## Purpose

Data Enrichment is the **control room** for bringing external data into Sophie Hub. It replaces the chaotic process of manually updating spreadsheets and running one-off scripts with a visual, intuitive interface.

**Only Admin users have access to this feature.**

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
- Each column has a dropdown: Partner / Staff / Weekly / Skip
- **Multi-select + Bulk Action Bar**:
  - Select multiple columns via checkboxes
  - Apply category to all selected at once
- Auto-detection patterns:
  - Weekly: columns matching `week`, date patterns, `w/`, etc.
  - Staff: columns matching `manager`, `email`, `slack`, etc.
  - Partner: columns matching `brand`, `tier`, `fee`, etc.
- Stats badges show classification breakdown
- Anchor column locked with "Key" badge

**Phase 4: Field Mapping** — "Map to database fields"
- Organized by category (3-column layout):
  - Partner columns → Partner field dropdowns
  - Staff columns → Staff field dropdowns
  - Weekly columns → Pivot explanation
- Source/Reference toggle for each mapped field
- Weekly columns explained: "Will be pivoted into weekly_statuses table"

---

### Column Categories

| Category | Icon | Color | Behavior |
|----------|------|-------|----------|
| Partner | 🏢 Building2 | Blue | Maps to `partners` table fields |
| Staff | 👥 Users | Green | Maps to `staff` table fields |
| ASIN | 📦 Package | Orange | Maps to `asins` table fields |
| Weekly | 📅 Calendar | Purple | Pivoted to `weekly_statuses` table |
| Computed | 🔢 Calculator | Cyan | Stored in computed_fields registry, not synced directly |
| Skip | ⏭️ SkipForward | Gray | Not imported |

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
├── browser/                     # NEW: Data Browser components
│   ├── CategoryHub.tsx          # Level 1: Category cards (Sheets, Forms, Docs)
│   ├── CategoryCard.tsx         # Individual category card with stats
│   ├── SourceBrowser.tsx        # Level 2: Browser-tab interface
│   ├── SourceTabBar.tsx         # Top row: source tabs
│   ├── SheetTabBar.tsx          # Second row: sheet sub-tabs
│   ├── AddSourceModal.tsx       # Modal for connecting new source
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
├── lineage/                     # (unchanged)
│   ├── LineageGraph.tsx
│   ├── FieldLineagePopover.tsx
│   └── SourceBadge.tsx
└── sources/                     # (unchanged)
    ├── SourceList.tsx
    ├── SourceCard.tsx
    └── SyncScheduler.tsx
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

## Related Files

- `src/lib/sheets/client.ts` - Google Sheets API wrapper
- `src/lib/enrichment/sync.ts` - Core sync logic
- `src/lib/enrichment/transforms.ts` - Data transformation functions
- `src/types/enrichment.ts` - TypeScript types for this feature
