# Data Enrichment Wizard - Feature Context

## Purpose

The Data Enrichment Wizard is the **control room** for bringing external data into Sophie Hub. It replaces the chaotic process of manually updating spreadsheets and running one-off scripts with a visual, guided interface.

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

## The New Approach

**Entity-first thinking**: We know we have Partners and Staff. Everything maps to those. The wizard guides the admin through:

1. What is this data source?
2. What fields does it contain?
3. For each field: Is this core data? What entity does it belong to? Where should it live?
4. Stage the data for review
5. Commit when ready

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
| Weekly | 📅 Calendar | Purple | Pivoted to `weekly_statuses` table |
| Skip | ⏭️ SkipForward | Gray | Not imported |

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

## Component Structure

```
src/components/data-enrichment/
├── wizard/
│   ├── WizardShell.tsx         # Overall wizard container, step management
│   ├── StepIndicator.tsx       # Progress bar showing current step
│   ├── ConnectSourceStep.tsx   # Step 1
│   ├── DiscoverFieldsStep.tsx  # Step 2
│   ├── ClassifyFieldsStep.tsx  # Step 3
│   ├── ReviewMappingsStep.tsx  # Step 4
│   └── FieldClassifier.tsx     # The per-field classification UI
├── staging/
│   ├── StagingDashboard.tsx    # Overview of all staged changes
│   ├── StagedChangesList.tsx   # List view of changes
│   ├── StagedChangeCard.tsx    # Individual change with diff
│   ├── ConflictResolver.tsx    # UI for resolving conflicts
│   └── BatchActions.tsx        # Select all, approve all, etc.
├── lineage/
│   ├── LineageGraph.tsx        # Visual representation of data flow
│   ├── FieldLineagePopover.tsx # Hover on field to see source
│   └── SourceBadge.tsx         # Shows where value came from
└── sources/
    ├── SourceList.tsx          # All configured sources
    ├── SourceCard.tsx          # Individual source with status
    └── SyncScheduler.tsx       # Configure auto-sync
```

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
