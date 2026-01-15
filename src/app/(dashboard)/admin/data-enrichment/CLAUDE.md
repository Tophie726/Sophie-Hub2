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
