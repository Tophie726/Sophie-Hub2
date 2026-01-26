# Data Enrichment Progress Tracker

> Tracking the implementation of Sophie Hub's data enrichment system.
> Last updated: 2026-01-26 (Dry run preview UI: SyncPreviewDialog shows changes before committing sync)

---

## Current Phase: Production Ready for Google Sheets

### Status: Core pipeline complete, ready for real data testing

---

## Phase 1: Connector Foundation

### Completed Items

| Task | Status | Date | Notes |
|------|--------|------|-------|
| Create connector type definitions | Done | 2026-01-24 | `src/lib/connectors/types.ts` |
| Create base connector interface | Done | 2026-01-24 | `src/lib/connectors/base.ts` |
| Create connector registry | Done | 2026-01-24 | Singleton pattern |
| Implement Google Sheets connector | Done | 2026-01-24 | Wraps existing sheets.ts |
| Add Zod validation schemas | Done | 2026-01-24 | V2 schemas with connection_config |
| Database migration | Done | 2026-01-24 | `connection_config` JSONB column (backfilled) |
| Update data-sources API | Done | 2026-01-24 | Accepts both legacy and new format |
| Update mappings/save API | Done | 2026-01-24 | Dual-write for backward compat |
| Type consolidation | Done | 2026-01-24 | Single source of truth in entities.ts |
| Update ARCHITECTURE.md | Done | 2026-01-24 | Documented connector pattern |

### Remaining Items

| Task | Status | Priority | Notes |
|------|--------|----------|-------|
| Apply database migration | Done | HIGH | `connection_config` backfilled via REST API |
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
| Apply database migrations | Done | HIGH | `connection_config` backfilled via REST API |
| Sync button in TabOverviewDashboard | Done | HIGH | "Sync Now" button with tooltip status |
| Sync history panel | Done | MEDIUM | Collapsible panel with expandable error details |
| Authority toggle UI | Done | MEDIUM | Already implemented in SmartMapper MapPhase |
| Visual data map component | Done | MEDIUM | Phase 5.1: React Flow canvas + mobile card list |
| Entity field registry | Done | HIGH | `src/lib/entity-fields/` - single source of truth |
| **Dry run preview UI** | **Done** | **HIGH** | `SyncPreviewDialog`: dry run → preview creates/updates/skips → confirm → actual sync |
| End-to-end sync verification | Pending | HIGH | Full pipeline test: map columns → sync → verify entity tables |
| Error recovery UX | Pending | MEDIUM | Better error handling for partial sync failures |
| Lineage visualization | Pending | MEDIUM | "Where did this value come from?" |

---

## Phase 3: Security Hardening

### Complete (Credential Storage Deferred)

| Task | Status | Priority | Notes |
|------|--------|----------|-------|
| Audit logging | Done | HIGH | `mapping_audit_log` table + `src/lib/audit/index.ts` |
| Rate limiting | Done | MEDIUM | `src/lib/rate-limit/index.ts` - sliding window algorithm |
| Credential storage | Deferred | MEDIUM | Deferred until Phase 4 (API connectors need API keys) |

### Audit Logging Details

- **Migration:** `supabase/migrations/20260124_audit_log.sql`
- **Service:** `src/lib/audit/index.ts` - singleton with convenience methods
- **API:** `GET /api/audit` - retrieve logs with filtering
- **Integrated in:**
  - Sync engine (sync_start, sync_complete, sync_fail)
  - Mappings save API (mapping_save)
  - Data sources API (create)

### Rate Limiting Details

- **Service:** `src/lib/rate-limit/index.ts` - in-memory sliding window
- **Presets:**
  - `GOOGLE_SHEETS`: 100 requests per 100 seconds (matches API quota)
  - `SYNC`: 10 syncs per minute
  - `API_GENERAL`: 100 requests per minute
  - `STRICT`: 5 requests per minute (expensive operations)
- **Protected routes:**
  - `/api/sync/tab/[id]` - sync operations
  - `/api/sheets/*` - all Google Sheets API calls
- **Response headers:** `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

---

## Phase 5: Visual Data Flow Map

### Phase 5.1: Foundation (Complete)

| Task | Status | Date | Notes |
|------|--------|------|-------|
| Install @xyflow/react | Done | 2026-01-26 | React Flow v12, MIT, ~180KB |
| GET /api/flow-map endpoint | Done | 2026-01-26 | 3-query optimization pattern |
| DataFlowMap orchestrator | Done | 2026-01-26 | Mobile/desktop switch at 768px |
| FlowCanvas (desktop) | Done | 2026-01-26 | React Flow with pan, zoom, minimap |
| MobileFlowList (mobile) | Done | 2026-01-26 | Hierarchical card layout |
| EntityNode custom node | Done | 2026-01-26 | Progress ring, expandable groups |
| SourceNode custom node | Done | 2026-01-26 | Sheet icon, tab count badge |
| FieldGroupNode custom node | Done | 2026-01-26 | Mini progress bar per group |
| MappingEdge (solid) | Done | 2026-01-26 | Source-to-entity, scaled stroke |
| ReferenceEdge (dashed) | Done | 2026-01-26 | Entity-to-entity reference |
| FlowLegend panel | Done | 2026-01-26 | Color coding + edge type legend |
| Category Hub integration | Done | 2026-01-26 | Top-right "Data Flow" button in page header |
| useFlowData hook | Done | 2026-01-26 | Fetch + transform API data |
| useFlowLayout hook | Done | 2026-01-26 | Layout + entity expansion state |
| usePinnedFields hook | Done | 2026-01-26 | localStorage persistence |
| useFlowFilters hook | Done | 2026-01-26 | Entity + status filter state |
| Fix source_column API bug | Done | 2026-01-26 | Added source_column to SELECT, fixed field reference |
| Fix edge crossing layout | Done | 2026-01-26 | Sort sources by primary entity, separate handle routing |
| Move entry point to header | Done | 2026-01-26 | Replaced card with top-right "Data Flow" button |

### Phase 5.2: Interaction (In Progress)

| Task | Status | Priority | Notes |
|------|--------|----------|-------|
| Entity-centric field detail | Done | HIGH | Click entity → scrollable field list with mapped dots, key badges, source badges, authority icons, and tooltips |
| EntityFieldData type + transform | Done | HIGH | Full field data passed through when entity expanded, height calculation updated |
| Mapping persistence fix | Done | HIGH | 3-step restore: DB draft → localStorage → saved column_mappings |
| Dropdown submenu portal fix | Done | HIGH | DropdownMenuSubContent wrapped in Portal to prevent ScrollArea clipping |
| Blank page race condition fix | Done | HIGH | Guard Overview on sheetTabs.length > 0, show skeleton during initial fetch, prevent preview overriding tab |
| Hover tooltips on truncated names | Done | LOW | Native `title` attr on truncated tab/source names in SheetTabBar + SourceTabBar |
| N+1 query fix in /api/mappings/load | Done | HIGH | 21+ queries → 3 queries via batch .in() + Map assembly |
| Cache-Control headers on GET APIs | Done | MEDIUM | flow-map + mappings/load + data-sources: private, max-age=30, stale-while-revalidate |
| apiSuccess headers parameter | Done | LOW | Optional headers param for cleaner cache control |
| Non-blocking preview (DB tabs render first) | Done | HIGH | DB tabs show immediately from API, Google preview merges in background for full tab discovery |
| Cache-Control on /api/data-sources | Done | MEDIUM | private, max-age=30, stale-while-revalidate=60 — revisits within 30s are instant |
| Parallel Google Sheets API calls | Done | HIGH | `values.get()` + `spreadsheets.get()` via Promise.all — saves 200-300ms per tab load |
| Client-side raw data cache (5min TTL) | Done | HIGH | Module-level Map in SmartMapper. Tab revisit: <50ms vs 400-1000ms Google API |
| Cache-Control on sheets/raw-rows, ai/save-summary, field-tags | Done | MEDIUM | Browser caching on all read-heavy SmartMapper endpoints |
| Deferred field tags fetch | Done | LOW | Only fetch when entering Classify phase, not on SmartMapper mount |
| Dry run preview dialog | Done | HIGH | `SyncPreviewDialog`: click Sync → dry run all tabs → review creates/updates/skips → confirm → apply |
| Saved mapping restore merge fix | Done | HIGH | Step 3 now merges saved mappings with full sheet headers — unmapped columns preserved |
| Level 3 - Field detail panel | Pending | HIGH | Slide-in from right |
| GET /api/flow-map/field/[name] | Pending | HIGH | Cross-references + lineage |
| Pin/lock feature | Pending | MEDIUM | Pin icon overlay + glow ring |
| Filter controls UI | Pending | MEDIUM | Entity + status filter bar |
| "View in Flow Map" button | Pending | LOW | On Tab Overview Dashboard |

### Phase 5.3: Intelligence (Future)

| Task | Status | Priority | Notes |
|------|--------|----------|-------|
| AI insight badges | Pending | LOW | AI analysis on nodes |
| Lineage timeline | Pending | LOW | From field_lineage table |
| Live refresh | Pending | LOW | SWR revalidation |
| Export as image | Pending | LOW | Download flow map |

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

**Implementation Status:**
| Component | Status | Notes |
|-----------|--------|-------|
| MappingAssistantSDK | Done | `src/lib/ai/mapping-sdk.ts` |
| POST /api/ai/suggest-mapping | Done | Single column suggestion |
| POST /api/ai/suggest-all | Done | Bulk suggestions with stats |
| Rate limiting | Done | 20/min single, 5/hr bulk |
| Audit logging | Done | Integrated with audit service |
| Sparkle button UI | Done | `src/components/data-enrichment/ai-suggestion-button.tsx` |
| Suggestion popover | Done | Popover with confidence + reasoning |
| "AI Suggest All" button | Done | `src/components/data-enrichment/ai-suggest-all-dialog.tsx` |

---

## Phase 6: AI-Assisted Mapping

### 6.1 SDK Foundation: Complete

| Task | Status | Date | Notes |
|------|--------|------|-------|
| MappingAssistantSDK class | Done | 2026-01-24 | `src/lib/ai/mapping-sdk.ts` |
| Anthropic SDK integration | Done | 2026-01-24 | Tool-use pattern for structured responses |
| Module exports | Done | 2026-01-24 | `src/lib/ai/index.ts` |
| POST /api/ai/suggest-mapping | Done | 2026-01-24 | Single column AI suggestion |
| POST /api/ai/suggest-all | Done | 2026-01-24 | Bulk suggestions with stats |
| Rate limiting integration | Done | 2026-01-24 | 20 single/min, 5 bulk/hr |
| Audit logging integration | Done | 2026-01-24 | All suggestions logged |
| Learn from existing mappings | Done | 2026-01-24 | Loads patterns from DB |

### 6.2 Column-Level UI: Complete

| Task | Status | Date | Notes |
|------|--------|------|-------|
| Sparkle button per column | Done | 2026-01-24 | `AISuggestionButton` component |
| Suggestion popover | Done | 2026-01-24 | Shows category, target, confidence, reasoning |
| Accept/reject UI | Done | 2026-01-24 | One-click apply with key confirmation |
| Loading state | Done | 2026-01-24 | Spinner in button, loading state in popover |
| Popover component | Done | 2026-01-24 | Added via shadcn/ui |

### 6.3 Tab-Level UI: Complete

| Task | Status | Date | Notes |
|------|--------|------|-------|
| "AI Suggest All" button | Done | 2026-01-24 | Purple button in SmartMapper header |
| Progress indicator | Done | 2026-01-24 | Progress bar during analysis |
| Bulk review dialog | Done | 2026-01-24 | `AISuggestAllDialog` component |
| Confidence grouping | Done | 2026-01-24 | High/medium/low sections |
| Select all/none | Done | 2026-01-24 | Quick selection controls |

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

### Sync UI Components
- `src/components/data-enrichment/sync-preview-dialog.tsx` - Dry run preview before sync (creates/updates/skips per entity)
- `src/components/data-enrichment/sync-history-panel.tsx` - Collapsible history with expandable errors
- `src/components/data-enrichment/browser/tab-overview-dashboard.tsx` - Contains Sync button

### Sync API Routes
- `src/app/api/sync/tab/[id]/route.ts` - POST to trigger sync
- `src/app/api/sync/runs/route.ts` - GET list of sync runs
- `src/app/api/sync/runs/[id]/route.ts` - GET sync run details

### Entity Field Registry (Single Source of Truth for Field Definitions)
- `src/lib/entity-fields/index.ts` - Barrel exports
- `src/lib/entity-fields/types.ts` - FieldDefinition, ReferenceConfig, FieldGroup types
- `src/lib/entity-fields/registry.ts` - 20 partner + 17 staff + 10 ASIN fields with reference relationships, helper functions

### Types (Single Source of Truth)
- `src/types/entities.ts` - CategoryStats, ColumnCategory, EntityType
- `src/types/enrichment.ts` - Enrichment-specific types

### API Routes
- `src/app/api/data-sources/route.ts` - Source CRUD
- `src/app/api/mappings/save/route.ts` - Save mappings
- `src/app/api/sheets/*` - Google Sheets specific

### Audit System
- `src/lib/audit/index.ts` - AuditService singleton with logging methods
- `src/app/api/audit/route.ts` - GET endpoint for retrieving logs
- `supabase/migrations/20260124_audit_log.sql` - mapping_audit_log table

### Rate Limiting
- `src/lib/rate-limit/index.ts` - RateLimiter with sliding window algorithm

### AI Mapping Assistant
- `src/lib/ai/index.ts` - Module exports
- `src/lib/ai/mapping-sdk.ts` - MappingAssistantSDK with Claude tool-use
- `src/app/api/ai/suggest-mapping/route.ts` - Single column suggestion
- `src/app/api/ai/suggest-all/route.ts` - Bulk suggestions
- `src/components/data-enrichment/ai-suggestion-button.tsx` - Sparkle button + popover
- `src/components/data-enrichment/ai-suggest-all-dialog.tsx` - Bulk review dialog
- `src/components/ui/popover.tsx` - Popover component (shadcn/ui)

### Data Flow Map (Visual Lineage)
- `src/components/data-enrichment/lineage/DataFlowMap.tsx` - Main orchestrator (mobile/desktop switch)
- `src/components/data-enrichment/lineage/FlowCanvas.tsx` - React Flow canvas (desktop)
- `src/components/data-enrichment/lineage/MobileFlowList.tsx` - Card layout (mobile)
- `src/components/data-enrichment/lineage/nodes/EntityNode.tsx` - Entity node (Partners/Staff/ASINs)
- `src/components/data-enrichment/lineage/nodes/SourceNode.tsx` - Data source node
- `src/components/data-enrichment/lineage/nodes/FieldGroupNode.tsx` - Field group node
- `src/components/data-enrichment/lineage/edges/MappingEdge.tsx` - Source-to-entity edge (solid)
- `src/components/data-enrichment/lineage/edges/ReferenceEdge.tsx` - Entity-to-entity edge (dashed)
- `src/components/data-enrichment/lineage/panels/FlowLegend.tsx` - Color coding legend
- `src/components/data-enrichment/lineage/hooks/useFlowData.ts` - Fetch + transform
- `src/components/data-enrichment/lineage/hooks/useFlowLayout.ts` - Layout computation
- `src/components/data-enrichment/lineage/hooks/usePinnedFields.ts` - Pin state (localStorage)
- `src/components/data-enrichment/lineage/hooks/useFlowFilters.ts` - Filter state
- `src/components/data-enrichment/lineage/utils/transform.ts` - API -> React Flow nodes/edges
- `src/components/data-enrichment/lineage/utils/layout.ts` - Node positioning
- `src/components/data-enrichment/lineage/utils/colors.ts` - Entity color map
- `src/app/api/flow-map/route.ts` - GET /api/flow-map aggregated endpoint

### Settings & API Key Management
- `src/app/(dashboard)/settings/page.tsx` - User settings (profile, theme)
- `src/app/(dashboard)/admin/settings/page.tsx` - Admin settings (API keys)
- `src/app/api/admin/settings/route.ts` - List settings API
- `src/app/api/admin/settings/[key]/route.ts` - Update/delete settings API
- `src/lib/encryption/index.ts` - AES-256-GCM encryption utilities
- `src/lib/settings/index.ts` - getSystemSetting, getAnthropicApiKey helpers
- `supabase/migrations/20260125_system_settings.sql` - system_settings table
- `docs/features/SETTINGS_AND_API_KEYS.md` - Full design doc

### Database Migrations
- `supabase/migrations/20260124_connector_config.sql` - Connection config backfill
- `supabase/migrations/20260124_field_lineage.sql` - Field lineage tracking
- `supabase/migrations/20260124_audit_log.sql` - Audit logging table

### Documentation
- `ARCHITECTURE.md` - Connector architecture
- `docs/features/SYNC_ENGINE.md` - Sync engine design doc
- `docs/features/AI_MAPPING_ASSISTANT.md` - AI mapping co-pilot design
- `src/components/data-enrichment/ROADMAP.md` - Feature roadmap

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-01-24 | Dual-write legacy + connection_config | Backward compatibility |
| 2026-01-24 | Singleton registry pattern | Matches getAdminClient() pattern |
| 2026-01-24 | Type consolidation to entities.ts | Reduce drift, single source of truth |
| 2026-01-24 | Keep SmartMapper connector-agnostic | Already uses generic TabRawData |
| 2026-01-24 | Sync engine uses authority rules | Only source_of_truth fields can overwrite existing |
| 2026-01-24 | Field lineage tracks all changes | Full audit trail for data provenance |
| 2026-01-24 | Batch inserts (50 at a time) | Performance optimization for large syncs |
| 2026-01-25 | Auth error state with retry button | Better UX for session race conditions |
| 2026-01-25 | Applied audit_log migration | Complete audit trail now active |
| 2026-01-25 | Settings pages + API key management | Admin can configure Claude API key in UI |
| 2026-01-25 | Tab scroll indicators | Chevron buttons show when tabs overflow |
| 2026-01-25 | Google profile images in sidebar | Session-based avatars with settings link |
| 2026-01-26 | Entity field registry | Single source of truth replaces 3 disconnected field defs |
| 2026-01-26 | @xyflow/react for flow map | Custom React nodes + built-in pan/zoom/minimap vs custom SVG |
| 2026-01-26 | Mobile card list for flow map | Canvas unusable on phone, structured cards instead |
| 2026-01-26 | 3-query flow-map API | Same optimization pattern as /api/data-sources |
| 2026-01-26 | Flow map as header button | Separate from integration cards (Sheets/Forms/Docs) per UX feedback |
| 2026-01-26 | Named handles for edges | Mapping edges use left handles, reference edges use right handles to avoid crossing |
| 2026-01-26 | Sort sources by primary entity | Minimizes edge crossings by aligning sources near their target entity |
| 2026-01-26 | 3-step draft restore cascade | DB draft → localStorage → saved column_mappings. Fixes lost mappings after Save clears drafts |
| 2026-01-26 | Entity-centric field detail in flow map | Replace group summary chips with actual mapped fields + source attribution + authority icons |
| 2026-01-26 | Portal wrap for dropdown submenus | DropdownMenuSubContent needs Portal to escape ScrollArea overflow clipping |
| 2026-01-26 | Guard Overview on sheetTabs.length | Prevents blank page when source loaded before Google Sheets preview returns |
| 2026-01-26 | Batch queries in /api/mappings/load | Same 3-query pattern as /api/data-sources: N+1 → batch .in() + in-memory Map assembly |
| 2026-01-26 | Cache-Control on read-heavy GETs | private + stale-while-revalidate; safe for auth-gated admin endpoints |
| 2026-01-26 | Native title tooltips on truncated names | Browser-native tooltip (~1s delay) over Radix Tooltip: zero DOM overhead, accessible by default |
| 2026-01-26 | Non-blocking preview (reverted aggressive skip) | Preview always fetches for tab discovery but doesn't block rendering. DB tabs show immediately. Skipping preview entirely was too aggressive — broke unmapped tab visibility |
| 2026-01-26 | Critical invariants + pre-change checklist | Added 6 invariants (INV-1 through INV-6) and verification checklist to `browser/CLAUDE.md` to prevent performance regressions |
| 2026-01-26 | Cache-Control on /api/data-sources | Same pattern as flow-map: private, max-age=30, stale-while-revalidate=60 |
| 2026-01-26 | Parallel Google Sheets API in getSheetRawRows | Two sequential Google API calls → Promise.all. Halves network latency |
| 2026-01-26 | Client-side raw data cache in SmartMapper | Module-level Map with 5min TTL. Avoids Google API entirely on tab revisit |
| 2026-01-26 | Defer field tags to Classify phase | Tags only needed for classification UI, not for Preview phase |
| 2026-01-26 | Sync engine backend complete | 596-line SyncEngine class, API endpoints, UI button + history panel all functional. Missing: dry run preview UI |
| 2026-01-26 | Playwright over Vitest for regression tests | Integration bugs (missing tabs, lost mappings) aren't catchable by unit tests. Playwright E2E covers real browser flows |
| 2026-01-26 | Dry run preview before sync | User clicks Sync → dry_run all tabs → SyncPreviewDialog shows creates/updates/skips per entity → Confirm → actual sync. Prevents accidental writes |

---

## Next Session Priorities

1. [x] Apply database migrations - DONE
2. [x] Audit logging system - DONE
3. [x] Rate limiting - DONE
4. [x] Apply audit_log migration via Supabase - DONE (2026-01-25)
5. [x] AI SDK implementation (Phase 6.1) - DONE
6. [x] AI sparkle button + suggestion popover (Phase 6.2) - DONE
7. [x] AI "Suggest All" button + bulk review (Phase 6.3) - DONE
8. [x] Auth error handling with retry button - DONE (2026-01-25)
9. [x] Phase 5.1: Visual data flow map (foundation) - DONE (2026-01-26)
10. [~] Phase 5.2: Data flow map interaction - entity field detail DONE, pin/lock/filters remaining
11. [x] Mapping persistence fix - 3-step restore cascade - DONE (2026-01-26)
12. [x] **Sync Engine UX: Dry Run Preview** - DONE (SyncPreviewDialog)
13. [ ] **End-to-end sync verification** - Full pipeline test with real data
14. [ ] **Playwright E2E tests** - Critical path regression tests (tab discovery, mapping persistence, sync)
14. [ ] Nested sheet extraction UX design
15. [ ] Phase 4: Additional connectors (Close.io, Typeform, etc.)

---

*This file tracks active development. See ROADMAP.md for full feature planning.*
