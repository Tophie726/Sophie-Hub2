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
│   │   │   └── data-enrichment/  # The Data Mapping Wizard
│   │   ├── partners/          # Partner management
│   │   ├── staff/             # Staff management
│   │   └── team/              # Team/squad views
│   └── (auth)/                # Login, etc.
├── components/
│   ├── data-enrichment/       # Wizard, staging, lineage components
│   ├── layout/                # Sidebar, headers, shells
│   └── ui/                    # shadcn/ui base components
├── lib/
│   ├── db/                    # Database schema, queries
│   ├── entity-fields/         # Field registry (single source of truth)
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

**Two-Layer Data System**: Sheets feed database initially, but individual fields can be migrated to "app-native" over time as adoption grows. See `/src/app/(dashboard)/admin/data-enrichment/CLAUDE.md` for full details.

### Partner Management
- View all partners with search/filter
- See assignments, ASINs, weekly status history
- Drill into partner detail with all related data

### Staff Management
- Team directory with roles, squads, capacity
- Training progress tracking
- Assignment history

## Current Phase

**Phase 2: Data Mapping & Flow** (In Progress)
- Phase 1 (Foundation) complete: app shell, auth, database schema, RBAC
- Data Enrichment browser with source/tab navigation
- SmartMapper: classify columns → map fields → save to DB
- Draft persistence (DB + localStorage with timestamp comparison, flush-on-unmount)
- Saved mapping restoration from `column_mappings` table
- Entity-centric Data Flow Map with field-level detail
- Sync preview (dry-run) dialog
- Next: actual data sync execution, computed field runner

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

## Commands

```bash
npm run dev      # Start development server (localhost only)
npm run build    # Production build
npm run lint     # Run ESLint
```

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
