# Sync Engine

> Background data synchronization from external sources to Sophie Hub entities.

---

## Overview

The sync engine pulls data from mapped sources (Google Sheets, Close.io, etc.) and writes to core entity tables (partners, staff, asins) based on configured mappings.

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ Data Source  │────▶│ Sync Engine  │────▶│ Core Entity  │
│ (Sheet, API) │     │ (Transform)  │     │ (partners)   │
└──────────────┘     └──────────────┘     └──────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │ Sync Runs    │
                     │ (Audit Log)  │
                     └──────────────┘
```

---

## Key Concepts

### Authority Rules

| Authority | Behavior |
|-----------|----------|
| `source_of_truth` | Source value overwrites entity field |
| `reference` | Source value stored but doesn't overwrite |
| `derived` | Computed from other fields, never synced |

### Sync Modes

| Mode | Trigger | Use Case |
|------|---------|----------|
| **Manual** | Admin clicks "Sync Now" | Testing, one-off imports |
| **Scheduled** | Cron job (hourly/daily) | Regular data refresh |
| **Webhook** | External trigger | Real-time updates (future) |

### Conflict Resolution

When multiple sources map to the same field:
1. Check `source_priority` on computed_fields
2. Higher priority source wins
3. Log conflict for admin review

---

## Architecture

### Core Components

```
src/lib/sync/
├── engine.ts           # Main SyncEngine class
├── strategies/
│   ├── base.ts         # BaseSyncStrategy interface
│   ├── google-sheets.ts # Google Sheets sync
│   └── api.ts          # Generic API sync
├── transformers/
│   ├── index.ts        # Transform registry
│   ├── date.ts         # Date format transforms
│   ├── currency.ts     # Currency transforms
│   └── boolean.ts      # Boolean transforms
├── reconciler.ts       # Conflict resolution
└── reporter.ts         # Sync run reporting
```

### SyncEngine Class

```typescript
// src/lib/sync/engine.ts

import { getAdminClient } from '@/lib/supabase/admin'
import { getConnector } from '@/lib/connectors'
import type { DataSource, TabMapping, ColumnMapping } from '@/types/enrichment'

export interface SyncOptions {
  dryRun?: boolean           // Preview changes without applying
  forceOverwrite?: boolean   // Ignore authority rules (admin only)
  rowLimit?: number          // Limit rows for testing
}

export interface SyncResult {
  success: boolean
  syncRunId: string
  stats: {
    rowsProcessed: number
    rowsCreated: number
    rowsUpdated: number
    rowsSkipped: number
    errors: SyncError[]
  }
  changes: ChangePreview[]  // For dry run
}

export class SyncEngine {
  private supabase = getAdminClient()

  /**
   * Sync a single tab mapping
   */
  async syncTab(
    tabMappingId: string,
    options: SyncOptions = {}
  ): Promise<SyncResult> {
    // 1. Load configuration
    const { tabMapping, columnMappings, dataSource } =
      await this.loadConfig(tabMappingId)

    // 2. Create sync run record
    const syncRunId = await this.createSyncRun(dataSource.id, tabMappingId)

    try {
      // 3. Fetch source data
      const connector = getConnector(dataSource.type as 'google_sheet')
      const sourceData = await connector.getData(
        await this.getAccessToken(),
        dataSource.connector_config,
        tabMapping.tab_name
      )

      // 4. Transform and reconcile
      const changes = await this.processRows(
        sourceData,
        tabMapping,
        columnMappings,
        options
      )

      // 5. Apply changes (unless dry run)
      if (!options.dryRun) {
        await this.applyChanges(changes, tabMapping.primary_entity)
      }

      // 6. Complete sync run
      const stats = this.calculateStats(changes)
      await this.completeSyncRun(syncRunId, stats)

      return { success: true, syncRunId, stats, changes }

    } catch (error) {
      await this.failSyncRun(syncRunId, error)
      throw error
    }
  }

  /**
   * Sync all active tabs for a data source
   */
  async syncDataSource(
    dataSourceId: string,
    options: SyncOptions = {}
  ): Promise<SyncResult[]> {
    const { data: tabMappings } = await this.supabase
      .from('tab_mappings')
      .select('id')
      .eq('data_source_id', dataSourceId)
      .eq('status', 'active')

    const results: SyncResult[] = []
    for (const tab of tabMappings || []) {
      const result = await this.syncTab(tab.id, options)
      results.push(result)
    }

    return results
  }

  /**
   * Process rows through mapping pipeline
   */
  private async processRows(
    sourceData: { headers: string[]; rows: string[][] },
    tabMapping: TabMapping,
    columnMappings: ColumnMapping[],
    options: SyncOptions
  ): Promise<EntityChange[]> {
    const changes: EntityChange[] = []
    const keyMapping = columnMappings.find(m => m.is_key)

    if (!keyMapping) {
      throw new Error('No key column defined for this mapping')
    }

    const keyIndex = sourceData.headers.indexOf(keyMapping.source_column)

    for (const row of sourceData.rows.slice(0, options.rowLimit)) {
      const keyValue = row[keyIndex]
      if (!keyValue) continue  // Skip rows without key

      // Build entity update from mapped columns
      const entityUpdate = this.buildEntityUpdate(
        row,
        sourceData.headers,
        columnMappings,
        tabMapping.primary_entity
      )

      // Check existing record
      const existing = await this.findExisting(
        tabMapping.primary_entity,
        keyMapping.target_field!,
        keyValue
      )

      // Determine change type
      const change: EntityChange = {
        entity: tabMapping.primary_entity,
        keyField: keyMapping.target_field!,
        keyValue,
        type: existing ? 'update' : 'create',
        fields: entityUpdate,
        existing: existing || undefined
      }

      // Apply authority rules
      if (existing && !options.forceOverwrite) {
        change.fields = this.filterByAuthority(
          change.fields,
          columnMappings
        )
      }

      if (Object.keys(change.fields).length > 0) {
        changes.push(change)
      }
    }

    return changes
  }

  /**
   * Apply changes to database
   */
  private async applyChanges(
    changes: EntityChange[],
    entityType: string
  ): Promise<void> {
    for (const change of changes) {
      if (change.type === 'create') {
        await this.supabase
          .from(entityType)
          .insert({ [change.keyField]: change.keyValue, ...change.fields })
      } else {
        await this.supabase
          .from(entityType)
          .update(change.fields)
          .eq(change.keyField, change.keyValue)
      }
    }
  }

  /**
   * Filter fields based on authority level
   * Only source_of_truth fields can overwrite existing values
   */
  private filterByAuthority(
    fields: Record<string, unknown>,
    mappings: ColumnMapping[]
  ): Record<string, unknown> {
    const authoritative: Record<string, unknown> = {}

    for (const [field, value] of Object.entries(fields)) {
      const mapping = mappings.find(m => m.target_field === field)
      if (mapping?.authority === 'source_of_truth') {
        authoritative[field] = value
      }
    }

    return authoritative
  }
}
```

---

## Database Schema

### sync_runs Table (Already Exists)

```sql
CREATE TABLE sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_source_id UUID REFERENCES data_sources(id),
  tab_mapping_id UUID REFERENCES tab_mappings(id),
  status TEXT NOT NULL,  -- 'running' | 'completed' | 'failed'
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  rows_processed INT DEFAULT 0,
  rows_created INT DEFAULT 0,
  rows_updated INT DEFAULT 0,
  rows_skipped INT DEFAULT 0,
  errors JSONB,
  triggered_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### field_lineage Table (New)

Track where each field value came from:

```sql
CREATE TABLE field_lineage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,         -- 'partners', 'staff', 'asins'
  entity_id UUID NOT NULL,           -- ID of the entity record
  field_name TEXT NOT NULL,          -- Field that was updated
  source_type TEXT NOT NULL,         -- 'google_sheet', 'api', 'app'
  source_id UUID,                    -- data_source_id if from external
  source_ref TEXT,                   -- Human-readable: "Master Sheet → Column B"
  previous_value JSONB,              -- Value before change
  new_value JSONB,                   -- Value after change
  sync_run_id UUID,                  -- Which sync run made this change
  changed_by UUID,                   -- User ID if manual, null if sync
  changed_at TIMESTAMPTZ DEFAULT NOW(),

  -- Composite index for entity lookups
  UNIQUE(entity_type, entity_id, field_name, changed_at)
);

CREATE INDEX idx_lineage_entity ON field_lineage(entity_type, entity_id);
CREATE INDEX idx_lineage_source ON field_lineage(source_id);
```

---

## API Endpoints

### POST /api/sync/tab/:tabMappingId

Sync a single tab.

```typescript
// Request
{
  dry_run?: boolean
  force_overwrite?: boolean
  row_limit?: number
}

// Response
{
  success: true,
  sync_run_id: "uuid",
  stats: {
    rows_processed: 150,
    rows_created: 12,
    rows_updated: 138,
    rows_skipped: 0,
    errors: []
  }
}
```

### POST /api/sync/source/:dataSourceId

Sync all active tabs for a source.

### GET /api/sync/runs

List recent sync runs with status.

### GET /api/sync/runs/:syncRunId

Get detailed sync run results.

---

## UI Components

### Sync Button in TabOverviewDashboard

```tsx
<Button
  variant="outline"
  onClick={() => handleSync(tab.id)}
  disabled={syncing}
>
  {syncing ? (
    <>
      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      Syncing...
    </>
  ) : (
    <>
      <RefreshCw className="h-4 w-4 mr-2" />
      Sync Now
    </>
  )}
</Button>
```

### Sync History Panel

```
┌─────────────────────────────────────────────────────────────┐
│ Sync History                                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ✅ Today, 2:30 PM                                          │
│     150 rows processed • 12 created • 138 updated           │
│                                                             │
│  ✅ Today, 10:15 AM                                         │
│     148 rows processed • 0 created • 148 updated            │
│                                                             │
│  ⚠️ Yesterday, 4:00 PM                                      │
│     150 rows processed • 2 errors                           │
│     └─ Row 47: Invalid email format                         │
│     └─ Row 89: Missing required field 'brand_name'          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 2.1: Core Engine (COMPLETE)
- [x] SyncEngine class (`src/lib/sync/engine.ts`)
- [x] Google Sheets sync strategy (via connector pattern)
- [x] Basic transform pipeline (`src/lib/sync/transforms.ts`)
- [x] sync_runs tracking

### Phase 2.2: API & UI (IN PROGRESS)
- [x] POST /api/sync/tab endpoint
- [x] GET /api/sync/runs endpoint
- [x] GET /api/sync/runs/[id] endpoint
- [x] Sync button in TabOverviewDashboard
- [x] Sync progress indicator (loading state + tooltip)
- [ ] Sync history panel

### Phase 2.3: Lineage Tracking (IN PROGRESS)
- [x] field_lineage table migration
- [x] Lineage recording on sync
- [ ] "Where did this come from?" UI

### Phase 2.4: Scheduling
- [ ] Cron job for scheduled sync
- [ ] Per-source sync schedule config
- [ ] Sync queue for rate limiting

---

## Error Handling

### Row-Level Errors

```typescript
interface SyncError {
  row: number
  column?: string
  error: string
  severity: 'warning' | 'error'
}
```

Errors don't stop the sync - they're collected and reported.

### Fatal Errors

- Auth failure (token expired)
- Source not found
- Database connection failure

Fatal errors abort the sync and mark run as failed.

---

## Performance Considerations

1. **Batch Inserts**: Use bulk inserts for creates (50 rows at a time)
2. **Parallel Processing**: Process multiple tabs concurrently
3. **Incremental Sync**: Track last sync row count, only process new rows
4. **Rate Limiting**: Respect Google Sheets API quotas (100 req/100 sec)

---

*Design-led by Emil Kowalski principles: Clear feedback on sync status, progressive disclosure of errors.*
