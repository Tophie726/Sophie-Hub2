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

---

## Commands

```bash
npm run dev      # Start development server
npm run build    # Production build
npm run lint     # Run ESLint
```
