# Sophie Hub v2 - Project Context

## What This Is

Sophie Hub v2 is the internal operations platform for Sophie Society, an Amazon brand management agency with 120+ staff members managing 700+ partner brands. This is a **fresh rebuild** designed entity-first, replacing a fragmented system of Google Sheets, forms, and a previous attempt (SophieHub v1) that had 100+ database tables due to a source-centric rather than entity-centric approach.

---

## DESIGN PHILOSOPHY (READ THIS FIRST)

**This is a design-led project.** Every feature, every component, every interaction must be crafted with care. The goal is not just functionality—it's creating an experience that users genuinely enjoy.

### The Golden Rule
> "Build interfaces with uncommon care." — interfacecraft.dev

### Design Principles (Non-Negotiable)

1. **Delight Over Function**
   - A functional but ugly tool is a failure
   - Every screen should make users want to use the tool
   - Beauty and usability are not trade-offs—they reinforce each other

2. **Progressive Disclosure**
   - Show the simple path first
   - Reveal complexity only when requested
   - Never overwhelm on first view
   - Depth should be available, not mandatory

3. **Instant Feedback**
   - Every click, every action gets immediate visual response
   - Loading states must be elegant (subtle spinners, skeleton loaders)
   - Success/error states should be clear but not jarring
   - Micro-interactions matter (button press scales, hover states, focus rings)

4. **Motion With Purpose**
   - Animations guide attention, not distract
   - Use motion to show relationships (what came from where)
   - Transitions should feel natural, not flashy
   - See Animation Guidelines below

5. **Data Feels Solid**
   - Information density done right (not cramped, not sparse)
   - Clear visual hierarchy (what's important stands out)
   - Trust through consistency (same patterns everywhere)
   - Lineage/source visible on demand (where did this data come from?)

### Animation Guidelines (The Easing Blueprint)

Reference: animations.dev by Emil Kowalski

**Use These:**
- **ease-out** `cubic-bezier(0.25, 0.46, 0.45, 0.94)`: PRIMARY choice
  - All user-initiated interactions (clicks, opens, closes)
  - Dropdowns, modals, tooltips, menus
  - Enter animations on marketing/welcome screens
  - Makes UI feel responsive and snappy

- **ease-in-out** `cubic-bezier(0.45, 0, 0.55, 1)`: For morphing
  - Elements already on screen changing position/size
  - Accordion expansions, tab switches
  - Layout shifts

- **linear**: Only for:
  - Progress bars
  - Marquees/tickers
  - Time-based visualizations

**Never Use:**
- **ease-in**: Makes UI feel sluggish and unresponsive. Avoid completely.

**Custom Curves for Polish:**
```css
--ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);      /* Snappier ease-out */
--ease-out-back: cubic-bezier(0.34, 1.56, 0.64, 1); /* Slight overshoot */
```

**Duration Guidelines:**
- Micro-interactions (button press): 100-150ms
- UI transitions (dropdowns, modals): 200-300ms
- Page transitions: 300-400ms
- Complex animations: 400-600ms

### Visual Design Rules

1. **Spacing**: Use consistent spacing scale (4, 8, 12, 16, 24, 32, 48, 64px)
2. **Typography**: Clear hierarchy, max 2-3 font sizes per view
3. **Color**: Purposeful use of accent colors (orange = action/priority, green = success, blue = info)
4. **Borders**: Subtle (border-border/40), not heavy. Prefer `box-shadow: 0 0 0 1px` over border for better blending
5. **Shadows**: Sparingly, for elevation (hover states, modals)
6. **Empty States**: Never just "No data"—always guide next action

### Typography Polish

- **Font smoothing**: Always use `-webkit-font-smoothing: antialiased`
- **No layout shift**: Never change font-weight on hover/selected states
- **Tabular numbers**: Use `font-variant-numeric: tabular-nums` for dynamic numbers (counters, prices)
- **Text wrapping**: Use `text-wrap: balance` on headings for better line breaks
- **Proper characters**: Use `…` not `...`, curly quotes not straight quotes

### Borders & Shadows

- **Shadows for borders**: Use `box-shadow: 0 0 0 1px rgba(0,0,0,0.08)` instead of border for better blending
- **Hairline borders**: Use 0.5px on retina displays for crisp dividers
- **Eased gradients**: Use eased gradients over linear for solid color fades
- **Mask over gradient**: Prefer `mask-image` for fades—works better with varying content

### Layout Rules

- **No layout shift**: Dynamic elements should never cause layout shift. Use hardcoded dimensions for skeletons
- **Z-index scale**: Use fixed scale (dropdown: 100, modal: 200, tooltip: 300, toast: 400)
- **Safe areas**: Account for device notches with `env(safe-area-inset-*)`
- **Scroll margins**: Set `scroll-margin-top` for anchor scrolling with sticky headers
- **No fade on scrollable**: Don't apply fade masks on scrollable lists—cuts off content

### Forms & Controls

- **Labels**: Clicking label must focus input. Always associate with `for` or wrap
- **Input types**: Use appropriate `type` (email, tel, url, number, search)
- **Font size 16px+**: Inputs must be 16px+ to prevent iOS zoom on focus
- **Autofocus**: Only on desktop—never autofocus on touch devices (opens keyboard)
- **Form wrapper**: Always wrap inputs in `<form>` to enable Enter submission
- **Cmd+Enter**: Support Cmd/Ctrl+Enter for textarea submission
- **Disable after submit**: Disable buttons during submission to prevent double-submits

### Button Polish

- **Always use `<button>`**: Never add click events to divs/spans
- **Press feel**: Add `transform: scale(0.97)` on `:active` for tactile feedback
- **Shortcuts as tooltips**: If action has keyboard shortcut, show it in tooltip

### Checkbox/Control Rules

- **No dead zones**: Space between checkbox and label must be clickable
- **Use wrapper labels**: `<label class="flex"><input type="checkbox"/><span>Label</span></label>`

### Decorative Elements

- **Pointer events**: Disable `pointer-events` on decorative elements
- **User select**: Disable `user-select` on code illustrations

---

## CRITICAL: No Fake Data

> **Every number, stat, and piece of information in the UI MUST come from the database.**

The UI is a **window into the database**, not a separate thing to maintain.

- **DO**: Query tables, derive stats, let data auto-update from single source of truth
- **DON'T**: Hardcode numbers, create separate progress fields, show mock data

Without this, you play whack-a-mole updating UI in multiple places. Database = truth. UI = view.

---

## The Core Philosophy

### Two Master Entities
Everything in this system ultimately relates to one of two core entities:
1. **Partners** - Client brands we manage (the businesses paying us)
2. **Staff** - Team members who do the work

All other data is either:
- A **subtable** of these entities (ASINs belong to Partners, Training belongs to Staff)
- A **relationship** between them (Partner Assignments connect Staff to Partners)
- **Reference data** (settings, templates, external contacts)

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS + shadcn/ui |
| Animation | Framer Motion |
| Database | Supabase (PostgreSQL) |
| Auth | NextAuth.js + Google OAuth |
| External APIs | Google Sheets API (primary data source) |

## Project Structure

```
src/
├── app/
│   ├── (dashboard)/           # Authenticated routes
│   │   ├── admin/
│   │   │   ├── data-enrichment/  # The Data Mapping Wizard
│   │   │   ├── change-approval/  # Review/approve staged changes
│   │   │   └── layout.tsx        # Admin route protection
│   │   ├── partners/          # Partner management
│   │   ├── staff/             # Staff management
│   │   └── team/              # Team/squad views
│   └── (auth)/                # Login, etc.
├── components/
│   ├── data-enrichment/       # Wizard, staging, lineage components
│   ├── help/                  # Help system (WorkflowCard, etc.)
│   ├── layout/                # Sidebar, headers, shells
│   ├── sync/                  # Sync-related components (SyncButton)
│   └── ui/                    # shadcn/ui base components
├── lib/
│   ├── db/                    # Database schema, queries
│   ├── entity-fields/         # Field registry (single source of truth)
│   ├── navigation/            # Role-based navigation config
│   ├── sheets/                # Google Sheets integration
│   ├── enrichment/            # Data mapping logic
│   └── utils/                 # Helpers
├── types/                     # TypeScript types
└── docs/                      # Feature documentation
```

## Database Schema Overview

### Tier 1: Core Entities
- `partners` - Client brands (source of truth)
- `staff` - Team members (source of truth)

### Tier 2: Relationships
- `partner_assignments` - Who manages which partner
- `squads` - Team groupings
- `staff_squads` - Staff membership in squads

### Tier 3: Domain Entities
- `asins` - Amazon products per partner
- `weekly_statuses` - Time-series partner health data
- `partner_sheets` - Linked Google Sheets per partner/ASIN
- `staff_training` - Training progress per staff

### Tier 4: Reference/Config
- `external_contacts` - Amazon reps, partnerships
- `system_settings` - App configuration
- `help_docs` - Centralized help documentation content
- `help_doc_versions` - Version history for help content changes

### Data Pipeline Tables
- `data_sources` - Configured external sources (sheets, forms)
- `field_mappings` - How source fields map to target tables
- `staged_changes` - Pending changes awaiting review
- `field_lineage` - Tracks where each field's value originated

## Key Features

### Data Enrichment Wizard (Admin Only)
The heart of this rebuild. A visual interface that:
1. Connects to data sources (Google Sheets first, forms later)
2. Discovers fields/columns automatically
3. Guides admin through classifying each field
4. Maps fields to target tables with **authority levels**:
   - **Source of Truth** (⭐): This sheet is authoritative for this field
   - **Reference** (📋): Read-only lookup, doesn't update master record
5. Stages changes for review before committing
6. Tracks lineage (where did this value come from?)
7. Syncs data to entity tables with dry-run preview, batch processing, and `source_data` JSONB capture for zero data loss

**Two-Layer Data System**: Sheets feed database initially, but individual fields can be migrated to "app-native" over time as adoption grows. See `/src/app/(dashboard)/admin/data-enrichment/CLAUDE.md` for full details.

### Header Row Handling (CRITICAL)

Many Google Sheets have headers on rows other than row 0 (e.g., Master Client Dashboard has headers on row 9). The system must always respect the configured `header_row` when fetching data.

**How it works:**
1. User confirms header row in SmartMapper Preview phase → saved to `tab_mappings.header_row`
2. When fetching sheet data, ALWAYS pass the header row to `getSheetData()`:
   ```typescript
   // CORRECT:
   const data = await getSheetData(token, spreadsheetId, tabName, headerRow)

   // WRONG (defaults to row 0):
   const data = await getSheetData(token, spreadsheetId, tabName)
   ```

**Where header_row is used:**
- `lib/sync/engine.ts` - Sync uses `config.tabMapping.header_row`
- `lib/connectors/google-sheets.ts` - Connector's `getData()` accepts optional `headerRow`
- `lib/google/sheets.ts` - Core `getSheetData()` slices data based on `headerRow`
- `api/sheets/tab-data` - Accepts `?headerRow=N` query parameter

**Where header_row is NOT needed:**
- `api/sheets/raw-rows` - Returns ALL rows for header detection (intentionally no header assumption)
- AI analysis endpoints - Use raw rows for full context

**When adding new sheet-fetching code:**
1. If you need data with headers parsed → use `getSheetData()` WITH `headerRow`
2. If you need raw rows for detection/preview → use `getSheetRawRows()`
3. Always check if `tab_mappings.header_row` exists and pass it through

### Tab Mappings: is_active and status (CRITICAL)

The `tab_mappings` table has two related fields that **MUST stay in sync**:
- `status`: The tab's workflow status (`active`, `hidden`, `reference`, `flagged`)
- `is_active`: Boolean used for filtering in queries

**The Rule:** `is_active` must ALWAYS equal `(status === 'active')`

| status | is_active |
|--------|-----------|
| `active` | `true` |
| `hidden` | `false` |
| `reference` | `false` |
| `flagged` | `false` |

**Why this matters:** A past bug allowed `status: 'hidden'` with `is_active: true`, causing hidden tabs to appear in:
- Sync sources (Change Approval page)
- Data Flow Map
- Field lineage tooltips

The actual sync was unaffected (data integrity preserved), but it was confusing and could lead to syncing from wrong tabs.

**How it's enforced:**
1. **Application level**: `PATCH /api/tab-mappings/[id]/status` automatically sets `is_active` based on `status`
2. **Database level** (optional): A trigger can be added to enforce this at the DB level

**When querying tab_mappings for UI/sync:**
```typescript
// CORRECT - filter to only active tabs
.from('tab_mappings')
.select('...')
.eq('is_active', true)

// WRONG - shows hidden tabs too
.from('tab_mappings')
.select('...')
.not('primary_entity', 'is', null)  // Missing is_active filter!
```

**Exception:** The Data Enrichment admin page intentionally shows ALL tabs (including hidden) so admins can manage them. But sync, flow map, and lineage queries must filter.

### Partner Management
- View all partners with search/filter
- See assignments, ASINs, weekly status history
- Drill into partner detail with all related data

### Staff Management
- Team directory with roles, squads, capacity
- Training progress tracking
- Assignment history

## Current Phase

**Phase 4: Sync Verification & Polish** (In Progress)
- Phase 1 (Foundation) complete: app shell, auth, database schema, RBAC
- Phase 2 (Data Mapping) complete: SmartMapper, AI suggestions, draft persistence, data flow map, sync engine
- Phase 3 (Hardening) complete: entity ID capture, failed batch tracking, weekly pivot, AI badges, Product Centre
- Entity pages complete: `/partners` and `/staff` with list (search, filter, sort, pagination) + detail pages
  - Shared components: StatusBadge, TierBadge, EntityListToolbar, FieldGroupSection, assignment cards
  - API routes: GET /api/partners, /api/partners/[id], /api/staff, /api/staff/[id]
  - Partner detail: field groups, staff assignments, ASINs, weekly status history
  - Staff detail: field groups, assigned partners

### Phase 4 Progress (Feb 2026)

**Completed:**
- ✅ First successful sync: 1823 partners from Master Client Sheet
- ✅ Value transform system working (status: Active→active, Churned→churned)
- ✅ Auto-transform detection for status/tier fields when saving mappings
- ✅ Navigation caching for instant page returns (module-level cache with 5min TTL)
- ✅ Progress logging during sync (every 500 rows)
- ✅ Error handling improvements (findExisting uses maybeSingle)
- ✅ **Batch lookup** - N queries → ~4 queries (10x+ faster)
- ✅ **Sync locking** - Prevents concurrent syncs on same tab_mapping
- ✅ **Upsert logic** - Uses ON CONFLICT for graceful duplicate handling
- ✅ **Duplicate cleanup** - Removed 1100+ duplicate records
- ✅ **Node 20** - Added .nvmrc, removed Supabase deprecation warning
- ✅ **Partner Health Dashboard** - Health distribution card on dashboard + compact bar in Partners header
- ✅ **Status Color Mappings** - Admin-configurable status→bucket mappings in Settings
  - Database table: `status_color_mappings` with seed defaults (37 patterns)
  - API routes: CRUD at `/api/admin/status-mappings`, unmapped discovery
  - Settings UI: Table with add/edit/delete, quick-map for unmapped statuses
  - Auto-discovery of unmapped statuses from partner source_data
  - Weekly status tab refactored to use centralized bucket-based colors
- ✅ **Weekly Status Year Calendar** - Full year view with 12 months grid
  - ISO week numbering (Week 1 can start in late December)
  - Color inheritance for past weeks with no data (faded previous status)
  - Future weeks show no color (blank)
  - 5 color intensity levels for visual hierarchy
- ✅ **Partners Default Filter** - Active status selected by default
- ✅ **Health Heatmap** - GitHub-style weekly status visualization
  - 156 weeks (~3 years) of partner health history
  - Sorting: Currently At Risk, Most Turbulent, Healthiest, Most Data
  - Event delegation for 88k+ cells (optimized scroll performance)
  - Module-level caching for view state persistence
- ✅ **Computed Partner Status** - Calculate status from latest weekly data
  - `src/lib/partners/computed-status.ts` - Status computation logic
  - Extracts latest weekly status from `source_data` JSONB
  - Maps weekly status → bucket → partner status value
  - Compares computed vs sheet-derived status (mismatch indicator)
  - API returns: `computed_status`, `computed_status_label`, `status_matches`
  - Filters now work on computed status (from weekly data, not DB field)
- ✅ **Partner List Refresh** - Manual refresh button in Partners page header
  - Clears heatmap cache on refresh
  - Re-fetches partner data with current filters
- ✅ **Per-Partner Sync** - Sync single partner from Google Sheet
  - API route: `POST /api/partners/[id]/sync`
  - Finds partner row in source sheet by key field
  - Updates only that partner's `source_data` and mapped fields
  - Sync button in partner detail page header
- ✅ **Weekly Status Preview Dialog** - Click weekly bars in partner list for quick view
  - `src/components/partners/weekly-status-dialog.tsx` - Mini calendar popup
  - Shows last 4 months in 2x2 grid with week-by-week status colors
  - Tooltips show week number, date, and full status text
  - "View Full History" button links to partner detail weekly tab
  - Partner detail page supports `?tab=weekly` URL param for direct linking
- ✅ **Responsive Partners Table** - Horizontal scrolling for narrow viewports
  - Sticky header stays fixed while content scrolls underneath
  - Header and content have independent horizontal scroll wrappers
  - Z-index layering ensures rows don't overlap header

- ✅ **Modular Navigation System** - Role-based sidebar visibility
  - Navigation config extracted to `src/lib/navigation/config.ts`
  - `NavSection` and `NavItem` types with `requiredRole` field
  - `getNavigationForRole(role)` filters sections/items by user role
  - Sidebar fetches user role from `/api/auth/me` with module-level caching
  - Admin section only visible to users with admin role
- ✅ **Admin Route Protection** - Server-side role check for `/admin/*` routes
  - `src/app/(dashboard)/admin/layout.tsx` - Checks admin role before rendering
  - Non-admins redirected to dashboard with error
  - Uses same role logic as `api-auth.ts` (ADMIN_EMAILS + staff table lookup)
- ✅ **Change Approval Page** - `/admin/change-approval`
  - Hub view with stats cards (Pending/Approved/Rejected/Applied)
  - **Entity-centric sync**: Shows Partners, Staff, ASINs (not individual tabs)
  - "Sync Partners" button syncs ALL tabs that feed partner data
  - Expandable detail shows which sources/tabs contribute to each entity
  - API: `GET /api/sync/sources` - Returns entities with aggregated source info
  - Browser view placeholder for future change list
- ✅ **SyncButton Component** - Reusable sync button with status tooltip
  - `src/components/sync/SyncButton.tsx` - Shows last sync time on hover
  - Placeholder for scheduled auto-sync time (future feature)
  - Spinning state during sync, disabled when syncing
- ✅ **Help Documentation System (Phase 1)** - Self-documenting help infrastructure
  - Database tables: `help_docs` and `help_doc_versions` with RLS policies
  - API endpoint: `GET /api/help/[docId]` - Fetches published help content
  - `WorkflowCard` component: Reusable numbered workflow steps card
    - Supports inline content OR database fetch via `docId` prop
    - Collapsible with smooth Framer Motion animations
    - Falls back to inline content if database fetch fails
  - Change Approval page updated to use WorkflowCard
  - Future phases: HelpButton, HelpPopover, FieldTooltip, AI generation

**Pending:**
- ⚠️ Real-time progress feedback in UI (WebSocket or polling)
- ⚠️ Change Approval backend (staged_changes API, sync integration)
- ⚠️ Change Approval frontend (change list, field-level diffs, approve/reject)

### Phase 5 Roadmap: Change Approval Workflow

**Vision:** When syncing from sheets, show a "Review Changes" screen before applying updates to the database. This prevents accidental overwrites and creates an audit trail.

**Design Decisions (Confirmed):**
1. **Approval mode**: Opt-in with default ON - new mappings require approval, can disable per mapping once trusted
2. **Auto-approve rules**: Not in v1 - start simple with manual review, add rules later
3. **Scheduled syncs**: Future feature - daily auto-sync at off-peak hours
4. **Location**: `/admin/change-approval` - dedicated page, not a popup

**User Flow:**
1. User clicks "Sync" on a mapped sheet
2. System fetches source data and compares to database
3. **Review Screen** shows:
   - New records to create (green)
   - Records to update with field-level diff (yellow)
   - Records unchanged (grey/collapsed)
4. User reviews changes, can approve all or selectively
5. On approval, changes apply to database with full lineage tracking

**Key Features:**
- **Field-level diffs**: Show "Pod Leader: John Smith → Jane Doe"
- **Selective approval**: Approve some changes, reject others
- **Batch operations**: "Approve all new", "Reject all updates"
- **Conflict detection**: Warn if database was modified since last sync
- **Audit log**: Track who approved what, when

**Technical Approach:**
- `staged_changes` table already exists for this purpose
- Dry-run mode in sync engine already calculates changes without applying
- Add UI to display EntityChange[] from dry run
- Add approval endpoint to apply selected changes

**Stretch Goals:**
- Email notifications for pending approvals
- Auto-approve rules (e.g., "always accept new partners")
- Scheduled syncs with auto-approval for low-risk changes

## Important Context

### Legacy System
The previous SophieHub had data spread across:
- Master Client Dashboard (20+ tabs)
- Individual Pod Leader Dashboards
- Brand Info sheets per partner
- Various Google Forms
- Close IO (CRM)
- Zoho (invoicing)

### The Problem We're Solving
Data was fragmented with no single source of truth. The old approach crawled sheets one-by-one without a coherent entity model. This rebuild thinks entity-first: define what Partners and Staff look like, then map all sources to those definitions.

### Who Uses This
- **Admin** (Tomas + leadership): Full access, configures data sources, reviews staged changes
- **Operations**: Daily partner management
- **Pod Leaders**: View their assigned partners
- **Staff**: View their own data, training, PTO

## Code Style

- Functional components with hooks
- Server Components by default, Client Components when needed
- Descriptive variable names
- Co-locate related code (component + styles + types together when small)
- Extract to lib/ when logic is reused

---

## Authentication & Authorization

Sophie Hub uses NextAuth.js with Google OAuth for authentication and a role-based access control (RBAC) system.

### Environment Variables

```bash
# Required in .env.local
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
NEXTAUTH_SECRET=your-secret-key

# Admin emails (comma-separated) - these users get full admin access
ADMIN_EMAILS=admin@example.com,tomas@sophiesociety.com

# Optional: Restrict to specific email domains
ALLOWED_EMAIL_DOMAINS=sophiesociety.com
```

### Role Hierarchy

| Role | Access Level |
|------|--------------|
| `admin` | Full access to everything including Data Enrichment |
| `pod_leader` | Manages assigned partners and team |
| `staff` | Views assigned partners, manages own profile |
| `partner` | External users viewing their own data (future) |

### How Roles Are Assigned

1. **ADMIN_EMAILS env var**: Emails listed here automatically get `admin` role
2. **Staff table lookup**: Users in `staff` table get role based on their `role` column:
   - `admin` or `operations_admin` → `ROLES.ADMIN`
   - `pod_leader` → `ROLES.POD_LEADER`
   - Everything else → `ROLES.STAFF`
3. **Default**: Users not in staff table get `ROLES.STAFF`

### Protected Routes

- Dashboard layout (`src/app/(dashboard)/layout.tsx`) requires authentication
- Data Enrichment requires `admin` role
- API routes use `requireAuth()`, `requirePermission()`, or `requireRole()` from `src/lib/auth/api-auth.ts`

### Debug Endpoint

```
GET /api/auth/me
```
Returns current user info including role assignment. Useful for debugging auth issues.

### Security Considerations

1. **ADMIN_EMAILS for Development**: The `ADMIN_EMAILS` env var is suitable for development and small teams. For production with many admins, consider adding an `access_level` column to the `staff` table.

2. **API Authentication**: All API routes should use `requireAuth()`, `requirePermission()`, or `requireRole()` from `src/lib/auth/api-auth.ts`. Never expose sensitive data without authentication.

3. **Environment Variables**: Never commit `.env.local` to git. The file is in `.gitignore` by default.

4. **OAuth Tokens**: Google OAuth tokens are stored in the NextAuth.js session (JWT strategy). They're refreshed automatically when expired.

---

## Enterprise Code Patterns

### Zod Input Validation

All API inputs are validated with Zod schemas defined in `src/lib/validations/schemas.ts`.

```typescript
import { DataSourceSchema } from '@/lib/validations/schemas'

export async function POST(request: Request) {
  const body = await request.json()
  const validation = DataSourceSchema.create.safeParse(body)

  if (!validation.success) {
    return apiValidationError(validation.error)
  }

  // validation.data is now typed and validated
}
```

### Standardized API Responses

All API routes use consistent response helpers from `src/lib/api/response.ts`:

```typescript
import { apiSuccess, apiError, apiValidationError, ApiErrors } from '@/lib/api/response'

// Success response
return apiSuccess({ source }, 201)

// Validation error (from Zod)
return apiValidationError(validation.error)

// Standard errors
return ApiErrors.unauthorized()
return ApiErrors.forbidden('Missing permission: data-enrichment:write')
return ApiErrors.notFound('Data source')
return ApiErrors.database(error)
```

**Response Format:**
```typescript
// Success: { success: true, data: T, meta: { timestamp } }
// Error: { success: false, error: { code, message, details? }, meta: { timestamp } }
```

**Client-Side Handling:**
When fetching from these APIs, access data via `json.data`:
```typescript
const json = await response.json()
const sources = json.data?.sources || json.sources || [] // Support both formats during migration
```

### Centralized TypeScript Types

Shared entity types are defined in `src/types/entities.ts` to prevent type drift:

```typescript
import { EntityType, TabStatus, ColumnCategory, CategoryStats } from '@/types/entities'
import { emptyCategoryStats, calculateProgress } from '@/types/entities'
```

### Entity Field Registry

All entity field definitions (partners, staff, asins) are centralized in `src/lib/entity-fields/`. This is the single source of truth for field names, types, groups, and reference relationships. Never define field lists inline.

```typescript
import { getFieldsForEntity, getGroupedFieldDefs, getSchemaDescription } from '@/lib/entity-fields'
import type { FieldDefinition, EntityFieldRegistry } from '@/lib/entity-fields'

// Grouped dropdown options for UI
const groups = getGroupedFieldDefs('partners')

// AI-friendly schema text
const schema = getSchemaDescription()

// Dependency graph
const deps = getReferencedEntities('partners') // → ['staff']
```

Reference fields encode which entity they point to, the match field, and storage mechanism (direct FK vs junction table). This powers the MapPhase grouped dropdown, AI mapping suggestions, and the analyze-source route.

**Field Alias Auto-Matching**: Each field definition supports an optional `aliases` array for fuzzy column name matching during the Map phase. When source columns are auto-matched to entity fields, the matcher checks `name`, `label`, and all `aliases` (case-insensitive). Example: a source column "Email Address" auto-matches to `client_email` via its alias.

### Mapping Requirement: Category + Target Field

**CRITICAL**: When a column is categorized as `partner`, `staff`, or `asin`, it MUST have a `target_field` set to be extracted to proper database columns during sync.

- **Category only** (no target_field): Data is captured in `source_data` JSONB but NOT extracted to table columns
- **Category + target_field**: Data is both captured in `source_data` AND extracted to the specified column

**Auto-matching behavior:**
- When user clicks category shortcut (e.g., "Partner"), the system auto-matches the source column name to a target field using aliases
- If no match found, `target_field` remains null and a warning is shown on save
- User should manually select a target field from the dropdown

**Validation:**
- On save, if any entity-category columns have no target_field, a warning toast is shown
- The mapping still saves (for zero-data-loss), but user is informed that columns won't sync to proper fields

### Zero-Data-Loss Source Capture

All entity tables (`partners`, `staff`, `asins`) have a `source_data` JSONB column that captures **every raw value** from every synced source row — including unmapped and skipped columns. This ensures no data is ever lost during import.

```typescript
// Structure: { connector: { tab_name: { original_header: raw_value } } }
source_data: {
  gsheets: {
    "Master Client Sheet": {
      "Brand Name": "Acme Corp",
      "Seller Central Name": "acme-us",  // unmapped column — still captured
      "Email Address": "hello@acme.com"
    }
  }
}
```

Re-syncing the same tab replaces that tab's data; other tabs are preserved (additive merge at connector+tab level).

### Entity Versioning (Time Machine)

Every INSERT, UPDATE, and DELETE on core entity tables (`partners`, `staff`, `asins`) is automatically captured by PostgreSQL triggers into the `entity_versions` table. This provides full point-in-time reconstruction of any entity.

```sql
-- What did this partner look like before the last sync?
SELECT old_data, changed_fields, changed_at
FROM entity_versions
WHERE entity_id = '<partner-uuid>' AND entity_type = 'partners'
ORDER BY changed_at DESC;
```

**What's stored per change:**
- `operation`: INSERT / UPDATE / DELETE
- `old_data`: Full row JSONB before the change (NULL on INSERT)
- `new_data`: Full row JSONB after the change (NULL on DELETE)
- `changed_fields`: Array of field names that actually changed (UPDATE only)
- `changed_at`: Timestamp

**Storage cost**: ~1KB per change. At 700 partners updated weekly = ~180MB/year. Negligible.

**Three layers of data protection:**
1. `entity_versions` — full row snapshots on every change (time machine)
2. `field_lineage` — field-level provenance: which source, which sync, old/new values
3. `source_data` JSONB — raw source capture: every column from every import, even unmapped

**RLS**: Only admins can read version history. Triggers run as SECURITY DEFINER (bypass RLS for writes).

### Value Transforms

The sync engine supports value transformation during import via `column_mappings.transform_type` and `transform_config`:

**Available Transforms:**
- `none` - Pass through as-is
- `trim` - Remove whitespace
- `lowercase` / `uppercase` - Case conversion
- `date` - Parse various date formats to ISO
- `currency` - Extract numeric value from "$1,234.56"
- `boolean` - Convert yes/no/true/false/1/0 to boolean
- `number` - Parse numeric strings
- `value_mapping` - Map specific values to database-valid values

**Auto-Detection:**
The save endpoint automatically applies transforms for known fields:
- `status` field: Maps "Active"→"active", "Churned"→"churned", "Paused"→"paused", etc.
- `tier` field: Maps "Tier 1"→"tier_1", "Tier 2"→"tier_2", etc.

**Value Mapping Example:**
```typescript
transform_config: {
  mappings: {
    "Active": "active",
    "Churned": "churned",
    "Discontinued": "churned"
  },
  default: "active"  // Fallback if no match
}
```

---

## Dark Mode

Sophie Hub supports light, dark, and system theme modes.

### Implementation
- Uses `next-themes` with class strategy (`darkMode: ["class"]` in Tailwind)
- Theme toggle in sidebar user section (cycles: light -> dark -> system)
- Respects system preference by default
- Theme persists in localStorage

### Components
- `ThemeProvider` wraps app in `src/components/providers/theme-provider.tsx`
- `useTheme()` hook from `next-themes` for accessing/setting theme
- Smooth theme transitions via CSS in `globals.css`

### Usage
```tsx
import { useTheme } from 'next-themes'

function MyComponent() {
  const { theme, setTheme } = useTheme()
  // theme is 'light' | 'dark' | 'system'
}
```

---

## UX Standards

**See `src/UX-STANDARDS.md` for the definitive UX reference** — covers:

1. **Design Philosophy** — Core principles, visual consistency, no fake data
2. **Animation System** — Easing curves, durations, `initial={false}` pattern
3. **Responsive Design** — Breakpoints, text truncation, touch targets
4. **Typography & Visual Design** — Spacing scale, colors, z-index
5. **Forms & Controls** — Input rules, accessibility, button polish
6. **Error Handling** — Toast notifications, API responses, error hierarchy
7. **Auth Error Recovery** — SessionMonitor auto-redirects on 401
8. **Loading & Empty States** — Skeleton loaders, user guidance
9. **Mobile Patterns** — Long-press action sheets, component variants
10. **Component Checklist** — Pre-ship verification

### Quick Reference

```tsx
// Toast notifications
import { toast } from 'sonner'
toast.success('Saved')
toast.error('Failed', { action: { label: 'Retry', onClick: retry } })

// Animation (no mount animation)
<motion.div initial={false} animate={{ opacity: 1 }} />

// Responsive truncation
className="truncate max-w-[80px] md:max-w-[120px]"

// Touch-friendly button
className="h-11 px-4 active:scale-[0.97]"
```

---

## Mobile Support

Sophie Hub is fully responsive with mobile-first considerations.

### Breakpoints
- Mobile: < 768px (md breakpoint)
- Desktop: >= 768px

### Layout
- **Sidebar**: Fixed on desktop, slide-in drawer on mobile
- **Mobile Header**: Shows hamburger menu + Sophie Hub logo on mobile only
- **Content**: `pl-0 md:pl-64` padding, `pt-14 md:pt-0` for mobile header

### Components
- `MobileMenuProvider` in `src/components/layout/mobile-menu-context.tsx`
- `useMobileMenu()` hook provides `{ isOpen, toggle, open, close }`
- Sidebar auto-closes on navigation on mobile
- Body scroll locked when drawer is open

### Touch Targets
- Minimum 44px touch targets on all interactive elements
- Full-width dropdowns on mobile for easier selection
- Larger button heights on mobile (h-9 vs h-7)

### Data Enrichment Mobile
- Column classification uses card layout on mobile (`MobileColumnCard`)
- Table layout on desktop (existing behavior)
- Horizontal scrolling tab bars with `overflow-x-auto scrollbar-hide`
- Filter tabs scroll horizontally on overflow

---

## Animation System

Centralized animation constants in `src/lib/animations.ts`.

### Easing Curves
```typescript
import { easeOut, easeInOut, easeOutExpo } from '@/lib/animations'

// Primary - user interactions
const easeOut = [0.22, 1, 0.36, 1]

// Morphing - on-screen elements changing
const easeInOut = [0.45, 0, 0.55, 1]
```

### Durations
```typescript
import { duration, durationMs } from '@/lib/animations'

// Framer Motion (seconds)
duration.micro  // 0.15 - button press
duration.ui     // 0.2  - dropdowns, modals
duration.page   // 0.3  - page transitions

// CSS (milliseconds)
durationMs.micro  // 150
durationMs.ui     // 200
durationMs.page   // 300
```

### Standard Variants
```typescript
import { fadeInUp, scaleOnHover, springPop } from '@/lib/animations'

// Use directly with framer-motion
<motion.div {...fadeInUp}>
<motion.div {...scaleOnHover}>
```

### No Animation on Page Load

For elements that appear on page load (not user-triggered), use `initial={false}` to prevent entrance animations. Only animate on **state changes**.

```typescript
// GOOD - no animation on mount, animates only when state changes
<motion.div
  initial={false}
  animate={{ scale: 1, opacity: 1 }}
  exit={{ scale: 0.8, opacity: 0 }}
  transition={{ duration: 0.15, ease: easeOut }}
/>

// BAD - animates every time component mounts (flickery)
<motion.div
  initial={{ scale: 0 }}
  animate={{ scale: 1 }}
/>
```

**When to use entrance animations:**
- User-triggered actions (clicking a button opens a modal)
- Progressive disclosure (expanding a section)
- Drawing attention to new content (toast notifications)

**When NOT to use entrance animations:**
- Page load / navigation (indicators, badges, status dots)
- List items that exist in the initial data
- Elements that re-render frequently

### Sliding Tab Indicators

Tabs use `layoutId` for smooth spring-physics transitions:

```tsx
{isActive && (
  <motion.div
    layoutId="activeTab"
    className="absolute inset-0 bg-background shadow-md rounded-lg"
    transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
  />
)}
<span className="relative z-10">{label}</span>
```

See SheetTabBar and Sidebar for implementations.

### Button Press Feedback

All buttons have tactile press feedback built-in:

```tsx
// Already in src/components/ui/button.tsx
active:scale-[0.97]
```

### Shimmer Loading

Skeleton loaders use a diagonal-sweep shimmer wave (`ease-in-out`, `background-position` only). Constants in `@/lib/animations`, components in `@/components/ui/shimmer-grid`:

```tsx
import { ShimmerGrid, ShimmerBar } from '@/components/ui/shimmer-grid'

<ShimmerGrid variant="table" rows={8} columns={5} showRowNumbers />
<ShimmerBar width={120} height={16} />
```

See `src/UX-STANDARDS.md` §2 for full shimmer documentation.

---

## Navigation Caching Pattern

For snappy in-session navigation between pages, use **module-level caching** that survives component unmounts but not page refreshes.

### When to Use

- Pages with expensive API calls that don't change frequently
- Data that should persist when users navigate away and back
- Complex component state that's expensive to restore

### Implementation

```typescript
// src/lib/your-feature/cache.ts
const cache = new Map<string, { data: unknown; timestamp: number }>()
const TTL = 5 * 60 * 1000 // 5 minutes

export function getCached<T>(key: string): T | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.timestamp > TTL) {
    cache.delete(key)
    return null
  }
  return entry.data as T
}

export function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() })
}
```

### Usage Pattern

```typescript
// In your component
useEffect(() => {
  // Check cache first
  const cached = getCached<MyData>('my-key')
  if (cached) {
    setData(cached)
    setIsLoading(false)
    return
  }

  // Cache miss - fetch from API
  fetchData().then(data => {
    setCache('my-key', data)
    setData(data)
    setIsLoading(false)
  })
}, [])
```

### Key Principles

1. **Module-level Map**: Survives unmounts, cleared on page refresh
2. **TTL expiration**: Prevents stale data (5 min default)
3. **Check cache before fetch**: Skip loading state if cached
4. **Update cache on mutations**: Keep cache in sync with local state
5. **Set `isLoading = false` on cache hit**: Skip shimmer/skeleton

### Current Implementations

- `src/lib/data-enrichment/cache.ts` - Data sources, sheet previews, SmartMapper state

---

## Help Documentation System

A self-documenting help system where content is stored in the database and displayed via reusable components. Designed for AI-assisted generation (future phase) while supporting manual content creation.

### Database Tables

**`help_docs`** - Main documentation storage
```sql
doc_id TEXT UNIQUE        -- e.g., "change-approval"
route_pattern TEXT        -- e.g., "/admin/change-approval"
scope TEXT               -- page | section | workflow | field
category TEXT            -- core | admin | workflow | reference
title TEXT               -- Display title
content JSONB            -- Structured content (steps, tips, etc.)
ai_generated BOOLEAN     -- Track if AI-created
ai_confidence REAL       -- 0-1 confidence score
published_at TIMESTAMPTZ -- NULL = draft, set when published
```

**`help_doc_versions`** - Version history for rollback/audit

### Content Structure (JSONB)

```typescript
interface HelpDocContent {
  overview?: string
  steps?: { title: string; description: string }[]
  tips?: string[]
  keyConcepts?: { term: string; definition: string }[]
}
```

### Components

**WorkflowCard** (`src/components/help/WorkflowCard.tsx`)
- Displays numbered workflow steps explaining how a feature works
- Supports database fetch (`docId` prop) OR inline content (`title` + `steps` props)
- Falls back to inline content if database fetch fails
- Collapsible with smooth Framer Motion animations

```tsx
// Fetch from database with inline fallback
<WorkflowCard
  docId="change-approval"
  title="How Change Approval Works"
  steps={[
    { title: "Run a Sync", description: "..." },
    { title: "Review Changes", description: "..." },
    { title: "Approve & Apply", description: "..." },
  ]}
/>

// Inline only
<WorkflowCard
  title="How It Works"
  steps={[...]}
  collapsible
  defaultCollapsed
/>
```

### API Endpoints

- `GET /api/help/[docId]` - Fetch published help document by doc_id

### Future Phases

- **HelpButton + HelpPopover** - Question mark button showing page-level help
- **FieldTooltip** - Enhanced field tooltips pulling from centralized definitions
- **AI Generation SDK** - Claude-powered documentation generation from codebase analysis
- **Feature Toggle** - Admin setting to enable/disable help system globally

---

## Commands

```bash
npm run dev      # Start development server (localhost only)
npm run build    # Production build
npm run lint     # Run ESLint
```

---

## Vercel Deployment

Sophie Hub v2 is deployed to Vercel with automatic deploys on push to main.

### URLs
- **Production**: https://sophie-hub-v2.vercel.app
- **GitHub**: https://github.com/Tophie726/Sophie-Hub2

### Custom Password Gate

Instead of Vercel's paid password protection, we use a custom middleware-based solution:

- **Middleware** (`src/middleware.ts`): Checks for `STAGING_PASSWORD` env var, redirects unauthenticated users to `/password`
- **Password page** (`src/app/(gate)/password/page.tsx`): Simple password form with Sophie Hub branding
- **Verify API** (`src/app/api/gate/verify/route.ts`): Sets httpOnly cookie valid for 30 days

**To change the password**: Update `STAGING_PASSWORD` in Vercel environment variables and redeploy.

**To disable the gate**: Remove `STAGING_PASSWORD` env var entirely — middleware will allow all traffic.

### Environment Variables

All env vars must be set in Vercel dashboard (Settings → Environment Variables):

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `NEXTAUTH_SECRET` | NextAuth.js secret |
| `ADMIN_EMAILS` | Comma-separated admin emails |
| `ENCRYPTION_KEY` | Encryption key for sensitive data |
| `STAGING_PASSWORD` | Password for staging gate |

**Important**: When adding env vars via CLI, use `printf '%s' 'value' | vercel env add NAME production` to avoid newline issues.

### Google OAuth Setup

The Vercel domain must be registered in Google Cloud Console:

- **Authorized JavaScript origins**: `https://sophie-hub-v2.vercel.app`
- **Authorized redirect URIs**: `https://sophie-hub-v2.vercel.app/api/auth/callback/google`

---

## Remote/Mobile Development (Tailscale)

To access the dev server from mobile devices over Tailscale:

### 1. Start Server on All Interfaces

```bash
npx next dev -H 0.0.0.0 -p 3000
```

### 2. NEXTAUTH_URL Auto-Detection

**Do NOT set NEXTAUTH_URL** in `.env.local`. With `trustHost: true` in auth config, NextAuth auto-detects the URL from the request. This allows seamless switching between:
- `localhost:3000` on your laptop
- `your-machine.tailnet.ts.net:3000` on mobile

Both callback URLs must be registered in Google Cloud Console.

### 3. Configure Google OAuth Console

Add these to your Google Cloud Console OAuth credentials:

**Authorized JavaScript origins:**
```
http://your-machine.tailnet-name.ts.net:3000
```

**Authorized redirect URIs:**
```
http://your-machine.tailnet-name.ts.net:3000/api/auth/callback/google
```

### 4. Static Login Page

Next.js React pages may not load properly on mobile Safari over Tailscale (JS hydration issues). A static HTML login page is available at `/login.html` that bypasses React and works reliably on mobile.

The auth config points to this page: `pages: { signIn: '/login.html' }`

### Notes

- Use HTTP (not HTTPS) unless you've set up Tailscale HTTPS certificates
- The `allowedDevOrigins` config in `next.config.mjs` allows cross-origin dev requests
- Google OAuth `prompt: 'select_account'` shows account picker without re-asking permissions every time
- Sign-in preserves original URL - after login, users return to the page they were trying to access
