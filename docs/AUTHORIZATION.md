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

### Role Hierarchy

```typescript
// src/lib/auth/roles.ts
export const ROLES = {
  ADMIN: 'admin',
  POD_LEADER: 'pod_leader',
  STAFF: 'staff',
  PARTNER: 'partner', // External users
} as const

export type Role = typeof ROLES[keyof typeof ROLES]

// Permission definitions
export const PERMISSIONS = {
  // Partners
  'partners:read:all': ['admin'],
  'partners:read:assigned': ['admin', 'pod_leader', 'staff'],
  'partners:read:own': ['partner'],
  'partners:write:all': ['admin'],
  'partners:write:assigned': ['admin', 'pod_leader'],

  // Staff
  'staff:read:all': ['admin'],
  'staff:read:own': ['admin', 'pod_leader', 'staff'],
  'staff:write:all': ['admin'],
  'staff:write:own': ['admin', 'pod_leader', 'staff'],

  // Admin functions
  'admin:data-enrichment': ['admin'],
  'admin:settings': ['admin'],
} as const

export function hasPermission(userRole: Role, permission: keyof typeof PERMISSIONS): boolean {
  return PERMISSIONS[permission]?.includes(userRole) ?? false
}
```

---

## 2. API Layer Authorization

### Enhanced Auth Helper

```typescript
// src/lib/auth/api-auth.ts
import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from './config'
import { hasPermission, Role, PERMISSIONS } from './roles'

interface AuthResult {
  authenticated: true
  session: Session
  user: {
    id: string
    email: string
    role: Role
  }
}

interface AuthFailure {
  authenticated: false
  response: NextResponse
}

export async function requireAuth(): Promise<AuthResult | AuthFailure> {
  const session = await getServerSession(authOptions)

  if (!session?.user?.email) {
    return {
      authenticated: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  // Fetch user role from database
  const { data: staffUser } = await supabase
    .from('staff')
    .select('id, role')
    .eq('email', session.user.email)
    .single()

  if (!staffUser) {
    return {
      authenticated: false,
      response: NextResponse.json({ error: 'User not found' }, { status: 401 }),
    }
  }

  return {
    authenticated: true,
    session,
    user: {
      id: staffUser.id,
      email: session.user.email,
      role: staffUser.role as Role,
    },
  }
}

export async function requirePermission(
  permission: keyof typeof PERMISSIONS
): Promise<AuthResult | AuthFailure> {
  const auth = await requireAuth()
  if (!auth.authenticated) return auth

  if (!hasPermission(auth.user.role, permission)) {
    return {
      authenticated: false,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    }
  }

  return auth
}
```

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

## 4. Frontend Guards (UX Only)

### Role-Based UI Components

```typescript
// src/components/auth/require-role.tsx
'use client'

import { useSession } from 'next-auth/react'
import { useUserRole } from '@/hooks/use-user-role'
import { Role, hasPermission, PERMISSIONS } from '@/lib/auth/roles'

interface RequireRoleProps {
  roles?: Role[]
  permission?: keyof typeof PERMISSIONS
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function RequireRole({
  roles,
  permission,
  children,
  fallback = null
}: RequireRoleProps) {
  const { data: session } = useSession()
  const { role, isLoading } = useUserRole()

  if (isLoading) return null
  if (!session) return fallback

  // Check by specific roles
  if (roles && !roles.includes(role)) {
    return fallback
  }

  // Check by permission
  if (permission && !hasPermission(role, permission)) {
    return fallback
  }

  return <>{children}</>
}

// Usage in components
function Sidebar() {
  return (
    <nav>
      <Link href="/dashboard">Dashboard</Link>
      <Link href="/partners">Partners</Link>

      {/* Only admins see this */}
      <RequireRole roles={['admin']}>
        <Link href="/admin/data-enrichment">Data Enrichment</Link>
        <Link href="/admin/settings">Settings</Link>
      </RequireRole>

      {/* Pod leaders and admins */}
      <RequireRole permission="partners:write:assigned">
        <Link href="/partners/manage">Manage Partners</Link>
      </RequireRole>
    </nav>
  )
}
```

### useUserRole Hook

```typescript
// src/hooks/use-user-role.ts
import { useSession } from 'next-auth/react'
import { useQuery } from '@tanstack/react-query'
import { Role, ROLES } from '@/lib/auth/roles'

export function useUserRole() {
  const { data: session } = useSession()

  const { data, isLoading } = useQuery({
    queryKey: ['user-role', session?.user?.email],
    queryFn: async () => {
      const res = await fetch('/api/me')
      if (!res.ok) throw new Error('Failed to fetch user')
      return res.json()
    },
    enabled: !!session?.user?.email,
  })

  return {
    role: (data?.role ?? ROLES.STAFF) as Role,
    user: data,
    isLoading,
    isAdmin: data?.role === ROLES.ADMIN,
    isPodLeader: data?.role === ROLES.POD_LEADER,
  }
}
```

---

## 5. Partner Portal Architecture (Future)

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

## Summary

| Layer | What It Does | Fails Gracefully? |
|-------|-------------|-------------------|
| UI | Hides unauthorized options | Yes (just UX) |
| API | Checks permissions, returns 403 | Yes (no data leak) |
| RLS | Database-level enforcement | Yes (final defense) |

**Always implement all three layers.** Defense in depth means even if one layer has a bug, the others catch it.
