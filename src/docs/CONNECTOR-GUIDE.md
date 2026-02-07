# Connector Creation Guide

How to build a new data source connector for Sophie Hub v2.

---

## 1. Architecture Overview

Sophie Hub uses a pluggable connector system with three layers:

```
IConnector          (interface)    -- Contract: what every connector must expose
BaseConnector       (abstract)     -- Convenience base class with default testConnection()
ConnectorRegistry   (singleton)    -- Runtime map of ConnectorTypeId -> IConnector instance
```

**Key files:**

| File | Purpose |
|------|---------|
| `src/lib/connectors/base.ts` | `IConnector` interface, `BaseConnector` abstract class |
| `src/lib/connectors/types.ts` | `ConnectorTypeId` union, config discriminated union, metadata, capabilities |
| `src/lib/connectors/registry.ts` | `ConnectorRegistry` class, `registerConnector` / `getConnector` helpers |
| `src/lib/connectors/index.ts` | Re-exports everything, auto-registers connectors on import |

**How registration works:**

`index.ts` calls `registerConnector()` for each connector at module load time. Any code that does `import { getConnector } from '@/lib/connectors'` gets a fully populated registry.

```typescript
// index.ts (simplified)
import { registerConnector } from './registry'
import { googleSheetsConnector } from './google-sheets'
import { bigQueryConnector } from './bigquery'

try { registerConnector(googleSheetsConnector) } catch { /* already registered */ }
try { registerConnector(bigQueryConnector) } catch { /* already registered */ }
```

**Consuming a connector:**

```typescript
import { getConnector } from '@/lib/connectors'

const sheets = getConnector('google_sheet')
const results = await sheets.search(token, 'budget')

// Or get the registry directly
const all = getConnectorRegistry().getAll(true) // enabled only
```

---

## 2. When to Implement IConnector Fully

Implement the full tabular interface when your data source has **rows, columns, tabs, and headers** -- the same shape as a spreadsheet.

Good candidates: Google Sheets, Google Forms, CSV files, Airtable, ClickUp tables.

The IConnector interface requires these methods:

| Method | Purpose |
|--------|---------|
| `validateConfig(config)` | Return `true` or an error message string |
| `getPreview(token, config)` | Source structure + sample data for first tab |
| `getTabs(token, config)` | All tabs/scopes within the source |
| `getRawRows(token, config, tabName, maxRows?)` | Raw 2D array for header detection |
| `getData(token, config, tabName, headerRow?)` | Parsed data with headers extracted |
| `testConnection(token, config)` | Verify credentials and access |
| `search?(token, query?)` | Optional: discover sources (e.g., search Drive) |

**Reference implementation:** `src/lib/connectors/google-sheets.ts`

Google Sheets implements every method because spreadsheets map 1:1 to the tabular interface: spreadsheet = source, sheet = tab, row 0 = potential headers, cells = data.

```typescript
export class GoogleSheetsConnector extends BaseConnector<GoogleSheetConnectorConfig> {
  readonly metadata: ConnectorMetadata = {
    id: 'google_sheet',
    name: 'Google Sheets',
    // ...
    capabilities: {
      search: true,     // Can search Drive
      hasTabs: true,    // Sheets have tabs
      // ...
    },
    enabled: true,
  }

  async search(token: string, query?: string): Promise<SourceSearchResult[]> {
    const results = await searchSheets(token, query || '')
    return results.map(sheet => ({ id: sheet.id, name: sheet.name, ... }))
  }

  async getTabs(token: string, config: GoogleSheetConnectorConfig): Promise<SourceTab[]> {
    const preview = await getSheetPreview(token, config.spreadsheet_id)
    return preview.tabs.map(tab => this.convertTab(tab))
  }

  // ... getRawRows, getData, getPreview, testConnection
}
```

---

## 3. When to Extend with Custom Methods

For **non-tabular** sources -- APIs, message platforms, databases with structured queries -- you extend `BaseConnector`, stub the tabular methods that don't apply, and add purpose-built methods.

Good candidates: BigQuery, Slack, Close.io, Zoho, any REST API.

**Pattern:**

1. Extend `BaseConnector<YourConfig>`
2. Implement the required tabular methods (they can return minimal/stubbed data)
3. Add custom methods that match your data source's natural interface

**Reference implementation:** `src/lib/connectors/bigquery.ts`

BigQuery implements the tabular interface (views act as "tabs", schema provides "headers") but the real value is in custom methods:

```typescript
export class BigQueryConnector extends BaseConnector<BigQueryConnectorConfig> {
  readonly metadata: ConnectorMetadata = {
    id: 'bigquery',
    capabilities: {
      search: false,         // No Drive-style search
      hasTabs: true,         // Views act as tabs
      incrementalSync: true, // Can filter by date
      // ...
    },
    enabled: true,
  }

  // Tabular interface works (views = tabs, schema = headers)
  async getTabs(_token: string, config: BigQueryConnectorConfig): Promise<SourceTab[]> { ... }
  async getRawRows(_token: string, config: BigQueryConnectorConfig, viewName: string): Promise<SourceRawRows> { ... }

  // Custom methods -- the real API surface
  async getPartnerData(config, viewName, clientName, options?): Promise<SourceData> { ... }
  async getClientNames(config, viewName?): Promise<string[]> { ... }
}
```

For Slack, the tabular interface is stubbed entirely because channels/users/messages are not rows-and-columns data. The custom methods are the entire API surface:

```typescript
export class SlackConnector extends BaseConnector<SlackConnectorConfig> {
  // Stubbed tabular methods
  async getPreview() { return { sourceId: 'slack', title: 'Slack', tabs: [], preview: { ... } } }
  async getTabs() { return [] }
  async getRawRows() { return { rows: [], totalRows: 0 } }
  async getData() { return { headers: [], rows: [] } }

  // Custom methods
  async getUsers(): Promise<SlackUser[]> { ... }
  async getChannels(): Promise<SlackChannel[]> { ... }
  async getChannelHistory(channelId, oldest?, limit?): Promise<SlackMessageMeta[]> { ... }
}
```

---

## 4. entity_external_ids Pattern

Sophie Hub maps entities (partners, staff, ASINs) to external systems through a single junction table instead of adding columns per integration.

**Table structure:**

```sql
CREATE TABLE entity_external_ids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,     -- 'partners', 'staff', 'asins'
  entity_id UUID NOT NULL,       -- FK to the entity
  source TEXT NOT NULL,           -- 'bigquery', 'slack_user', 'slack_channel', 'closeio', etc.
  external_id TEXT NOT NULL,      -- The identifier in the external system
  metadata JSONB DEFAULT '{}',   -- Source-specific context
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT,

  -- Allows one-to-many mappings per source (e.g., partner -> many Slack channels)
  CONSTRAINT entity_external_ids_unique_entity_source_external
    UNIQUE(entity_type, entity_id, source, external_id),

  -- Each external_id is unique within a source
  CONSTRAINT entity_external_ids_unique_source_external
    UNIQUE(source, external_id)
);

-- One-to-one semantics for selected sources
CREATE UNIQUE INDEX idx_entity_external_ids_one_to_one_sources
  ON entity_external_ids(entity_type, entity_id, source)
  WHERE source IN ('bigquery', 'slack_user');
```

**Migrations:** `supabase/migrations/20260205_entity_external_ids.sql`, `supabase/migrations/20260207_relax_entity_source_constraint.sql`

**Constraints explained:**

- `UNIQUE(entity_type, entity_id, source, external_id)` -- Allows one-to-many mappings (for example, one partner mapped to multiple Slack channels).
- `UNIQUE(source, external_id)` -- A BigQuery client_name can only be mapped to one partner. Prevents duplicate mappings.
- `idx_entity_external_ids_one_to_one_sources` (partial unique index) -- Keeps one-to-one behavior for `bigquery` and `slack_user`.

**Usage patterns:**

```typescript
// Save a one-to-many mapping (example: Slack channel -> partner)
await supabase
  .from('entity_external_ids')
  .upsert({
    entity_type: 'partners',
    entity_id: partnerId,
    source: 'slack_channel',
    external_id: 'C06ABCDEF',
  }, { onConflict: 'source,external_id' })

// Look up: "Which partner owns channel C06ABCDEF?"
const { data } = await supabase
  .from('entity_external_ids')
  .select('entity_id')
  .eq('source', 'slack_channel')
  .eq('external_id', 'C06ABCDEF')
  .single()

// Look up: "What are all external IDs for this partner?"
const { data } = await supabase
  .from('entity_external_ids')
  .select('source, external_id, metadata')
  .eq('entity_type', 'partners')
  .eq('entity_id', partnerId)
```

**Source naming conventions:**

| Source value | Entity type | External ID contains |
|-------------|-------------|---------------------|
| `bigquery` | partners | BigQuery `client_name` |
| `slack_user` | staff | Slack user ID (e.g., `U06ABCDEF`) |
| `slack_channel` | partners | Slack channel ID (e.g., `C06ABCDEF`) |
| `closeio` | partners | Close.io lead ID |
| `zoho` | partners | Zoho contact ID |

**API reference:** `src/app/api/bigquery/partner-mappings/route.ts` shows the full CRUD pattern for BigQuery mappings.

---

## 5. CategoryHub Integration

The Data Enrichment hub (`src/components/data-enrichment/browser/category-hub.tsx`) displays a card grid where admins select a data source category.

**To add a new connector card:**

1. Import the icon you need from `lucide-react`
2. Add a `<CategoryCard>` in the grid

```tsx
// src/components/data-enrichment/browser/category-hub.tsx

import { MessageSquare } from 'lucide-react'

// Inside the grid div:
<CategoryCard
  title="Slack"
  description="Staff mapping, channel-partner mapping, response analytics"
  icon={MessageSquare}
  iconColor="text-yellow-600"
  bgColor="bg-yellow-500/10"
  onClick={() => onSelectCategory('slack')}
/>
```

3. Update the `onSelectCategory` type to include your new category:

```typescript
interface CategoryHubProps {
  onSelectCategory: (category: 'sheets' | 'forms' | 'docs' | 'bigquery' | 'slack') => void
}
```

4. Handle the new category in the parent component (`SourceBrowser`) to render the appropriate view.

Use `comingSoon` prop on the `CategoryCard` for connectors not yet ready:

```tsx
<CategoryCard title="Zoho" description="..." icon={...} comingSoon />
```

---

## 6. Caching Pattern

Sophie Hub uses **module-level caches** with TTL for expensive data source operations. Caches survive component unmounts and API route re-invocations within the same server process, but reset on server restart.

**TTL constants** are centralized in `src/lib/constants.ts`:

```typescript
export const CACHE = {
  DEFAULT_TTL: 5 * 60 * 1000,      // 5 min -- general use
  BIGQUERY_TTL: 10 * 60 * 1000,    // 10 min -- expensive queries
  STATUS_COLORS_TTL: 5 * 60 * 1000,
  USAGE_TTL: 60 * 60 * 1000,       // 1 hour -- aggregated stats
} as const
```

**Implementation pattern** (see `src/lib/connectors/bigquery-cache.ts`):

```typescript
import { CACHE } from '@/lib/constants'

const CACHE_TTL = CACHE.BIGQUERY_TTL

let cachedClientNames: string[] | null = null
let cacheTimestamp = 0

export function getCachedClientNames(): string[] | null {
  if (!cachedClientNames) return null
  if (Date.now() - cacheTimestamp > CACHE_TTL) {
    cachedClientNames = null
    cacheTimestamp = 0
    return null
  }
  return cachedClientNames
}

export function setCachedClientNames(names: string[]): void {
  cachedClientNames = names
  cacheTimestamp = Date.now()
}

export function invalidateClientNamesCache(): void {
  cachedClientNames = null
  cacheTimestamp = 0
}
```

**For connectors with multiple cached entities** (see `src/lib/connectors/slack-cache.ts`):

Create separate get/set/invalidate functions per entity, plus an `invalidateAll` function:

```typescript
export function getCachedUsers(): SlackUser[] | null { ... }
export function setCachedUsers(users: SlackUser[]): void { ... }
export function invalidateUsersCache(): void { ... }

export function getCachedChannels(): SlackChannel[] | null { ... }
export function setCachedChannels(channels: SlackChannel[]): void { ... }
export function invalidateChannelsCache(): void { ... }

export function invalidateAllSlackCaches(): void {
  invalidateUsersCache()
  invalidateChannelsCache()
}
```

**Key rules:**

1. Always import TTL from `CACHE` constants -- never inline magic numbers
2. Always expose an `invalidate` function and call it on writes/mutations
3. Check cache first in API routes; set cache after successful fetch
4. Add a `CACHE_TTL` entry to `src/lib/constants.ts` if your connector needs a non-default TTL

**API route usage:**

```typescript
export async function GET() {
  const cached = getCachedClientNames()
  if (cached) {
    return apiSuccess({ clientNames: cached, cached: true })
  }

  const clientNames = await bigQueryConnector.getClientNames(config)
  setCachedClientNames(clientNames)
  return apiSuccess({ clientNames, cached: false })
}
```

---

## 7. API Route Conventions

All connector API routes follow Sophie Hub's standard patterns.

**Authentication and authorization** (`src/lib/auth/api-auth.ts`):

```typescript
import { requireAuth, requireRole } from '@/lib/auth/api-auth'

// Require any authenticated user
const auth = await requireAuth()
if (!auth.authenticated) return auth.response

// Require admin role (most connector admin routes)
const auth = await requireRole('admin')
if (!auth.authenticated) return auth.response
```

**Input validation** with Zod:

```typescript
import { z } from 'zod'
import { apiValidationError } from '@/lib/api/response'

const CreateMappingSchema = z.object({
  partner_id: z.string().uuid('partner_id must be a valid UUID'),
  client_name: z.string().min(1, 'client_name is required').max(255),
})

export async function POST(request: NextRequest) {
  const body = await request.json()
  const validation = CreateMappingSchema.safeParse(body)
  if (!validation.success) {
    return apiValidationError(validation.error)
  }
  // validation.data is typed
}
```

**Response helpers** (`src/lib/api/response.ts`):

```typescript
import { apiSuccess, apiError, apiValidationError, ApiErrors } from '@/lib/api/response'

// Success (200)
return apiSuccess({ mappings, count: mappings.length })

// Success with custom status
return apiSuccess({ mapping }, 201)

// Validation error (400) -- from Zod
return apiValidationError(validation.error)

// Semantic errors
return ApiErrors.unauthorized()
return ApiErrors.forbidden('Missing permission: slack:admin')
return ApiErrors.notFound('Channel')
return ApiErrors.conflict('Channel already mapped to another partner')
return ApiErrors.database()
return ApiErrors.internal()
return ApiErrors.externalApi('Slack', 'Rate limited')
```

**Response format:**

```typescript
// Success: { success: true, data: T, meta: { timestamp } }
// Error:   { success: false, error: { code, message, details? }, meta: { timestamp } }
```

**Route file structure:**

```
src/app/api/
  bigquery/
    client-names/route.ts      # GET
    partner-mappings/route.ts   # GET, POST, DELETE
    partner-data/[id]/route.ts  # GET
  slack/
    test-connection/route.ts    # POST
    users/route.ts              # GET
    channels/route.ts           # GET
    mappings/staff/route.ts     # GET, POST, DELETE
    mappings/staff/auto-match/route.ts  # POST
    mappings/channels/route.ts  # GET, POST, DELETE
    mappings/channels/auto-match/route.ts  # POST
```

---

## 8. Auto-Matching Strategies

When mapping external entities to Sophie Hub entities, auto-matching reduces manual work. Different data shapes call for different strategies.

### Email matching (staff)

Exact match on email address. Highest confidence -- emails are unique identifiers.

```typescript
// Match Slack users to staff by email
for (const slackUser of slackUsers) {
  const email = slackUser.profile.email?.toLowerCase()
  if (!email) continue

  const staff = staffByEmail.get(email)
  if (staff) {
    matches.push({
      staff_id: staff.id,
      slack_user_id: slackUser.id,
      match_type: 'auto',
    })
  }
}
```

### Name fuzzy matching (partners)

For BigQuery `client_name` to partner `brand_name`, use case-insensitive comparison first, then fuzzy matching with MiniSearch for remaining items.

```typescript
// Phase 1: Exact case-insensitive match
const partnersByName = new Map(
  partners.map(p => [p.brand_name.toLowerCase(), p])
)
for (const clientName of clientNames) {
  const partner = partnersByName.get(clientName.toLowerCase())
  if (partner) { /* matched */ }
}

// Phase 2: Fuzzy match unmatched items with MiniSearch
import MiniSearch from 'minisearch'
const index = new MiniSearch({
  fields: ['brand_name'],
  storeFields: ['id', 'brand_name'],
  searchOptions: { fuzzy: 0.2, prefix: true },
})
index.addAll(unmatchedPartners)
```

### Pattern-based matching (channels)

For Slack channels to partners, match against naming conventions like `client-{brand_name}`:

```typescript
// Parse channel name: "client-coat-defense" -> "coat defense"
function extractBrandFromChannel(channelName: string, pattern: string): string | null {
  // Remove prefix, replace hyphens with spaces
  const prefix = pattern.split('{')[0]  // "client-"
  if (!channelName.startsWith(prefix)) return null
  return channelName.slice(prefix.length).replace(/-/g, ' ')
}

// Then fuzzy-match extracted name against partner brand_names
```

**Auto-match summary types** (from `src/lib/slack/types.ts`):

```typescript
interface StaffAutoMatchSummary {
  total_staff: number
  total_slack_users: number
  matched: number
  unmatched_staff: string[]
  unmatched_slack_users: string[]
}

interface ChannelAutoMatchSummary {
  total_channels: number
  total_partners: number
  matched: number
  skipped_internal: number
  ambiguous: Array<{
    channel_name: string
    possible_matches: Array<{ partner_id: string; partner_name: string; confidence: number }>
  }>
  unmatched_channels: string[]
}
```

---

## 9. Checklist: Shipping a New Connector

### Types and config

- [ ] Add type ID to `ConnectorTypeId` union in `src/lib/connectors/types.ts`
- [ ] Define config interface (e.g., `SlackConnectorConfig`) in `types.ts`
- [ ] Add config to `ConnectorConfig` discriminated union in `types.ts`
- [ ] Add type guard function (e.g., `isSlackConfig()`) in `types.ts`

### Connector class

- [ ] Create `src/lib/connectors/{name}.ts`
- [ ] Extend `BaseConnector<YourConfig>` or implement `IConnector<YourConfig>`
- [ ] Define `metadata` with correct `id`, `name`, `icon`, `authType`, `capabilities`
- [ ] Implement tabular methods (full or stubbed)
- [ ] Add custom methods for non-tabular data access
- [ ] Export singleton instance

### Registration

- [ ] Import and register in `src/lib/connectors/index.ts`
- [ ] Re-export connector class and instance from `index.ts`

### Caching

- [ ] Create `src/lib/connectors/{name}-cache.ts` if data is expensive to fetch
- [ ] Add TTL constant to `src/lib/constants.ts` if non-default
- [ ] Export get/set/invalidate functions per cached entity

### External system client

- [ ] Create `src/lib/{name}/client.ts` for API wrapper (rate limiting, pagination, auth)
- [ ] Create `src/lib/{name}/types.ts` for API response types
- [ ] Add env vars to `.env.local` and document in README

### Database

- [ ] Create migration for any new tables (e.g., sync state)
- [ ] Choose `source` value(s) for `entity_external_ids` (e.g., `'slack_user'`, `'slack_channel'`)
- [ ] Add RLS policies for new tables

### API routes

- [ ] Create routes under `src/app/api/{name}/`
- [ ] Use `requireAuth()` or `requireRole()` for auth
- [ ] Validate input with Zod
- [ ] Use `apiSuccess` / `apiError` / `ApiErrors` for responses
- [ ] Check cache before external calls, set cache after
- [ ] Invalidate cache on mutations

### CategoryHub UI

- [ ] Add `CategoryCard` to `src/components/data-enrichment/browser/category-hub.tsx`
- [ ] Update `onSelectCategory` type to include new category
- [ ] Handle new category in parent `SourceBrowser`
- [ ] Build mapping/admin UI component(s)

### Mapping UI

- [ ] Build auto-match endpoint and UI
- [ ] Build manual mapping UI for items that didn't auto-match
- [ ] Show match confidence / match type indicators
- [ ] Support bulk save (batch operations for many mappings)

### Testing

- [ ] Test connection endpoint works
- [ ] Test auto-matching produces correct results
- [ ] Test cache invalidation on mutations
- [ ] Test auth guards on all routes
- [ ] Test Zod validation rejects bad input
