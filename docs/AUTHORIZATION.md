# Authorization Architecture

## Overview

Sophie Hub has multiple user types who should only see their own data:

| Role | Access Level |
|------|-------------|
| **Admin** | Everything - all partners, all staff, all settings |
| **Pod Leader** | Their assigned partners only |
| **Staff** | Their own profile, their assigned partners |
| **Partner** (future) | Their own data only (external portal) |

This document covers how to implement secure data isolation.

---

## Implementation Status

| Layer | Status | Notes |
|-------|--------|-------|
| Roles & Permissions | ✅ Done | `src/lib/auth/roles.ts` |
| API Auth Helpers | ✅ Done | `requirePermission()`, `requireRole()`, `canAccessPartner()` |
| /api/me endpoint | ✅ Done | Returns user role and permissions |
| Admin route protection | ✅ Done | All data-enrichment routes use `requirePermission()` |
| Frontend components | ⏳ Future | `<RequireRole>`, `useUserRole` - build when needed |
| Supabase RLS | ⏳ Future | Enable when building multi-tenant features |
| Partner portal | ⏳ Future | Separate auth flow for external partners |
| Admin role management UI | ⏳ Future | UI for admins to manage user roles |

---

## The Three Layers of Defense

```
┌─────────────────────────────────────────────┐
│  1. UI Layer (Frontend)                     │
│     Hide buttons/pages user can't access    │
│     (UX only - NOT security)                │
├─────────────────────────────────────────────┤
│  2. API Layer (Backend)                     │
│     Check permissions before processing     │
│     Return 403 Forbidden if unauthorized    │
├─────────────────────────────────────────────┤
│  3. Database Layer (Supabase RLS)           │
│     Final enforcement - even if API fails   │
│     User physically cannot query other data │
└─────────────────────────────────────────────┘
```

**Golden Rule:** Never trust the frontend. Always enforce at API + Database level.

---

## 1. User Roles & Permissions

### Database Schema

```sql
-- Add role to your user/staff table
ALTER TABLE staff ADD COLUMN role TEXT DEFAULT 'staff';
-- Values: 'admin', 'pod_leader', 'staff'

-- Partner assignments (who manages whom)
CREATE TABLE partner_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID REFERENCES partners(id),
  staff_id UUID REFERENCES staff(id),
  role TEXT DEFAULT 'member', -- 'pod_leader', 'am', 'member'
  assigned_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(partner_id, staff_id)
);

-- For external partner portal (future)
CREATE TABLE partner_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID REFERENCES partners(id),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Role Hierarchy (Implemented)

```typescript
// src/lib/auth/roles.ts (ACTUAL IMPLEMENTATION)
export const ROLES = {
  ADMIN: 'admin',
  POD_LEADER: 'pod_leader',
  STAFF: 'staff',
  PARTNER: 'partner',
} as const

export type Role = typeof ROLES[keyof typeof ROLES]

// Actual permissions in use
export const PERMISSIONS = {
  // Partners
  'partners:read:all': [ROLES.ADMIN],
  'partners:read:assigned': [ROLES.ADMIN, ROLES.POD_LEADER, ROLES.STAFF],
  'partners:read:own': [ROLES.PARTNER],
  'partners:write:all': [ROLES.ADMIN],
  'partners:write:assigned': [ROLES.ADMIN, ROLES.POD_LEADER],

  // Staff
  'staff:read:all': [ROLES.ADMIN],
  'staff:read:own': [ROLES.ADMIN, ROLES.POD_LEADER, ROLES.STAFF],
  'staff:write:all': [ROLES.ADMIN],
  'staff:write:own': [ROLES.ADMIN, ROLES.POD_LEADER, ROLES.STAFF],

  // Data Enrichment (admin only)
  'data-enrichment:read': [ROLES.ADMIN],
  'data-enrichment:write': [ROLES.ADMIN],

  // Admin functions
  'admin:settings': [ROLES.ADMIN],
  'admin:users': [ROLES.ADMIN],
} as const

// Check if role has permission
export function hasPermission(role: Role | undefined, permission: Permission): boolean

// Check if role meets minimum level
export function isRoleAtLeast(role: Role | undefined, minimumRole: Role): boolean

// Get all permissions for a role
export function getPermissionsForRole(role: Role): Permission[]
```

---

## 2. API Layer Authorization (Implemented)

### Auth Helpers in `src/lib/auth/api-auth.ts`

```typescript
// ACTUAL IMPLEMENTATION

// Basic authentication - returns user with role from staff table
export async function requireAuth(): Promise<AuthResult>
// Returns: { authenticated: true, user: { id, email, name, role }, session }
// Or: { authenticated: false, response: 401 Unauthorized }

// Permission-based access - checks if user's role has permission
export async function requirePermission(permission: Permission): Promise<AuthResult>
// Returns: { authenticated: true, user: {...} }
// Or: { authenticated: false, response: 403 Forbidden }

// Role-based access - checks if user has one of the allowed roles
export async function requireRole(...roles: Role[]): Promise<AuthResult>

// Partner access check - for future multi-tenant features
export async function canAccessPartner(
  userId: string,
  userRole: Role,
  partnerId: string
): Promise<boolean>
// Admin: always true
// Pod Leader/Staff: checks partner_assignments table
// Partner: checks if partnerId matches their partner

// Role lookup with fallback
function mapRoleToAccessLevel(dbRole: string | null): Role
// Maps staff.role field to ROLES enum
// Defaults to STAFF if not found or not in staff table
```

### How Role Lookup Works

```
User logs in with Google OAuth
  ↓
requireAuth() gets session email
  ↓
Looks up email in staff table
  ↓
If found: uses staff.role field (admin, pod_leader, staff)
If not found: defaults to STAFF role
  ↓
Returns user object with role attached
```

**Note:** Users not in the staff table get STAFF role by default. Add hardcoded admin emails in `mapRoleToAccessLevel()` if needed.

### Example: Pod Leader Partners API

```typescript
// src/app/api/my-partners/route.ts
import { requireAuth } from '@/lib/auth/api-auth'
import { ROLES } from '@/lib/auth/roles'

export async function GET() {
  const auth = await requireAuth()
  if (!auth.authenticated) return auth.response

  const { user } = auth

  // Admin sees all
  if (user.role === ROLES.ADMIN) {
    const { data } = await supabase.from('partners').select('*')
    return NextResponse.json({ partners: data })
  }

  // Pod leaders & staff see only assigned partners
  const { data } = await supabase
    .from('partners')
    .select(`
      *,
      partner_assignments!inner(staff_id)
    `)
    .eq('partner_assignments.staff_id', user.id)

  return NextResponse.json({ partners: data })
}
```

### Example: Partner Portal API (Future)

```typescript
// src/app/api/portal/my-data/route.ts
export async function GET() {
  const auth = await requireAuth()
  if (!auth.authenticated) return auth.response

  // Partner users can ONLY see their own partner's data
  if (auth.user.role !== ROLES.PARTNER) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Get partner_id from partner_users table
  const { data: partnerUser } = await supabase
    .from('partner_users')
    .select('partner_id')
    .eq('email', auth.user.email)
    .single()

  if (!partnerUser) {
    return NextResponse.json({ error: 'Partner not found' }, { status: 404 })
  }

  // Fetch only this partner's data
  const { data: partner } = await supabase
    .from('partners')
    .select('*')
    .eq('id', partnerUser.partner_id)
    .single()

  return NextResponse.json({ partner })
}
```

---

## 3. Database Layer (Supabase RLS)

### Why RLS Matters

Even if your API has a bug, RLS prevents data leakage:

```typescript
// BUG: Forgot to filter by user!
const { data } = await supabase.from('partners').select('*')
// Without RLS: Returns ALL partners (data breach)
// With RLS: Returns only partners user can access (safe)
```

### Enable RLS

```sql
-- Enable RLS on all sensitive tables
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE asins ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_statuses ENABLE ROW LEVEL SECURITY;
```

### RLS Policies

```sql
-- Helper function to get current user's role
CREATE OR REPLACE FUNCTION auth.user_role()
RETURNS TEXT AS $$
  SELECT role FROM staff WHERE email = auth.jwt()->>'email'
$$ LANGUAGE SQL SECURITY DEFINER;

-- Helper function to get current user's staff ID
CREATE OR REPLACE FUNCTION auth.staff_id()
RETURNS UUID AS $$
  SELECT id FROM staff WHERE email = auth.jwt()->>'email'
$$ LANGUAGE SQL SECURITY DEFINER;

-- ============ PARTNERS TABLE ============

-- Admins can do everything
CREATE POLICY "Admins full access to partners"
ON partners FOR ALL
TO authenticated
USING (auth.user_role() = 'admin')
WITH CHECK (auth.user_role() = 'admin');

-- Pod leaders & staff can read assigned partners
CREATE POLICY "Staff read assigned partners"
ON partners FOR SELECT
TO authenticated
USING (
  auth.user_role() IN ('pod_leader', 'staff')
  AND id IN (
    SELECT partner_id FROM partner_assignments
    WHERE staff_id = auth.staff_id()
  )
);

-- Pod leaders can update assigned partners
CREATE POLICY "Pod leaders update assigned partners"
ON partners FOR UPDATE
TO authenticated
USING (
  auth.user_role() = 'pod_leader'
  AND id IN (
    SELECT partner_id FROM partner_assignments
    WHERE staff_id = auth.staff_id()
    AND role = 'pod_leader'
  )
)
WITH CHECK (
  auth.user_role() = 'pod_leader'
  AND id IN (
    SELECT partner_id FROM partner_assignments
    WHERE staff_id = auth.staff_id()
    AND role = 'pod_leader'
  )
);

-- ============ STAFF TABLE ============

-- Admins can do everything
CREATE POLICY "Admins full access to staff"
ON staff FOR ALL
TO authenticated
USING (auth.user_role() = 'admin')
WITH CHECK (auth.user_role() = 'admin');

-- Users can read their own profile
CREATE POLICY "Users read own profile"
ON staff FOR SELECT
TO authenticated
USING (email = auth.jwt()->>'email');

-- Users can update their own profile (limited fields)
CREATE POLICY "Users update own profile"
ON staff FOR UPDATE
TO authenticated
USING (email = auth.jwt()->>'email')
WITH CHECK (email = auth.jwt()->>'email');

-- ============ PARTNER PORTAL (Future) ============

-- Partner users can only see their own partner
CREATE POLICY "Partner users read own partner"
ON partners FOR SELECT
TO authenticated
USING (
  auth.user_role() = 'partner'
  AND id IN (
    SELECT partner_id FROM partner_users
    WHERE email = auth.jwt()->>'email'
  )
);
```

### Testing RLS

```sql
-- Test as a specific user
SET request.jwt.claims = '{"email": "podleader@sophiesociety.com"}';

-- This should only return their assigned partners
SELECT * FROM partners;

-- Reset
RESET request.jwt.claims;
```

---

## 4. Frontend Guards (UX Only) - PLANNED

**Status:** Not yet implemented. Build when multi-tenant features are needed.

The `/api/me` endpoint is ready and returns:
```json
{
  "id": "uuid",
  "email": "user@sophiesociety.com",
  "name": "User Name",
  "role": "admin",
  "permissions": ["data-enrichment:read", "data-enrichment:write", ...]
}
```

### Planned: RequireRole Component

```typescript
// src/components/auth/require-role.tsx (TO BUILD)
'use client'

export function RequireRole({
  roles,
  permission,
  children,
  fallback = null
}: RequireRoleProps) {
  const { role, isLoading } = useUserRole()

  if (isLoading) return null
  if (roles && !roles.includes(role)) return fallback
  if (permission && !hasPermission(role, permission)) return fallback

  return <>{children}</>
}

// Usage:
<RequireRole roles={['admin']}>
  <Link href="/admin/data-enrichment">Data Enrichment</Link>
</RequireRole>
```

### Planned: useUserRole Hook

```typescript
// src/hooks/use-user-role.ts (TO BUILD)
export function useUserRole() {
  const { data } = useQuery({
    queryKey: ['user-role'],
    queryFn: () => fetch('/api/me').then(r => r.json()),
  })

  return {
    role: data?.role ?? ROLES.STAFF,
    permissions: data?.permissions ?? [],
    isAdmin: data?.role === ROLES.ADMIN,
    isPodLeader: data?.role === ROLES.POD_LEADER,
  }
}
```

### Planned: Sidebar Visibility

| Nav Item | Visible To |
|----------|-----------|
| Dashboard | All |
| Partners (All) | Admin |
| My Partners | Pod Leader, Staff |
| Data Enrichment | Admin |
| Settings | Admin |
| User Management | Admin |
| My Dashboard | Partner |

**Remember:** Frontend hiding is UX only. API + RLS enforce actual security.

---

## 5. Partner Portal Architecture (Future)

### Automatic Access via Email Matching

The core concept: **partners get access based on the email we have on file**.

```
Partner Onboarding Flow:
1. Admin adds partner contact email to partner_users table
2. Partner receives invite/magic link
3. Partner logs in with that email
4. System automatically grants access to their partner's data

partner_users table:
| id | partner_id | email | name |
|----|------------|-------|------|
| 1  | abc-123    | john@acmebrand.com | John Smith |
| 2  | abc-123    | jane@acmebrand.com | Jane Doe |
| 3  | def-456    | bob@otherbrand.com | Bob Wilson |

When john@acmebrand.com logs in:
→ Lookup in partner_users → finds partner_id = abc-123
→ User gets PARTNER role
→ RLS ensures they can ONLY see partner abc-123's data
→ API checks partnerId matches their assigned partner
```

### Key Benefits
- **No manual access granting** - email match is automatic
- **Multiple contacts per partner** - just add more rows
- **Revoke access easily** - delete row from partner_users
- **Audit trail** - all access logged

For external partner access, use a separate auth flow:

```
┌─────────────────────────────────────────────────────────┐
│                    Sophie Hub                            │
├─────────────────────┬───────────────────────────────────┤
│   Internal App      │      Partner Portal               │
│   /dashboard        │      /portal                      │
│   /partners         │      /portal/my-brand             │
│   /admin/*          │      /portal/reports              │
├─────────────────────┼───────────────────────────────────┤
│   Google OAuth      │      Magic Link / Password        │
│   @sophiesociety    │      partner@theirbrand.com       │
├─────────────────────┴───────────────────────────────────┤
│                  Shared Database                         │
│                  (RLS enforces isolation)                │
└─────────────────────────────────────────────────────────┘
```

### Separate Auth for Partners

```typescript
// src/lib/auth/config.ts
export const authOptions: NextAuthOptions = {
  providers: [
    // Internal staff - Google OAuth
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),

    // External partners - Magic link (future)
    EmailProvider({
      server: process.env.EMAIL_SERVER,
      from: process.env.EMAIL_FROM,
      // Only allow emails in partner_users table
      async sendVerificationRequest({ identifier, url }) {
        const { data } = await supabase
          .from('partner_users')
          .select('id')
          .eq('email', identifier)
          .single()

        if (!data) {
          throw new Error('Email not authorized for partner portal')
        }

        // Send magic link email
        await sendEmail({ to: identifier, url })
      },
    }),
  ],

  callbacks: {
    async signIn({ user, account }) {
      // Google = internal staff
      if (account?.provider === 'google') {
        const domain = user.email?.split('@')[1]
        return domain === 'sophiesociety.com'
      }

      // Email = partner portal
      if (account?.provider === 'email') {
        const { data } = await supabase
          .from('partner_users')
          .select('id')
          .eq('email', user.email)
          .single()
        return !!data
      }

      return false
    },
  },
}
```

---

## 6. Common Vulnerabilities to Avoid

### IDOR (Insecure Direct Object Reference)

```typescript
// BAD - User can change partner_id in request
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const partnerId = searchParams.get('partner_id')

  // Anyone can fetch any partner!
  const { data } = await supabase
    .from('partners')
    .select('*')
    .eq('id', partnerId)

  return NextResponse.json(data)
}

// GOOD - Verify user has access
export async function GET(request: Request) {
  const auth = await requireAuth()
  if (!auth.authenticated) return auth.response

  const { searchParams } = new URL(request.url)
  const partnerId = searchParams.get('partner_id')

  // Check if user can access this partner
  const canAccess = await userCanAccessPartner(auth.user.id, partnerId)
  if (!canAccess) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data } = await supabase
    .from('partners')
    .select('*')
    .eq('id', partnerId)

  return NextResponse.json(data)
}
```

### Mass Assignment

```typescript
// BAD - User can set any field including 'role'
export async function PATCH(request: Request) {
  const body = await request.json()

  await supabase
    .from('staff')
    .update(body) // User sends { role: 'admin' } 😱
    .eq('id', userId)
}

// GOOD - Whitelist allowed fields
export async function PATCH(request: Request) {
  const body = await request.json()

  // Only allow these fields to be updated
  const allowedFields = ['name', 'phone', 'timezone']
  const updates = Object.fromEntries(
    Object.entries(body).filter(([key]) => allowedFields.includes(key))
  )

  await supabase
    .from('staff')
    .update(updates)
    .eq('id', userId)
}
```

### Privilege Escalation

```typescript
// BAD - No check if user can assign this role
export async function POST(request: Request) {
  const { staffId, partnerId, role } = await request.json()

  await supabase
    .from('partner_assignments')
    .insert({ staff_id: staffId, partner_id: partnerId, role })
}

// GOOD - Only admins can assign pod leaders
export async function POST(request: Request) {
  const auth = await requirePermission('admin:settings')
  if (!auth.authenticated) return auth.response

  const { staffId, partnerId, role } = await request.json()

  // Validate role value
  if (!['pod_leader', 'am', 'member'].includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  await supabase
    .from('partner_assignments')
    .insert({ staff_id: staffId, partner_id: partnerId, role })
}
```

---

## 7. Testing Authorization

### Unit Tests

```typescript
// __tests__/auth/permissions.test.ts
import { hasPermission, ROLES } from '@/lib/auth/roles'

describe('Permissions', () => {
  test('admin has all permissions', () => {
    expect(hasPermission(ROLES.ADMIN, 'partners:read:all')).toBe(true)
    expect(hasPermission(ROLES.ADMIN, 'admin:settings')).toBe(true)
  })

  test('pod leader cannot access admin settings', () => {
    expect(hasPermission(ROLES.POD_LEADER, 'admin:settings')).toBe(false)
  })

  test('staff can only read assigned partners', () => {
    expect(hasPermission(ROLES.STAFF, 'partners:read:assigned')).toBe(true)
    expect(hasPermission(ROLES.STAFF, 'partners:read:all')).toBe(false)
  })
})
```

### Integration Tests

```typescript
// __tests__/api/partners.test.ts
describe('GET /api/partners', () => {
  test('returns 401 without auth', async () => {
    const res = await fetch('/api/partners')
    expect(res.status).toBe(401)
  })

  test('admin sees all partners', async () => {
    const res = await fetchAs('admin@sophiesociety.com', '/api/partners')
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.partners.length).toBeGreaterThan(10)
  })

  test('pod leader sees only assigned partners', async () => {
    const res = await fetchAs('podleader@sophiesociety.com', '/api/partners')
    expect(res.status).toBe(200)
    const data = await res.json()
    // Should only see their 5 assigned partners
    expect(data.partners.length).toBe(5)
  })
})
```

---

---

## 8. Admin Role Management UI (Future)

Admins need a UI to manage who can do what.

### User Management Page (`/admin/users`)

**Features needed:**
- List all staff with their current roles
- Change user roles (admin, pod_leader, staff)
- View partner assignments per staff
- Add/remove partner assignments
- Add partner portal users (partner_users table)

### Security Considerations

```typescript
// Prevent self-demotion (lockout prevention)
if (targetUserId === currentUser.id && newRole !== 'admin') {
  return { error: "Cannot demote yourself" }
}

// Require at least one admin
const adminCount = await countAdminsExcluding(targetUserId)
if (adminCount === 0 && currentRole === 'admin') {
  return { error: "Cannot remove the last admin" }
}

// Audit log all role changes
await logAuditEvent({
  action: 'role_change',
  targetUser: targetUserId,
  oldRole: currentRole,
  newRole: newRole,
  changedBy: currentUser.id,
})
```

### Partner User Management

For adding partner portal users:

```typescript
// Admin adds partner contact
POST /api/admin/partner-users
{
  partner_id: "abc-123",
  email: "contact@thebrand.com",
  name: "Brand Contact"
}

// This person can now log in and see their partner's data
// No role assignment needed - email match handles it
```

---

## Summary

| Layer | What It Does | Fails Gracefully? |
|-------|-------------|-------------------|
| UI | Hides unauthorized options | Yes (just UX) |
| API | Checks permissions, returns 403 | Yes (no data leak) |
| RLS | Database-level enforcement | Yes (final defense) |

**Always implement all three layers.** Defense in depth means even if one layer has a bug, the others catch it.

---

## Implementation Checklist

When building multi-tenant features, follow this order:

1. ✅ **Define roles and permissions** - `src/lib/auth/roles.ts`
2. ✅ **Create API auth helpers** - `src/lib/auth/api-auth.ts`
3. ✅ **Create /api/me endpoint** - returns user info for frontend
4. ✅ **Protect admin routes** - use `requirePermission()`
5. ⏳ **Build frontend components** - `<RequireRole>`, `useUserRole`
6. ⏳ **Add sidebar role filtering** - hide nav items by role
7. ⏳ **Enable Supabase RLS** - policies per table
8. ⏳ **Build admin user management UI** - `/admin/users`
9. ⏳ **Build partner portal** - separate auth, email matching
