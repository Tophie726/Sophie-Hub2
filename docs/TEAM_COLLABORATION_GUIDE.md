# Sophie Hub v2 - Team Collaboration Guide

> A comprehensive guide for Leo and team to collaborate effectively with Tomas Norton's team on the data enrichment project.
> Last updated: 2026-01-29

---

## 1. Project Overview

### What We're Building

**Sophie Hub v2** is the internal operations platform for **Sophie Society**, an Amazon brand management agency with 120+ staff members managing 700+ partner brands. This is a complete rebuild designed to replace a fragmented system of Google Sheets, forms, and a previous attempt (SophieHub v1) that had 100+ database tables due to poor architecture.

### The Problem We're Solving

Data is currently scattered across:
- **Master Client Dashboard** (20+ tabs in Google Sheets)
- **Individual Pod Leader Dashboards** (one per team lead)
- **Brand Info sheets** (one per partner)
- **Google Forms** (various intake forms)
- **Close IO** (CRM)
- **Zoho** (invoicing)

This fragmentation means:
- No single source of truth for partner or staff data
- Manual data entry and copy-paste errors
- No audit trail for changes
- Impossible to answer basic questions like "How many active clients does Sarah manage?"

### The Solution

A **unified platform** where:
1. All partner and staff data lives in one PostgreSQL database
2. Data flows in through a **visual mapping wizard** (not manual entry)
3. Every piece of information has clear **lineage** (where did it come from?)
4. The experience is **beautiful and delightful**, not just functional

### Core Philosophy

**Two Master Entities** — Everything relates to:
1. **Partners** — Client brands we manage (the businesses paying us)
2. **Staff** — Team members who do the work

All other data is either:
- A **subtable** (ASINs belong to Partners, Training belongs to Staff)
- A **relationship** (Partner Assignments connect Staff to Partners)
- **Reference data** (settings, templates, external contacts)

### Current State

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 1: Foundation | Complete | App shell, auth, database schema, RBAC |
| Phase 2: Data Pipeline | Complete | SmartMapper wizard, AI mapping, sync engine |
| Phase 3: Hardening | Complete | Entity ID tracking, audit logging, rate limiting |
| Phase 4: Entity Pages | Complete | Partners and Staff list/detail pages |
| **Current: Verification** | In Progress | End-to-end sync testing with real data |

### Desired End State

- **All 700+ partners** imported from Master Client Dashboard
- **All 120+ staff** imported and synced
- **Weekly status updates** flowing automatically from Pod Leader dashboards
- **Full lineage tracking** — click any field to see where it came from
- **Scheduled syncs** refreshing data hourly/daily
- **Additional connectors** for Close IO, Zoho, Typeform, ClickUp

---

## 2. Technical Architecture

### Tech Stack

| Layer | Technology | Notes |
|-------|------------|-------|
| Framework | Next.js 14 (App Router) | React Server Components |
| Language | TypeScript (strict mode) | Full type safety |
| Styling | Tailwind CSS + shadcn/ui | Design system components |
| Animation | Framer Motion | Motion library |
| Database | Supabase (PostgreSQL) | Hosted, real-time capable |
| Auth | NextAuth.js + Google OAuth | Role-based access |
| External APIs | Google Sheets API | Primary data source |
| AI | Claude API (Anthropic) | Mapping suggestions |

### Project Structure

```
sophie-hub-v2/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── (dashboard)/          # Authenticated routes
│   │   │   ├── admin/            # Admin-only pages
│   │   │   │   ├── data-enrichment/  # The Data Mapping Wizard
│   │   │   │   └── products/     # Product Centre
│   │   │   ├── partners/         # Partner list + detail
│   │   │   ├── staff/            # Staff list + detail
│   │   │   └── settings/         # User settings
│   │   ├── (auth)/               # Login pages
│   │   └── api/                  # API routes
│   ├── components/
│   │   ├── data-enrichment/      # Wizard, sync, lineage
│   │   ├── entities/             # Shared entity components
│   │   ├── layout/               # Sidebar, headers
│   │   └── ui/                   # shadcn/ui components
│   ├── lib/
│   │   ├── ai/                   # Claude API integration
│   │   ├── audit/                # Audit logging
│   │   ├── auth/                 # RBAC, permissions
│   │   ├── connectors/           # Data source connectors
│   │   ├── entity-fields/        # Field registry
│   │   ├── google/               # Google Sheets API
│   │   ├── rate-limit/           # API rate limiting
│   │   ├── supabase/             # Database client
│   │   ├── sync/                 # Sync engine
│   │   └── validations/          # Zod schemas
│   └── types/                    # TypeScript types
├── supabase/
│   └── migrations/               # Database migrations
├── docs/                         # Documentation
└── public/                       # Static assets
```

### Database Schema (Key Tables)

**Tier 1: Core Entities**
- `partners` — 700+ client brands (brand_name, status, tier, fees, dates)
- `staff` — 120+ team members (name, email, role, department, capacity)

**Tier 2: Relationships**
- `partner_assignments` — Who manages which partner
- `squads` — Team groupings
- `staff_squads` — Staff membership in squads

**Tier 3: Domain Entities**
- `asins` — Amazon products per partner
- `weekly_statuses` — Time-series partner health data
- `partner_sheets` — Linked Google Sheets per partner

**Tier 4: Data Pipeline**
- `data_sources` — Configured external sources
- `tab_mappings` — Sheet tabs and their mapping status
- `column_mappings` — How columns map to entity fields
- `sync_runs` — Audit log of sync operations
- `field_lineage` — Where each field value originated
- `entity_versions` — Full row snapshots on every change (time machine)

### Data Flow Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Data Sources   │     │  SmartMapper    │     │  Entity Tables  │
│  (Google Sheets)│────▶│  (Classify/Map) │────▶│  (partners,     │
│                 │     │                 │     │   staff, asins) │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │                        │
                               ▼                        ▼
                        ┌─────────────┐         ┌─────────────┐
                        │ Sync Engine │         │ field_lineage│
                        │ (Transform) │         │ (Audit Trail)│
                        └─────────────┘         └─────────────┘
```

### Key Integrations

| Integration | Status | Purpose |
|-------------|--------|---------|
| Google Sheets API | Active | Primary data source |
| Google OAuth | Active | Staff authentication |
| Claude API | Active | AI-assisted mapping |
| Close IO | Planned | CRM data import |
| Zoho | Planned | Invoice data import |
| Typeform | Planned | Form response import |
| ClickUp/Asana | Planned | Task management sync |

### Connector Architecture

The system uses a **pluggable connector pattern** that allows new data sources to be added without modifying core logic:

```typescript
// Each connector implements:
interface IConnector<TConfig> {
  metadata: ConnectorMetadata
  validateConfig(config: TConfig): true | string
  search?(token: string, query?: string): Promise<SourceSearchResult[]>
  getPreview(token: string, config: TConfig): Promise<SourcePreview>
  getTabs(token: string, config: TConfig): Promise<SourceTab[]>
  getRawRows(token: string, config: TConfig, tab: string): Promise<SourceRawRows>
  getData(token: string, config: TConfig, tab: string): Promise<SourceData>
  testConnection(token: string, config: TConfig): Promise<ConnectionTestResult>
}
```

Adding a new connector (e.g., Close IO):
1. Create `src/lib/connectors/close-io.ts`
2. Implement `IConnector<CloseIOConnectorConfig>`
3. Register in `src/lib/connectors/registry.ts`
4. Add UI components for connection flow

---

## 3. Development Process

### Git Workflow

**Branches**
- `main` — Production-ready code, deployed
- `dev/feature-name` — Feature development branches

**Branch Naming Convention**
```
dev/feature-name        # New features
fix/bug-description     # Bug fixes
refactor/what-changed   # Refactoring
docs/what-updated       # Documentation
```

**Commit Messages**

Follow conventional commits:
```
feat: add AI-assisted column mapping
fix: prevent duplicate toast notifications
refactor: extract entity field registry
docs: update collaboration guide
chore: update dependencies
```

Always include co-author for AI-assisted commits:
```
Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

### Code Review Process

1. **Create feature branch** from `main`
2. **Make changes** with clear, focused commits
3. **Push to origin** and create PR
4. **PR Description** should include:
   - Summary of changes (bullet points)
   - Test plan (how to verify)
   - Screenshots if UI changes
5. **Review** — At least one approval required
6. **Merge** — Squash and merge preferred

### Local Development Setup

**Prerequisites**
- Node.js 18+
- npm or pnpm
- Git
- Supabase account (for database)
- Google Cloud Console project (for OAuth + Sheets API)

**Setup Steps**

```bash
# 1. Clone the repository
git clone https://github.com/Tophie726/Sophie-Hub2.git
cd sophie-hub-v2

# 2. Install dependencies
npm install

# 3. Create environment file
cp .env.example .env.local
# Edit .env.local with your credentials (see below)

# 4. Start development server
npm run dev
# Or with network access (for mobile testing):
npm run dev -- -H 0.0.0.0
```

**Required Environment Variables** (`.env.local`)

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Google OAuth
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret

# NextAuth
NEXTAUTH_SECRET=your-random-secret-key
# Do NOT set NEXTAUTH_URL - auto-detected for Tailscale compatibility

# Admin Access
ADMIN_EMAILS=admin@sophiesociety.com,tomas@sophiesociety.com

# Optional: Restrict to company domain
ALLOWED_EMAIL_DOMAINS=sophiesociety.com

# Claude API (stored in DB, but can override here)
ANTHROPIC_API_KEY=sk-ant-...
```

**Available Scripts**

```bash
npm run dev      # Start development server
npm run build    # Production build
npm run lint     # Run ESLint
npm run start    # Start production server
```

### Deployment

Currently deployed via Vercel (or your hosting provider). The deployment process:

1. Push to `main` branch
2. CI/CD automatically builds and deploys
3. Environment variables configured in hosting dashboard
4. Database migrations applied via Supabase dashboard

### Database Migrations

Migrations live in `supabase/migrations/`. To apply:

1. **Via Supabase Dashboard:**
   - Go to SQL Editor
   - Paste migration SQL
   - Execute

2. **Via Supabase CLI:**
   ```bash
   supabase db push
   ```

**Migration Naming Convention:**
```
20260129_feature_name.sql
```

---

## 4. Project Management

### Recommended Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| **GitHub Issues** | Bug tracking, feature requests | Integrated with repo |
| **GitHub Projects** | Kanban boards, sprint planning | Free, integrated |
| **ClickUp/Asana** | Optional advanced PM | If team prefers |
| **Slack** | Team communication | Real-time chat |
| **Loom** | Async video updates | Screen recordings |
| **Notion** | Documentation wiki | If team uses it |

### Kanban Board Structure

**Columns:**
1. **Backlog** — Unscheduled work, ideas, future features
2. **To Do** — Prioritized for current sprint
3. **In Progress** — Actively being worked on (limit: 2-3 per person)
4. **Review** — In code review or testing
5. **Done** — Completed and merged

**Labels:**
- `priority: critical` — Blocking issues
- `priority: high` — This sprint
- `priority: medium` — Next sprint
- `priority: low` — Backlog
- `type: bug` — Something broken
- `type: feature` — New functionality
- `type: enhancement` — Improvement to existing
- `type: docs` — Documentation
- `area: data-enrichment` — Mapping wizard
- `area: entity-pages` — Partners/Staff UI
- `area: sync-engine` — Data synchronization
- `area: api` — Backend routes

### Task Assignment

**Task Format:**
```markdown
## Title
Brief description of what needs to be done.

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Technical Notes
Any relevant context, file locations, or implementation hints.

## Related
- #123 (related issue)
- Figma link (if design)
```

### Sprint Cadence

Recommended 2-week sprints:
- **Day 1:** Sprint planning, task breakdown
- **Days 2-10:** Development work
- **Day 11:** Code freeze, testing
- **Day 12:** Sprint review, demo
- **Day 13-14:** Sprint retrospective, planning next

---

## 5. Communication & Collaboration

### Regular Check-ins

| Meeting | Frequency | Duration | Purpose |
|---------|-----------|----------|---------|
| Daily Standup | Daily | 15 min | Async or sync, blockers |
| Sprint Planning | Bi-weekly | 1 hour | Plan next 2 weeks |
| Sprint Review | Bi-weekly | 30 min | Demo completed work |
| Technical Sync | Weekly | 30 min | Architecture decisions |

**Async Updates (Recommended)**

For distributed teams, use async standups:
```markdown
**Yesterday:** What I completed
**Today:** What I'm working on
**Blockers:** Any issues needing help
```

Post in Slack channel or GitHub Discussions.

### Documentation Sharing

| Document | Location | Purpose |
|----------|----------|---------|
| CLAUDE.md | Root of repo | Project context for AI assistants |
| ARCHITECTURE.md | Root | Technical decisions log |
| ROADMAP.md | /docs | Feature roadmap, priorities |
| DATA_ENRICHMENT_PROGRESS.md | /docs | Detailed progress tracker |
| Feature docs | /docs/features | Individual feature designs |

### AI Tools for Meetings

**Transcription & Summaries:**
- **Otter.ai** — Live transcription
- **Fireflies.ai** — Meeting recording + notes
- **tl;dv** — Video meeting summaries

**Format for Sharing Meeting Notes:**
```markdown
# Meeting: [Topic] - [Date]

## Attendees
- Name 1, Name 2, Name 3

## Key Decisions
1. Decision 1
2. Decision 2

## Action Items
- [ ] @name - Task 1 (due: date)
- [ ] @name - Task 2 (due: date)

## Notes
Detailed discussion points...
```

### Communication Channels

| Channel | Use For |
|---------|---------|
| `#sophie-hub-dev` | Development discussions |
| `#sophie-hub-urgent` | Blocking issues, outages |
| `#sophie-hub-general` | General updates, announcements |
| GitHub PR comments | Code-specific feedback |
| GitHub Issues | Bug reports, feature requests |

---

## 6. Next Steps for Leo's Team

### Immediate Actions (Week 1)

| # | Task | Owner | Priority |
|---|------|-------|----------|
| 1 | **Clone repo and run locally** | Each developer | Critical |
| 2 | **Get Supabase access** | Request from Tomas | Critical |
| 3 | **Get Google Cloud credentials** | Request from Tomas | Critical |
| 4 | **Read CLAUDE.md** | Each developer | High |
| 5 | **Review ARCHITECTURE.md** | Each developer | High |
| 6 | **Set up local environment** | Each developer | High |
| 7 | **Join Slack channels** | Each developer | High |

### Onboarding Checklist

- [ ] Repository access granted
- [ ] Supabase project access (viewer or editor)
- [ ] Google Cloud project access
- [ ] `.env.local` configured and server running
- [ ] Signed into app with Google OAuth
- [ ] Successfully viewed Partners list page
- [ ] Successfully viewed Data Enrichment wizard
- [ ] Joined team communication channels

### First Sprint Tasks (Suggested)

1. **End-to-End Sync Verification** (HIGH)
   - Connect real Master Client Dashboard
   - Map columns to Partner entity
   - Run sync, verify data in `partners` table
   - Verify `field_lineage` records

2. **Lineage Visualization** (MEDIUM)
   - Add "Source" indicator on entity detail pages
   - Show which sheet/tab/column each field came from
   - Use `field_lineage` table data

3. **Bug Fixes & Polish** (MEDIUM)
   - Address any issues found during testing
   - Improve error messages
   - Performance optimizations

### Timeline & Milestones

| Milestone | Target Date | Deliverables |
|-----------|-------------|--------------|
| **M1: Onboarding Complete** | Week 1 | All devs have local env running |
| **M2: First Sync Test** | Week 2 | Partners synced from real sheet |
| **M3: Staff Entity** | Week 3 | Staff synced, basic validation |
| **M4: Weekly Statuses** | Week 4 | Time-series data flowing |
| **M5: Production Ready** | Week 6 | Full pipeline verified, ready for users |

---

## 7. Key Contacts

| Name | Role | Contact | Responsibilities |
|------|------|---------|------------------|
| Tomas Norton | Project Lead | @tomas | Architecture, decisions, priorities |
| Leo | Dev Team Lead | @leo | Implementation, code review |
| [Dev 1] | Developer | @dev1 | Frontend, UI components |
| [Dev 2] | Developer | @dev2 | Backend, API routes |
| [Dev 3] | Developer | @dev3 | Database, sync engine |

---

## 8. Additional Resources

### Documentation
- [CLAUDE.md](/CLAUDE.md) — Complete project context
- [ARCHITECTURE.md](/ARCHITECTURE.md) — Technical decisions
- [ROADMAP.md](/docs/ROADMAP.md) — Feature roadmap
- [DATABASE_SCHEMA.md](/docs/DATABASE_SCHEMA.md) — Full schema
- [SYNC_ENGINE.md](/docs/features/SYNC_ENGINE.md) — Sync design
- [AI_MAPPING_ASSISTANT.md](/docs/features/AI_MAPPING_ASSISTANT.md) — AI integration
- [UX-STANDARDS.md](/src/UX-STANDARDS.md) — Design guidelines

### External Links
- [GitHub Repository](https://github.com/Tophie726/Sophie-Hub2)
- [Supabase Dashboard](https://app.supabase.com) — Database management
- [Google Cloud Console](https://console.cloud.google.com) — API credentials
- [Vercel Dashboard](https://vercel.com) — Deployment (if used)
- [shadcn/ui](https://ui.shadcn.com) — Component library
- [Next.js Docs](https://nextjs.org/docs) — Framework docs
- [Anthropic API](https://docs.anthropic.com) — Claude API docs

### Design References
- [animations.dev](https://animations.dev) — Animation principles (by Emil Kowalski)
- [interfacecraft.dev](https://interfacecraft.dev) — Design philosophy

---

## 9. FAQ

**Q: How do I get database access?**
A: Request from Tomas. You'll get a Supabase project invite with appropriate role.

**Q: Where do I find the Google Sheets credentials?**
A: The OAuth client ID/secret are in Google Cloud Console. Ask Tomas for access to the project.

**Q: Can I push directly to main?**
A: No. All changes go through feature branches and pull requests.

**Q: How do I run the app on my phone?**
A: Start with `npm run dev -- -H 0.0.0.0`, then access via your machine's local IP or Tailscale hostname.

**Q: What if I break something?**
A: We have entity versioning (time machine) that captures every change. Data can be recovered. Always test in development first.

**Q: Who reviews PRs?**
A: Tomas or designated reviewer. Tag in the PR.

**Q: Where do I ask questions?**
A: Slack `#sophie-hub-dev` for quick questions, GitHub Issues for tracked discussions.

---

*Welcome to the team! Let's build something beautiful.*
