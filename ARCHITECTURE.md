# Architecture & Engineering Decisions

This document tracks technical decisions, performance optimizations, and engineering improvements made to Sophie Hub.

---

## Performance Optimizations

### Database Query Optimization

#### N+1 Query Fix in Data Sources API (2025-01-24)

**Location:** `src/app/api/data-sources/route.ts`

**Problem:** The GET endpoint was making 1 + N + N*M queries where:
- 1 query for all data sources
- N queries for tab mappings (one per source)
- N*M queries for column mappings (one per tab)

With 10 sources averaging 5 tabs each, this was 61 queries per request.

**Solution:** Batch all queries upfront, join in memory:
```typescript
// Query 1: All data sources
const { data: sources } = await supabase.from('data_sources').select('*')

// Query 2: ALL tab mappings for all sources
const { data: allTabs } = await supabase
  .from('tab_mappings')
  .select('*')
  .in('data_source_id', sourceIds)

// Query 3: ALL column mappings for all tabs
const { data: allColumns } = await supabase
  .from('column_mappings')
  .select('tab_mapping_id, category')
  .in('tab_mapping_id', tabIds)

// Build lookup maps for O(1) access
const tabsBySource = new Map<string, Tab[]>()
const columnsByTab = new Map<string, Column[]>()
```

**Result:** Reduced from 500+ queries to 3 queries regardless of data size.

---

### Connection Pool Management

#### Supabase Client Singleton (2025-01-24)

**Location:** `src/lib/supabase/admin.ts`

**Problem:** Each API route was creating a new Supabase client, potentially exhausting connection pools under load.

**Solution:** Singleton pattern for server-side admin client:
```typescript
let adminClient: SupabaseClient | null = null

export function getAdminClient(): SupabaseClient {
  if (!adminClient) {
    adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
  }
  return adminClient
}
```

**Files Updated:**
- All API routes now import `getAdminClient` instead of creating clients inline
- `createAdminClient()` deprecated but kept for backwards compatibility

---

### React Component Optimization

#### React.memo on List Components (2025-01-24)

**Location:**
- `src/components/data-enrichment/browser/tab-card.tsx`
- `src/components/data-enrichment/browser/tab-list-row.tsx`

**Problem:** List items were re-rendering on every parent state change.

**Solution:** Wrapped components with `React.memo`:
```typescript
export const TabCard = memo(function TabCard({ ... }: TabCardProps) {
  // component logic
})
```

**When to use React.memo:**
- Components rendered in lists
- Components with expensive render logic
- Components that receive the same props frequently

**When NOT to use:**
- Components that always receive different props
- Simple components where memo overhead exceeds benefit

---

## Stability & Error Handling

### Error Boundary (2025-01-24)

**Location:** `src/components/error-boundary.tsx`

**Purpose:** Catch runtime errors and prevent full app crashes.

**Integration:** Wraps main content in `src/components/layout/main-layout.tsx`

**Features:**
- User-friendly error UI with "Try Again" and "Refresh" options
- Development mode shows error details
- Optional `onError` callback for external logging (Sentry, etc.)

**Usage:**
```tsx
// Basic
<ErrorBoundary>
  <YourComponent />
</ErrorBoundary>

// With error logging
<ErrorBoundary onError={(error, info) => logToSentry(error, info)}>
  <YourComponent />
</ErrorBoundary>
```

---

### Health Check Endpoint (2025-01-24)

**Location:** `src/app/api/health/route.ts`

**Purpose:** Monitoring and load balancer health checks.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-24T12:00:00.000Z",
  "version": "0.0.0",
  "checks": {
    "database": {
      "status": "up",
      "latencyMs": 45
    }
  }
}
```

**HTTP Status:**
- 200: All checks pass
- 503: One or more checks fail

**No auth required** - needed for external health checks.

---

## Code Quality

### TypeScript Strict Mode

**Config:** `tsconfig.json` has `strict: true`

**Common Fixes Applied (2025-01-24):**

| Issue | Fix |
|-------|-----|
| Implicit `any` parameter | Add explicit type annotation |
| Empty interface | Use type alias instead |
| Unused variables | Remove or prefix with `_` |
| Possibly undefined | Add null checks or optional chaining |

**Example Fixes:**
```typescript
// Before: implicit any
const adminEmails = []

// After: explicit type
const adminEmails: string[] = []
```

```typescript
// Before: empty interface
export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

// After: type alias
export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>
```

---

### Console.log Cleanup

**Removed all debug `console.log` statements from production code.**

**Acceptable console usage:**
- `console.error` for actual errors (caught exceptions)
- Never `console.log` for debugging

**Files cleaned (2025-01-24):**
- `src/components/data-enrichment/browser/source-browser.tsx` (8 statements removed)

---

## Infrastructure Patterns

### API Route Structure

All API routes follow this pattern:

```typescript
import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { requirePermission } from '@/lib/auth/api-auth'

const supabase = getAdminClient()

export async function GET() {
  const auth = await requirePermission('resource:read')
  if (!auth.authenticated) return auth.response

  try {
    // ... business logic
    return NextResponse.json({ data })
  } catch (error) {
    console.error('Error in GET /api/route:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

---

### Navigation Type Safety

**Location:** `src/components/layout/sidebar.tsx`

Navigation items now have proper TypeScript interfaces:

```typescript
interface NavItem {
  name: string
  href: string
  icon: typeof LayoutDashboard
  highlight?: boolean  // Optional highlight indicator
}

interface NavSection {
  title: string
  items: NavItem[]
}

const navigation: NavSection[] = [...]
```

---

## Enterprise Sweep Summary (2025-01-24)

### Completed

| Area | Improvement | Impact |
|------|-------------|--------|
| **Performance** | N+1 query fix in data-sources API | 500+ queries → 3 queries |
| **Performance** | Supabase client singleton pattern | Prevents connection exhaustion |
| **Performance** | React.memo on TabCard, TabListRow | Reduces unnecessary re-renders |
| **Stability** | ErrorBoundary component | Prevents full app crashes |
| **Observability** | Health check endpoint `/api/health` | Ready for monitoring/load balancers |
| **Code Quality** | Removed 8 debug console.log statements | Production-ready logging |
| **Code Quality** | Fixed 12+ TypeScript errors | Type-safe codebase |
| **Code Quality** | Added proper types to navigation | Sidebar type safety |

### Remaining from Task List

| Task | Priority | Effort | Notes |
|------|----------|--------|-------|
| Enterprise ESLint rules | Medium | 1-2 hrs | Stricter linting for consistency |

---

## Recently Implemented (January 2026)

### High Priority Items Completed

#### 1. Input Validation with Zod ✅

**Location:** `src/lib/validations/schemas.ts`

Runtime validation now prevents malformed data from reaching the database.

**Schemas implemented:**
- `DataSourceSchema.create` - For creating data sources
- `DataSourceSchema.reorder` - For reordering data sources
- `TabMappingSchema.create` - For creating tab mappings
- `TabMappingSchema.updateStatus` - For updating tab status
- `TabMappingSchema.confirmHeader` - For confirming headers
- `TabMappingSchema.draft` - For saving draft state
- `SaveMappingSchema` - For saving column mappings
- `SheetsSchema` - For sheets API operations

**Usage pattern:**
```typescript
import { DataSourceSchema } from '@/lib/validations/schemas'
import { apiValidationError } from '@/lib/api/response'

const validation = DataSourceSchema.create.safeParse(body)
if (!validation.success) {
  return apiValidationError(validation.error)
}
```

#### 2. API Response Standardization ✅

**Location:** `src/lib/api/response.ts`

Consistent response format across all API routes:

```typescript
// Success: { success: true, data: T, meta: { timestamp } }
return apiSuccess({ sources: data })

// Error: { success: false, error: { code, message, details? }, meta: { timestamp } }
return apiError('NOT_FOUND', 'Resource not found', 404)

// Validation error (from Zod)
return apiValidationError(result.error)

// Convenience methods
return ApiErrors.notFound('Partner')
return ApiErrors.database(error.message)
return ApiErrors.internal()
```

#### 3. Centralized TypeScript Interfaces ✅

**Location:** `src/types/entities.ts`

Single source of truth for shared types:

```typescript
import {
  EntityType,
  TabStatus,
  ColumnCategory,
  CategoryStats,
  DataSourceWithStats,
  TabWithStats,
  emptyCategoryStats,
  calculateProgress,
} from '@/types/entities'
```

**Files updated to use centralized types:**
- `src/app/api/data-sources/route.ts`
- All tab-mapping related routes

---

## Future Improvements

### Medium Priority (Post-Launch)

#### 4. Code Splitting / Lazy Loading
**Why:** smart-mapper.tsx is 2,700+ lines. Splitting reduces initial bundle size.

```typescript
// Lazy load heavy components
const SmartMapper = dynamic(
  () => import('@/components/data-enrichment/smart-mapper'),
  { loading: () => <MapperSkeleton /> }
)
```

**Candidates for splitting:**
- SmartMapper (2,700 lines)
- SourceBrowser (800+ lines)
- Heavy modal components

---

#### 5. Request/Response Caching
**Why:** Reduce database load for frequently accessed, rarely changed data.

```typescript
// Using Next.js fetch caching
const data = await fetch('/api/field-tags', {
  next: { revalidate: 300 } // Cache for 5 minutes
})

// Or SWR for client-side
const { data } = useSWR('/api/field-tags', fetcher, {
  revalidateOnFocus: false,
  dedupingInterval: 60000,
})
```

**Good candidates for caching:**
- Field tags (rarely change)
- Table stats (revalidate on mutation)
- Data source list (short TTL)

---

#### 6. Database Indexing Review
**Why:** As data grows, queries slow down without proper indexes.

**Recommended indexes:**
```sql
-- For N+1 fix queries
CREATE INDEX idx_tab_mappings_data_source_id ON tab_mappings(data_source_id);
CREATE INDEX idx_column_mappings_tab_mapping_id ON column_mappings(tab_mapping_id);

-- For common lookups
CREATE INDEX idx_staff_email ON staff(email);
CREATE INDEX idx_partners_status ON partners(status);
```

---

#### 7. Retry Logic for External APIs
**Why:** Google Sheets API can have transient failures.

```typescript
// src/lib/utils/retry.ts
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { retries?: number; delay?: number } = {}
): Promise<T> {
  const { retries = 3, delay = 1000 } = options

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      if (attempt === retries) throw error
      await new Promise(r => setTimeout(r, delay * attempt))
    }
  }
  throw new Error('Unreachable')
}

// Usage
const data = await withRetry(() => sheets.spreadsheets.get({ spreadsheetId }))
```

---

### Low Priority (Nice to Have)

#### 8. Smart-Mapper Refactor
**Why:** 2,700-line file is hard to maintain and test.

**Proposed structure:**
```
src/components/data-enrichment/smart-mapper/
├── index.tsx              # Main orchestrator
├── phases/
│   ├── preview-phase.tsx  # Phase 1: Preview
│   ├── classify-phase.tsx # Phase 2: Classify
│   └── map-phase.tsx      # Phase 3: Map
├── hooks/
│   ├── use-column-state.ts
│   └── use-draft-persistence.ts
└── components/
    ├── column-table.tsx
    └── field-picker.tsx
```

---

#### 9. Test Infrastructure
**Why:** No tests = no confidence in refactors.

**Recommended setup:**
```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom
```

**Priority test targets:**
1. `src/lib/auth/roles.ts` - Permission logic
2. `src/lib/google/sheets.ts` - Header detection
3. API routes - Integration tests

---

#### 10. ESLint Enterprise Rules
**Why:** Enforce consistency across codebase.

```javascript
// .eslintrc.js additions
rules: {
  'no-console': ['error', { allow: ['error', 'warn'] }],
  '@typescript-eslint/explicit-function-return-type': 'warn',
  '@typescript-eslint/no-floating-promises': 'error',
  'import/order': ['error', { 'newlines-between': 'always' }],
  'react/jsx-no-leaked-render': 'error',
}
```

---

### Monitoring & Observability

| Tool | Purpose | Priority | Setup Effort |
|------|---------|----------|--------------|
| **Sentry** | Error tracking with stack traces | High | 30 min |
| **Vercel Analytics** | Core Web Vitals, performance | Medium | 5 min |
| **Upstash Redis** | Rate limiting, caching | Medium | 1 hr |
| **Axiom/Logtail** | Structured logging | Low | 1 hr |

**Sentry integration example:**
```typescript
// src/components/error-boundary.tsx
<ErrorBoundary onError={(error, info) => {
  Sentry.captureException(error, { extra: { componentStack: info.componentStack } })
}}>
```

---

### Performance Benchmarks

Track these metrics as the app scales:

| Metric | Current | Target | Tool |
|--------|---------|--------|------|
| Data sources API (GET) | ~3 queries | Maintain | Supabase logs |
| Time to Interactive | TBD | < 3s | Lighthouse |
| Largest Contentful Paint | TBD | < 2.5s | Vercel Analytics |
| API response time (p95) | TBD | < 500ms | Health endpoint |

---

## Audit History

| Date | Type | Changes |
|------|------|---------|
| 2025-01-24 | Enterprise Sweep | N+1 fix, singleton pattern, React.memo, ErrorBoundary, health endpoint, TypeScript fixes, console.log cleanup |
| 2025-01-24 | Security Audit | Open redirect fix, query injection fix, RBAC implementation |

---

## Best Practices Checklist

### Before Each PR
- [ ] No `console.log` (only `console.error` for actual errors)
- [ ] No `any` types (use `unknown` if truly unknown)
- [ ] API routes have auth checks
- [ ] New components have proper TypeScript props interface

### Before Production Deploy
- [ ] All high-priority items from this doc addressed
- [ ] SECURITY.md production checklist completed
- [ ] Health endpoint returning 200
- [ ] Error tracking (Sentry) configured

---

## Related Documentation

- **Security:** [SECURITY.md](SECURITY.md)
- **Database:** [docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md)
- **Authorization:** [docs/AUTHORIZATION.md](docs/AUTHORIZATION.md)
- **Roadmap:** [docs/ROADMAP.md](docs/ROADMAP.md)
- **Project Context:** [CLAUDE.md](CLAUDE.md)
