# Data Enrichment System Roadmap

> Making Sophie Hub's data integration rock-solid for multi-connector support.

## Current State Assessment

**Overall Score: 7.5/10** - 75% ready for new connectors

### What's Working Well

| Component | Score | Status |
|-----------|-------|--------|
| Column mappings (`column_mappings` table) | 9/10 | Fully connector-agnostic |
| Pattern matching (`matchesPattern()`) | 9/10 | Works with any tabular source |
| Computed fields framework | 9/10 | Hot-swappable sources built-in |
| Header detection algorithm | 9/10 | Intelligent, generic |
| Security/RBAC | 8/10 | Admin-only, permission-based |
| Draft persistence | 8/10 | Multi-user collaboration ready |
| Type system (`src/types/enrichment.ts`) | 8/10 | Prepared for multiple source types |

### Critical Gaps

| Issue | Location | Status |
|-------|----------|--------|
| Hardcoded `type: 'google_sheet'` | `api/data-sources/route.ts:53` | [x] DONE |
| Hardcoded `type: 'google_sheet'` | `api/mappings/save/route.ts:57` | [x] DONE |
| No Connector Registry/Interface | `src/lib/connectors/` | [x] DONE |
| No connector config storage | `data_sources.connection_config` | [x] DONE |
| Monolithic search modal | `sheet-search-modal.tsx` | [ ] TODO |
| No audit logging | N/A | [x] DONE |
| No rate limiting | API routes | [x] DONE |

---

## Data Model Architecture

### Core Entities & Primary Keys

| Entity | Primary Key | Description |
|--------|-------------|-------------|
| **partners** | `brand_name` | The unique brand/company name |
| **staff** | `full_name` | Staff member's full name |
| **asins** | `asin_code` | Amazon's ASIN identifier |

### Relationship Fields (Critical Pattern)

Staff members are often assigned to partners (e.g., POD Leader, Account Manager). These assignments are stored **ON the partner record** as foreign keys.

**The Rule:** Category is determined by **which entity owns the row**, not what the value contains.

| Sheet Type | Column | Category | Target Field | Why |
|------------|--------|----------|--------------|-----|
| Partner sheet | "POD Leader" | `partner` | `pod_leader_id` | Assignment stored on partner |
| Partner sheet | "Account Manager" | `partner` | `account_manager_id` | Assignment stored on partner |
| Partner sheet | "Brand Manager" | `partner` | `brand_manager_id` | Assignment stored on partner |
| Staff sheet | "Manager" | `staff` | `manager_id` | Manager FK stored on staff |
| ASIN sheet | "Brand" | `asin` | `brand_name` | FK to partner stored on ASIN |

**Common Relationship Columns on Partner Records:**
- `pod_leader_id` - POD Leader assignment
- `account_manager_id` - Account Manager assignment
- `brand_manager_id` - Brand Manager assignment
- `sales_rep_id` - Sales Rep assignment
- `ppc_specialist_id` - PPC Specialist assignment

**Why This Matters:**
When AI sees "POD Leader = Sarah Smith" on a partner sheet, it should suggest:
- Category: `partner` (not `staff`)
- Target: `pod_leader_id`
- Authority: `reference` (values are staff names, FK lookups)

This is documented in all AI prompts in:
- `src/lib/ai/mapping-sdk.ts`
- `src/app/api/ai/analyze-source/route.ts`
- `src/app/api/ai/analyze-tab/route.ts`

---

## Phase 1: Foundation Abstraction

**Goal:** Create a pluggable connector architecture that makes adding new data sources trivial.

**Timeline:** 2-3 days

### 1.1 Connector Interface & Registry

- [x] Create base connector interface (`src/lib/connectors/base.ts`)
  ```typescript
  interface ConnectorService {
    type: ConnectorType
    displayName: string
    icon: string

    // Discovery
    searchSources(token: string, query: string): Promise<SourceSearchResult[]>
    getSourceStructure(token: string, sourceId: string): Promise<SourceStructure>

    // Data
    getTabularData(token: string, sourceId: string, scopeId: string): Promise<TabularData>
    detectHeaders(rows: string[][]): HeaderDetectionResult

    // Validation
    validateConnection(token: string, sourceId: string): Promise<ConnectionStatus>

    // Auth
    getAuthType(): 'oauth' | 'api_key' | 'none'
    getOAuthScopes?(): string[]
  }
  ```

- [x] Create connector registry (`src/lib/connectors/registry.ts`)
  ```typescript
  export const CONNECTORS = {
    google_sheet: new GoogleSheetsConnector(),
    // Future:
    // close_io: new CloseIOConnector(),
    // typeform: new TypeformConnector(),
    // clickup: new ClickUpConnector(),
    // asana: new AsanaConnector(),
  }

  export function getConnector(type: ConnectorType): ConnectorService
  export function listConnectors(): ConnectorInfo[]
  ```

- [x] Migrate Google Sheets to connector pattern (`src/lib/connectors/google-sheets.ts`)

### 1.2 Database Schema Updates

- [x] Add `connection_config` JSONB column to `data_sources` table
  - Stores: API keys, webhook URLs, refresh tokens, connector-specific settings
  - Encrypted at rest for sensitive data
  - Note: Column existed in initial schema, just needed backfilling

- [ ] Consider renaming `tab_mappings` to `scope_mappings` (optional, for clarity)
  - "Scope" = tab (sheets), form (typeform), list (clickup), project (asana)

- [ ] Add `connector_type` validation constraint

### 1.3 API Route Updates

- [x] Fix `POST /api/data-sources` to accept `type` parameter (not hardcode)
- [x] Fix `POST /api/mappings/save` to accept `type` parameter
- [ ] Create generic connector route pattern:
  ```
  /api/connectors/[type]/search    → ConnectorService.searchSources()
  /api/connectors/[type]/structure → ConnectorService.getSourceStructure()
  /api/connectors/[type]/data      → ConnectorService.getTabularData()
  ```

### 1.4 Component Abstraction

- [ ] Create `ConnectorSearchModal` base component
- [ ] Refactor `SheetSearchModal` to extend base
- [ ] Create connector picker component (for "Add Source" flow)

### 1.5 Type System Updates

- [x] Add to `ConnectorType`: `'google_sheet' | 'close_io' | 'typeform' | 'clickup' | 'asana'`
- [x] Create `ConnectorConfig` discriminated union type
- [x] Add connector metadata types

---

## Phase 2: Visual Data Map

**Goal:** Create a stunning, Emil-approved visualization of data connections.

**Timeline:** 3-4 days

### 2.1 Design Principles (Emil Kowalski)

- **Speed over delight** - Fast renders, no unnecessary animations on load
- **Progressive disclosure** - Simple view first, detail on interaction
- **Motion with purpose** - Animations guide attention, not distract
- **Data feels solid** - Clear hierarchy, trust through consistency

### 2.2 Core Visualization

- [x] Create `DataFlowMap` component (React Flow + mobile card list)
  - `FlowCanvas.tsx` for desktop (pan, zoom, minimap)
  - `MobileFlowList.tsx` for mobile (hierarchical cards)

- [x] Node Types:
  | Node | Shape | Color | Component |
  |------|-------|-------|-----------|
  | Core Entity (Partners) | Rounded rect | Blue | `EntityNode.tsx` |
  | Core Entity (Staff) | Rounded rect | Green | `EntityNode.tsx` |
  | Core Entity (ASINs) | Rounded rect | Orange | `EntityNode.tsx` |
  | Data Source | Rounded rect | Gray | `SourceNode.tsx` |
  | Field Group | Rounded rect | Entity color | `FieldGroupNode.tsx` |

- [x] Edge Types:
  | Edge | Style | Component |
  |------|-------|-----------|
  | Mapping (source→entity) | Solid line | `MappingEdge.tsx` |
  | Reference (entity→entity) | Dashed line | `ReferenceEdge.tsx` |

### 2.3 Interactions

- [x] **Hover**: Entity nodes scale + tooltips on expanded fields showing source details
- [x] **Click**: Entity expand toggle shows field-level detail with mapped dots, key badges, source names, authority icons
- [x] **Zoom/Pan**: React Flow built-in pan/zoom/minimap
- [ ] **Filter**: By entity type, source type, connection strength

### 2.4 Stats & Insights

- [x] Connection strength indicators (edge stroke width scaled by mapped field count)
- [ ] Data freshness indicators (last sync time)
- [ ] Health status (errors, warnings)
- [x] Coverage percentage per entity (progress rings + percentage badges)

### 2.5 Animation Specs

```typescript
// All animations use ease-out: [0.22, 1, 0.36, 1]
const animations = {
  nodeHover: { scale: 1.05, duration: 150 },
  edgeHighlight: { opacity: 1, duration: 200 },
  panZoom: { duration: 300, ease: 'easeInOut' },
  nodeEnter: { scale: [0, 1], opacity: [0, 1], duration: 300 },
}
```

---

## Phase 3: Security Hardening

**Goal:** Enterprise-grade security for multi-connector data platform.

**Timeline:** 1-2 days

### 3.1 Audit Logging

- [x] Create `mapping_audit_log` table
  ```sql
  CREATE TABLE mapping_audit_log (
    id UUID PRIMARY KEY,
    action TEXT NOT NULL,           -- 'create', 'update', 'delete'
    entity_type TEXT NOT NULL,      -- 'data_source', 'tab_mapping', 'column_mapping'
    entity_id UUID NOT NULL,
    old_value JSONB,
    new_value JSONB,
    user_id UUID NOT NULL,
    user_email TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  ```

- [x] Add audit triggers or API-level logging
- [x] Create audit log API endpoint (`/api/audit`)

### 3.2 Credential Storage

- [x] Secure storage for connector API keys
  - Using Option B: Encrypted JSONB column with app-level encryption (AES-256-GCM)
  - Admin settings page at `/admin/settings`
  - Encryption utilities in `src/lib/encryption/index.ts`

- [ ] Token refresh handling for OAuth connectors
- [ ] Credential rotation support

### 3.3 Rate Limiting

- [x] Add rate limiting middleware to data-enrichment APIs
- [x] Per-user limits for expensive operations (sync, preview)
- [x] Global limits to protect external APIs (GOOGLE_SHEETS preset)

### 3.4 Input Validation Hardening

- [ ] Review all Zod schemas for completeness
- [ ] Add SQL injection prevention checks
- [ ] Validate connector-specific config schemas

---

## Phase 4: Future Connectors

### Close.io (CRM)

**Effort:** 12-17 hours

- [ ] OAuth 2.0 integration
- [ ] Lead/Contact data mapping
- [ ] Activity sync (calls, emails)
- [ ] Custom field support

**Data Structure:**
```
Close.io Account
├── Leads (→ Partners)
│   ├── Contacts (→ Staff or External Contacts)
│   └── Custom Fields
├── Activities
└── Opportunities
```

### Typeform

**Effort:** 10-14 hours

- [ ] OAuth or API key auth
- [ ] Form responses as rows
- [ ] Question → Column mapping
- [ ] Webhook for real-time updates

**Data Structure:**
```
Typeform Account
├── Workspaces
│   └── Forms
│       ├── Questions (→ Columns)
│       └── Responses (→ Rows)
```

### ClickUp

**Effort:** 8-12 hours

- [ ] OAuth 2.0 integration
- [ ] Task lists as "tabs"
- [ ] Custom fields support
- [ ] Status/assignee mapping

**Data Structure:**
```
ClickUp Workspace
├── Spaces
│   └── Lists (→ Tabs)
│       └── Tasks (→ Rows)
│           └── Custom Fields (→ Columns)
```

### Asana

**Effort:** 8-12 hours

- [ ] OAuth 2.0 integration
- [ ] Project as "tabs"
- [ ] Task fields mapping
- [ ] Section support

**Data Structure:**
```
Asana Workspace
├── Teams
│   └── Projects (→ Tabs)
│       └── Tasks (→ Rows)
│           └── Custom Fields (→ Columns)
```

### Airtable (Bonus)

**Effort:** 6-10 hours

- [ ] API key or OAuth
- [ ] Base/Table structure maps naturally
- [ ] Rich field types (attachments, links)
- [ ] View filtering

---

## Phase 5: Nested Sheet Extraction

### The Challenge: Brand Information Sheets

Sophie Society uses a hierarchical sheet structure that requires special handling:

```
Partner
└── Brand Information Sheet (one per partner)
    ├── Partner metadata (top section)
    └── ASIN rows (table section)
        ├── ASIN identifiers
        ├── Product info
        └── Linked Sheets (URLs in cells):
            ├── Keyword Research Sheet
            ├── Market & Comp Analysis Sheet
            └── Campaign Structure Sheet
```

**Complexity:**
- Each linked sheet has its own complex layout (not simple rows/columns)
- Keyword sheets have hierarchical keyword trees
- Market analysis sheets have competitor grids
- Campaign sheets have nested campaign → ad group → keyword structures

### Proposed Solution: Sheet Type Templates

```typescript
interface SheetTypeTemplate {
  id: string
  name: string
  description: string
  // How to identify this sheet type
  detection: {
    titlePattern?: RegExp
    requiredColumns?: string[]
    layoutSignature?: string  // e.g., "merged_header_row_1"
  }
  // How to extract structured data
  extraction: {
    type: 'tabular' | 'hierarchical' | 'sectioned' | 'custom'
    rules: ExtractionRule[]
  }
  // Where extracted data maps to
  targetEntity: 'asins' | 'keywords' | 'campaigns' | 'competitors'
}
```

### Template Examples

**Keyword Research Sheet:**
```typescript
{
  id: 'keyword_research',
  name: 'Keyword Research',
  detection: {
    titlePattern: /keyword.*research/i,
    requiredColumns: ['Keyword', 'Search Volume', 'Difficulty']
  },
  extraction: {
    type: 'hierarchical',
    rules: [
      { name: 'root_keywords', startRow: 2, indent: 0 },
      { name: 'child_keywords', detectByIndent: true }
    ]
  },
  targetEntity: 'keywords'
}
```

**Campaign Structure Sheet:**
```typescript
{
  id: 'campaign_structure',
  name: 'Campaign Structure',
  detection: {
    titlePattern: /campaign.*structure/i,
    layoutSignature: 'campaign_adgroup_keyword_hierarchy'
  },
  extraction: {
    type: 'sectioned',
    rules: [
      { section: 'campaigns', headerPattern: /^Campaign:/i },
      { section: 'ad_groups', headerPattern: /^Ad Group:/i },
      { section: 'keywords', indentLevel: 2 }
    ]
  },
  targetEntity: 'campaigns'
}
```

### UX Approach

1. **Auto-Detection Phase**
   - Scan Brand Information Sheet for linked sheet URLs
   - Attempt to identify each linked sheet's type
   - Show user: "Found 3 linked sheets: 2 Keyword Research, 1 Campaign Structure"

2. **Template Selection**
   - If auto-detection fails, let user select template
   - "What type of sheet is this?" with visual examples

3. **Extraction Preview**
   - Show extracted data structure before saving
   - "We found 47 keywords in 3 groups. Does this look right?"

4. **Manual Mapping Fallback**
   - Complex sheets can fall back to manual column mapping
   - Or create custom template for recurring layouts

### Implementation Status

- [ ] Sheet type template system design
- [ ] Brand Information Sheet parser
- [ ] Linked sheet URL extractor
- [ ] Template: Keyword Research
- [ ] Template: Market & Comp Analysis
- [ ] Template: Campaign Structure
- [ ] UX: Template selection modal
- [ ] UX: Extraction preview

---

## Phase 6: AI-Assisted Mapping (Claude API)

> **Full Design Doc:** `docs/features/AI_MAPPING_ASSISTANT.md`

### Vision

Claude as an in-app mapping co-pilot at multiple granularity levels:

| Level | Trigger | Use Case |
|-------|---------|----------|
| **Column** | ✨ icon per column | "What should this column be?" |
| **Tab** | "AI Suggest All" button | Bulk suggestions with confidence scores |
| **Sheet** | Structure analyzer | Complex nested sheets detection |

### Core Capabilities

1. **Mapping suggestions** - "This 'Company Name' field → partners.brand_name (94% confidence)"
2. **Pattern learning** - Uses existing mappings to improve future suggestions
3. **Authority inference** - Knows if another source already maps this field
4. **Weekly detection** - Identifies date-pattern columns automatically

### Architecture Options

#### Option A: Claude API with Tool Use

```typescript
// Claude as mapping assistant
const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-20250514',
  tools: [
    {
      name: 'suggest_mapping',
      description: 'Suggest how a source field maps to target entities',
      input_schema: {
        type: 'object',
        properties: {
          source_field: { type: 'string' },
          sample_values: { type: 'array', items: { type: 'string' } },
          available_targets: { type: 'array', items: { type: 'string' } }
        }
      }
    },
    {
      name: 'analyze_data_quality',
      description: 'Analyze data quality issues in a dataset',
      input_schema: { ... }
    }
  ],
  messages: [
    { role: 'user', content: 'Analyze this Close.io export and suggest mappings...' }
  ]
})
```

#### Option B: MCP (Model Context Protocol)

If MCPs exist for Close.io, Zoho, Xero:
- Claude can directly query external APIs
- More dynamic, real-time data access
- Claude handles authentication flow

```typescript
// Example MCP integration
const result = await claude.useMcp('close-io', {
  action: 'list_leads',
  limit: 100
})
// Claude analyzes and suggests mappings
```

#### Option C: Hybrid Approach (Recommended)

1. **Setup Phase**: Claude API helps configure connector
2. **Discovery Phase**: Connector fetches schema, Claude suggests mappings
3. **Validation Phase**: Human reviews and approves
4. **Sync Phase**: Automated sync runs without AI

### User Experience

```
┌─────────────────────────────────────────────────┐
│  Add New Data Source                            │
├─────────────────────────────────────────────────┤
│                                                 │
│  [Google Sheets]  [Close.io]  [Zoho]  [+ More]  │
│                                                 │
│  ─────────────────────────────────────────────  │
│                                                 │
│  🤖 Claude AI Assistant                         │
│  ┌─────────────────────────────────────────┐   │
│  │ "I'll help you connect Close.io.        │   │
│  │  First, let me analyze your leads..."   │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  Suggested Mappings:                            │
│  ┌─────────────────────────────────────────┐   │
│  │ Close.io Lead     →  Partner            │   │
│  │ Lead.company      →  partners.brand_name│   │
│  │ Lead.contact_name →  partners.manager   │   │
│  │ Lead.status       →  partners.status    │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  [✓ Accept All]  [Review Each]  [Manual Map]   │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Implementation Requirements

1. **API Key Management**
   - Store Anthropic API key securely (env var or encrypted DB)
   - Rate limiting to control costs
   - Usage tracking per admin user

2. **Prompt Engineering**
   - System prompt with Sophie Society context
   - Few-shot examples of good mappings
   - Entity schema provided as context

3. **Safety Rails**
   - Claude suggests, human approves
   - Never auto-apply destructive changes
   - Audit log of AI-assisted changes

### Implementation Status

- [ ] Claude API integration design
- [ ] API key management (secure storage)
- [ ] Mapping suggestion endpoint
- [ ] Data quality analysis endpoint
- [ ] UI: AI assistant chat panel
- [ ] UI: Mapping suggestion cards
- [ ] MCP exploration (if available for target systems)

---

## Design Standards (Emil Kowalski Principles)

### Animation Guidelines

```typescript
// Primary easing - all user interactions
const easeOut = [0.22, 1, 0.36, 1]

// Morphing - elements changing on screen
const easeInOut = [0.45, 0, 0.55, 1]

// Durations
const duration = {
  micro: 0.15,   // Button press, icon change
  ui: 0.2,       // Dropdowns, tooltips
  page: 0.3,     // Route transitions
}

// CRITICAL: No animations on page load
// Use initial={false} for state-driven animations
```

### Visual Consistency

- **Spacing scale:** 4, 8, 12, 16, 24, 32, 48, 64px
- **Border radius:** 4px (small), 8px (medium), 12px (large)
- **Shadows:** Sparingly, for elevation only
- **Colors:**
  - Blue = Partners
  - Green = Staff
  - Orange = ASINs/Action
  - Purple = Computed
  - Grey = Skip/Inactive

### Component Patterns

- **No layout shift** - Dynamic content uses fixed dimensions
- **Tabular numbers** - `font-variant-numeric: tabular-nums` for stats
- **Touch targets** - Minimum 44px on mobile
- **Button press** - `active:scale-[0.97]` for tactile feedback

---

## Progress Tracking

### Phase 1 Progress
- [x] Connector interface created (`src/lib/connectors/base.ts`)
- [x] Connector registry created (`src/lib/connectors/registry.ts`)
- [x] Google Sheets migrated to connector pattern (`src/lib/connectors/google-sheets.ts`)
- [x] Database schema updated (`20260124_connector_config.sql`)
- [x] API routes updated (data-sources, mappings/save)
- [ ] Components abstracted (Phase 1.4 - future work)

### Phase 2 Progress: Sync Engine
- [x] SyncEngine class (`src/lib/sync/engine.ts`)
- [x] Transform pipeline (`src/lib/sync/transforms.ts`)
- [x] Sync types (`src/lib/sync/types.ts`)
- [x] Field lineage migration (`20260124_field_lineage.sql`)
- [x] POST /api/sync/tab/[id] endpoint
- [x] GET /api/sync/runs endpoint
- [x] GET /api/sync/runs/[id] endpoint
- [x] Sync button in TabOverviewDashboard
- [x] Sync history panel component
- [x] Visual data map (React Flow canvas + entity-centric field detail)

### Phase 3 Progress
- [x] Audit logging implemented (`src/lib/audit/index.ts`)
- [ ] Credential storage (deferred - Phase 4 connectors)
- [x] Rate limiting added (`src/lib/rate-limit/index.ts`)
- [x] Validation hardened (Zod schemas for all inputs)

### Phase 4 Progress
- [ ] Close.io connector
- [ ] Typeform connector
- [ ] ClickUp connector
- [ ] Asana connector

### Phase 5 Progress (Nested Sheets)
- [ ] Sheet type template system design
- [ ] Brand Information Sheet parser
- [ ] Linked sheet URL extractor
- [ ] Template: Keyword Research
- [ ] Template: Market & Comp Analysis
- [ ] Template: Campaign Structure

### Phase 6 Progress (AI-Assisted)
- [x] Claude API integration design (Tool-use pattern)
- [x] API key management (database with env fallback - see `/admin/settings`)
- [x] Mapping suggestion endpoint (`/api/ai/suggest-mapping`)
- [x] Bulk suggestion endpoint (`/api/ai/suggest-all`)
- [x] MappingAssistantSDK class (`src/lib/ai/mapping-sdk.ts`)
- [x] Rate limiting (20/min single, 5/hr bulk)
- [x] Audit logging integration
- [x] UI: Sparkle button per column (`ai-suggestion-button.tsx`)
- [x] UI: Suggestion popover with confidence + reasoning
- [x] UI: "AI Suggest All" button + bulk review dialog (`ai-suggest-all-dialog.tsx`)
- [x] Source-level AI analysis (`/api/ai/analyze-source`, `ai-source-analysis.tsx`)
- [x] Per-tab AI summary in SmartMapper (`/api/ai/analyze-tab`, `ai-tab-analysis.tsx`)
- [x] Tab summary persistence (`/api/ai/save-summary`, `tab_mappings.ai_summary`)
- [x] Context passing: Tab summary's `primary_entity` improves per-column suggestions

---

## Performance Optimization

### Done (2026-01-26)

| Item | Location | Impact |
|------|----------|--------|
| N+1 → 3-query fix in data-sources API | `api/data-sources/route.ts` | 500+ → 3 queries |
| N+1 → 3-query fix in mappings/load API | `api/mappings/load/route.ts` | 21+ → 3 queries |
| Cache-Control on read-heavy GETs | `api/flow-map`, `api/mappings/load`, `api/data-sources` | 40% fewer refetches |
| `apiSuccess` headers parameter | `src/lib/api/response.ts` | Cleaner cache pattern |
| Blank page race condition fix | `source-browser.tsx` | Guard render on data ready |
| React.memo on all Flow nodes/edges | `lineage/nodes/*.tsx`, `lineage/edges/*.tsx` | No re-render on pan/zoom |
| Non-blocking preview (DB tabs render first) | `source-browser.tsx` | DB tabs show immediately, preview merges in background |
| Parallel Google Sheets API calls | `src/lib/google/sheets.ts` | `values.get()` + `get()` via Promise.all, saves 200-300ms |
| Client-side raw data cache (5min TTL) | `smart-mapper.tsx` | Module-level Map cache, tab revisit <50ms vs 400-1000ms |
| Cache-Control on sheets/raw-rows | `api/sheets/raw-rows/route.ts` | 60s browser cache on sheet data |
| Cache-Control on ai/save-summary GET | `api/ai/save-summary/route.ts` | 60s browser cache on AI summaries |
| Cache-Control on field-tags GET | `api/field-tags/route.ts` | 5min browser cache (tags rarely change) |
| Deferred field tags fetch | `smart-mapper.tsx` | Only fetches when entering Classify phase, not on mount |

### Remaining (Prioritized)

| Item | Impact | Effort | Notes |
|------|--------|--------|-------|
| **SWR for data fetching** | HIGH | HIGH | Replace 29 raw `fetch()` calls — dedup, cache, auto-retry. Start with `useDataSources()` hook |
| **SmartMapper code split** | HIGH | MED | 2943-line monolith → lazy-loaded phases (`PreviewPhase`, `ClassifyPhase`, `MapPhase`) |
| **useMemo on filter/map ops** | MED | MED | ~59 `.filter()/.map()` calls in SmartMapper re-run every render |
| **useCallback on handler props** | MED | LOW | Inline handlers break `React.memo` on TabCard, FieldRow children |
| **Draft save debounce increase** | LOW | LOW | 500ms → 1000ms = 50% fewer DB writes during rapid classification |
| **Virtual scroll for large field lists** | MED | MED | `react-window` on MobileFlowList for 500+ field datasets |
| **Prefetch on phase transitions** | LOW | LOW | When entering classify phase, prefetch `/api/mappings/load` in background |

### Performance Principles

- **3-query pattern**: Batch all related data with `.in()`, assemble with in-memory Maps. Never loop queries.
- **Cache-Control**: `private` (auth-gated), short `max-age`, generous `stale-while-revalidate`. Never cache mutation endpoints.
- **React.memo**: All leaf components that receive stable data. Pair with `useCallback` for handler props.
- **No layout shift**: Fixed dimensions for skeletons, `tabular-nums` for counters, reserve space for dynamic content.

---

## Key Files Reference

### Database
- `supabase/migrations/20260115_data_enrichment_mappings.sql` - Core schema
- `supabase/migrations/20260115_computed_fields.sql` - Computed fields
- `supabase/migrations/20260122_field_tags.sql` - Domain tags
- `supabase/migrations/20260124_connector_config.sql` - Connector config column
- `supabase/migrations/20260124_field_lineage.sql` - Field lineage tracking

### Types
- `src/types/entities.ts` - Core entity types (CategoryStats, ColumnCategory, EntityType)
- `src/types/enrichment.ts` - Enrichment-specific types (re-exports entity types)

### Connectors
- `src/lib/connectors/index.ts` - Main export + auto-registration
- `src/lib/connectors/types.ts` - ConnectorConfig discriminated union
- `src/lib/connectors/base.ts` - IConnector interface
- `src/lib/connectors/registry.ts` - Singleton ConnectorRegistry
- `src/lib/connectors/google-sheets.ts` - Google Sheets implementation

### Sync Engine
- `src/lib/sync/index.ts` - Module export + getSyncEngine singleton
- `src/lib/sync/types.ts` - SyncOptions, SyncResult, EntityChange, etc.
- `src/lib/sync/transforms.ts` - Value transforms (date, currency, boolean, number)
- `src/lib/sync/engine.ts` - SyncEngine class

### API Routes
- `src/app/api/data-sources/route.ts` - Source CRUD
- `src/app/api/mappings/save/route.ts` - Save mappings
- `src/app/api/sync/tab/[id]/route.ts` - Trigger sync for a tab
- `src/app/api/sync/runs/route.ts` - List sync runs
- `src/app/api/sync/runs/[id]/route.ts` - Get sync run details
- `src/app/api/sheets/*` - Google Sheets specific

### Components
- `src/components/data-enrichment/smart-mapper.tsx` - Column classification
- `src/components/data-enrichment/browser/source-browser.tsx` - Browser container
- `src/components/data-enrichment/sheet-search-modal.tsx` - Sheet search

### Security
- `src/lib/auth/api-auth.ts` - Auth middleware
- `src/lib/auth/roles.ts` - RBAC definitions
- `src/lib/audit/index.ts` - Audit logging service
- `src/lib/rate-limit/index.ts` - Rate limiting service

### AI Mapping Assistant
- `src/lib/ai/index.ts` - Module exports
- `src/lib/ai/mapping-sdk.ts` - MappingAssistantSDK (Claude tool-use)
- `src/app/api/ai/suggest-mapping/route.ts` - Single column suggestion (accepts `primary_entity` context)
- `src/app/api/ai/suggest-all/route.ts` - Bulk suggestions
- `src/app/api/ai/analyze-source/route.ts` - Source-level AI analysis
- `src/app/api/ai/analyze-tab/route.ts` - Per-tab AI summary (entity type, purpose, column breakdown)
- `src/app/api/ai/save-summary/route.ts` - Save/load tab summaries to database
- `src/components/data-enrichment/browser/ai-source-analysis.tsx` - Source analysis UI
- `src/components/data-enrichment/ai-tab-analysis.tsx` - Per-tab summary UI (persists to DB, passes context)

### Settings & API Keys
- `src/app/(dashboard)/settings/page.tsx` - User settings page
- `src/app/(dashboard)/admin/settings/page.tsx` - Admin API key management
- `src/lib/encryption/index.ts` - AES-256-GCM encryption
- `src/lib/settings/index.ts` - getAnthropicApiKey helper
- `supabase/migrations/20260125_system_settings.sql` - Settings table

### Feature Docs
- `docs/features/AI_MAPPING_ASSISTANT.md` - AI mapping co-pilot design
- `docs/features/SETTINGS_AND_API_KEYS.md` - Settings & API key management design
- `docs/DATA_ENRICHMENT_PROGRESS.md` - Progress tracker

---

*Last updated: 2026-01-26 (Fix: preview always fetches for tab discovery + critical invariants checklist)*
*Architecture audit by Claude Opus 4.5*
