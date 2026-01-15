# Sophie Hub v2 - Project Context

## What This Is

Sophie Hub v2 is the internal operations platform for Sophie Society, an Amazon brand management agency with 120+ staff members managing 700+ partner brands. This is a **fresh rebuild** designed entity-first, replacing a fragmented system of Google Sheets, forms, and a previous attempt (SophieHub v1) that had 100+ database tables due to a source-centric rather than entity-centric approach.

## The Core Philosophy

### Two Master Entities
Everything in this system ultimately relates to one of two core entities:
1. **Partners** - Client brands we manage (the businesses paying us)
2. **Staff** - Team members who do the work

All other data is either:
- A **subtable** of these entities (ASINs belong to Partners, Training belongs to Staff)
- A **relationship** between them (Partner Assignments connect Staff to Partners)
- **Reference data** (settings, templates, external contacts)

### Design-Led Development
This tool must be **beautiful, pleasant, and professional**. Users should feel delighted using it. Key principles:
- **Progressive disclosure**: Simple by default, depth available on demand
- **Instant feedback**: Every action shows immediate visual result
- **Motion with purpose**: Use ease-out for responsiveness, subtle animations for state changes
- **Solid and trustworthy**: Data accuracy is paramount - the UI should feel reliable

### UX Animation Guidelines
Reference: animations.dev "The Easing Blueprint"
- **ease-out**: Primary choice for user-initiated interactions (dropdowns, modals, buttons)
- **ease-in-out**: For elements morphing/moving on screen
- **linear**: Only for constant animations (progress bars, marquees)
- **Avoid ease-in**: Makes UI feel sluggish
- Custom curves for extra polish when needed

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
