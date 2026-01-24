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

- [ ] Create `DataMapVisualization` component
  - Canvas-based or SVG for performance
  - Responsive layout (force-directed or hierarchical)

- [ ] Node Types:
  | Node | Shape | Color |
  |------|-------|-------|
  | Core Entity (Partners) | Large circle | Blue |
  | Core Entity (Staff) | Large circle | Green |
  | Core Entity (ASINs) | Medium circle | Orange |
  | Data Source | Rounded rect | Based on connector |
  | Computed Field | Diamond | Purple |

- [ ] Edge Types:
  | Edge | Style | Animation |
  |------|-------|-----------|
  | Source of Truth | Solid line | Pulse on hover |
  | Reference | Dashed line | None |
  | Computed | Dotted line | None |

### 2.3 Interactions

- [ ] **Hover**: Highlight connected nodes, show tooltip with stats
- [ ] **Click**: Drill down to source detail or entity view
- [ ] **Zoom/Pan**: Smooth, bounded, with minimap
- [ ] **Filter**: By entity type, source type, connection strength

### 2.4 Stats & Insights

- [ ] Connection strength indicators (how many fields mapped)
- [ ] Data freshness indicators (last sync time)
- [ ] Health status (errors, warnings)
- [ ] Coverage percentage per entity

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

- [ ] Secure storage for connector API keys
  - Option A: Supabase Vault (if available)
  - Option B: Encrypted JSONB column with app-level encryption
  - Option C: Environment variables for sensitive keys

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
- [ ] Sync button in TabOverviewDashboard
- [ ] Sync history panel component
- [ ] Visual data map design (future)

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
- [x] API key management (env var ANTHROPIC_API_KEY)
- [x] Mapping suggestion endpoint (`/api/ai/suggest-mapping`)
- [x] Bulk suggestion endpoint (`/api/ai/suggest-all`)
- [x] MappingAssistantSDK class (`src/lib/ai/mapping-sdk.ts`)
- [x] Rate limiting (20/min single, 5/hr bulk)
- [x] Audit logging integration
- [ ] UI: Sparkle button per column (Phase 6.2)
- [ ] UI: Suggestion popover (Phase 6.2)
- [ ] UI: "AI Suggest All" button (Phase 6.3)

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
- `src/app/api/ai/suggest-mapping/route.ts` - Single column suggestion
- `src/app/api/ai/suggest-all/route.ts` - Bulk suggestions

### Feature Docs
- `docs/features/AI_MAPPING_ASSISTANT.md` - AI mapping co-pilot design
- `docs/DATA_ENRICHMENT_PROGRESS.md` - Progress tracker

---

*Last updated: 2026-01-24 (Phase 6.1 AI SDK Complete)*
*Architecture audit by Claude Opus 4.5*
