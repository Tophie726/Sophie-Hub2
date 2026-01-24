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

## Future Improvements

### Pending Tasks

| Task | Priority | Notes |
|------|----------|-------|
| Add enterprise ESLint rules | Medium | Stricter linting for code consistency |
| Centralize shared TypeScript interfaces | Medium | DRY principle for types |
| Add Zod input validation | Medium | Runtime validation on API routes |
| Smart-mapper refactor | Low | Split 2700-line file into smaller modules |

### Recommended Monitoring

| Tool | Purpose | Priority |
|------|---------|----------|
| Sentry | Error tracking | High |
| Vercel Analytics | Performance monitoring | Medium |
| Upstash | Rate limiting | Medium (for production) |

---

## Audit History

| Date | Type | Changes |
|------|------|---------|
| 2025-01-24 | Enterprise Sweep | N+1 fix, singleton pattern, React.memo, ErrorBoundary, health endpoint, TypeScript fixes, console.log cleanup |

---

## Related Documentation

- **Security:** [SECURITY.md](SECURITY.md)
- **Database:** [docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md)
- **Authorization:** [docs/AUTHORIZATION.md](docs/AUTHORIZATION.md)
- **Roadmap:** [docs/ROADMAP.md](docs/ROADMAP.md)
