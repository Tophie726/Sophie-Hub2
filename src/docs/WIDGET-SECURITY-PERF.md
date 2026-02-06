# Widget System -- Security & Performance Audit

## Date: 2026-02-06

## Executive Summary

The widget system is **well-architected** with strong security fundamentals: column whitelisting, Zod input validation, parameterized BigQuery queries, and role-based access control. Two critical issues were found and fixed: (1) the portfolio-query endpoint has no rate limiting, and (2) error messages leak internal BigQuery details to clients. Several important and future recommendations are also documented below.

---

## Critical Issues (Fix Now)

### 1. CRITICAL: Portfolio-Query Has No Rate Limiting

**File:** `src/app/api/bigquery/portfolio-query/route.ts`
**Risk:** Cost abuse -- an admin (or compromised admin session) can spam unlimited BigQuery queries at ~$0.01-0.05 each with no throttle.

The single-partner `/api/bigquery/query` endpoint correctly applies `checkRateLimit()` (line 118), but the portfolio-query endpoint has **zero rate limiting**. Since portfolio queries scan data for ALL brands, they are typically **more expensive** than single-partner queries.

**Status:** FIXED -- Added rate limiting with `RATE_LIMITS.STRICT` (5 requests/minute) since portfolio queries are expensive.

### 2. CRITICAL: Error Messages Leak Internal BigQuery Details

**Files:**
- `src/app/api/bigquery/query/route.ts` (line 345)
- `src/app/api/bigquery/portfolio-query/route.ts` (line 348)

**Risk:** Information disclosure -- the raw `error.message` from BigQuery SDK errors is returned directly to the client. BigQuery errors can include:
- Full SQL query text (reveals table names, dataset structure)
- Service account email addresses
- Project IDs and internal configuration
- Stack traces in some error modes

**Code:**
```typescript
// BEFORE (both files):
return ApiErrors.internal(
  error instanceof Error ? error.message : 'BigQuery query failed'
)
```

**Status:** FIXED -- Replaced with generic messages. Raw errors are now logged server-side only.

---

## Important Issues (Fix Soon)

### 3. IMPORTANT: partner_ids Array Has No Max Length Limit

**File:** `src/app/api/bigquery/portfolio-query/route.ts` (line 65)

The Zod schema validates that each element is a UUID, but there is no `.max()` on the array:
```typescript
partner_ids: z.array(z.string().uuid()).optional(),
```

An attacker could pass thousands of UUIDs, triggering:
1. A massive Supabase `.in()` query (URL length limits may mitigate this)
2. A BigQuery query with thousands of parameterized values in the IN clause

**Recommendation:** Add `.max(100)` to the `partner_ids` array. With 700 partners total, 100 is generous.

### 4. IMPORTANT: Widget Config JSONB Has No Deep Validation

**File:** `src/app/api/modules/dashboards/[dashboardId]/widgets/route.ts` (line 29)

The `config` field uses `z.record(z.string(), z.unknown())` which accepts any JSON object. A malicious admin could store:
- Extremely large config objects (megabytes of JSON)
- Deeply nested structures that cause rendering issues
- XSS payloads that could execute if config values are rendered unsafely

**Recommendation:** Add size limit validation or use typed config schemas per widget type.

### 5. IMPORTANT: In-Memory Cache Does Not Work on Vercel Serverless

**File:** `src/app/api/bigquery/portfolio-query/route.ts` (lines 101-112)

The `portfolioCache` Map is in module scope, which works fine locally but on Vercel:
- Each serverless invocation may get a fresh instance
- There is no shared state between instances
- The cache hit rate will be very low in production

**Recommendation:** For production caching, use:
1. **Vercel KV** (Redis) for shared server-side cache
2. **Client-side caching** with React Query / SWR (already recommended in codebase docs)
3. Accept the current approach as a "best effort" cache that helps during burst requests to the same instance

### 6. IMPORTANT: No Client-Side Data Caching / Deduplication

**Files:** `src/components/reporting/widgets/metric-widget.tsx`, `chart-widget.tsx`, `table-widget.tsx`

Each widget makes its own independent `fetch()` call. If a dashboard has 5 widgets all querying the `sales` view for the same partner and date range, that is 5 separate BigQuery queries. There is no:
- React Query / SWR for request deduplication
- Shared data layer between widgets
- Cache headers on responses

**Recommendation:** Wrap widget data fetching in a shared React Query context. Two widgets querying the same view/partner/dateRange should share one request.

---

## Recommendations (Future)

### 7. Consider Stricter Rate Limiting for BigQuery

**Current:** The single-partner query endpoint uses `RATE_LIMITS.PARTNERS_LIST` (30 req/min). This is reasonable for interactive use but could still cost ~$1.50/minute under sustained use.

**Recommendation:** Create a dedicated `RATE_LIMITS.BIGQUERY` preset:
```typescript
BIGQUERY: {
  maxRequests: 20,
  windowMs: 60 * 1000,
}
```

### 8. Add Request Logging / Audit Trail for Admin Actions

Widget CRUD (create/update/delete) operations should be logged to an audit table. Currently, only BigQuery query usage is logged. An admin could delete all widgets with no record of who did it.

### 9. Recharts Bundle Size

Recharts is imported with named imports (`from 'recharts'`), which should enable tree-shaking in modern bundlers. However, Recharts is a large library (~170KB gzipped). Consider:
- Verifying tree-shaking is effective with `next build --analyze`
- Lazy-loading chart widgets with `React.lazy()` since they are below the fold

### 10. Table Virtualization

**File:** `src/components/reporting/widgets/table-widget.tsx`

The table renders all rows up to the `limit` (max 1000). With 1000 rows and multiple columns, this creates thousands of DOM nodes. For tables with many rows, consider `@tanstack/react-virtual` for virtualized scrolling.

### 11. BigQuery Column Selection Optimization

The API currently selects only the requested columns (good!), but does not use partition filters. If the BigQuery views are partitioned by `date`, adding `_PARTITIONDATE` filters would significantly reduce bytes scanned and cost.

---

## Security Findings

### SQL Injection: PASS

**Column Whitelist:** All column names in `metrics`, `group_by`, and `sort_by` are validated against `ALLOWED_COLUMNS` which is derived from the static `COLUMN_METADATA` registry. Only exact string matches pass.

**sanitizeIdentifier():** Additionally strips all non-alphanumeric/underscore characters. This is defense-in-depth since the whitelist is the primary protection.

**Parameterized Queries:** All user-provided values (`clientId`, date ranges, partner names for IN clauses) use `@param` syntax with BigQuery's parameterized query API. No string interpolation for values.

**View Alias Resolution:** The `resolveViewName()` function only resolves against the static `VIEW_ALIASES` map or checks membership in `Object.values(VIEW_ALIASES)`. A crafted alias cannot produce an arbitrary table name.

**Aggregation Functions:** Validated against a static enum (`sum`, `avg`, `count`, `min`, `max`). Cannot be injected.

**Sort Direction:** Validated against `['asc', 'desc']` enum. The actual SQL uses a ternary, not the raw string.

**Table Name Construction:** Uses template literal with `BIGQUERY.PROJECT_ID` and `BIGQUERY.DATASET` constants, plus the resolved `viewName`. The viewName comes from the static allowlist. No user input reaches the table reference.

**Overall:** The SQL injection surface is well-hardened with multiple layers of defense.

### Authorization: PASS

**Single-Partner Query (`/api/bigquery/query`):**
- `requireAuth()` verifies session
- `canAccessPartner()` checks admin role OR `partner_assignments` table
- Partner A cannot query Partner B's data

**Portfolio Query (`/api/bigquery/portfolio-query`):**
- `requireRole(ROLES.ADMIN)` restricts to admin-only
- Admins can legitimately query all brands (this is the intended use case)
- `partner_ids` filter uses Supabase lookups to resolve to `external_id` values, not raw SQL

**Widget CRUD (`/api/modules/dashboards/[dashboardId]/widgets`):**
- All operations (POST, PATCH, DELETE) require `ROLES.ADMIN`
- Widget operations are scoped to `dashboard_id` via URL param
- Section ownership is verified (section must belong to dashboard)
- Widget update/delete are scoped by both `widget_id` AND `dashboard_id`

**Auth Fallback:** Users not in the `staff` table get `ROLES.STAFF` and a `temp-{email}` ID. The `canAccessPartner()` check queries `partner_assignments` by `staff_id`, so temp users would have no assignments and thus no partner data access. This is safe.

### Input Validation: PASS (with caveats)

**Zod Schemas:** Both query endpoints validate all inputs with comprehensive Zod schemas:
- `partner_id`: UUID format enforced
- `view`: Non-empty string (resolved against allowlist)
- `metrics`: Array of strings, min 1, max 10
- `limit`: Integer, min 1, max 1000
- `date_range`: Preset enum or custom with `YYYY-MM-DD` regex
- `aggregation`: Enum validated
- `sort_direction`: Enum validated

**Caveat 1:** `partner_ids` array has no max length (see Important Issue #3)
**Caveat 2:** Widget `config` JSONB is loosely validated (see Important Issue #4)
**Caveat 3:** `dashboardId` from URL params is not UUID-validated (Supabase would reject invalid UUIDs, but explicit validation is better practice)

### Rate Limiting: EXISTS (with gaps)

**Present:**
- Single-partner query: `RATE_LIMITS.PARTNERS_LIST` (30 req/min) -- adequate
- In-memory sliding window algorithm with cleanup -- well-implemented
- Rate limit headers returned in responses -- good practice

**Gap (FIXED):**
- Portfolio query had no rate limiting -- now uses `RATE_LIMITS.STRICT` (5 req/min)

**Limitation:**
- In-memory rate limiting does not persist across Vercel serverless instances
- A determined attacker could hit different instances to bypass limits
- For production, consider Vercel KV (Redis) or Upstash for distributed rate limiting

### Information Disclosure: FAIL (FIXED)

**Before fix:** Both BigQuery query endpoints returned raw `error.message` from caught exceptions. BigQuery SDK errors can include SQL text, project IDs, and service account details.

**After fix:** Generic error messages returned to client. Detailed errors logged server-side with `console.error()`.

---

## Performance Findings

### Query Efficiency

**Column Selection:** Only requested columns are selected (no `SELECT *`). This is correct and minimizes bytes scanned.

**LIMIT Always Applied:** Both endpoints apply `LIMIT` (max 1000, default 100). Aggregation queries produce 1 row naturally.

**Date Filters:** Date ranges are applied as WHERE conditions, which helps if views are partitioned by date. However, the queries do not use `_PARTITIONDATE` explicitly, so partition pruning depends on BigQuery's query optimizer recognizing the `date` column as the partition key.

**Redundant Queries:** Multiple widgets on the same dashboard each make independent requests. If 3 widgets query `sales` for the same partner/date_range with different metrics, that is 3 BigQuery jobs. These could be batched into one query with all metrics selected, then split client-side.

**Portfolio Cache:** The 10-minute in-memory cache for portfolio queries is a good optimization for repeated identical requests, but has low hit rate on Vercel (see Important Issue #5).

### Client Rendering

**Recharts Imports:** Uses named imports which enables tree-shaking. The three files importing from `recharts` use only the components they need (LineChart, BarChart, AreaChart, etc.).

**No Table Virtualization:** Table widget renders all rows in the DOM (up to 1000). This could cause jank for large datasets. A `max-h-[400px]` with `overflow-y-auto` is applied, which helps visually but still renders all rows.

**Widget Loading:** Each widget independently fetches data in `useEffect`. Widgets load in parallel (browser handles concurrent requests), but there is no request deduplication or shared cache.

**Chart Height Calculation:** `chartHeightFromRowSpan()` correctly computes height from widget config. No wasted re-renders.

### Caching Strategy

**Server-Side:**
- Portfolio query: In-memory Map with 10-min TTL (per-instance only on Vercel)
- Single-partner query: No server-side cache (each request hits BigQuery)
- Rate limiter: In-memory (per-instance only on Vercel)

**Client-Side:**
- No React Query / SWR
- No cache headers on responses
- Each widget re-fetches on mount (navigating away and back triggers new queries)
- No stale-while-revalidate pattern

**Recommendation Priority:**
1. Add React Query for client-side caching (highest impact, lowest effort)
2. Add `Cache-Control` headers for identical repeat requests
3. Consider Vercel KV for shared server-side cache (higher effort)

### Cost Optimization

**Positive:**
- Only needed columns selected (no `SELECT *`)
- LIMIT applied on all queries
- Date filters reduce scan scope
- Rate limiting prevents runaway costs
- Query logging tracks per-request cost

**Improvement Opportunities:**
- Batch widget queries (N widgets -> 1 query per view)
- Client-side caching to avoid re-fetching identical data
- Partition filters if views are date-partitioned
- Consider BigQuery BI Engine cache ($0/first 1GB) for frequently queried views

---

## Files Reviewed

| File | Lines | Purpose |
|------|-------|---------|
| `src/app/api/bigquery/query/route.ts` | 349 | Single-partner query endpoint |
| `src/app/api/bigquery/portfolio-query/route.ts` | 352 | Cross-brand query endpoint |
| `src/app/api/modules/dashboards/[dashboardId]/widgets/route.ts` | 176 | Widget CRUD |
| `src/components/reporting/widgets/metric-widget.tsx` | 149 | Metric widget rendering |
| `src/components/reporting/widgets/chart-widget.tsx` | 304 | Chart widget rendering |
| `src/components/reporting/widgets/table-widget.tsx` | 203 | Table widget rendering |
| `src/lib/bigquery/column-metadata.ts` | 188 | Column whitelist registry |
| `src/lib/auth/api-auth.ts` | 179 | Auth helpers |
| `src/lib/api/response.ts` | 163 | API response helpers |
| `src/lib/rate-limit/index.ts` | 253 | Rate limiting service |
| `src/lib/constants.ts` | 87 | Centralized constants |
| `src/lib/auth/roles.ts` | 86 | RBAC role definitions |
| `src/types/modules.ts` | 286 | Module/widget type definitions |

## Changes Made

1. **`src/app/api/bigquery/portfolio-query/route.ts`** -- Added rate limiting with `RATE_LIMITS.STRICT`, fixed error message leakage
2. **`src/app/api/bigquery/query/route.ts`** -- Fixed error message leakage
