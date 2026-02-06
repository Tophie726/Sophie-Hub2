# Sophie Hub Widget & Data Guide

Comprehensive reference for building dashboards with the Sophie Hub widget system.
Covers widget types, BigQuery data views, advertising nuances, filtering, and computed metrics.

---

## Table of Contents

1. [Widget Types Overview](#1-widget-types-overview)
2. [Available Data Views](#2-available-data-views)
3. [Advertising Data Nuances](#3-advertising-data-nuances)
4. [Filtering Considerations](#4-filtering-considerations)
5. [Computed Metrics Guide](#5-computed-metrics-guide)
6. [Smart Title Conventions](#6-smart-title-conventions)
7. [Column Metadata System](#7-column-metadata-system)

---

## 1. Widget Types Overview

Every dashboard is composed of widgets arranged in a grid (4 columns wide). Each widget has a type that determines what it displays and how it is configured.

### Metric

**Purpose:** Display a single aggregated number -- ideal for KPIs and headline stats.

| Property | Value |
|----------|-------|
| Default size | 1 col x 1 row |
| Config options | Data View, Metric column, Aggregation (sum/avg/count/min/max), Display format |
| Requires BigQuery | Yes |

**Config shape (`MetricWidgetConfig`):**
```
view        — which BigQuery view to query
metric      — the column to aggregate
aggregation — sum | avg | count | min | max
format      — currency | number | percent | compact
```

**Example use cases:**
- "Total Sales Revenue" (sales view, `ordered_product_sales_amount`, sum, currency)
- "Average Session Count" (sales view, `sessions`, avg, number)
- "Total Ad Spend" (sp view, `ppc_spend`, sum, currency)
- "Max Refund Rate" (refunds view, `refund_rate`, max, percent)

**Example titles:**
- Total Sales Revenue
- Average Ad Spend
- Total Units Ordered
- Maximum Refund Rate

---

### Chart

**Purpose:** Visualize trends and comparisons over time or across dimensions.

| Property | Value |
|----------|-------|
| Default size | 2 cols x 2 rows |
| Chart types | Line, Bar, Area |
| Config options | Data View, Chart type, X-axis (dimension), Y-axis (one or more metrics), Aggregation, Y-axis format |
| Requires BigQuery | Yes |

**Config shape (`ChartWidgetConfig`):**
```
view        — which BigQuery view to query
chart_type  — line | bar | area
x_axis      — a dimension column (usually date)
y_axis      — array of metric columns to plot
aggregation — sum | avg | count | min | max
format      — display format for Y-axis values
```

When the view changes, the X-axis defaults to the first temporal column (usually `date`) and the Y-axis selects the first available metric. Multiple Y-axis metrics can be toggled on/off via a checkbox popover.

**Example use cases:**
- "Sales Over Time" (sales, line, x=date, y=ordered_product_sales_amount)
- "Ad Spend vs Ad Sales" (sp, bar, x=date, y=[ppc_spend, ppc_sales])
- "Impressions by Campaign" (sd, area, x=campaign_name, y=impressions)
- "Clicks Trend" (sb, line, x=date, y=clicks)

**Example titles:**
- Daily Sales Revenue
- Ad Spend vs Sales Over Time
- Impressions by Campaign
- Weekly Click Trend

---

### Table

**Purpose:** Display raw or sorted rows of data in a columnar format.

| Property | Value |
|----------|-------|
| Default size | 4 cols (full width) x 2 rows |
| Config options | Data View, Columns (multi-select), Sort column, Sort direction, Row limit (10/20/50) |
| Requires BigQuery | Yes |

**Config shape (`TableWidgetConfig`):**
```
view           — which BigQuery view to query
columns        — array of column names to display
sort_by        — column to sort on
sort_direction — asc | desc
limit          — 10 | 20 | 50
```

When the view changes, the first 4 table-visible columns are auto-selected and the sort column defaults to the first selected column.

**Example use cases:**
- "Top Products by Revenue" (sales, columns=[asin_child, ordered_product_sales_amount, units_ordered], sort=ordered_product_sales_amount, desc, limit 20)
- "Campaign Performance Table" (sp, columns=[campaign_name, impressions, clicks, ppc_spend, ppc_sales], sort=ppc_spend, desc)
- "Recent Refunds" (refunds, columns=[date, units_refunded, refund_rate], sort=date, desc, limit 10)
- "Search Term Analysis" (match, columns=[campaign_name, match_type, ppc_revenue], sort=ppc_revenue, desc)

**Example titles:**
- Top 20 Products by Revenue
- Campaign Performance Breakdown
- Recent Refund Activity
- Search Term Revenue Report

---

### Text

**Purpose:** Static text blocks for notes, instructions, or section labels.

| Property | Value |
|----------|-------|
| Default size | 2 cols x 1 row |
| Config options | Title, Content (free text), Alignment (left/center/right) |
| Requires BigQuery | No |

**Config shape (`TextWidgetConfig`):**
```
content   — free-form text
alignment — left | center | right
```

**Example use cases:**
- Section divider with a label like "Advertising Performance"
- Notes about how to interpret data
- Disclaimers about data freshness
- Partner-specific instructions

**Example titles:**
- Notes
- Data Disclaimer
- Section: Advertising
- Instructions

---

### Widget Size Options

Widgets can be resized in two ways:

1. **During creation** — Set initial size in the widget config dialog
2. **Drag-to-resize** — In edit mode, grab the bottom-right corner handle and drag to snap to grid

| Dimension | Options |
|-----------|---------|
| Width (col_span) | 1 column, 2 columns, 3 columns, 4 columns (full width) |
| Height (row_span) | 1 row, 2 rows, 3 rows |

The drag-resize handle appears on hover in edit mode as a subtle grip icon. During drag, a pill label shows the target size (e.g., "3x2") and the widget has a blue ring preview. On release, the widget snaps to the nearest grid increment.

### Preset Widgets

The widget config dialog includes a "Start from Preset" section with 18 production-ready widget configurations organized into 3 templates:

**Executive Overview** (6 presets):
Total Sales Revenue, Total Units Ordered, Total Ad Spend, ROAS, Sales Trend, Revenue vs Ad Spend

**PPC Performance** (6 presets):
SP Ad Spend, SP ACOS, SP Impressions, SP Clicks vs Orders, SP Campaign Breakdown, SD Spend vs Sales

**Product Analytics** (6 presets):
Sessions, Refund Rate, Sessions Trend, Refunds Over Time, ASIN Performance, Match Type Revenue

Clicking a preset pre-fills the widget type, title, view, metrics, and all config options. Users can still customize everything after selecting a preset. Presets are defined in `src/lib/bigquery/widget-presets.ts`.

### Multi-View PPC Queries

When creating a PPC widget (SP, SD, or SB view), a **Campaign Types** selector appears with three toggle chips:
- Sponsored Products (SP)
- Sponsored Display (SD)
- Sponsored Brands (SB)

Selecting multiple campaign types causes the widget to query each view in parallel and sum/merge the results client-side. This enables "Total Ad Spend across all campaign types" in a single widget.

The `ppc_views` config field stores the selected views (e.g., `['sp', 'sd']`). When only one view is selected, the widget behaves as before.

---

## 2. Available Data Views

Each widget queries exactly ONE BigQuery view. Views are identified by a short alias that maps to a full BigQuery table name in the `sophie-society-reporting.pbi` dataset.

---

### Sales (`sales`)

**Full table:** `sophie-society-reporting.pbi.pbi_sellingpartner_sales_unified_latest`
**Partner field:** `client_id`
**What it represents:** Amazon Seller Central sales data -- orders, revenue, and session traffic at the ASIN level.

#### Metrics (aggregatable)

| Column | Label | Format | Description |
|--------|-------|--------|-------------|
| `sessions` | Sessions | number | Total page sessions |
| `sessions_b2b` | B2B Sessions | number | Business-to-business sessions |
| `units_ordered` | Units Ordered | number | Total units ordered |
| `units_ordered_b2b` | B2B Units Ordered | number | Business-to-business units ordered |
| `ordered_product_sales_amount` | Sales Revenue | currency | Total ordered product sales ($) |
| `ordered_product_sales_b2b_amount` | B2B Sales Revenue | currency | Business-to-business sales ($) |
| `total_order_items` | Order Items | number | Total order line items |
| `total_order_items_b2b` | B2B Order Items | number | Business-to-business order items |

#### Dimensions (group-by)

| Column | Label | Description |
|--------|-------|-------------|
| `date` | Date | Transaction date |
| `asin_child` | Child ASIN | Child product ASIN |
| `asin_parent` | Parent ASIN | Parent product ASIN |

#### Common widget examples

- **Metric:** "Total Sales Revenue" -- sum of `ordered_product_sales_amount`
- **Chart:** "Daily Sales Trend" -- line chart, x=date, y=ordered_product_sales_amount
- **Table:** "Top ASINs by Revenue" -- columns: asin_child, ordered_product_sales_amount, units_ordered

---

### Refunds (`refunds`)

**Full table:** `sophie-society-reporting.pbi.pbi_sellingpartner_refunds_unified_latest`
**Partner field:** `client_id`
**What it represents:** Refund data from Seller Central -- volume and rate of returns.

#### Metrics

| Column | Label | Format | Description |
|--------|-------|--------|-------------|
| `units_refunded` | Units Refunded | number | Number of units refunded |
| `refund_rate` | Refund Rate | percent | Percentage of units refunded |

#### Dimensions

| Column | Label | Description |
|--------|-------|-------------|
| `date` | Date | Refund date |

#### Common widget examples

- **Metric:** "Total Units Refunded" -- sum of `units_refunded`
- **Chart:** "Refund Rate Over Time" -- line chart, x=date, y=refund_rate, aggregation=avg
- **Table:** "Daily Refund Log" -- columns: date, units_refunded, refund_rate

---

### Sponsored Products (`sp`)

**Full table:** `sophie-society-reporting.pbi.pbi_sp_par_unified_latest`
**Partner field:** `client_name`
**What it represents:** Sponsored Products advertising data -- keyword-targeted product ads that appear in search results and product detail pages. This is typically the highest-volume ad type.

#### Metrics

| Column | Label | Format | Description |
|--------|-------|--------|-------------|
| `impressions` | Impressions | number | Number of ad impressions |
| `clicks` | Clicks | number | Number of ad clicks |
| `ppc_spend` | Ad Spend | currency | Total advertising spend ($) |
| `ppc_sales` | Ad Sales | currency | Sales attributed to ads ($) |
| `ppc_orders` | Ad Orders | number | Orders attributed to ads |
| `ppc_units` | Ad Units | number | Units sold via ads |

#### Dimensions

| Column | Label | Description |
|--------|-------|-------------|
| `date` | Date | Campaign date |
| `campaign_id` | Campaign ID | Campaign identifier |
| `campaign_name` | Campaign Name | Campaign display name |
| `asin` | ASIN | Product ASIN |

#### Common widget examples

- **Metric:** "Total SP Ad Spend" -- sum of `ppc_spend`
- **Chart:** "SP Spend vs Sales Over Time" -- line chart, x=date, y=[ppc_spend, ppc_sales]
- **Table:** "SP Campaign Performance" -- columns: campaign_name, impressions, clicks, ppc_spend, ppc_sales, ppc_orders

---

### Sponsored Display (`sd`)

**Full table:** `sophie-society-reporting.pbi.pbi_sd_par_unified_latest`
**Partner field:** `client_name`
**What it represents:** Sponsored Display advertising data -- audience and product targeting display ads that appear on and off Amazon. Often used for retargeting shoppers who viewed a product but did not purchase.

#### Metrics

| Column | Label | Format | Description |
|--------|-------|--------|-------------|
| `impressions` | Impressions | number | Number of ad impressions |
| `clicks` | Clicks | number | Number of ad clicks |
| `ppc_spend` | Ad Spend | currency | Total advertising spend ($) |
| `ppc_sales` | Ad Sales | currency | Sales attributed to ads ($) |
| `ppc_orders` | Ad Orders | number | Orders attributed to ads |
| `ppc_units` | Ad Units | number | Units sold via ads |

#### Dimensions

| Column | Label | Description |
|--------|-------|-------------|
| `date` | Date | Campaign date |
| `campaign_id` | Campaign ID | Campaign identifier |
| `campaign_name` | Campaign Name | Campaign display name |
| `asin` | ASIN | Product ASIN |

#### Common widget examples

- **Metric:** "Total SD Ad Spend" -- sum of `ppc_spend`
- **Chart:** "SD Impressions Over Time" -- area chart, x=date, y=impressions
- **Table:** "SD Campaign Breakdown" -- columns: campaign_name, impressions, clicks, ppc_spend, ppc_sales

---

### Sponsored Brands (`sb`)

**Full table:** `sophie-society-reporting.pbi.pbi_sb_str_unified_latest`
**Partner field:** `client_id`
**What it represents:** Sponsored Brands advertising data -- brand-level campaigns including headline search ads and video ads that appear at the top of search results. Best for brand awareness and top-of-funnel metrics.

#### Metrics

| Column | Label | Format | Description |
|--------|-------|--------|-------------|
| `impressions` | Impressions | number | Number of ad impressions |
| `clicks` | Clicks | number | Number of ad clicks |
| `ppc_spend` | Ad Spend | currency | Total advertising spend ($) |
| `ppc_sales` | Ad Sales | currency | Sales attributed to ads ($) |
| `ppc_orders` | Ad Orders | number | Orders attributed to ads |

**Important:** Sponsored Brands does NOT have a `ppc_units` column, unlike SP and SD. This is because SB campaigns report at the brand/campaign level rather than per-unit.

#### Dimensions

| Column | Label | Description |
|--------|-------|-------------|
| `date` | Date | Campaign date |
| `campaign_id` | Campaign ID | Campaign identifier |
| `campaign_name` | Campaign Name | Campaign display name |
| `asin` | ASIN | Product ASIN |

#### Common widget examples

- **Metric:** "Total SB Ad Spend" -- sum of `ppc_spend`
- **Chart:** "SB Click-Through Over Time" -- line chart, x=date, y=clicks
- **Table:** "SB Campaign Overview" -- columns: campaign_name, impressions, clicks, ppc_spend, ppc_sales, ppc_orders

---

### Products (`products`)

**Full table:** `sophie-society-reporting.pbi.pbi_dim_products_unified_latest`
**Partner field:** `client_id`
**What it represents:** Product catalog dimension data -- ASIN details and product names. This is reference data, not transactional.

#### Dimensions

| Column | Label | Description |
|--------|-------|-------------|
| `asin` | ASIN | Product ASIN |
| `parent_asin` | Parent ASIN | Parent product ASIN |
| `product_name` | Product Name | Product title |
| `report_start_date` | Report Start | Report period start date |

**Note:** The products view has no metric columns. It is primarily useful for table widgets that display product catalog information.

#### Common widget examples

- **Table:** "Product Catalog" -- columns: asin, parent_asin, product_name

---

### Match Analysis (`match`)

**Full table:** `sophie-society-reporting.pbi.pbi_match_unified_latest`
**Partner field:** `client_name`
**What it represents:** Search term to campaign match data -- maps customer search queries to ad campaigns. Critical for keyword optimization, negative keyword discovery, and understanding search intent.

#### Metrics

| Column | Label | Format | Description |
|--------|-------|--------|-------------|
| `ppc_revenue` | PPC Revenue | currency | Revenue from PPC ($) |

**Note:** The match view only has `ppc_revenue` as a metric. It does not have separate spend/sales/orders columns like the advertising views. Its strength is the dimensional data for search term analysis.

#### Dimensions

| Column | Label | Description |
|--------|-------|-------------|
| `type` | Report Type | Match report type |
| `date` | Date | Report date |
| `campaign_id` | Campaign ID | Campaign identifier |
| `campaign_name` | Campaign Name | Campaign display name |
| `asin` | ASIN | Product ASIN |
| `match_type` | Match Type | Keyword match type (broad, phrase, exact) |

#### Common widget examples

- **Metric:** "Total PPC Revenue" -- sum of `ppc_revenue`
- **Chart:** "PPC Revenue by Match Type" -- bar chart, x=match_type, y=ppc_revenue
- **Table:** "Search Term Analysis" -- columns: campaign_name, match_type, asin, ppc_revenue

---

### Partner Field Summary

This is a critical detail: the field used to identify which partner's data to query varies by view.

| View | Alias | Partner Field |
|------|-------|---------------|
| Sales | `sales` | `client_id` |
| Refunds | `refunds` | `client_id` |
| Sponsored Products | `sp` | `client_name` |
| Sponsored Display | `sd` | `client_name` |
| Sponsored Brands | `sb` | `client_id` |
| Products | `products` | `client_id` |
| Match Analysis | `match` | `client_name` |

The query API resolves this automatically using `entity_external_ids`, which maps a partner UUID to their BigQuery `client_name` or `client_id`. You do not need to handle this manually when creating widgets -- the API handles the translation.

---

## 3. Advertising Data Nuances

Amazon has three distinct advertising programs. Understanding their differences is essential for building meaningful dashboards.

### Sponsored Products (SP)

**Ad type:** Keyword-targeted product ads in search results and product pages.
**Typical use:** Drive direct sales for specific products.
**Volume:** Usually the highest-volume ad type (most spend, most data).

- Has all standard metrics: impressions, clicks, spend, sales, orders, **and units**
- Dimensions include campaign-level AND ad-level (`ad_id`) AND ASIN-level breakdowns
- Best for: keyword performance analysis, product-level ROI, ACOS optimization
- ACOS = `ppc_spend / ppc_sales * 100`

### Sponsored Display (SD)

**Ad type:** Audience and product targeting display ads on and off Amazon.
**Typical use:** Retargeting, audience expansion, competitor conquesting.
**Volume:** Generally lower volume than SP but reaches different audiences.

- Has the same metric columns as SP, **including `ppc_units`**
- Same dimensional structure as SP (campaign, ad, ASIN)
- Best for: retargeting analysis, audience reach, display campaign efficiency
- Often shows different ACOS patterns than SP due to display vs search intent

### Sponsored Brands (SB)

**Ad type:** Brand-level campaigns -- headline search ads, video ads, Store spotlight.
**Typical use:** Brand awareness, top-of-funnel visibility, new product launches.
**Volume:** Typically lowest volume of the three, but highest brand impact.

- **Does NOT have `ppc_units`** -- this is the key difference from SP and SD
- No `ad_id` dimension (campaigns report at brand level, not individual ad level)
- `campaign_name` is the primary grouping dimension
- Best for: brand awareness metrics, top-of-funnel spend analysis

### Why They Are Separate Views

Each ad type has different:
- Targeting mechanisms (keywords vs audiences vs brand terms)
- Reporting granularity (unit-level vs campaign-level)
- Available columns (SB lacks `ppc_units` and `ad_id`)
- Business purpose (direct response vs awareness)

Combining them into a single view would lose this granularity and create misleading aggregations. To see total ad spend across all types, use separate widgets or the portfolio dashboard (see Section 4).

### Match Analysis: The Missing Piece

The match view connects search terms to campaigns, revealing:
- Which search terms trigger which campaigns
- Match type distribution (broad vs phrase vs exact)
- Revenue per search term
- Opportunities for negative keywords (irrelevant terms generating spend)

This data complements the SP view -- SP tells you campaign performance, while match tells you WHY the campaign performed that way.

---

## 4. Filtering Considerations

### One Widget = One View

Each widget queries exactly ONE BigQuery view. There are no cross-view joins at the widget level. This means:

- You cannot show "total ad spend across SP + SD + SB" in a single metric widget
- To compare ad types, create separate widgets side-by-side
- Each widget has independent date range and dimension filtering

### Cross-Brand Queries: Portfolio Dashboard

The portfolio query API (`/api/bigquery/portfolio-query`) enables admin-only cross-brand analysis:

- Queries ALL brands or a filtered subset
- Supports `group_by_brand` to break down metrics per partner
- Admin-only access (requires admin role)
- 10-minute server-side cache to reduce BigQuery costs
- Same view/metric/aggregation options as the per-partner query

### Date Range Filtering

Date ranges apply at the dashboard level and filter all widgets:

| Preset | Range |
|--------|-------|
| `7d` | Last 7 days |
| `30d` | Last 30 days |
| `90d` | Last 90 days |
| `custom` | User-specified start and end dates (YYYY-MM-DD) |

The date filter is applied as `WHERE date >= @startDate AND date <= @endDate` on every query. Views that lack a `date` column (like `products`) are unaffected.

### Partner Filtering

Partner filtering is handled automatically by the query API:

1. The widget provides a `partner_id` (UUID)
2. The API looks up `entity_external_ids` for that partner's BigQuery identifier
3. The query filters by `client_id` or `client_name` depending on the view (see Partner Field Summary above)
4. If the partner has no BigQuery mapping, the API returns `{ mapped: false }` instead of an error

### Computed vs Raw Metrics

**ACOS, ROAS, conversion rate, and CPC are NOT stored in BigQuery.** They are computed client-side from raw metrics. This means:

- You cannot use `aggregation: 'avg'` on ACOS directly -- it does not exist as a column
- The widget rendering layer computes these from raw values after the query returns
- See Section 5 for formulas

### Rate Limiting

BigQuery queries are expensive. The query API enforces rate limits per user to prevent runaway costs. If a dashboard has many widgets, they share the same rate limit pool.

---

## 5. Computed Metrics Guide

These metrics are derived client-side from the raw columns returned by BigQuery. They are not stored as columns in BigQuery and cannot be selected in widget config dropdowns.

### Using Computed Metrics in Widgets

Computed metrics are configured via the `computed` field in `MetricWidgetConfig`:

```typescript
computed: {
  formula: 'acos' | 'roas' | 'tacos' | 'cpc' | 'ctr' | 'cvr'
  numerator: string    // column name (e.g., 'ppc_spend')
  denominator: string  // column name (e.g., 'ppc_sales')
  multiply?: number    // optional multiplier (100 for percentages)
}
```

The widget fetches both the numerator and denominator columns, then computes the ratio client-side. Division by zero displays an em dash ("--") instead of crashing.

Preset widgets for ACOS and ROAS already have the `computed` field pre-configured. Custom computed metrics can be created by setting this field manually in the widget config.

### ACOS (Advertising Cost of Sales)

```
ACOS = (ppc_spend / ppc_sales) * 100
```

- Lower is better
- Expressed as a percentage
- If `ppc_sales` is 0, ACOS is undefined (avoid division by zero)
- Available for: SP, SD, SB
- Typical good range: 15-30% (varies by category)
- Example: $500 spend / $2,000 sales = 25% ACOS

### ROAS (Return on Ad Spend)

```
ROAS = ppc_sales / ppc_spend
```

- Higher is better
- Expressed as a ratio (e.g., 4.0x means $4 return per $1 spent)
- The inverse of ACOS: `ROAS = 100 / ACOS`
- Available for: SP, SD, SB
- Example: $2,000 sales / $500 spend = 4.0x ROAS

### Conversion Rate

```
Conversion Rate = (ppc_orders / clicks) * 100
```

- Expressed as a percentage
- Available for: SP, SD, SB (all have `ppc_orders` and `clicks`)
- Example: 50 orders / 1,000 clicks = 5% conversion rate

### Cost Per Click (CPC)

```
CPC = ppc_spend / clicks
```

- Expressed in currency
- Available for: SP, SD, SB
- Example: $500 spend / 1,000 clicks = $0.50 CPC

### Notes on Aggregation

When computing these metrics over aggregated data, always aggregate the raw values first, then compute the ratio. Never average pre-computed ratios:

```
CORRECT:  ACOS = SUM(ppc_spend) / SUM(ppc_sales) * 100
WRONG:    ACOS = AVG(daily_acos)
```

Averaging ratios produces mathematically incorrect results because days with low volume would be weighted equally with high-volume days.

---

## 6. Smart Title Conventions

The widget config dialog includes a title field that accepts any custom text. However, the system encourages consistent naming patterns.

### Auto-Title Structure

Auto-generated titles follow this pattern:

```
[Aggregation] [Metric Label]
```

**Aggregation prefix mapping:**

| Aggregation | Prefix |
|-------------|--------|
| `sum` | "Total" |
| `avg` | "Average" |
| `count` | "Count of" |
| `min` | "Minimum" |
| `max` | "Maximum" |

**Examples:**
- sum + Sales Revenue = "Total Sales Revenue"
- avg + Ad Spend = "Average Ad Spend"
- max + Refund Rate = "Maximum Refund Rate"
- count + Clicks = "Count of Clicks"

### Per-Widget-Type Patterns

**Metric widgets:** `[Aggregation] [Metric Label]`
- "Total Sales Revenue"
- "Average Ad Spend"

**Chart widgets:** `[Metric Label] Over Time` or `[Metric Label] by [Dimension]`
- "Sales Revenue Over Time"
- "Ad Spend by Campaign"

**Table widgets:** `[Adjective] [Entity] by [Sort Column]`
- "Top Products by Revenue"
- "Campaign Performance Breakdown"

**Text widgets:** Short descriptive label
- "Notes"
- "Section: Advertising"

### When to Use Custom Titles

Use custom titles when:
- The auto-generated title is too generic (e.g., "Total Ad Spend" when you have SP, SD, and SB widgets -- add the ad type)
- The widget serves a specific business purpose (e.g., "Q1 Campaign Budget Tracker")
- The dashboard is partner-facing and needs friendly language

---

## 7. Column Metadata System

The column metadata registry (`src/lib/bigquery/column-metadata.ts`) is the single source of truth for what columns exist in each view and how they should be displayed.

### How It Works

The registry is a `Record<string, ViewMeta>` keyed by view alias (e.g., `sales`, `sp`). Each view has an array of `ColumnMeta` objects describing every column.

### ColumnMeta Interface

```typescript
interface ColumnMeta {
  column: string       // Exact BigQuery column name
  label: string        // Human-friendly label shown in UI
  description: string  // Short description for tooltips
  format: DisplayFormat // Default display format
  category: ColumnCategory // metric | dimension | identifier | temporal
  visibility: {
    metric: boolean    // Can be selected as an aggregatable metric
    dimension: boolean // Can be used for GROUP BY / X-axis
    table: boolean     // Can appear as a table column
  }
}
```

### Column Categories

| Category | Purpose | Example |
|----------|---------|---------|
| `metric` | Numeric values that can be summed, averaged, etc. | `ordered_product_sales_amount`, `ppc_spend` |
| `dimension` | Categorical or textual values for grouping | `campaign_name`, `asin`, `match_type` |
| `identifier` | Partner identification (hidden from UI) | `client_id`, `client_name` |
| `temporal` | Date/time values | `date`, `request_time` |

### Visibility Flags

Visibility controls where a column appears in widget config dropdowns:

| Flag | Controls | Shown in |
|------|----------|----------|
| `metric: true` | Metric widget metric selector, Chart Y-axis | Metric config, Chart Y-axis multi-select |
| `dimension: true` | Chart X-axis selector, Table group-by | Chart X-axis dropdown, Table column picker |
| `table: true` | Table widget column picker | Table column multi-select |

Identifier columns (`client_id`, `client_name`) have all visibility flags set to `false` -- they are used internally for filtering but never exposed in widget config.

Temporal columns like `request_time` are hidden (all false) because they represent API metadata, not business data. The `date` column is visible as a dimension and table column.

### Display Formats

| Format | Rendering | Example |
|--------|-----------|---------|
| `currency` | Dollar sign, 2 decimals | $42,350.00 |
| `number` | Comma-separated integers | 1,234 |
| `percent` | Percentage with % sign | 12.5% |
| `compact` | Abbreviated large numbers | 1.2K, 42.3M |

The format is set per-column in the metadata and used as the default when a column is selected. Users can override the format in the widget config.

### Helper Functions

The metadata module exports these helpers:

| Function | Purpose | Used by |
|----------|---------|---------|
| `getMetricColumns(viewAlias)` | Get columns selectable as metrics | Metric config, Chart Y-axis |
| `getDimensionColumns(viewAlias)` | Get columns selectable as dimensions | Chart X-axis |
| `getTableColumns(viewAlias)` | Get columns selectable for tables | Table column picker |
| `getColumnLabel(viewAlias, column)` | Get the friendly label for a column | All config UIs, table headers |
| `getColumnFormat(viewAlias, column)` | Get the default display format | Auto-set format on column selection |
| `getAllowedColumns(viewAlias)` | Get all column names for API whitelist | Query API security |

### How to Add a New Column

To add a new column to an existing view:

1. Add a `ColumnMeta` entry to the view's `columns` array in `column-metadata.ts`
2. Set the appropriate `category` and `visibility` flags
3. Choose the correct `format` for display

The query API automatically derives its column whitelist from this metadata, so no separate API changes are needed. The new column will immediately appear in the relevant widget config dropdowns.

### How to Add a New View

To add an entirely new BigQuery view:

1. Add the view alias and full table name to `VIEW_ALIASES` in `src/types/modules.ts`
2. Add a human-readable label to `VIEW_LABELS` in the same file
3. Add the full column metadata to `COLUMN_METADATA` in `column-metadata.ts`
4. Add the partner field mapping to `PARTNER_FIELD_PER_VIEW` in both query routes
5. Add the view constant to `BIGQUERY.VIEWS` in `src/lib/constants.ts`

---

## Appendix: Quick Reference Card

### View Alias Cheat Sheet

| Alias | Full Name | Human Label | Partner Field |
|-------|-----------|-------------|---------------|
| `sales` | `pbi_sellingpartner_sales_unified_latest` | Sales | `client_id` |
| `refunds` | `pbi_sellingpartner_refunds_unified_latest` | Refunds | `client_id` |
| `sp` | `pbi_sp_par_unified_latest` | Sponsored Products | `client_name` |
| `sd` | `pbi_sd_par_unified_latest` | Sponsored Display | `client_name` |
| `sb` | `pbi_sb_str_unified_latest` | Sponsored Brands | `client_id` |
| `products` | `pbi_dim_products_unified_latest` | Products | `client_id` |
| `match` | `pbi_match_unified_latest` | Match Analysis | `client_name` |

### Metric Availability Matrix

| Metric | Sales | Refunds | SP | SD | SB | Products | Match |
|--------|:-----:|:-------:|:--:|:--:|:--:|:--------:|:-----:|
| `ordered_product_sales_amount` | x | | | | | | |
| `ordered_product_sales_b2b_amount` | x | | | | | | |
| `units_ordered` | x | | | | | | |
| `units_ordered_b2b` | x | | | | | | |
| `sessions` | x | | | | | | |
| `sessions_b2b` | x | | | | | | |
| `total_order_items` | x | | | | | | |
| `total_order_items_b2b` | x | | | | | | |
| `units_refunded` | | x | | | | | |
| `refund_rate` | | x | | | | | |
| `impressions` | | | x | x | x | | |
| `clicks` | | | x | x | x | | |
| `ppc_spend` | | | x | x | x | | |
| `ppc_sales` | | | x | x | x | | |
| `ppc_orders` | | | x | x | x | | |
| `ppc_units` | | | x | x | | | |
| `ppc_revenue` | | | | | | | x |

### Computed Metrics Formula Card

| Metric | Formula | Unit | Direction |
|--------|---------|------|-----------|
| ACOS | `(spend / sales) * 100` | % | Lower = better |
| ROAS | `sales / spend` | ratio | Higher = better |
| TACoS | `(ad_spend / total_sales) * 100` | % | Lower = better |
| CPC | `spend / clicks` | $ | Lower = better |
| CTR | `(clicks / impressions) * 100` | % | Higher = better |
| CVR | `(orders / clicks) * 100` | % | Higher = better |
