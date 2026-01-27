# Product / Service Centres

> Sophie Society's service offerings and how they map to the data model.

---

## Overview

Sophie Society manages Amazon brands through a set of **products** (service packages sold to partners). Each product is composed of one or more **service centres** — discrete operational capabilities that staff execute.

```
┌─────────────────────────────────────────────┐
│                  Products                    │
│  (what partners buy)                         │
│                                              │
│  ┌──────────┐  ┌──────┐  ┌──────────────┐  │
│  │ PPC Basic│  │ C&C  │  │ SOFI PPC     │  │
│  └──────────┘  └──────┘  │ Partnership  │  │
│                           └──────────────┘  │
│  ┌──────────────────────────────────────┐   │
│  │ FAM (Full Account Management)       │   │
│  │  = PPC + C&C + Catalogue + Inventory│   │
│  └──────────────────────────────────────┘   │
│  ┌──────────┐                               │
│  │ TikTok   │                               │
│  └──────────┘                               │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│              Service Centres                 │
│  (what staff actually do)                    │
│                                              │
│  PPC Management  ·  Content & Creative       │
│  Catalogue Mgmt  ·  Inventory Management     │
│  TikTok Ads      ·  Account Strategy         │
└─────────────────────────────────────────────┘
```

---

## Products

| Product | Description | Composed Of |
|---------|-------------|-------------|
| **PPC Basic** | Amazon PPC campaign management | PPC Management |
| **C&C** (Content & Creative) | Listing optimization, A+ content, brand stores | Content & Creative |
| **SOFI PPC Partnership** | PPC via SOFI partnership model | PPC Management (SOFI variant) |
| **FAM** (Full Account Management) | End-to-end Amazon management | PPC + C&C + Catalogue + Inventory + Strategy |
| **TikTok** | TikTok advertising management | TikTok Ads |

### Composability

Products are **composable** — FAM is not a separate thing, it's PPC Basic + C&C + Catalogue Management + Inventory Management bundled together. This has key implications:

- A partner on FAM should see metrics from all constituent service centres
- A partner can upgrade from PPC Basic to FAM by adding service centres
- Staff working on FAM partners may only handle one service centre (e.g., a PPC manager handles PPC for both PPC Basic and FAM partners)

---

## Role-Based Dashboards

Different roles see different slices of data based on which service centres they operate in.

| Role | Sees | Key Metrics |
|------|------|-------------|
| **Pod Leader** | All partners in their pod, across all services | Partner health, team capacity, escalations |
| **PPC Manager** | Partners they manage PPC for | ACoS, TACoS, spend, sales, campaign status |
| **Graphic Designer** | Partners with C&C assignments | Content pipeline, revision status, deadlines |
| **Catalogue Manager** | Partners with catalogue assignments | Listing accuracy, ASIN coverage, suppression alerts |
| **Account Strategist** | FAM partners (full view) | Account health, growth trajectory, all service metrics |

### Pod Leader Multi-Service Visibility

Pod leaders oversee multiple staff who may work across different service centres. A pod leader's dashboard aggregates:

- All partners assigned to their pod members
- Weekly statuses across all services (not just one)
- Capacity and workload per staff member per service centre

---

## Data Model Implications

### Partner Services

Partners have a `services` array (or junction table) recording which products/service centres are active:

```
partners
  └── partner_services (junction)
        ├── partner_id
        ├── service_centre    (e.g., 'ppc', 'content_creative')
        ├── product           (e.g., 'fam', 'ppc_basic')
        ├── status            ('active', 'paused', 'offboarding')
        └── started_at
```

This allows a single partner to have multiple active service centres (FAM = 4 services), and supports adding/removing individual services over time.

### Staff Multi-Role

Staff can operate across multiple service centres simultaneously:

```
staff
  └── staff_roles (junction)
        ├── staff_id
        ├── service_centre    (e.g., 'ppc', 'content_creative')
        ├── role_type         (e.g., 'manager', 'designer', 'strategist')
        └── is_primary        (boolean — main service centre)
```

A staff member might be a PPC Manager (primary) who also handles catalogue tasks for some partners.

### Per-Service Weekly Statuses

The `weekly_statuses` table should support per-service tracking:

```
weekly_statuses
  ├── partner_id
  ├── week_start_date
  ├── service_centre        (which service this status covers)
  ├── status                (e.g., 'on_track', 'needs_attention')
  ├── metrics               (JSONB — service-specific KPIs)
  └── reported_by
```

A FAM partner would have up to 4 weekly status rows per week (one per service centre). This allows granular tracking — PPC might be on track while catalogue needs attention.

### Partner Assignments

Assignments become service-scoped:

```
partner_assignments
  ├── partner_id
  ├── staff_id
  ├── service_centre        (which service this assignment covers)
  ├── role                  (e.g., 'lead', 'support')
  └── is_active
```

A FAM partner might have 3 different staff assigned: PPC lead, content lead, and catalogue manager.

---

## Sync & Data Enrichment Impact

### Source Sheets

Many source sheets are **service-specific** (e.g., "PPC Master Dashboard", "Content Pipeline"). The data enrichment system should:

1. Tag each data source with its service centre
2. Route synced data to the correct service-scoped tables
3. Support multiple sheets feeding the same partner with different service data

### Weekly Column Pivot

Weekly status columns in source sheets are already service-scoped by virtue of which sheet they come from. The sync engine's `processWeeklyColumns()` should tag each pivoted row with the source sheet's service centre.

### Field Authority Per Service

Authority rules may differ by service centre. A PPC dashboard is source-of-truth for ACoS but reference-only for partner name. The column mapping system already supports this — the key is ensuring mappings are configured per source sheet rather than globally.

---

## Implementation Phases

### Phase 1 (Current)
- Single-service model (all partners treated uniformly)
- Weekly statuses without service centre distinction
- Staff have one primary role

### Phase 2 (Next)
- Add `partner_services` junction table
- Add `service_centre` column to `weekly_statuses` and `partner_assignments`
- Tag data sources with service centre
- Update sync engine to populate service-scoped data

### Phase 3 (Future)
- Role-based dashboard views
- Per-service metrics aggregation
- Pod leader multi-service overview
- Service centre capacity planning

---

## Open Questions

- **Pricing model**: Do products have fixed service centre bundles, or can partners mix-and-match?
- **Historical migration**: How to backfill existing weekly statuses with service centre tags?
- **SOFI variant**: Is SOFI PPC different enough to warrant its own service centre, or is it PPC Management with a flag?
- **Reporting granularity**: Do partners on FAM see one unified report or per-service breakdowns?
