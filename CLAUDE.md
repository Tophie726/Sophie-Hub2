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
4. **Borders**: Subtle (border-border/40), not heavy
5. **Shadows**: Sparingly, for elevation (hover states, modals)
6. **Empty States**: Never just "No data"—always guide next action

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
4. Maps fields to target tables
5. Stages changes for review before committing
6. Tracks lineage (where did this value come from?)

### Partner Management
- View all partners with search/filter
- See assignments, ASINs, weekly status history
- Drill into partner detail with all related data

### Staff Management
- Team directory with roles, squads, capacity
- Training progress tracking
- Assignment history

## Current Phase

**Phase 1: Foundation** (In Progress)
- Project structure setup
- Database schema design
- CLAUDE.md documentation
- Basic app shell

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

## Commands

```bash
npm run dev      # Start development server
npm run build    # Production build
npm run lint     # Run ESLint
```
