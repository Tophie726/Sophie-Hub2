# Sophie Hub v2 - Roadmap & Priorities

> This document outlines what we're building, in what order, and why.

---

## Vision

Replace fragmented Google Sheets with a **beautiful, unified internal platform** where:
- All partner and staff data lives in one place
- Data flows in through a visual wizard (not manual entry)
- Every piece of information has clear lineage (where did it come from?)
- The experience is delightful, not just functional

---

## Current Phase: Foundation + Data Enrichment MVP

### Completed ✓

| Item | Status | Notes |
|------|--------|-------|
| Project structure | Done | Next.js 14, TypeScript, Tailwind, shadcn/ui |
| Database schema | Done | 17 tables, entity-first design |
| Supabase connection | Done | Connected and migrated |
| App shell | Done | Sidebar, routing, layouts |
| Dashboard | Done | Welcome flow, stats, quick actions |
| Data Enrichment UI | Done | Overview page with wizard structure |
| Partners page | Done | Empty state, ready for data |
| Staff page | Done | Empty state, ready for data |
| Team page | Done | Placeholder |
| CLAUDE.md | Done | Design principles documented |
| GitHub repo | Done | github.com/Tophie726/Sophie-Hub2 |

### In Progress

| Item | Priority | Description |
|------|----------|-------------|
| Google Sheets connection | HIGH | OAuth + search for sheets in user's Drive |
| Data Enrichment wizard | HIGH | Full flow: Connect → Discover → Map → Review → Commit |

---

## Priority Stack (What We're Building)

### P0: Critical Path (Now)

1. **Google OAuth & Sheets Search**
   - Connect user's Google account
   - Search/browse sheets in their Drive
   - Preview sheet contents before importing
   - WHY: Can't enrich data without connecting to data sources

2. **Field Discovery & Mapping**
   - Auto-detect columns from selected sheet
   - Classify each field (Partner/Staff/ASIN/Skip)
   - Map to target table columns
   - Handle transforms (dates, currencies, etc.)
   - WHY: Core functionality of the data enrichment wizard

3. **Staging & Review**
   - Stage discovered data before committing
   - Diff view (what will be created/updated)
   - Batch approve/reject
   - WHY: Data accuracy is paramount—never auto-commit

4. **Apply Changes**
   - Commit approved changes to master tables
   - Track lineage (which source provided which value)
   - Sync logging
   - WHY: Actually get data into the system

### P1: Essential Features (Next)

5. **Partner Management**
   - List view with search/filter
   - Partner detail page
   - Assignment management
   - ASIN list per partner

6. **Staff Management**
   - Team directory
   - Role and squad assignment
   - Capacity tracking

7. **Auth & Permissions**
   - Google OAuth login
   - Role-based access (Admin vs Pod Leader vs Staff)
   - Row-level security in Supabase

### P2: Enhanced Functionality (After)

8. **Weekly Status Tracking**
   - Time-series partner health
   - Pod leader reporting interface

9. **Team Structure**
   - Squad management
   - Org chart visualization
   - Leader/captain hierarchy

10. **PTO Calendar**
    - Request/approve workflow
    - Calendar visualization
    - Capacity impact

### P3: Future Features (Later)

11. **Form Support** (Google Forms, TypeForm)
12. **API Connectors** (Close IO, Zoho, Amazon)
13. **Reporting Dashboard** (Custom widgets, metrics)
14. **Scheduled Syncs** (Cron-based auto-refresh)
15. **Education/Training Module**
16. **Ticketing System**
17. **Partner Feedback/Escalations**

---

## Feature Deep Dives

### Data Enrichment Wizard (P0)

The heart of the system. A visual, guided experience for bringing data in.

```
┌────────────────────────────────────────────────────────────────┐
│                    DATA ENRICHMENT FLOW                        │
└────────────────────────────────────────────────────────────────┘
                              │
      ┌───────────────────────┼───────────────────────┐
      ▼                       ▼                       ▼
┌───────────┐          ┌───────────┐          ┌───────────┐
│  Connect  │          │  Discover │          │  Classify │
│  Google   │────────▶ │  Sheets   │────────▶ │  Fields   │
│  Account  │          │  & Tabs   │          │           │
└───────────┘          └───────────┘          └───────────┘
                              │                       │
                              ▼                       ▼
                       ┌───────────┐          ┌───────────┐
                       │   Map     │          │  Review   │
                       │  to       │◀──────── │  Staged   │
                       │  Tables   │          │  Changes  │
                       └───────────┘          └───────────┘
                              │                       │
                              ▼                       ▼
                       ┌───────────┐          ┌───────────┐
                       │  Commit   │────────▶ │  Track    │
                       │  Changes  │          │  Lineage  │
                       └───────────┘          └───────────┘
```

**User Experience Goals:**
- Feel like a conversation, not a form
- Show progress and what's coming
- Allow going back without losing work
- Celebrate success at the end

### Google Connection (P0)

**Flow:**
1. User clicks "Connect Google Account"
2. OAuth popup → user grants access
3. App can now access their Google Drive
4. Search bar to find sheets by name
5. Click sheet → see preview (tabs, columns, sample data)
6. Select sheet to begin wizard

**Technical:**
- NextAuth.js with Google provider
- googleapis npm package
- Store refresh token securely
- Request minimal scopes (Drive read-only, Sheets read-only)

---

## Technical Priorities

### Must Have
- [ ] Google OAuth integration
- [ ] Sheets API connection
- [ ] Server-side API routes
- [ ] Proper error handling
- [ ] Loading states everywhere

### Should Have
- [ ] Optimistic UI updates
- [ ] Keyboard navigation
- [ ] Mobile-responsive (at least not broken)

### Nice to Have
- [ ] Undo/redo in wizard
- [ ] Offline indicator
- [ ] Dark mode

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

### Phase 1 Success
- [ ] Can connect a Google Sheet
- [ ] Can map fields to Partner table
- [ ] Can review and approve staged changes
- [ ] Can see data in Partners list
- [ ] UI feels polished and professional

### Phase 2 Success
- [ ] Staff data imported
- [ ] Assignments working
- [ ] Basic CRUD for partners/staff
- [ ] Auth with role-based access

### Phase 3 Success
- [ ] Multiple data sources connected
- [ ] Weekly status tracking
- [ ] Team structure visualized
- [ ] Users actively using the tool

---

## Notes & Decisions

### Why Entity-First?
Previous approach crawled sheets one-by-one, creating tables as needed. Result: 100+ tables, no coherence. New approach: Define Partners and Staff first, then map everything to those.

### Why Staging?
Data accuracy > speed. All changes go through review before committing. This builds trust and catches errors.

### Why Design-Led?
People need to actually use this tool every day. If it's ugly or confusing, they'll go back to spreadsheets. Delight drives adoption.

---

*Last updated: January 2026*
