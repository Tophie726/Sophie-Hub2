# Visual Schema Vision

> Conversation notes from Feb 4, 2026 discussing the core philosophy and future direction of the Data Flow Map.

---

## The Core Insight

**"The schema IS the mapping."**

This is not a traditional database project where you design a schema upfront, then write ETL scripts to fill it. Instead:

- The schema **emerges** from the mapping process
- It's a **living schema** that grows as you connect more data sources
- The visual representation IS the schema - not a diagram OF the schema

This flips the mental model:

| Traditional | Sophie Approach |
|-------------|-----------------|
| Design schema → write ETL → import data | Map data visually → schema emerges |
| Schema is static documentation | Schema is living, interactive |
| Technical work hidden | Mapping process is the product |

---

## Architectural Patterns

This approach aligns with established enterprise patterns:

1. **Canonical Data Model** - Stable target entities (Partners, Staff, ASINs) that don't care where data comes from
2. **Adapter Pattern** - Each connector (Google Sheets, Close.io, Typeform) is an adapter that maps to the canonical model
3. **Schema-on-Read** - Structure emerges when you map, not when you design

### The Three-Layer Architecture

```
┌─────────────────────────────────────────────────────────┐
│  LAYER 3: Apps / Dashboards / Reports                   │
│  (Consumes the canonical model)                         │
└─────────────────────────────────────────────────────────┘
                           ▲
                           │ reads from
                           │
┌─────────────────────────────────────────────────────────┐
│  LAYER 2: Canonical Model (Stable)                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │ Partners │  │  Staff   │  │  ASINs   │              │
│  └──────────┘  └──────────┘  └──────────┘              │
│  (Entities don't care WHERE data comes from)            │
└─────────────────────────────────────────────────────────┘
                           ▲
                           │ mappings define flow
                           │
┌─────────────────────────────────────────────────────────┐
│  LAYER 1: Sources (Swappable)                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │ Google Sheet│  │  Typeform   │  │  Close.io   │     │
│  │ (current)   │  │  (future?)  │  │  (future?)  │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
└─────────────────────────────────────────────────────────┘
```

### Swapping Sources (Future Capability)

The mapping layer enables source swapping:

1. Connect new data source (e.g., Close.io)
2. Map its fields → same canonical entity fields
3. Set new source as "Source of Truth"
4. Demote old source to "Reference" or disconnect

The canonical model doesn't change. Apps reading from it don't change. You just rewired the data flow.

---

## Final Implementation: Settings-Style Design

**Location:** `src/components/data-enrichment/lineage/DataFlowMap.tsx`

After evaluating force-directed graphs vs settings-style lists, we chose the **settings-style approach** (similar to Notion/Linear/Airtable). This scales better for 50+ sources and matches Sophie Hub's clean design language.

### Why Settings-Style Won

| Force-Directed Graph | Settings-Style List |
|---------------------|---------------------|
| Visually impressive | Scales to 50+ sources |
| Challenging on mobile | Works on any screen size |
| Hard to find specific source | Search-first discovery |
| Performance concerns at scale | Efficient render (virtualization-ready) |
| Requires physics tuning | Zero config needed |

### What The Implementation Does

1. **Entity Diagram** at top - clickable filters for Partners/Staff/ASINs
2. **Two View Modes:**
   - **By Source** - see which sources feed which entities
   - **By Field** - reverse lookup: which sources feed a specific field
3. **Expandable Cards** - drill into field-level mappings
4. **Authority Indicators** - ⭐ Source of Truth vs 📋 Reference
5. **Search** - filter by source name or field name
6. **Real Data** - fetches from `/api/flow-map` endpoint (no mocks)

### Data Flow

```
/api/flow-map
    ├── Query 1: data_sources (active)
    ├── Query 2: tab_mappings (for those sources)
    ├── Query 3: column_mappings (for those tabs)
    └── Merge with entity field registry (in-memory)
           ↓
DataFlowMap.tsx
    ├── useFlowData() hook fetches API
    ├── transformedSources useMemo (source → entity → fields)
    ├── fieldToSources useMemo (reverse lookup)
    └── Render expandable list with search/filter
```

---

## Key Insight for Dev Team

> **The mapping UI is the product.**

This isn't backend plumbing with a thin admin screen on top. The visual, interactive mapping experience IS what makes Sophie Hub different from writing ETL scripts.

When implementing:
- Prioritize clarity over flash
- Make exploration feel quick and useful
- The interface should answer "where does this data come from?" instantly

---

## Future Enhancements

1. **Actions in expanded view** - Sync Now, Edit Mapping buttons
2. **Visual diff** - show what would change if a new sync runs
3. **Source health indicators** - last sync time, error states
4. **Mobile optimizations** - long-press for actions, card-based layout
5. **Animated data flow** - show data moving during sync

---

*Updated Feb 4, 2026 after implementing the settings-style approach.*
