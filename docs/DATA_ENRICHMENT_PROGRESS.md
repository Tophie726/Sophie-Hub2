# Data Enrichment Progress Tracker

> Tracking the implementation of Sophie Hub's data enrichment system.
> Last updated: 2026-01-24 (Sync Engine Implementation)

---

## Current Phase: Phase 2 - Sync Engine (In Progress)

### Status: Core Engine Complete, API Ready, UI Pending

---

## Phase 1: Connector Foundation

### Completed Items

| Task | Status | Date | Notes |
|------|--------|------|-------|
| Create connector type definitions | Done | 2026-01-24 | `src/lib/connectors/types.ts` |
| Create base connector interface | Done | 2026-01-24 | `src/lib/connectors/base.ts` |
| Create connector registry | Done | 2026-01-24 | Singleton pattern |
| Implement Google Sheets connector | Done | 2026-01-24 | Wraps existing sheets.ts |
| Add Zod validation schemas | Done | 2026-01-24 | V2 schemas with connector_config |
| Database migration | Done | 2026-01-24 | `connector_config` JSONB column |
| Update data-sources API | Done | 2026-01-24 | Accepts both legacy and new format |
| Update mappings/save API | Done | 2026-01-24 | Dual-write for backward compat |
| Type consolidation | Done | 2026-01-24 | Single source of truth in entities.ts |
| Update ARCHITECTURE.md | Done | 2026-01-24 | Documented connector pattern |

### Remaining Items

| Task | Status | Priority | Notes |
|------|--------|----------|-------|
| Apply database migration | Pending | HIGH | Run `supabase migration up` |
| Component abstraction (search modal) | Pending | LOW | SheetSearchModal → ConnectorSearchModal |
| Create connector picker UI | Pending | LOW | "Add Source" flow with connector selection |

---

## Phase 2: Sync Engine

### Core Engine: Complete

| Task | Status | Date | Notes |
|------|--------|------|-------|
| Sync types definition | Done | 2026-01-24 | `src/lib/sync/types.ts` |
| Value transforms | Done | 2026-01-24 | `src/lib/sync/transforms.ts` - date, currency, boolean, number |
| SyncEngine class | Done | 2026-01-24 | `src/lib/sync/engine.ts` - syncTab, syncDataSource |
| Module exports | Done | 2026-01-24 | `src/lib/sync/index.ts` - getSyncEngine singleton |
| Field lineage migration | Done | 2026-01-24 | `20260124_field_lineage.sql` |
| POST /api/sync/tab/[id] | Done | 2026-01-24 | Trigger sync for a tab mapping |
| GET /api/sync/runs | Done | 2026-01-24 | List sync runs with filtering |
| GET /api/sync/runs/[id] | Done | 2026-01-24 | Get sync run details |

### Remaining (Phase 2)

| Task | Status | Priority | Notes |
|------|--------|----------|-------|
| Apply database migrations | Pending | HIGH | Run connector_config + field_lineage migrations |
| Sync button in TabOverviewDashboard | Done | HIGH | "Sync Now" button with tooltip status |
| Sync history panel | Pending | MEDIUM | Show recent sync runs for a tab |
| Authority toggle UI | Pending | MEDIUM | Switch field from source_of_truth → reference |
| Visual data map component | Pending | LOW | Canvas/SVG visualization |
| Lineage visualization | Pending | LOW | "Where did this value come from?" |

---

## Phase 3: Security Hardening

### Not Started

| Task | Status | Priority | Notes |
|------|--------|----------|-------|
| Audit logging | Pending | HIGH | mapping_audit_log table |
| Rate limiting | Pending | MEDIUM | Protect external APIs |
| Credential storage | Pending | MEDIUM | Secure API keys for connectors |

---

## Phase 4: Additional Connectors

### Not Started

| Connector | Status | Effort Est. | Notes |
|-----------|--------|-------------|-------|
| Close.io | Pending | 12-17 hrs | CRM data |
| Zoho | Pending | 10-14 hrs | Invoicing data |
| Xero | Pending | 8-12 hrs | Accounting data |
| Typeform | Pending | 10-14 hrs | Form responses |
| ClickUp | Pending | 8-12 hrs | Task management |
| Asana | Pending | 8-12 hrs | Project management |

---

## Special Considerations

### Nested Sheet Architecture (Brand Information Sheets)

Sophie Society has a complex nested data structure that requires special handling:

```
Partner
└── Brand Information Sheet (one per partner)
    └── ASIN rows
        ├── Keyword Research Sheet (linked)
        ├── Market & Comp Analysis Sheet (linked)
        └── Campaign Structure Sheet (linked)
```

**Challenges:**
1. Links to other sheets are stored as cell values (URLs or sheet IDs)
2. Linked sheets have complex layouts (not simple tabular data)
3. Need "mini programs" to extract structured data from each sheet type

**Proposed Approach:**
1. Create sheet type templates (KeywordResearch, MarketAnalysis, CampaignStructure)
2. Each template defines extraction rules for that sheet type
3. Brand Information Sheet connector recursively resolves linked sheets
4. Store extracted data in appropriate entity tables (ASINs, campaigns, keywords)

**Status:** Design phase - needs UX exploration

### AI-Assisted Mapping (Claude API)

In-app AI co-pilot for column mapping at multiple granularity levels.

**Granularity Levels:**
1. **Column** - Click sparkle icon, get suggestion for single column
2. **Tab** - "AI Suggest All" analyzes entire tab
3. **Sheet** - Structure analysis for complex nested sheets

**Architecture:**
- `MappingAssistantSDK` class with schema context
- Tool-use for structured suggestions
- Confidence scores + reasoning
- Human always approves

**Full Design:** See `docs/features/AI_MAPPING_ASSISTANT.md`

**Status:** Design complete, implementation pending

---

## Files Reference

### Core Connector System
- `src/lib/connectors/index.ts` - Main export
- `src/lib/connectors/types.ts` - Type definitions
- `src/lib/connectors/base.ts` - IConnector interface
- `src/lib/connectors/registry.ts` - Singleton registry
- `src/lib/connectors/google-sheets.ts` - Google Sheets implementation

### Sync Engine
- `src/lib/sync/index.ts` - Module exports, getSyncEngine singleton
- `src/lib/sync/types.ts` - SyncOptions, SyncResult, EntityChange, etc.
- `src/lib/sync/transforms.ts` - Value transforms (date, currency, boolean, number)
- `src/lib/sync/engine.ts` - SyncEngine class

### Sync API Routes
- `src/app/api/sync/tab/[id]/route.ts` - POST to trigger sync
- `src/app/api/sync/runs/route.ts` - GET list of sync runs
- `src/app/api/sync/runs/[id]/route.ts` - GET sync run details

### Types (Single Source of Truth)
- `src/types/entities.ts` - CategoryStats, ColumnCategory, EntityType
- `src/types/enrichment.ts` - Enrichment-specific types

### API Routes
- `src/app/api/data-sources/route.ts` - Source CRUD
- `src/app/api/mappings/save/route.ts` - Save mappings
- `src/app/api/sheets/*` - Google Sheets specific

### Database Migrations
- `supabase/migrations/20260124_connector_config.sql` - Connector config column
- `supabase/migrations/20260124_field_lineage.sql` - Field lineage tracking

### Documentation
- `ARCHITECTURE.md` - Connector architecture
- `docs/features/SYNC_ENGINE.md` - Sync engine design doc
- `docs/features/AI_MAPPING_ASSISTANT.md` - AI mapping co-pilot design
- `src/components/data-enrichment/ROADMAP.md` - Feature roadmap

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-01-24 | Dual-write legacy + connector_config | Backward compatibility |
| 2026-01-24 | Singleton registry pattern | Matches getAdminClient() pattern |
| 2026-01-24 | Type consolidation to entities.ts | Reduce drift, single source of truth |
| 2026-01-24 | Keep SmartMapper connector-agnostic | Already uses generic TabRawData |
| 2026-01-24 | Sync engine uses authority rules | Only source_of_truth fields can overwrite existing |
| 2026-01-24 | Field lineage tracks all changes | Full audit trail for data provenance |
| 2026-01-24 | Batch inserts (50 at a time) | Performance optimization for large syncs |

---

## Next Session Priorities

1. [ ] Apply database migrations (`supabase migration up` for connector_config + field_lineage)
2. [x] Add Sync button to TabOverviewDashboard - DONE
3. [ ] Create SyncHistoryPanel component
4. [ ] Design nested sheet extraction UX
5. [ ] Evaluate Claude API integration approach

---

*This file tracks active development. See ROADMAP.md for full feature planning.*
