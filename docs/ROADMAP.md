# Sophie Hub v2 - Roadmap & Priorities

> This document outlines what we're building, in what order, and why.
> Last updated: 2026-01-27

---

## Vision

Replace fragmented Google Sheets with a **beautiful, unified internal platform** where:
- All partner and staff data lives in one place
- Data flows in through a visual wizard (not manual entry)
- Every piece of information has clear lineage (where did it come from?)
- The experience is delightful, not just functional

---

## Current Phase: Sync Verification & Polish

The data enrichment pipeline and entity pages are functionally complete. Partners and Staff have list pages (search, filter, sort, pagination) and detail pages (grouped fields, assignments, ASINs, weekly statuses). The next focus is **verifying the full pipeline end-to-end with real data** and adding lineage visualization.

---

## Completed Phases

### Phase 1: Foundation (Done)

| Item | Notes |
|------|-------|
| Project structure | Next.js 14, TypeScript, Tailwind, shadcn/ui |
| Database schema | 17+ tables, entity-first design |
| Supabase connection | Connected and migrated |
| App shell | Sidebar, routing, layouts, mobile responsive |
| Dashboard | Welcome flow, stats, quick actions |
| Google OAuth | NextAuth.js, refresh tokens, Tailscale mobile support |
| Role-based access control | Admin/Pod Leader/Staff roles, middleware guards |
| Dark mode | Light/dark/system via next-themes |

### Phase 2: Data Enrichment Pipeline (Done)

| Item | Notes |
|------|-------|
| Google Sheets connector | Search Drive, preview tabs, raw row extraction |
| SmartMapper wizard | 4-phase: Preview → Classify → Map → Summary |
| Column classification | 6 categories: Partner, Staff, ASIN, Weekly, Computed, Skip |
| AI-assisted mapping | Claude API with per-column and bulk suggestion modes |
| Field mapping with authority | Source of truth vs reference, grouped dropdowns from field registry |
| Draft persistence | Auto-save to DB, 3-step restore cascade |
| Column patterns | Regex/keyword patterns for auto-matching weekly columns |
| Sync engine | SyncEngine class, batch inserts, value transforms, field lineage |
| Dry run preview | SyncPreviewDialog: preview creates/updates/skips before committing |
| Visual data flow map | React Flow canvas (desktop) + card layout (mobile) |
| Audit logging | mapping_audit_log table, integrated in sync + save flows |
| Rate limiting | Sliding window for Google API + sync operations |
| Entity field registry | Single source of truth for all field definitions |

### Phase 3: Sync Hardening & UX Polish (Done - 2026-01-27)

| Item | Notes |
|------|-------|
| Entity ID capture after bulk insert | `.insert().select()` maps real IDs back for lineage |
| `last_synced_at` timestamp | Updated on tab_mappings after successful sync |
| Failed batch tracking | Explicit skip + error propagation instead of silent failures |
| Weekly status pivot | `processWeeklyColumns()` with date parsing, upserts to `weekly_statuses` |
| AI suggestion badges | Purple "AI" badge with confidence tooltip |
| Auto-hide empty columns | Detection + collapsible "Empty columns (N)" section |
| Letter keyboard shortcuts | P/S/A/W/C/X mnemonic keys for classification |
| Product Centre | Cards, Rows, and Composition (SVG mind map) views |

### Phase 4: Entity Pages (Done - 2026-01-27)

| Item | Notes |
|------|-------|
| Partner list page | Search, status/tier filter, sort, 50/page pagination, pod leader join |
| Partner detail page | Grouped fields (Core, Contact, Financial, Dates, Metrics), assignments, ASINs, weekly statuses |
| Staff list page | Search, status/role/dept filter, sort, 50/page pagination |
| Staff detail page | Grouped fields (Core, Contact, Status & Role, Metrics, Dates, Links), assigned partners |
| Entity API routes | GET /api/partners, /api/partners/[id], /api/staff, /api/staff/[id] |
| Shared components | StatusBadge, TierBadge, EntityListToolbar, FieldGroupSection, assignment cards |
| Entity types | PartnerListItem, StaffListItem, PartnerDetail, StaffDetail in entities.ts |
| useDebounce hook | 300ms debounce for search input |

---

## Up Next

### P0: Critical Path (Now)

1. **End-to-End Sync Verification**
   - Full pipeline test: map columns → sync → verify entity tables have correct data
   - Validate field_lineage records have real entity IDs
   - Test weekly status pivot with real weekly columns
   - WHY: Everything is built but unverified with real data

### P1: Essential Features (Next)

4. **Lineage Visualization**
   - "Where did this value come from?" on entity detail pages
   - Field-level provenance from field_lineage table
   - WHY: Trust through transparency — admins need to verify data origins

5. **Data Flow Map Interaction (Phase 5.2 remaining)**
   - Level 3: Field detail slide-in panel
   - Pin/lock feature for important fields
   - Filter controls (entity + status)
   - WHY: Power-user features for managing complex mappings

6. **Product Centre Analytics**
   - Partner counts per product (live from DB)
   - Line chart: partner/revenue per product over time
   - Analytics sub-tab under Products
   - WHY: Business visibility into service distribution

### P2: Enhanced Functionality (After)

7. **Scheduled Syncs**
   - Cron-based auto-refresh from Google Sheets
   - Webhook triggers on sheet changes
   - WHY: Remove manual sync step

8. **Nested Sheet Extraction**
   - Brand Information Sheets → ASIN sub-sheets
   - Template-based extraction rules
   - WHY: Complex data structures in real sheets

9. **Playwright E2E Tests**
   - Critical path: tab discovery, mapping persistence, sync flow
   - Regression prevention for browser-level bugs
   - WHY: Integration bugs not catchable by unit tests

10. **Team Structure**
    - Squad management
    - Org chart visualization
    - Leader/captain hierarchy

### P3: Future Features (Later)

11. **Additional Connectors** — Close.io, Zoho, Typeform, ClickUp, Asana
12. **Reporting Dashboard** — Custom widgets, metrics, exports
13. **Education/Training Module** — Training progress per staff
14. **PTO Calendar** — Request/approve workflow with capacity impact
15. **Ticketing System** — Internal task management
16. **Partner Feedback/Escalations** — External communication tracking

---

## Design Checkpoints

Before any feature ships, verify:

1. **Does it feel good?** Test the interactions, the timing, the feedback
2. **Is it obvious?** Can someone use it without instructions?
3. **Is it consistent?** Same patterns as the rest of the app?
4. **Is it delightful?** Any moment of "oh, that's nice"?
5. **Is data safe?** No accidental overwrites, clear confirmations

---

## Success Metrics

### Phase 1-3 Success (Achieved)
- [x] Can connect a Google Sheet
- [x] Can map fields to Partner/Staff/ASIN tables
- [x] Can review and approve staged changes (dry run preview)
- [x] Sync writes to entity tables with lineage
- [x] UI feels polished and professional
- [x] Auth with role-based access
- [x] AI assists with column classification

### Phase 4 Success (Achieved - UI ready, pending real data)
- [x] Partners list page with search, filter, sort
- [x] Staff directory with search, filter, sort
- [x] Partner detail with assignments, ASINs, weekly statuses
- [x] Staff detail with assigned partners
- [ ] Full sync pipeline verified end-to-end
- [ ] Weekly statuses populate from sheet columns
- [ ] Users actively using the tool daily

### Phase 5 Success (Future)
- [ ] Multiple data sources connected (not just Google Sheets)
- [ ] Scheduled syncs running automatically
- [ ] Team structure visualized
- [ ] Education module tracking training

---

## Notes & Decisions

### Why Entity-First?
Previous approach crawled sheets one-by-one, creating tables as needed. Result: 100+ tables, no coherence. New approach: Define Partners and Staff first, then map everything to those.

### Why Staging?
Data accuracy > speed. All changes go through dry run preview before committing. This builds trust and catches errors.

### Why Design-Led?
People need to actually use this tool every day. If it's ugly or confusing, they'll go back to spreadsheets. Delight drives adoption.

### Why Product Centre?
Products (PPC Basic, C&C, FAM, etc.) are composable — FAM includes Sophie PPC Partnership, which includes PPC Basic + C&C. The composition view makes this hierarchy visible. Future: per-product analytics, partner counts, revenue tracking.

---

*See `docs/DATA_ENRICHMENT_PROGRESS.md` for granular task tracking.*
